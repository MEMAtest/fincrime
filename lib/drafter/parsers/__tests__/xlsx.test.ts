import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { listXlsxSheets, parseXlsxSheet, detectHeaderRowIndex } from "../xlsx";

async function bufferOf(build: (wb: ExcelJS.Workbook) => void): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("xlsx parser", () => {
  it("lists sheet names", async () => {
    const buf = await bufferOf((wb) => {
      wb.addWorksheet("Register");
      wb.addWorksheet("Notes");
    });
    const result = await listXlsxSheets(buf);
    expect(result.sheetNames).toEqual(["Register", "Notes"]);
  });

  it("detects the header row when it is not row 1", async () => {
    const buf = await bufferOf((wb) => {
      const sheet = wb.addWorksheet("Register");
      sheet.addRow(["A title row with only one cell"]);
      sheet.addRow([]);
      sheet.addRow(["REQ ID", "Applicability", "Coverage"]);
      sheet.addRow(["REQ-0001", "Applicable to Revolut", "Yes"]);
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const headerRow = detectHeaderRowIndex(wb.getWorksheet("Register")!);
    expect(headerRow).toBe(3);
  });

  it("parses data rows below the detected header row", async () => {
    const buf = await bufferOf((wb) => {
      const sheet = wb.addWorksheet("Register");
      sheet.addRow(["title"]);
      sheet.addRow([]);
      sheet.addRow(["REQ ID", "Coverage"]);
      sheet.addRow(["REQ-0001", "Yes"]);
      sheet.addRow(["REQ-0002", "Partial"]);
    });
    const parsed = await parseXlsxSheet(buf, "Register");
    expect(parsed.headerRowIndex).toBe(3);
    expect(parsed.headers).toEqual(["REQ ID", "Coverage"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0][0].text).toBe("REQ-0001");
  });

  it("keeps formula errors typed, never read as text", async () => {
    const buf = await bufferOf((wb) => {
      const sheet = wb.addWorksheet("Register");
      sheet.addRow(["REQ ID", "Complete for PRA"]);
      const dataRow = sheet.addRow(["REQ-0001", null]);
      dataRow.getCell(2).value = { error: "#REF!" };
    });
    const parsed = await parseXlsxSheet(buf, "Register");
    expect(parsed.rows[0][1].error).toBe("#REF!");
    expect(parsed.rows[0][1].text).toBe("#REF!");
  });
});
