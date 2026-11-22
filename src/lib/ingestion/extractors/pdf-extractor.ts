import * as pdfParseModule from 'pdf-parse';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

export class PdfExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['application/pdf'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    const pageTexts: ExtractedPage[] = [];
    let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let fullText = '';
    let pageCount = 1;

    // Support both modern pdf-parse v2 (class PDFParse) and legacy v1 (function)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = pdfParseModule as any;
    const PDFParseClass = mod.PDFParse || mod.default?.PDFParse;

    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass(new Uint8Array(buffer));
      try {
        const infoResult = await parser.getInfo().catch(() => null);
        if (infoResult?.info?.Title && String(infoResult.info.Title).trim().length > 2) {
          title = String(infoResult.info.Title).trim();
        }

        const textResult = await parser.getText().catch(() => null);
        if (textResult) {
          pageCount = textResult.total || (textResult.pages ? textResult.pages.length : 1);
          fullText = textResult.text || '';

          if (Array.isArray(textResult.pages) && textResult.pages.length > 0) {
            for (const p of textResult.pages) {
              pageTexts.push({
                pageNumber: p.num || pageTexts.length + 1,
                text: (p.text || '').trim(),
              });
            }
          }
        }
      } finally {
        await parser.destroy().catch(() => {});
      }
    } else {
      // Legacy pdf-parse v1 function fallback
      const parseFn = typeof mod === 'function' ? mod : mod.default;
      if (typeof parseFn === 'function') {
        try {
          const data = await parseFn(buffer);
          pageCount = data.numpages || 1;
          fullText = data.text || '';
          if (data.info?.Title && data.info.Title.trim().length > 2) {
            title = data.info.Title.trim();
          }
          const rawPages = fullText.split(/\x0C/);
          if (rawPages.length > 1) {
            rawPages.forEach((txt: string, idx: number) => {
              if (txt.trim()) {
                pageTexts.push({
                  pageNumber: idx + 1,
                  text: txt.trim(),
                });
              }
            });
          }
        } catch {
          // ignore fallback error
        }
      }
    }

    return {
      title,
      authors: [],
      year: new Date().getFullYear(),
      pageCount,
      pages: pageTexts.length > 0 ? pageTexts : [{ pageNumber: 1, text: fullText.trim() }],
      fullText,
      mime: 'application/pdf',
      sourceType: 'guideline',
      license: 'Open Access / Academic Use',
      evidenceLevel: 'Ia',
    };
  }
}
