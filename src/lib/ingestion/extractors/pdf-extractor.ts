// @ts-expect-error pdf-parse CJS module default export
import pdfParse from 'pdf-parse';
import { DocumentExtractor, ExtractedDocument, ExtractedPage } from './index';

export class PdfExtractor implements DocumentExtractor {
  supportedMimes(): string[] {
    return ['application/pdf'];
  }

  async extract(buffer: Buffer, fileName: string): Promise<ExtractedDocument> {
    const pageTexts: ExtractedPage[] = [];
    let currentPage = 1;

    // Custom pager render callback in pdf-parse to track page numbers
    const renderPage = (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
      return pageData.getTextContent().then((textContent) => {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }

        pageTexts.push({
          pageNumber: currentPage,
          text: text.trim(),
        });
        currentPage++;
        return text;
      });
    };

    let title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let fullText = '';
    let pageCount = 1;

    try {
      const data = await pdfParse(buffer, { pagerender: renderPage });
      pageCount = data.numpages || pageTexts.length || 1;
      fullText = data.text || '';
      if (data.info?.Title && data.info.Title.trim().length > 2) {
        title = data.info.Title.trim();
      }
    } catch {
      // Fallback if custom pagerender fails on unusual PDF structures
      const fallbackData = await pdfParse(buffer);
      pageCount = fallbackData.numpages || 1;
      fullText = fallbackData.text || '';
      
      // Approximate pages by form-feed characters (\x0C) or equal chunking
      const rawPages = fullText.split(/\x0C/);
      if (rawPages.length > 1) {
        rawPages.forEach((txt, idx) => {
          if (txt.trim()) {
            pageTexts.push({
              pageNumber: idx + 1,
              text: txt.trim(),
            });
          }
        });
      } else {
        pageTexts.push({
          pageNumber: 1,
          text: fullText.trim(),
        });
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
