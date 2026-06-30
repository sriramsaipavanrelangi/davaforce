import { parseArgs } from "node:util";
import { verifyImportedDatabase } from "../src/lib/workforce-verify";

const { values } = parseArgs({
  options: {
    excel: { type: "string" },
    db: { type: "string" },
  },
  allowPositionals: false,
});

const summary = verifyImportedDatabase({
  excelPath: values.excel,
  dbPath: values.db,
});

for (const result of summary.results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} | ${result.name} | ${result.detail}`);
}

console.log(
  "\nNote: VAL-024 (10,000-iteration portfolio stress test) is not re-executed here because it is a scenario simulation, not a persisted-data normalization/integrity check.",
);
console.log(`\nSummary: passed=${summary.passed} failed=${summary.failed}`);
process.exit(summary.failed === 0 ? 0 : 1);
