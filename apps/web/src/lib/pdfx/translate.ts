import OpenAI from 'openai';
import { env } from '@/lib/config/env';
import { sanitizeExtractedText } from './extract';

let openAiClient: OpenAI | undefined;
const DEFAULT_CHUNK_CHARACTERS = 6_000;
const MIN_RETRY_CHUNK_CHARACTERS = 500;
const RESPONSE_START = '[[PDFX_TRANSLATION_START]]';
const RESPONSE_END = '[[PDFX_TRANSLATION_END]]';

export interface TranslationCompletion {
  text: string;
  finishReason: string | null;
}

export type TranslationRequester = (
  text: string,
  targetLang: string,
) => Promise<TranslationCompletion>;

export interface TranslationChunk {
  text: string;
  separatorAfter: string;
}

interface TranslationOptions {
  maxChunkCharacters?: number;
  request?: TranslationRequester;
  attemptsPerChunk?: number;
}

export class TranslationIncompleteError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TranslationIncompleteError';
  }
}

function cleanTranslation(text: string): string {
  let output = sanitizeExtractedText(text);
  output = output.replace(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/m, '$1').trim();
  output = output
    .replace(/^(here is (the )?translation:?|translation:)\s*/i, '')
    .trim();
  return output;
}

function normalizeSeparator(value: string): string {
  if (/\n\s*\n/.test(value)) return '\n\n';
  if (value.includes('\n')) return '\n';
  return value ? ' ' : '';
}

function safeCharacterBoundary(text: string, index: number): number {
  if (
    index > 0 &&
    index < text.length &&
    /[\ud800-\udbff]/.test(text[index - 1]) &&
    /[\udc00-\udfff]/.test(text[index])
  ) {
    return index - 1;
  }
  return index;
}

function findChunkBoundary(text: string, start: number, maximumEnd: number): number {
  const minimumUsefulEnd = start + Math.floor((maximumEnd - start) * 0.55);
  const window = text.slice(start, maximumEnd);
  const boundaries = [
    window.lastIndexOf('\n\n'),
    window.lastIndexOf('\n'),
    Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
      window.lastIndexOf('؟ '),
      window.lastIndexOf('。'),
    ),
    window.lastIndexOf(' '),
  ];

  for (const relative of boundaries) {
    if (relative >= minimumUsefulEnd - start) {
      const includesPunctuation = /[.!?؟。]/.test(text[start + relative] || '');
      return safeCharacterBoundary(text, start + relative + (includesPunctuation ? 1 : 0));
    }
  }
  return safeCharacterBoundary(text, maximumEnd);
}

/**
 * Split large pages at paragraph/line/sentence boundaries while retaining the
 * separator used to join translated chunks back together.
 */
export function chunkTextForTranslation(
  source: string,
  maxCharacters = DEFAULT_CHUNK_CHARACTERS,
): TranslationChunk[] {
  const text = sanitizeExtractedText(source);
  if (!text) return [];
  const limit = Math.max(32, Math.floor(maxCharacters));
  const chunks: TranslationChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const maximumEnd = Math.min(text.length, start + limit);
    let contentEnd = maximumEnd === text.length
      ? maximumEnd
      : findChunkBoundary(text, start, maximumEnd);
    if (contentEnd <= start) contentEnd = maximumEnd;

    let nextStart = contentEnd;
    while (nextStart < text.length && /\s/.test(text[nextStart])) nextStart += 1;
    const chunkText = text.slice(start, contentEnd).trim();
    if (chunkText) {
      chunks.push({
        text: chunkText,
        separatorAfter: normalizeSeparator(text.slice(contentEnd, nextStart)),
      });
    }
    start = nextStart;
  }

  if (chunks.length > 0) chunks[chunks.length - 1].separatorAfter = '';
  return chunks;
}

