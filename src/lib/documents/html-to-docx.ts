import { parse, HTMLElement, Node, TextNode } from "node-html-parser";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageOrientation,
} from "docx";

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "666666" };
const ALL_BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
};

function cleanText(text: string): string {
  return text.replace(/[\u0080-\u00FF\u2000-\u206F]/g, "");
}

type InlineSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

function collectInlineSegments(node: Node): InlineSegment[] {
  const segments: InlineSegment[] = [];

  const walk = (
    n: Node,
    fmt: { bold?: boolean; italic?: boolean } = {}
  ) => {
    if (n.nodeType === 3) {
      const text = cleanText((n as TextNode).text);
      if (text.length > 0) segments.push({ text, ...fmt });
      return;
    }

    if (n.nodeType === 1) {
      const el = n as HTMLElement;
      const tag = el.tagName?.toLowerCase() ?? "";
      const newFmt = { ...fmt };
      if (tag === "b" || tag === "strong") newFmt.bold = true;
      if (tag === "i" || tag === "em") newFmt.italic = true;
      if (tag === "br") {
        segments.push({ text: "\n" });
        return;
      }
      if (tag === "table") return;

      for (const child of el.childNodes) walk(child, newFmt);
    }
  };

  walk(node);
  return segments;
}

function inlineToTextRuns(
  segments: InlineSegment[],
  defaultSize = 24
): TextRun[] {
  const runs: TextRun[] = [];
  for (const seg of segments) {
    if (seg.text === "\n") {
      runs.push(new TextRun({ text: "", break: 1 }));
      continue;
    }
    runs.push(
      new TextRun({
        text: seg.text,
        bold: seg.bold,
        italics: seg.italic,
        size: defaultSize,
      })
    );
  }
  return runs.length > 0 ? runs : [new TextRun({ text: "" })];
}

function paragraphFromSegments(
  segments: InlineSegment[],
  opts: {
    bold?: boolean;
    size?: number;
    align?: any;
    spacing?: number;
  } = {}
): Paragraph {
  if (opts.bold) for (const s of segments) s.bold = true;
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacing ?? 120 },
    children: inlineToTextRuns(segments, opts.size ?? 24),
  });
}

function paragraphFromElement(el: HTMLElement): Paragraph {
  return paragraphFromSegments(collectInlineSegments(el));
}

function headingFromElement(el: HTMLElement, level: number): Paragraph {
  const sizes: Record<number, number> = { 1: 32, 2: 28, 3: 26, 4: 24, 5: 24, 6: 24 };
  const segments = collectInlineSegments(el);
  for (const s of segments) s.bold = true;
  return new Paragraph({
    alignment: level <= 2 ? AlignmentType.CENTER : undefined,
    spacing: { before: 200, after: 200 },
    children: inlineToTextRuns(segments, sizes[level] ?? 24),
  });
}

function listItemsFromElement(el: HTMLElement, ordered: boolean): Paragraph[] {
  const items: Paragraph[] = [];
  const liNodes = el.querySelectorAll("li");
  let index = 1;

  for (const li of liNodes) {
    const prefix = ordered ? `${index}. ` : "• ";
    const segments = collectInlineSegments(li);
    segments.unshift({ text: prefix });
    items.push(
      new Paragraph({
        spacing: { after: 80 },
        indent: { left: 400 },
        children: inlineToTextRuns(segments, 24),
      })
    );
    index++;
  }

  return items;
}

// ─── Ширины колонок для таблиц (в twips) ────────────
function getColumnWidths(count: number): number[] | undefined {
  switch (count) {
    case 7:
      // Журнал инструктажей: № | ФИО | Должность | Дата | Вид | Подпись 1 | Подпись 2
      return [650, 2600, 1950, 1560, 1690, 2275, 2275];
    case 6:
      // Журнал без №: ФИО | Должность | Дата | Вид | Подпись 1 | Подпись 2
      return [3200, 2200, 1700, 1600, 2600, 2600];
    case 4:
      // График отпусков: № | ФИО | Дней | Дата начала
      return [800, 4200, 1800, 3400];
    default:
      return undefined;
  }
}

