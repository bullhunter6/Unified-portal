declare module 'bidi-js' {
  export type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  };

  export type Bidi = {
    getEmbeddingLevels(text: string, direction?: 'ltr' | 'rtl'): EmbeddingLevels;
    getMirroredCharactersMap(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Map<number, string>;
    getReorderSegments(
      text: string,
      embedding: EmbeddingLevels,
      start?: number,
      end?: number,
    ): Array<[number, number]>;
  };

  export default function bidiFactory(): Bidi;
}
