// Explicit independent PHASE 3.5 approval. Only safe metadata is public.
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { paid35 } from "./lib/phase35-live";
import { extractPdfText } from "../src/modules/pdf/extract";
import { emptyShippingWire } from "../src/modules/shipping/ground";
import { reviewShipping } from "../src/modules/shipping/review";
import { safeShippingDiagnostics } from "../src/modules/shipping/diagnostics";
import { fixture35, type Row35 } from "../tests/fixtures/shipping35";
import {
  shippingTypes,
  type ShippingType,
} from "../src/modules/shipping/catalog";
import type {
  ShippingDocument,
  ShippingField,
} from "../src/modules/shipping/schema";
const arg = (k: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
if (
  arg("approved-max-cost-usd") !== "0.50" ||
  arg("approved-documents") !== "60" ||
  arg("approved-requests") !== "75"
)
  throw Error("PHASE35 explicit approval caps required");
const sha = arg("sha") ?? "",
  stage = arg("stage") ?? "",
  repeats = Number(arg("repeat") ?? 1);
if (
  !/^[a-f0-9]{40}$/.test(sha) ||
  ![
    "normal",
    "mismatch",
    "conflict-hbl",
    "multiple-items",
    "multiple-containers",
    "partial",
    "multi-declaration",
    "shared-container",
    "incomplete-table",
    "source-conflict",
  ].includes(stage) ||
  !Number.isInteger(repeats) ||
  repeats < 1 ||
  repeats > 3 ||
  (stage !== "normal" && repeats !== 1)
)
  throw Error("Known stage/exact SHA/bounded repetition required");
const coreMeanings = [
  "houseBlNumber",
  "declarationNumber",
  "containerNumber",
  "sealNumber",
  "packageCount",
  "grossWeight",
  "quantity",
  "portOfLoading",
  "portOfDischarge",
];
const fieldsOf = (d: ShippingDocument, k: string): ShippingField[] => [
  ...(d.fields[k] ? [d.fields[k]] : []),
  ...d.additionalFields.filter((a) => a.meaning === k).map((a) => a.field),
  ...d.items.flatMap((i) => (i.fields[k] ? [i.fields[k]] : [])),
  ...d.cargoRecords.flatMap((c) => (c.fields[k] ? [c.fields[k]] : [])),
  ...d.containers.flatMap((c) =>
    k === "sealNumber"
      ? (c.sealNumbers ?? [c.sealNumber])
      : (c as unknown as Record<string, ShippingField>)[k]
        ? [(c as unknown as Record<string, ShippingField>)[k]]
        : [],
  ),
  ...d.references
    .filter((r) =>
      k === "houseBlNumber"
        ? r.kind === "house_bl"
        : k === "declarationNumber"
          ? r.kind === "export_declaration"
          : false,
    )
    .map((r) => r.number),
];
const dir = "test-results/live-phase35/private";
await mkdir(dir, { recursive: true, mode: 0o700 });
await chmod(dir, 0o700);
for (let repeat = 1; repeat <= repeats; repeat++) {
  let fixtures:
    | Awaited<ReturnType<typeof fixture35>>[]
    | {
        bytes: Uint8Array;
        pdf: Awaited<ReturnType<typeof fixture35>>["pdf"];
        wire: ReturnType<typeof emptyShippingWire>;
      }[] = [];
  let gold: { index: number; role: string; value: string | number }[] = [];
  if (stage === "normal") {
    const input = arg("input-dir"),
      goldPath = arg("gold");
    if (!input || !goldPath)
      throw Error("Private original and ground truth paths required");
    gold = JSON.parse(await readFile(resolve(goldPath), "utf8"));
    const names = [
      "01_house_bl.pdf",
      "02_export_declaration.pdf",
      "03_house_manifest.pdf",
    ];
    for (const [i, type] of shippingTypes.entries()) {
      const bytes = await readFile(join(resolve(input), names[i]));
      const pdf = {
        id: "phase35-user-" + i,
        fileName: names[i],
        pages: await extractPdfText(
          new Uint8Array(bytes),
          undefined,
          false,
          true,
        ),
      };
      fixtures.push({ bytes, pdf, wire: emptyShippingWire(type) } as never);
    }
  } else {
    const baseRow: Row35 = {
        name: "SYNTHETIC METAL BOTTLE 600ML",
        hs: "7323.93-0000",
        qty: 720,
        packages: 200,
        gross: 1920,
      },
      baseContainer: Row35 = {
        name: "",
        cn: "SYN-CN-35-A",
        seal: "SYN-SEAL-35-A",
        packages: 200,
        gross: 1920,
      };
    const build = (
      type: ShippingType,
      o: Parameters<typeof fixture35>[1] = {},
    ) =>
      fixture35(type, { rows: [baseRow], containers: [baseContainer], ...o });
    if (stage === "mismatch")
      fixtures = [
        await build("house_bl"),
        await build("house_manifest", {
          rows: [{ ...baseRow, qty: 700, packages: 180, gross: 1820 }],
          containers: [
            {
              ...baseContainer,
              cn: "SYN-CN-35-B",
              seal: "SYN-SEAL-35-B",
              packages: 180,
              gross: 1820,
            },
          ],
          totals: { quantity: 700, packageCount: 180, grossWeight: 1820 },
        }),
      ];
    if (stage === "conflict-hbl")
      fixtures = [
        await build("house_bl"),
        await build("house_manifest", {
          hbl: "HB-SYN-35-OTHER",
          rows: [{ ...baseRow, qty: 700, packages: 180 }],
          totals: { quantity: 700, packageCount: 180 },
        }),
      ];
    if (stage === "partial")
      fixtures = [
        await build("house_bl"),
        await build("house_manifest", {
          scope: "partial shipment",
          rows: [{ ...baseRow, qty: 700, packages: 180, gross: 1820 }],
          containers: [{ ...baseContainer, packages: 180, gross: 1820 }],
          totals: { quantity: 700, packageCount: 180, grossWeight: 1820 },
        }),
      ];
    if (stage === "multiple-items") {
      const rows = [
        { name: "SYNTHETIC METAL BOTTLE A", hs: "7323.93-0000", qty: 260 },
        { name: "SYNTHETIC METAL BOTTLE B", hs: "7323.94-0000", qty: 460 },
      ];
      fixtures = await Promise.all(
        shippingTypes.map((t) =>
          build(t, {
            rows,
            totals: { quantity: 720, packageCount: 200, grossWeight: 1920 },
          }),
        ),
      );
    }
    if (stage === "multiple-containers") {
      const cs = [
        { ...baseContainer, packages: 80, gross: 820 },
        {
          ...baseContainer,
          cn: "SYN-CN-35-B",
          seal: "SYN-SEAL-35-B",
          packages: 120,
          gross: 1100,
        },
      ];
      fixtures = await Promise.all(
        shippingTypes.map((t) =>
          build(t, {
            containers: cs,
            rows: [{ ...baseRow, packages: undefined, gross: undefined }],
            totals:
              t === "house_bl"
                ? { quantity: 720 }
                : { quantity: 720, packageCount: 200, grossWeight: 1920 },
          }),
        ),
      );
    }
    if (stage === "multi-declaration") {
      const rows = [
        { name: "SYNTHETIC METAL BOTTLE A", hs: "7323.93-0000", qty: 260 },
        { name: "SYNTHETIC METAL BOTTLE B", hs: "7323.94-0000", qty: 460 },
      ];
      fixtures = [
        await build("house_bl", {
          rows,
          declarationRefs: ["DECL-SYN-35-A", "DECL-SYN-35-B"],
        }),
        await build("export_declaration", {
          id: "syn35-decl-a",
          rows: [rows[0]],
          declaration: "DECL-SYN-35-A",
        }),
        await build("export_declaration", {
          id: "syn35-decl-b",
          rows: [rows[1]],
          declaration: "DECL-SYN-35-B",
        }),
      ];
    }
    if (stage === "shared-container")
      fixtures = [
        await build("house_bl"),
        await build("house_manifest", {
          rows: [],
          containers: [],
          cargos: [
            {
              ...baseRow,
              ...baseContainer,
              hbl: "HB-SYN-35-A",
              packages: 80,
              gross: 820,
            },
            {
              ...baseRow,
              ...baseContainer,
              hbl: "HB-SYN-35-OTHER",
              name: "SYNTHETIC SHARED OTHER GOODS",
              packages: 120,
              gross: 1100,
            },
          ],
        }),
      ];
    if (stage === "incomplete-table")
      fixtures = [
        await build("house_bl", { notice: "Selected items only" }),
        await build("house_manifest", {
          totals: { quantity: 720, packageCount: 200, grossWeight: 1920 },
        }),
      ];
    if (stage === "source-conflict")
      fixtures = [
        await build("house_bl", { totals: { packageCount: 180 } }),
        await build("house_manifest", { totals: { packageCount: 200 } }),
      ];
  }
  const runStage = stage === "normal" ? `normal-${repeat}` : stage,
    result = await paid35(sha, runStage, fixtures),
    base = `${runStage}-${sha.slice(0, 7)}-d${result.budget.documents}`;
  await writeFile(
    join(dir, base + ".json"),
    JSON.stringify({
      ...result,
      results: result.results.map((r) => ({
        ...r,
        pdf: { ...r.pdf, pages: [] },
      })),
    }),
    { mode: 0o600 },
  );
  const docs = result.results.flatMap((r) => (r.document ? [r.document] : [])),
    review = reviewShipping(docs),
    diagnostics = safeShippingDiagnostics(docs, review);
  const core = Object.fromEntries(
    coreMeanings.map((meaning) => [
      meaning,
      review.primaryChecks?.find(
        (c) =>
          c.comparison?.scope === "hbl_record" &&
          c.comparison.meaning === meaning,
      )?.assessment ?? "not_performed",
    ]),
  );
  const observedGold = gold.map((g) => {
    const d = docs[g.index],
      vs = d ? fieldsOf(d, g.role) : [];
    const correct = (f: ShippingField) =>
      String(f.original.value).toUpperCase() === String(g.value).toUpperCase();
    return {
      document: g.index,
      role: g.role,
      extractedCorrect: vs.some(correct),
      verifiedCorrect: vs.some(
        (f) => correct(f) && f.original.status === "verified",
      ),
    };
  });
  const expectedErrors =
    stage === "mismatch"
      ? [
          "packageCount",
          "grossWeight",
          "quantity",
          "containerNumber",
          "sealNumber",
        ]
      : [];
  const found = (review.primaryChecks ?? [])
    .filter((c) => c.assessment === "confirmed_mismatch")
    .map((c) => c.comparison?.meaning ?? c.category);
  const metrics = {
    stage: runStage,
    sourceSha: sha,
    inputHashes: fixtures.map((f) =>
      createHash("sha256").update(f.bytes).digest("hex"),
    ),
    budget: result.budget,
    diagnostics,
    core,
    gold: observedGold,
    classification: docs.filter((d) => d.classificationStatus === "classified")
      .length,
    documents: docs.length,
    relationships: review.summary,
    scopePlacements: review.primaryChecks
      ?.filter((c) => c.comparison?.scope === "hbl_record")
      .flatMap((c) =>
        c.comparison!.facts.map((f) => ({
          meaning: f.meaning,
          documentType: f.documentType,
          scope: f.scope,
          derivation: f.derivation,
          reasons: f.reasons,
        })),
      ),
    independentErrors: [...new Set(found)],
    expectedErrors,
    truePositive: expectedErrors.filter((m) => found.includes(m)).length,
    falseNegative: expectedErrors.filter((m) => !found.includes(m)).length,
    falsePositive:
      stage === "normal" || stage === "mismatch"
        ? found.filter((m) => !expectedErrors.includes(m)).length
        : null,
    triangle: review.triangleStatus,
    primary: review.primaryChecks?.map((c) => ({
      meaning: c.comparison?.meaning,
      scope: c.scope,
      assessment: c.assessment,
      codes: c.comparison?.reasonCodes,
    })),
    usage: result.results.map((r) => r.aiUsage ?? null),
    errors: result.results.map((r) => r.error?.code ?? null),
    batchRequests: result.batchRequests,
    batchDurationsMs: result.batchDurationsMs,
    automaticRetries: 0,
  };
  await writeFile(
    `test-results/live-phase35/${base}-metrics.json`,
    JSON.stringify(metrics, null, 2),
  );
  console.log(JSON.stringify(metrics, null, 2));
  if (
    docs.length !== fixtures.length ||
    result.results.some((r) => r.error) ||
    (stage === "normal" &&
      coreMeanings.some((m) => core[m] !== "confirmed_match"))
  ) {
    process.exitCode = 1;
    break;
  }
}
