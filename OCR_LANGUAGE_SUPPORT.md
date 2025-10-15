# OCR Language Support Guide

## Overview

The PDF Translator uses **Tesseract OCR** through `ocrmypdf` to extract text from scanned/image-based PDFs. Tesseract supports **100+ languages**.

---

## Currently Configured Languages

The system is configured to automatically detect and extract text from documents in these languages:

| Language | Code | Script |
|----------|------|--------|
| English | `eng` | Latin |
| Arabic | `ara` | Arabic |
| Chinese (Simplified) | `chi_sim` | Chinese |
| Chinese (Traditional) | `chi_tra` | Chinese |
| Russian | `rus` | Cyrillic |
| Spanish | `spa` | Latin |
| French | `fra` | Latin |
| German | `deu` | Latin |
| Japanese | `jpn` | Japanese |
| Korean | `kor` | Hangul |
| Italian | `ita` | Latin |
| Portuguese | `por` | Latin |
| Turkish | `tur` | Latin |
| Vietnamese | `vie` | Latin |
| Hindi | `hin` | Devanagari |
| Uzbek (Latin) | `uzb` | Latin |
| Uzbek (Cyrillic) | `uzb_cyrl` | Cyrillic |

---

## How Multi-Language OCR Works

1. **Automatic Detection**: Tesseract automatically detects which language(s) are present in the document
2. **Multi-Script Support**: Can handle documents with mixed languages (e.g., English + Arabic)
3. **Fallback**: If a language isn't recognized, Tesseract will attempt to extract whatever text it can

---

## Adding Additional Languages

### On Ubuntu Server (EC2)

#### 1. Find Available Languages
```bash
# Search for available language packs
apt-cache search tesseract-ocr- | grep "^tesseract-ocr-"
```

#### 2. Install Language Pack
```bash
# Example: Install Thai language support
sudo apt install -y tesseract-ocr-tha

# Example: Install multiple languages
sudo apt install -y tesseract-ocr-pol tesseract-ocr-nld tesseract-ocr-swe
```

#### 3. Verify Installation
```bash
tesseract --list-langs
```

#### 4. Update Code
Edit `apps/web/src/lib/pdfx/extract.ts` (around line 130):

```typescript
const languages = [
  'eng',        // English
  'ara',        // Arabic
  // ... existing languages ...
  'tha',        // Thai (NEW)
  'pol',        // Polish (NEW)
  'nld',        // Dutch (NEW)
].join('+');
```

#### 5. Rebuild and Deploy
```bash
cd /var/www/portal-v1.0.3
cd apps/web && pnpm build && cd ../..
pm2 restart portal-v1.0.3
```

### On Windows (Local Development)

#### 1. Install Tesseract for Windows
Download from: https://github.com/UB-Mannheim/tesseract/wiki

#### 2. Install Language Data Files
- Download language `.traineddata` files from: https://github.com/tesseract-ocr/tessdata
- Place in: `C:\Program Files\Tesseract-OCR\tessdata\`

#### 3. Verify
```powershell
tesseract --list-langs
```

---

## Complete Language List

### European Languages
| Language | Code | Language | Code |
|----------|------|----------|------|
| Albanian | `sqi` | Latvian | `lav` |
| Basque | `eus` | Lithuanian | `lit` |
| Belarusian | `bel` | Macedonian | `mkd` |
| Bosnian | `bos` | Maltese | `mlt` |
| Bulgarian | `bul` | Norwegian | `nor` |
| Catalan | `cat` | Polish | `pol` |
| Croatian | `hrv` | Romanian | `ron` |
| Czech | `ces` | Serbian | `srp` |
| Danish | `dan` | Slovak | `slk` |
| Dutch | `nld` | Slovenian | `slv` |
| Estonian | `est` | Swedish | `swe` |
| Finnish | `fin` | Ukrainian | `ukr` |
| Greek | `ell` | Welsh | `cym` |
| Hungarian | `hun` | | |
| Icelandic | `isl` | | |
| Irish | `gle` | | |

### Asian Languages
| Language | Code | Language | Code |
|----------|------|----------|------|
| Bengali | `ben` | Nepali | `nep` |
| Burmese | `mya` | Oriya | `ori` |
| Khmer | `khm` | Punjabi | `pan` |
| Lao | `lao` | Sinhala | `sin` |
| Malayalam | `mal` | Tamil | `tam` |
| Marathi | `mar` | Telugu | `tel` |
| Mongolian | `mon` | Thai | `tha` |

### Middle Eastern Languages
| Language | Code | Language | Code |
|----------|------|----------|------|
| Amharic | `amh` | Persian | `fas` |
| Armenian | `hye` | Pashto | `pus` |
| Azerbaijani | `aze` | Tigrinya | `tir` |
| Georgian | `kat` | Urdu | `urd` |
| Hebrew | `heb` | Yiddish | `yid` |
| Kurdish | `kur` | | |

### African Languages
| Language | Code | Language | Code |
|----------|------|----------|------|
| Afrikaans | `afr` | Swahili | `swa` |

### Other Languages
| Language | Code | Language | Code |
|----------|------|----------|------|
| Esperanto | `epo` | Indonesian | `ind` |
| Filipino | `fil` | Malay | `msa` |

---

## Installation Commands by Region

### All European Languages
```bash
sudo apt install -y \
  tesseract-ocr-sqi tesseract-ocr-eus tesseract-ocr-bel \
  tesseract-ocr-bos tesseract-ocr-bul tesseract-ocr-cat \
  tesseract-ocr-hrv tesseract-ocr-ces tesseract-ocr-dan \
  tesseract-ocr-nld tesseract-ocr-est tesseract-ocr-fin \
  tesseract-ocr-ell tesseract-ocr-hun tesseract-ocr-isl \
  tesseract-ocr-gle tesseract-ocr-lav tesseract-ocr-lit \
  tesseract-ocr-mkd tesseract-ocr-mlt tesseract-ocr-nor \
  tesseract-ocr-pol tesseract-ocr-ron tesseract-ocr-srp \
  tesseract-ocr-slk tesseract-ocr-slv tesseract-ocr-swe \
  tesseract-ocr-ukr tesseract-ocr-cym
