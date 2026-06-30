import { parseArgs } from "node:util";
import { importExcelToSqlite } from "../src/lib/workforce-import";

const { values } = parseArgs({
  options: {
    excel: { type: "string" },
    db: { type: "string" },
    replace: { type: "boolean" },
  },
  allowPositionals: false,
});

const result = await importExcelToSqlite({
  excelPath: values.excel,
  dbPath: values.db,
  replace: values.replace ?? false,
});

console.log(`Created SQLite database: ${result.dbPath}`);
console.log(`Imported workbook: ${result.workbookName}`);
for (const tableName of Object.keys(result.counts).sort((left, right) => left.localeCompare(right))) {
  console.log(`${tableName}: ${result.counts[tableName]}`);
}
