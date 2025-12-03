import { PDFDocument, PDFName, PDFString, rgb } from "pdf-lib";
import { loadPdfFonts } from "@/lib/pdf-fonts";
import {
  WrittenContractDraftSchema,
  type WrittenContractDraft,
} from "@/lib/schemas/written-contract";

const PAGE_WIDTH = 595.28; // A4 width (points)
const PAGE_HEIGHT = 841.89; // A4 height (points)
const MARGIN = 64;
const BODY_FONT_SIZE = 12;
const BODY_LEADING = 18;
const BODY_SPACING_AFTER = 12;

type RichToken = {
  text: string;
  bold: boolean;
  break?: boolean;
};

type Segment = {
  text: string;
  bold: boolean;
};

type ParagraphOptions = {
  size?: number;
  leading?: number;
  spacingAfter?: number;
  align?: "left" | "center" | "right";
  indent?: number;
  firstLineIndent?: number;
  spacingBefore?: number;
  bullet?: boolean;
  bulletIndent?: number;
  bulletGap?: number;
};

type ParagraphKind = "heading" | "subheading" | "list" | "body";

type ParsedParagraph = {
  tokens: RichToken[];
  kind: ParagraphKind;
};

function decodeEntities(value: string): string {
  const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    bdquo: "„",
    ldquo: "“",
    rdquo: "”",
    lsquo: "‘",
    rsquo: "’",
    hellip: "…",
    ndash: "–",
    mdash: "—",
    laquo: "«",
    raquo: "»",
    icirc: "î",
    Icirc: "Î",
    acirc: "â",
    Acirc: "Â",
    abreve: "ă",
    Abreve: "Ă",
    scedil: "ș",
    Scedil: "Ș",
    tcedil: "ț",
    Tcedil: "Ț",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (!entity) return match;
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const raw = isHex ? entity.slice(2) : entity.slice(1);
      const base = isHex ? 16 : 10;
      const parsed = Number.parseInt(raw, base);
      return Number.isNaN(parsed) ? "" : String.fromCharCode(parsed);
    }
    const replacement =
      NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()];
    return replacement ?? match;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function normalizeText(value: string): string {
  if (!value) return "";
  const hasLeading = /^\s/.test(value);
  const hasTrailing = /\s$/.test(value);
  const collapsed = value.replace(/\s+/g, " ");
  const trimmed = collapsed.trim();

  if (!trimmed) {
    return hasLeading || hasTrailing ? " " : "";
  }

  if (trimmed.startsWith("•")) {
    const rest = trimmed.slice(1).trim();
    let bullet = rest ? `• ${rest}` : "•";
    if (hasLeading) {
      bullet = ` ${bullet}`;
    }
    if (hasTrailing) {
      bullet = `${bullet} `;
    }
    return bullet;
  }

  let result = trimmed;
  if (hasLeading) {
    result = ` ${result}`;
  }
  if (hasTrailing) {
    result = `${result} `;
  }
  return result;
}

function compactTokens(tokens: RichToken[]): RichToken[] {
  const result: RichToken[] = [];
  for (const token of tokens) {
    if (token.break) {
      if (result.length === 0 || result[result.length - 1].break) continue;
      result.push({ text: "", bold: false, break: true });
      continue;
    }
    const text = normalizeText(token.text);
    if (!text) continue;
    const last = result[result.length - 1];
    if (last && !last.break && last.bold === token.bold) {
      last.text = `${last.text} ${text}`.replace(/\s+/g, " ").trim();
    } else {
      result.push({ text, bold: token.bold });
    }
  }
  while (result.length && result[result.length - 1].break) {
    result.pop();
  }
  return result;
}