async function requestTranslation(
  text: string,
  targetLang: string,
): Promise<TranslationCompletion> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for PDF translation');
  }
  openAiClient ??= new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openAiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 4_000,
    messages: [
      {
        role: 'system',
        content:
          `You are a professional translator to ${targetLang}. ` +
          'Translate all supplied text without omission. Preserve line breaks and paragraph structure. ' +
          `Return exactly ${RESPONSE_START}, the translated text, then ${RESPONSE_END}. ` +
          'Keep both markers verbatim and do not add commentary or headings.',
      },
      { role: 'user', content: text },
    ],
  });

  return {
    text: response.choices[0]?.message?.content || '',
    finishReason: response.choices[0]?.finish_reason ?? null,
  };
}

function parseCompleteTranslation(completion: TranslationCompletion): string | null {
  if (completion.finishReason !== 'stop') return null;
  const raw = completion.text || '';
  const start = raw.indexOf(RESPONSE_START);
  const end = raw.lastIndexOf(RESPONSE_END);
  if (start < 0 || end < start + RESPONSE_START.length) return null;
  const trailing = raw.slice(end + RESPONSE_END.length).trim();
  if (trailing) return null;
  return cleanTranslation(raw.slice(start + RESPONSE_START.length, end));
}

function splitForRetry(source: string): TranslationChunk[] {
  const retryLimit = Math.max(MIN_RETRY_CHUNK_CHARACTERS, Math.ceil(source.length / 2));
  const chunks = chunkTextForTranslation(source, retryLimit);
  if (chunks.length > 1) return chunks;

  const middle = safeCharacterBoundary(source, Math.ceil(source.length / 2));
  return [
    { text: source.slice(0, middle), separatorAfter: '' },
    { text: source.slice(middle), separatorAfter: '' },
  ].filter((chunk) => Boolean(chunk.text));
}

async function translateChunk(
  source: string,
  targetLang: string,
  request: TranslationRequester,
  attemptsPerChunk: number,
  depth = 0,
): Promise<string> {
  let lastError: unknown;
  let lastFinishReason: string | null = null;

  for (let attempt = 0; attempt < attemptsPerChunk; attempt += 1) {
    try {
      const completion = await request(source, targetLang);
      lastFinishReason = completion.finishReason;
      const translated = parseCompleteTranslation(completion);
      if (translated !== null) return translated;
      if (completion.finishReason === 'content_filter') break;
      if (completion.finishReason === 'length') break;
    } catch (error) {
      lastError = error;
    }
  }

  if (source.length > MIN_RETRY_CHUNK_CHARACTERS && depth < 6) {
    const smallerChunks = splitForRetry(source);
    if (smallerChunks.length > 1) {
      let translated = '';
      for (const chunk of smallerChunks) {
        translated += await translateChunk(
          chunk.text,
          targetLang,
          request,
          attemptsPerChunk,
          depth + 1,
        );
        translated += chunk.separatorAfter;
      }
      return translated;
    }
  }

  const reason = lastFinishReason
    ? `model finish reason was ${lastFinishReason}`
    : 'the model response was incomplete';
  throw new TranslationIncompleteError(
    `Translation could not be completed safely because ${reason}`,
    lastError ? { cause: lastError } : undefined,
  );
}

export async function translatePage(
  text: string,
  targetLang: string,
  options: TranslationOptions = {},
): Promise<string> {
  const source = sanitizeExtractedText(text);
  if (!source) return '';

  const chunks = chunkTextForTranslation(
    source,
    options.maxChunkCharacters ?? DEFAULT_CHUNK_CHARACTERS,
  );
  const request = options.request ?? requestTranslation;
  const attempts = Math.max(1, Math.min(options.attemptsPerChunk ?? 2, 3));
  let translated = '';

  for (const chunk of chunks) {
    translated += await translateChunk(chunk.text, targetLang, request, attempts);
    translated += chunk.separatorAfter;
  }

  return cleanTranslation(translated);
}
