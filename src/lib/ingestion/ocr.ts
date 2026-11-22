// src/lib/ingestion/ocr.ts
// DocMate AI - Native OCR Processing Engine (Cocoa PDFKit + Tesseract)

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

// Path to temporary JXA renderer script
const JXA_RENDER_SCRIPT_PATH = '/private/tmp/docmate_pdf_page_renderer.js';

const JXA_RENDER_SCRIPT = `
ObjC.import("PDFKit");
ObjC.import("Foundation");
ObjC.import("AppKit");

function run(argv) {
  var pdfPath = argv[0];
  var pageIndex = parseInt(argv[1], 10);
  var outImg = argv[2];

  var doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(pdfPath));
  if (!doc) return 0;

  if (pageIndex === -1) {
    return doc.pageCount;
  }

  if (pageIndex >= doc.pageCount) return "ERROR_OUT_OF_BOUNDS";

  var page = doc.pageAtIndex(pageIndex);
  var bounds = page.boundsForBox($.kPDFDisplayBoxMediaBox);
  var scale = 1.5;
  var width = bounds.size.width * scale;
  var height = bounds.size.height * scale;

  var image = $.NSImage.alloc.initWithSize($.NSMakeSize(width, height));
  image.lockFocus;
  var context = $.NSGraphicsContext.currentContext.CGContext;
  $.CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 1.0);
  $.CGContextFillRect(context, $.CGRectMake(0, 0, width, height));
  $.CGContextScaleCTM(context, scale, scale);
  page.drawWithBoxToContext($.kPDFDisplayBoxMediaBox, context);
  image.unlockFocus;

  var tiffData = image.TIFFRepresentation;
  var imageRep = $.NSBitmapImageRep.imageRepsWithData(tiffData).objectAtIndex(0);
  var pngData = imageRep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
  pngData.writeToFileAtomically(outImg, true);
  return "OK";
}
`;

function ensureJxaScript() {
  fs.writeFileSync(JXA_RENDER_SCRIPT_PATH, JXA_RENDER_SCRIPT, 'utf-8');
}

/**
 * Checks whether Tesseract OCR is available on the host system.
 */
export async function isTesseractAvailable(): Promise<boolean> {
  try {
    await execAsync('which tesseract');
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs OCR on a PDF buffer using native Cocoa PDFKit page rendering and Tesseract.
 */
export async function runOcrOnPdfBuffer(
  pdfBuffer: Buffer,
  options: {
    jobId?: string;
    maxPages?: number;
    onProgress?: (currentPage: number, totalPages: number) => Promise<void>;
  } = {}
): Promise<Array<{ pageNumber: number; text: string }>> {
  ensureJxaScript();

  const tempPdfPath = `/private/tmp/docmate_ocr_input_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.pdf`;
  fs.writeFileSync(tempPdfPath, pdfBuffer);

  const results: Array<{ pageNumber: number; text: string }> = [];

  try {
    // Determine page count via JXA
    const { stdout: pageCountOut } = await execAsync(
      `osascript -l JavaScript ${JXA_RENDER_SCRIPT_PATH} "${tempPdfPath}" -1 dummy`
    );
    const totalPages = parseInt(pageCountOut.trim(), 10) || 1;
    const pagesToProcess = options.maxPages ? Math.min(totalPages, options.maxPages) : totalPages;

    for (let p = 0; p < pagesToProcess; p++) {
      const tempImgPath = `/private/tmp/docmate_ocr_page_${Date.now()}_${p}.png`;
      try {
        await execAsync(`osascript -l JavaScript ${JXA_RENDER_SCRIPT_PATH} "${tempPdfPath}" ${p} "${tempImgPath}"`);

        if (fs.existsSync(tempImgPath)) {
          const { stdout: ocrText } = await execAsync(
            `tesseract "${tempImgPath}" stdout -l eng+ben --oem 1`,
            { encoding: 'utf8' }
          );
          results.push({
            pageNumber: p + 1,
            text: ocrText.trim(),
          });
        }
      } catch (err) {
        console.warn(`[OCR] Warning: Failed to OCR page ${p + 1}:`, err);
        results.push({ pageNumber: p + 1, text: '' });
      } finally {
        try {
          if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);
        } catch {
          // ignore cleanup errors
        }
      }

      if (options.onProgress) {
        await options.onProgress(p + 1, pagesToProcess);
      }
    }
  } finally {
    try {
      if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
    } catch {
      // ignore cleanup errors
    }
  }

  return results;
}
