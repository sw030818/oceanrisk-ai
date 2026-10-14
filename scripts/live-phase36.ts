// Explicit independent PHASE 3.6 approval. Only safe metadata is public.
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { paid36 } from "./lib/phase36-live";
import { extractPdfText } from "../src/modules/pdf/extract";
import { emptyShippingWire } from "../src/modules/shipping/ground";
import { reviewShipping } from "../src/modules/shipping/review";
import { safeShippingDiagnostics } from "../src/modules/shipping/diagnostics";
import {
  recoveryStage,
  recoveryTargets,
} from "../src/modules/shipping/recovery";
import { independentlyVerified } from "../src/modules/shipping/effective";
import { wrapped36, holdout36 } from "../tests/fixtures/shipping36";
import { paidRecovery36 } from "./lib/phase36-live";
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
  throw Error("PHASE36 explicit approval caps required");
const sha = arg("sha") ?? "",
  stage =
    arg("stage") === "recovery"
      ? "targeted"
      : arg("stage") === "complex"
        ? (arg("case") ?? "multi-declaration")
        : (arg("stage") ?? ""),
  repeats = Number(arg("repeat") ?? 1);
if (
  !/^[a-f0-9]{40}$/.test(sha) ||
  ![
    "normal",
    "targeted",
    "ports",
    "holdout",
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
  repeats > 5 ||
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
const dir = "test-results/live-phase36/private";
await mkdir(dir, { recursive: true, mode: 0o700 });
await chmod(dir, 0o700);
if (stage === "targeted") {
  const f = await wrapped36();
  const targets = recoveryTargets(f.document).filter((t) =>
    t.role.startsWith("portOf"),
  );
  const r = await paidRecovery36(sha, f, targets);
  const proposals = r.response?.proposals ?? [];
  const metrics = {
    stage,
    sourceSha: sha,
    inputHashes: [createHash("sha256").update(f.bytes).digest("hex")],
    evaluation: "synthetic-initial-candidates/real-targeted-call",
    initial: { verified: 0 },
    native: { verified: 0 },
    final: {
      verified: proposals.filter((p) => independentlyVerified(p.field)).length,
      literalCorrect: proposals.filter(
        (p) =>
          p.field.current.value ===
          (p.target.includes("portOfLoading") ? "KR PUS" : "US LAX"),
      ).length,
      targets: targets.length,
    },
    supplierCalls: r.response?.supplierCalls ?? null,
    usage: r.response?.usage ?? null,
    error: r.response?.error?.code ?? null,
    durationMs: r.durationMs,
    budget: r.budget,
    automaticRetries: 0,
  };
  await writeFile(
    `test-results/live-phase36/targeted-${sha.slice(0, 7)}-d${r.budget.documents}-metrics.json`,
    JSON.stringify(metrics, null, 2),
  );
  console.log(JSON.stringify(metrics, null, 2));
  if (
    metrics.final.verified !== 2 ||
    metrics.final.literalCorrect !== 2 ||
    metrics.supplierCalls !== 1
  )
    process.exitCode = 1;
} else
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
        const expectedHashes = [
          "d1559910f371e1c10b8613a198085c1006b2c1949621dfc9cff3384f22c301d5",
          "9f15bc729a940d23a61a488262d32b72fda464cec2d431802646f0dc9361d6a0",
          "04998575325ee7cd3e013fa146f130d65449b14071476b23217195284e389326",
        ];
        if (
          createHash("sha256").update(bytes).digest("hex") !== expectedHashes[i]
        )
          throw Error("Original fixture SHA changed");
        const pdf = {
          id: "phase36-user-" + i,
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
      if (stage === "holdout")
        fixtures = await Promise.all(shippingTypes.map((t) => holdout36(t)));
      if (stage === "ports")
        fixtures = [
          await build("house_bl"),
          await build("house_manifest", {
            ports: { loading: "LOS ANGELES, USA", discharge: "BUSAN, KOREA" },
          }),
        ];
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
                name: baseRow.name,
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
      result = await paid36(sha, runStage, fixtures),
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
    const docs = result.results.flatMap((r) =>
        r.document ? [r.document] : [],
      ),
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
        String(f.current.value).toUpperCase() === String(g.value).toUpperCase();
      return {
        document: g.index,
        role: g.role,
        extractedCorrect: vs.some(correct),
        verifiedCorrect: vs.some((f) => correct(f) && independentlyVerified(f)),
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
        : stage === "ports"
          ? ["portOfLoading", "portOfDischarge"]
          : [];
    const found = (review.primaryChecks ?? [])
      .filter((c) => c.assessment === "confirmed_mismatch")
      .map((c) => c.comparison?.meaning ?? c.category);
    const stages = Object.fromEntries(
      (["initial", "native", "final"] as const).map((phase) => {
        const ds = docs.map((d) =>
          recoveryStage(d, fixtures.find((f) => f.pdf.id === d.id)!.pdf, phase),
        );
        const rev = reviewShipping(ds);
        const cc = Object.fromEntries(
          coreMeanings.map((m) => [
            m,
            rev.primaryChecks?.find(
              (c) =>
                c.comparison?.scope === "hbl_record" &&
                c.comparison.meaning === m,
            )?.assessment ?? "not_performed",
          ]),
        );
        const truth = gold.map((g) => {
          const fs = ds[g.index] ? fieldsOf(ds[g.index], g.role) : [];
          const ok = (f: ShippingField) =>
            String(f.current.value).toUpperCase() ===
            String(g.value).toUpperCase();
          return {
            document: g.index,
            role: g.role,
            extractedCorrect: fs.some(ok),
            verifiedCorrect: fs.some((f) => ok(f) && independentlyVerified(f)),
          };
        });
        const statusCounts: Record<string, number> = {};
        for (const c of rev.primaryChecks ?? [])
          statusCounts[c.assessment] = (statusCounts[c.assessment] ?? 0) + 1;
        return [
          phase,
          {
            core: cc,
            coreMatches: Object.values(cc).filter(
              (x) => x === "confirmed_match",
            ).length,
            coreDenominator: coreMeanings.length,
            gold: truth,
            verifiedGold: truth.filter((x) => x.verifiedCorrect).length,
            goldDenominator: truth.length,
            statusCounts,
          },
        ];
      }),
    );
    const metrics = {
      stages,
      recovery: docs.map((d) => d.recoverySummary ?? null),
      recoveryUsage: result.results.map((r) => r.recoveryUsage ?? null),
      recoveryRequests: result.results.map((r) => r.recoveryRequests ?? null),
      stage: runStage,
      sourceSha: sha,
      inputHashes: fixtures.map((f) =>
        createHash("sha256").update(f.bytes).digest("hex"),
      ),
      budget: result.budget,
      diagnostics,
      core,
      gold: observedGold,
      classification: docs.filter(
        (d) => d.classificationStatus === "classified",
      ).length,
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
      falsePositive: [
        "normal",
        "mismatch",
        "ports",
        "holdout",
        "multiple-items",
        "multiple-containers",
        "multi-declaration",
        "partial",
        "shared-container",
      ].includes(stage)
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
      `test-results/live-phase36/${base}-metrics.json`,
      JSON.stringify(metrics, null, 2),
    );
    console.log(JSON.stringify(metrics, null, 2));
    if (
      docs.length !== fixtures.length ||
      result.results.some((r) => r.error) ||
      (stage === "normal" &&
        (coreMeanings.some((m) => core[m] !== "confirmed_match") ||
          found.length > 0))
    ) {
      process.exitCode = 1;
      break;
    }
  }
