import * as XLSX from "xlsx";

export type CellValue = string | number | boolean | Date | null | undefined;
export type WorkbookRow = Record<string, CellValue>;

export type SheetRow = {
  rowNumber: number;
  values: WorkbookRow;
};

export type SheetData = {
  header: string[];
  rows: SheetRow[];
};

export type WorkbookSheets = Record<string, SheetData>;

const getCellValue = (worksheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): CellValue => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const value = worksheet[address]?.v as CellValue;
  return value === "" ? undefined : value;
};

export function readSheet(workbook: XLSX.WorkBook, sheetName: string): SheetData {
  const worksheet = workbook.Sheets[sheetName];
  const reference = worksheet?.["!ref"];
  if (!worksheet || !reference) {
    return { header: [], rows: [] };
  }

  const range = XLSX.utils.decode_range(reference);
  const header: string[] = [];
  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const value = getCellValue(worksheet, range.s.r, columnIndex);
    header.push(value == null ? "" : String(value));
  }

  const rows: SheetRow[] = [];
  for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const rowValues: CellValue[] = [];
    let hasContent = false;

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const value = getCellValue(worksheet, rowIndex, columnIndex);
      rowValues.push(value);
      if (value != null && String(value).trim() !== "") {
        hasContent = true;
      }
    }

    if (!hasContent) {
      continue;
    }

    const values: WorkbookRow = {};
    for (let index = 0; index < header.length; index += 1) {
      values[header[index]] = rowValues[index];
    }

    rows.push({
      rowNumber: rowIndex + 1,
      values,
    });
  }

  return { header, rows };
}

export function readWorkbookSheetsFromBuffer(data: ArrayBuffer | Uint8Array): {
  workbook: XLSX.WorkBook;
  sheets: WorkbookSheets;
} {
  const workbook = XLSX.read(data, {
    raw: true,
    cellDates: true,
    cellFormula: false,
  });

  const sheets: WorkbookSheets = {};
  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = readSheet(workbook, sheetName);
  }

  return { workbook, sheets };
}