```

### All Asian Languages
```bash
sudo apt install -y \
  tesseract-ocr-ben tesseract-ocr-mya tesseract-ocr-khm \
  tesseract-ocr-lao tesseract-ocr-mal tesseract-ocr-mar \
  tesseract-ocr-mon tesseract-ocr-nep tesseract-ocr-ori \
  tesseract-ocr-pan tesseract-ocr-sin tesseract-ocr-tam \
  tesseract-ocr-tel tesseract-ocr-tha
```

### All Middle Eastern Languages
```bash
sudo apt install -y \
  tesseract-ocr-amh tesseract-ocr-hye tesseract-ocr-aze \
  tesseract-ocr-kat tesseract-ocr-heb tesseract-ocr-kur \
  tesseract-ocr-fas tesseract-ocr-pus tesseract-ocr-tir \
  tesseract-ocr-urd tesseract-ocr-yid
```

### Install EVERYTHING (100+ languages)
```bash
sudo apt install -y tesseract-ocr-all
```
**Warning**: This requires ~2GB disk space and takes 10-15 minutes.

---

## Performance Considerations

### Language Detection Overhead
- **More languages = Slightly slower OCR**: Each additional language increases processing time by ~1-5%
- **Recommendation**: Use only the languages you actually need

### Optimal Configuration
For global business documents, the default 17 languages provide excellent coverage with minimal overhead:
- Covers ~80% of global business documents
- Processing time: ~2-5 seconds per page
- Disk space: ~500MB

### If You Need Everything
If you process documents in many rare languages:
```bash
sudo apt install -y tesseract-ocr-all
```
Then update `extract.ts` to use all languages:
```typescript
// Use ALL installed languages (automatically detected)
'-l', 'eng+ara+chi_sim+chi_tra+...'  // or use tesseract's auto-detection
```

Or let Tesseract auto-detect:
```typescript
// Remove the -l flag entirely to auto-detect language
const args = [
  src,
  path.join(workDir, `ocr_${pageNumber}.pdf`),
  '--sidecar',
  sidecarTxt,
  '--jobs',
  '1',
  // No -l flag = auto-detect language
  '--rotate-pages',
  '--deskew',
];
```

---

## Testing Language Support

### Test OCR for a Specific Language
```bash
# Download a test PDF in your target language
cd /tmp

# Run OCR with specific language
ocrmypdf -l ara input.pdf output.pdf --sidecar output.txt

# Check extracted text
cat output.txt
```

### Test Multiple Languages
```bash
# Document with English + Arabic + Chinese
ocrmypdf -l eng+ara+chi_sim input.pdf output.pdf --sidecar output.txt
```

---

## Troubleshooting

### Error: "Language not found"
```
Error: Tesseract language 'xxx' is not available
```

**Solution:**
```bash
# Install the missing language
sudo apt install -y tesseract-ocr-xxx

# Verify
tesseract --list-langs | grep xxx
```

### Poor OCR Quality
1. **Wrong language selected**: Make sure the language pack is installed
2. **Low image quality**: Try scanning at higher DPI (300+ recommended)
3. **Skewed/rotated pages**: The `--rotate-pages` and `--deskew` flags help with this

### OCR Taking Too Long
1. **Too many languages**: Reduce the language list to only what you need
2. **Large PDFs**: Break into chunks or process pages in parallel
3. **Low-powered server**: Increase EC2 instance size

---

## Best Practices

1. **Install only needed languages** to optimize performance
2. **Use language codes consistently** (e.g., `chi_sim` not `chi-sim`)
3. **Test with sample documents** in your target languages
4. **Monitor disk space** when installing many language packs
5. **Update language packs periodically** for improved accuracy

---

## References

- **Tesseract Documentation**: https://tesseract-ocr.github.io/
- **Language Data Files**: https://github.com/tesseract-ocr/tessdata
- **OCRmyPDF Documentation**: https://ocrmypdf.readthedocs.io/
- **Language Codes (ISO 639-2)**: https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes

---

**Last Updated**: October 15, 2025  
**Current Languages**: 17 (covering major global languages)  
**Installation Size**: ~500MB for configured languages
