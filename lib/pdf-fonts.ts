import { PDFDocument } from "pdf-lib";
import { Buffer } from "buffer";

const PDF_FONT_REGULAR_PATH = "public/fonts/RobotoCondensed-Regular.ttf";

const pdfFontByteCache = new Map<string, Uint8Array>();

async function readFontBytes(relativePath: string): Promise<Uint8Array> {
  const cached = pdfFontByteCache.get(relativePath);
  if (cached) return cached;
  const [{ readFile }, path] = await Promise.all([
    import("fs/promises"),
    import("path"),
  ]);
  const absolutePath = path.join(process.cwd(), relativePath);
  const fileData = (await readFile(absolutePath)) as unknown as
    | Uint8Array
    | string
    | ArrayBuffer;
  let bytes: Uint8Array;
  if (fileData instanceof Uint8Array) {
    bytes = new Uint8Array(fileData);
  } else if (typeof fileData === "string") {
    bytes = new Uint8Array(Buffer.from(fileData, "utf8"));
  } else {
    bytes = new Uint8Array(fileData as ArrayBuffer);
  }
  pdfFontByteCache.set(relativePath, bytes);
  return bytes;
}

export async function loadPdfFonts(pdfDoc: PDFDocument): Promise<{
  font: import("pdf-lib").PDFFont;
  fontBold: import("pdf-lib").PDFFont;
}> {
  try {
    const fontkitModule = await import("@pdf-lib/fontkit");
    const moduleWithDefault = fontkitModule as { default?: unknown };
    const fontkit = moduleWithDefault.default ?? fontkitModule;
    const docWithFontkit = pdfDoc as PDFDocument & {
      registerFontkit?: (fontkit: unknown) => void;
    };
    if (typeof docWithFontkit.registerFontkit === "function") {
      docWithFontkit.registerFontkit(fontkit);
    }
    const regularBytes = await readFontBytes(PDF_FONT_REGULAR_PATH);
    const baseFont = await pdfDoc.embedFont(regularBytes, { subset: true });
    return { font: baseFont, fontBold: baseFont };
  } catch (error) {
    console.error(
      "Nu am putut încărca fonturile PDF necesare pentru diacritice.",
      error
    );
    throw new Error(
      "Fonturile necesare pentru generarea PDF-ului nu sunt disponibile. Verificați fișierul RobotoCondensed-Regular.ttf din public/fonts și instalați @pdf-lib/fontkit."
    );
  }
}
