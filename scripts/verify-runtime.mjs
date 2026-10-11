import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
const traceFile = ".next/server/app/api/analyze/route.js.nft.json";
const trace = JSON.parse(readFileSync(traceFile, "utf8"));
const worker = trace.files.find((file) => file.endsWith("pdfjs-dist/legacy/build/pdf.worker.mjs"));
if (!worker || !existsSync(resolve(dirname(traceFile), worker))) throw new Error("PDF.js worker missing from deployable API trace");
console.log("Deployable PDF API trace includes its worker: PASS");
