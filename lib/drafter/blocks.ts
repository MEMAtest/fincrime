/**
 * Internal document block structure. Every accepted upload format (.md,
 * .html, .docx) is converted to this shape, keeping heading levels, lists
 * and tables plus each block's position in the source document. See
 * SPEC.md "Supported uploads" / "Data model".
 */

export type BlockType = "heading" | "paragraph" | "list" | "table";

export interface HeadingBlock {
  type: "heading";
  level: number; // 1-6
  text: string;
  position: number;
}

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
  position: number;
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: string[];
  position: number;
}

export interface TableCell {
  text: string;
  error?: string; // e.g. "#REF!" formula error, kept typed, never read as text
}

export interface TableBlock {
  type: "table";
  rows: TableCell[][];
  position: number;
}

export type DocBlock = HeadingBlock | ParagraphBlock | ListBlock | TableBlock;

export interface ParsedDocument {
  blocks: DocBlock[];
  warnings: string[];
}

export const FORMULA_ERROR_VALUES = ["#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NULL!", "#NUM!"] as const;

export function detectFormulaError(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return (FORMULA_ERROR_VALUES as readonly string[]).includes(trimmed) ? trimmed : null;
}
