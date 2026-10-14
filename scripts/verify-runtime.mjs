import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
for (const route of ["analyze", "recover"]) {
  const traceFile = `.next/server/app/api/${route}/route.js.nft.json`;
  const trace = JSON.parse(readFileSync(traceFile, "utf8"));
  const worker = trace.files.find((file) => file.endsWith("pdfjs-dist/legacy/build/pdf.worker.mjs"));
  if (!worker || !existsSync(resolve(dirname(traceFile), worker))) throw new Error(`PDF.js worker missing from deployable ${route} API trace`);
  console.log(`Deployable ${route} PDF API trace includes its worker: PASS`);
}