function parseParagraph(html: string): RichToken[] {
  let inner = html.replace(/^<p[^>]*>/i, "").replace(/<\/p>$/i, "");
  inner = inner
    .replace(/<b([^>]*)>/gi, "<strong$1>")
    .replace(/<\/b>/gi, "</strong>")
    .replace(/<br\s*\/?\>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?(span|em|u|div|strong|ol|ul)[^>]*>/gi, (match) =>
      /strong/i.test(match) ? match : ""
    );

  const tokens: RichToken[] = [];
  let bold = false;
  let cursor = 0;
  const marker = /(<strong[^>]*>|<\/strong>|\n)/gi;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(inner)) !== null) {
    const chunk = inner.slice(cursor, match.index);
    if (chunk) {
      const text = normalizeText(decodeEntities(stripTags(chunk)));
      if (text) {
        tokens.push({ text, bold });
      }
    }
    const token = match[0];
    if (token === "\n") {
      tokens.push({ text: "", bold, break: true });
    } else if (/^<strong/i.test(token)) {
      bold = true;
    } else {
      bold = false;
    }
    cursor = marker.lastIndex;
  }
  const tail = inner.slice(cursor);
  if (tail) {
    const text = normalizeText(decodeEntities(stripTags(tail)));
    if (text) {
      tokens.push({ text, bold });
    }
  }
  return compactTokens(tokens);
}

function classifyParagraph(tokens: RichToken[]): ParagraphKind {
  const text = tokens
    .filter((token) => !token.break)
    .map((token) => token.text)
    .join(" ")
    .trim();
  if (!text) {
    return "body";
  }
  if (/^•/.test(text)) {
    return "list";
  }
  if (/^CAP\.?\s*\d+/i.test(text)) {
    return "heading";
  }
  if (/^(Art\.|ART\.|\d+([.)]|\s))/i.test(text)) {
    return "subheading";
  }
  if (text.length <= 90 && text === text.toUpperCase()) {
    return "heading";
  }
  return "body";
}