function tableFromElement(el: HTMLElement): Table | null {
  const rows: TableRow[] = [];
  const trNodes = el.querySelectorAll("tr");
  if (trNodes.length === 0) return null;

  // Определяем количество колонок по максимальной строке
  let maxCols = 0;
  for (const tr of trNodes) {
    let cells = tr.querySelectorAll("th");
    if (cells.length === 0) cells = tr.querySelectorAll("td");
    if (cells.length > maxCols) maxCols = cells.length;
  }
  const columnWidths = getColumnWidths(maxCols);

  for (const tr of trNodes) {
    let cellNodes = tr.querySelectorAll("th");
    if (cellNodes.length === 0) cellNodes = tr.querySelectorAll("td");
    if (cellNodes.length === 0) continue;

    const cells: TableCell[] = [];
    for (let i = 0; i < cellNodes.length; i++) {
      const cell = cellNodes[i];
      const segments = collectInlineSegments(cell);
      const isHeader = cell.tagName?.toLowerCase() === "th";
      if (isHeader) for (const s of segments) s.bold = true;

      cells.push(
        new TableCell({
          width:
            columnWidths && columnWidths[i]
              ? { size: columnWidths[i], type: WidthType.DXA }
              : undefined,
          borders: ALL_BORDERS,
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: isHeader ? AlignmentType.CENTER : undefined,
              children: inlineToTextRuns(segments, 22),
            }),
          ],
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  }

  if (rows.length === 0) return null;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: columnWidths,
    rows,
  });
}

function convertNode(
  node: Node
): (Paragraph | Table) | (Paragraph | Table)[] | null {
  if (node.nodeType === 3) {
    const text = cleanText((node as TextNode).text).trim();
    if (!text) return null;
    return new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text, size: 24 })],
    });
  }

  if (node.nodeType !== 1) return null;

  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase() ?? "";

  switch (tag) {
    case "body":
    case "html":
    case "div":
    case "section": {
      const results: (Paragraph | Table)[] = [];
      for (const child of el.childNodes) {
        const converted = convertNode(child);
        if (!converted) continue;
        if (Array.isArray(converted)) results.push(...converted);
        else results.push(converted);
      }
      return results;
    }

    case "p": {
      const hasTable = el.querySelectorAll("table").length > 0;
      if (!hasTable) return paragraphFromElement(el);

      const results: (Paragraph | Table)[] = [];
      let buffer: InlineSegment[] = [];

      const flushBuffer = () => {
        const hasText = buffer.some((s) => s.text.trim().length > 0);
        if (hasText) results.push(paragraphFromSegments(buffer));
        buffer = [];
      };

      const walk = (
        n: Node,
        fmt: { bold?: boolean; italic?: boolean } = {}
      ) => {
        if (n.nodeType === 3) {
          const text = cleanText((n as TextNode).text);
          if (text.length > 0) buffer.push({ text, ...fmt });
          return;
        }
        if (n.nodeType !== 1) return;

        const child = n as HTMLElement;
        const childTag = child.tagName?.toLowerCase() ?? "";

        if (childTag === "table") {
          flushBuffer();
          const t = tableFromElement(child);
          if (t) results.push(t);
          return;
        }

        if (childTag === "br") {
          buffer.push({ text: "\n" });
          return;
        }

        const newFmt = { ...fmt };
        if (childTag === "b" || childTag === "strong") newFmt.bold = true;
        if (childTag === "i" || childTag === "em") newFmt.italic = true;

        for (const c of child.childNodes) walk(c, newFmt);
      };

      for (const c of el.childNodes) walk(c);
      flushBuffer();

      return results;
    }

    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return headingFromElement(el, parseInt(tag[1], 10));

    case "ul":
      return listItemsFromElement(el, false);
    case "ol":
      return listItemsFromElement(el, true);
    case "table":
      return tableFromElement(el);
    case "br":
      return new Paragraph({ children: [new TextRun({ text: "" })] });
    case "strong":
    case "b":
    case "em":
    case "i":
    case "span":
    case "u": {
      const segs = collectInlineSegments(el);
      return paragraphFromSegments(segs);
    }
    default: {
      const results: (Paragraph | Table)[] = [];
      for (const child of el.childNodes) {
        const converted = convertNode(child);
        if (!converted) continue;
        if (Array.isArray(converted)) results.push(...converted);
        else results.push(converted);
      }
      return results;
    }
  }
}

// ─── Публичная функция ──────────────────────────────
export async function htmlToDocxBuffer(
  htmlBody: string,
  options: { landscape?: boolean } = {}
): Promise<Buffer> {
  const wrapped = htmlBody.includes("<body")
    ? htmlBody
    : `<html><body>${htmlBody}</body></html>`;

  const root = parse(wrapped);

  const children: (Paragraph | Table)[] = [];
  for (const child of root.childNodes) {
    const converted = convertNode(child);
    if (!converted) continue;
    if (Array.isArray(converted)) children.push(...converted);
    else children.push(converted);
  }

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: options.landscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}