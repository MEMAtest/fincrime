import ExcelJS from "exceljs";
import { FORMULA_ERROR_VALUES } from "../blocks";

export interface XlsxCell {
  text: string;
  error?: string;
}

export interface XlsxSheetPreview {
  sheetNames: string[];
}

export interface XlsxParsedSheet {
  sheetName: string;
  headerRowIndex: number; // 1-based, matching ExcelJS row numbers
  headers: string[];
  rows: XlsxCell[][]; // data rows only, below the header row
}

/** Lists sheet names for the sheet-picker step of the import wizard. */
export async function listXlsxSheets(buffer: Buffer): Promise<XlsxSheetPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return { sheetNames: workbook.worksheets.map((ws) => ws.name) };
}

function cellToXlsxCell(cell: ExcelJS.Cell): XlsxCell {
  const value = cell.value as unknown;
  if (value && typeof value === "object" && "error" in (value as Record<string, unknown>)) {
    const errorValue = String((value as Record<string, unknown>).error);
    return { text: errorValue, error: errorValue };
  }
  if (value && typeof value === "object" && "result" in (value as Record<string, unknown>)) {
    // A formula cell: {formula, result}. If the cached result is itself an
    // error object, surface it; otherwise use the computed result text.
    const formulaValue = value as Record<string, unknown>;
    const result = formulaValue.result;
    if (result && typeof result === "object" && "error" in (result as Record<string, unknown>)) {
      const errorValue = String((result as Record<string, unknown>).error);
      return { text: errorValue, error: errorValue };
    }
    return { text: result === null || result === undefined ? "" : String(result) };
  }
  if (value === null || value === undefined) return { text: "" };
  if (value instanceof Date) return { text: value.toISOString() };
  if (typeof value === "object" && "richText" in (value as Record<string, unknown>)) {
    const richText = (value as Record<string, unknown>).richText as { text: string }[];
    return { text: richText.map((r) => r.text).join("") };
  }
  const text = String(value).trim();
  if ((FORMULA_ERROR_VALUES as readonly string[]).includes(text)) return { text, error: text };
  return { text };
}

/**
 * Detects the header row: scans the first `scanRows` rows and scores each by
 * the count of non-empty text cells. The row with the highest score wins,
 * with ties broken toward the LATER row - a title/caption row above the
 * real header typically has fewer populated cells than the header row
 * itself (which has one label per column). Not assumed to be row 1, per
 * SPEC.md.
 */
export function detectHeaderRowIndex(worksheet: ExcelJS.Worksheet, scanRows = 15): number {
  let bestRow = 1;
  let bestScore = -1;
  const limit = Math.min(scanRows, worksheet.rowCount || scanRows);
  for (let r = 1; r <= limit; r++) {
    const row = worksheet.getRow(r);
    let score = 0;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cellToXlsxCell(cell).text;
      if (v.trim()) score++;
    });
    if (score >= bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

export async function parseXlsxSheet(
  buffer: Buffer,
  sheetName: string,
  headerRowIndex?: number
): Promise<XlsxParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`Sheet "${sheetName}" not found`);

  const headerRow = headerRowIndex ?? detectHeaderRowIndex(worksheet);
  const headerRowObj = worksheet.getRow(headerRow);
  const headers: string[] = [];
  const colCount = worksheet.columnCount || headerRowObj.cellCount;
  for (let c = 1; c <= colCount; c++) {
    headers.push(cellToXlsxCell(headerRowObj.getCell(c)).text);
  }

  const rows: XlsxCell[][] = [];
  for (let r = headerRow + 1; r <= (worksheet.rowCount || headerRow); r++) {
    const row = worksheet.getRow(r);
    if (row.cellCount === 0) continue;
    const cells: XlsxCell[] = [];
    let hasContent = false;
    for (let c = 1; c <= colCount; c++) {
      const cell = cellToXlsxCell(row.getCell(c));
      if (cell.text.trim()) hasContent = true;
      cells.push(cell);
    }
    if (hasContent) rows.push(cells);
  }

  return { sheetName, headerRowIndex: headerRow, headers, rows };
}