function parseBody(html: string): ParsedParagraph[] {
  if (!html) return [];
  const paragraphs = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  if (paragraphs && paragraphs.length > 0) {
    return paragraphs
      .map((fragment) => parseParagraph(fragment))
      .filter((tokens) => tokens.length > 0)
      .map((tokens) => ({ tokens, kind: classifyParagraph(tokens) }));
  }
  const tokens = parseParagraph(`<p>${html}</p>`);
  return tokens.length > 0 ? [{ tokens, kind: classifyParagraph(tokens) }] : [];
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10) || value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function renderWrittenContractPdf(
  draft: WrittenContractDraft
): Promise<Uint8Array> {
  const normalized = WrittenContractDraftSchema.parse(draft);
  const pdfDoc = await PDFDocument.create();
  const resolvedTitle = normalized.title?.trim() || "Contract scris";
  const now = new Date();

  try {
    pdfDoc.setTitle(resolvedTitle);
    pdfDoc.setSubject("Contract de închiriere");
    if (normalized.ownerName?.trim()) {
      pdfDoc.setAuthor(normalized.ownerName.trim());
    }
    pdfDoc.setProducer("Rentapp");
    pdfDoc.setCreator("Rentapp");
    pdfDoc.setCreationDate(now);
    pdfDoc.setModificationDate(now);
  } catch {
    // Metadata updates are best-effort; ignore incompatibilities.
  }

  try {
    pdfDoc.catalog.set(PDFName.of("Lang"), PDFString.of("ro-RO"));
  } catch {
    // Ignore failures caused by PDF catalog nuances.
  }

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { font } = await loadPdfFonts(pdfDoc);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const addSpacer = (gap = 6) => {
    ensureSpace(gap);
    y -= gap;
  };

  const drawDivider = () => {
    ensureSpace(18);
    y -= 10;
    currentPage.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });
    y -= 12;
  };

  const drawTextLine = (
    segments: Segment[],
    size: number,
    lineWidth: number,
    indent: number,
    align: "left" | "center" | "right"
  ) => {
    if (segments.length === 0) return;
    const availableWidth = Math.max(0, maxWidth - indent);
    const safeLineWidth = Math.min(lineWidth, availableWidth);
    let x = MARGIN + indent;

    if (align === "center") {
      x += Math.max(0, (availableWidth - safeLineWidth) / 2);
    } else if (align === "right") {
      x += Math.max(0, availableWidth - safeLineWidth);
    }

    for (const segment of segments) {
      currentPage.drawText(segment.text, {
        x,
        y,
        size,
        font,
      });
      x += font.widthOfTextAtSize(segment.text, size);
    }
  };

  const drawParagraph = (
    tokens: RichToken[],
    opts?: ParagraphOptions
  ) => {
    if (!tokens || tokens.length === 0) {
      return;
    }
    const size = opts?.size ?? BODY_FONT_SIZE;
    const leading = opts?.leading ?? BODY_LEADING;
    const spacingAfter = opts?.spacingAfter ?? BODY_SPACING_AFTER;
    const spacingBefore = opts?.spacingBefore ?? 0;
    const align = opts?.align ?? "left";
    const bullet = opts?.bullet ?? false;
    const requestedIndent = Math.max(0, opts?.indent ?? 0);
    const requestedFirstLineIndent = Math.max(
      0,
      opts?.firstLineIndent ?? requestedIndent
    );
    const bulletIndent = bullet
      ? Math.max(0, opts?.bulletIndent ?? Math.max(0, requestedIndent - 10))
      : 0;
    const bulletGap = Math.max(4, opts?.bulletGap ?? 8);
    const bulletGlyphWidth = bullet ? font.widthOfTextAtSize("•", size) : 0;
    const bulletVisualIndent = bullet
      ? bulletIndent + bulletGlyphWidth + bulletGap
      : 0;
    const baseIndent = bullet
      ? Math.max(requestedIndent, bulletVisualIndent)
      : requestedIndent;
    const firstLineIndent = bullet
      ? Math.max(requestedFirstLineIndent, bulletVisualIndent)
      : requestedFirstLineIndent;
    const lineSegments: Segment[] = [];
    let lineWidth = 0;
    let pendingSpace = false;
    let hasContent = false;
    let lineIndex = 0;

    if (spacingBefore > 0) {
      addSpacer(spacingBefore);
    }

    const flushLine = () => {
      if (lineSegments.length === 0) {
        addSpacer(leading);
        return;
      }
      const currentIndent = lineIndex === 0 ? firstLineIndent : baseIndent;
      ensureSpace(leading);
      if (bullet && lineIndex === 0) {
        const bulletX = MARGIN + Math.max(0, bulletIndent);
        const bulletWidth = font.widthOfTextAtSize("•", size);
        currentPage.drawText("•", {
          x: bulletX,
          y,
          size,
          font,
        });
        const adjustedIndent = Math.max(
          currentIndent,
          bulletX - MARGIN + bulletWidth + bulletGap
        );
        drawTextLine([...lineSegments], size, lineWidth, adjustedIndent, align);
      } else {
        drawTextLine([...lineSegments], size, lineWidth, currentIndent, align);
      }
      y -= leading;
      lineSegments.length = 0;
      lineWidth = 0;
      lineIndex += 1;
    };

    const addWord = (word: string, bold: boolean, withSpace: boolean) => {
      const wordWidth = font.widthOfTextAtSize(word, size);
      const spaceWidth =
        withSpace && lineSegments.length > 0
          ? font.widthOfTextAtSize(" ", size)
          : 0;
      let activeIndent = lineIndex === 0 ? firstLineIndent : baseIndent;
      let currentAvailable = Math.max(0, maxWidth - activeIndent);
      if (
        lineSegments.length > 0 &&
        currentAvailable > 0 &&
        lineWidth + spaceWidth + wordWidth > currentAvailable
      ) {
        flushLine();
        activeIndent = lineIndex === 0 ? firstLineIndent : baseIndent;
        currentAvailable = Math.max(0, maxWidth - activeIndent);
      }
      if (withSpace && lineSegments.length > 0) {
        lineSegments.push({ text: " ", bold: false });
        lineWidth += font.widthOfTextAtSize(" ", size);
      }
      lineSegments.push({ text: word, bold });
      lineWidth += wordWidth;
      hasContent = true;
    };

    for (const token of tokens) {
      if (token.break) {
        flushLine();
        pendingSpace = false;
        continue;
      }
      const text = token.text;
      if (!text) continue;
      const pieces = text.split(/(\s+)/);
      for (const piece of pieces) {
        if (!piece) continue;
        if (/^\s+$/.test(piece)) {
          pendingSpace = true;
          continue;
        }
        addWord(piece, token.bold, pendingSpace);
        pendingSpace = false;
      }
    }

    if (lineSegments.length > 0) {
      flushLine();
    }

    if (hasContent) {
      addSpacer(spacingAfter);
    }
  };

  const makeSimpleTokens = (text: string, bold = false): RichToken[] => {
    const trimmed = text.trim();
    return trimmed ? [{ text: trimmed, bold }] : [];
  };

  drawParagraph(makeSimpleTokens(resolvedTitle, true), {
    size: 20,
    leading: 30,
    spacingAfter: 8,
    align: "center",
  });

  const subtitle = normalized.subtitle?.trim();
  if (subtitle) {
    drawParagraph(makeSimpleTokens(subtitle), {
      size: 13,
      leading: 20,
      spacingAfter: 12,
      align: "center",
    });
  }

  const docInfoParts: string[] = [];
  if (normalized.documentNumber?.trim()) {
    docInfoParts.push(`Nr. ${normalized.documentNumber.trim()}`);
  }
  if (normalized.documentDate?.trim()) {
    docInfoParts.push(`Data ${formatDate(normalized.documentDate)}`);
  }
  if (docInfoParts.length > 0) {
    drawParagraph([{ text: docInfoParts.join(" • "), bold: false }], {
      size: 11,
      leading: 16,
      spacingAfter: 18,
      align: "center",
    });
  } else {
    addSpacer(10);
  }

  drawDivider();

  const bodyParagraphs = parseBody(normalized.body);
  for (const paragraph of bodyParagraphs) {
    if (paragraph.kind === "heading") {
      const emphasisedHeading = paragraph.tokens.map((token) =>
        token.break ? token : { ...token, bold: true }
      );
      drawParagraph(emphasisedHeading, {
        size: 14,
        leading: 24,
        spacingBefore: 18,
        spacingAfter: 12,
        align: "left",
      });
      continue;
    }

    if (paragraph.kind === "subheading") {
      const emphasised = paragraph.tokens.map((token, index) =>
        token.break ? token : { ...token, bold: index === 0 ? true : token.bold }
      );
      drawParagraph(emphasised, {
        size: 12.5,
        leading: 20,
        spacingBefore: 12,
        spacingAfter: 8,
      });
      continue;
    }

    if (paragraph.kind === "list") {
      const withoutBullet = paragraph.tokens.flatMap((token, index) => {
        if (index === 0 && token.text.startsWith("•")) {
          const trimmed = token.text.replace(/^•\s*/, "");
          return trimmed ? [{ text: trimmed, bold: token.bold }] : [];
        }
        return [token];
      });
      drawParagraph(withoutBullet, {
        size: 12,
        leading: 18,
        spacingBefore: 4,
        spacingAfter: 8,
        indent: 28,
        bullet: true,
        bulletIndent: 12,
        bulletGap: 10,
      });
      continue;
    }

    drawParagraph(paragraph.tokens, {
      size: BODY_FONT_SIZE,
      leading: BODY_LEADING,
      spacingAfter: BODY_SPACING_AFTER,
      indent: 6,
      firstLineIndent: 16,
    });
  }

  const notes = normalized.notes?.trim();
  if (notes) {
    drawParagraph(makeSimpleTokens("Note interne", true), {
      size: 13,
      leading: 20,
      spacingBefore: 18,
      spacingAfter: 8,
    });
    const noteBlocks = notes.split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);
    if (noteBlocks.length === 0) {
      noteBlocks.push(notes);
    }
    for (const block of noteBlocks) {
      drawParagraph(makeSimpleTokens(block), {
        size: 11,
        leading: 16,
        spacingAfter: 8,
        indent: 6,
        firstLineIndent: 16,
      });
    }
  }

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const footerSize = 9;
  const footerColor = rgb(0.45, 0.45, 0.45);
  pages.forEach((page, index) => {
    const footerText = `Pagina ${index + 1} din ${totalPages}`;
    const textWidth = font.widthOfTextAtSize(footerText, footerSize);
    const footerY = MARGIN / 2.5;
    const footerX = (PAGE_WIDTH - textWidth) / 2;
    page.drawText(footerText, {
      x: footerX,
      y: footerY,
      size: footerSize,
      font,
      color: footerColor,
    });
  });

  return pdfDoc.save();
}
