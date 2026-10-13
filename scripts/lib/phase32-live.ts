import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { openSync, closeSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  reserveTestBudget,
  reconcileTestBudget,
  requestUpperCost,
  type TestBudget,
} from "./openai-budget";
import { assertProduction } from "./release-policy";
import { shippingOpenAIRequest } from "../../src/modules/shipping/openai";
import { shippingValues } from "../../src/modules/shipping/fields";
import type { ShippingResult } from "../../src/modules/shipping/prepare";
import type { ShippingField } from "../../src/modules/shipping/schema";
import type { shipping32Fixture } from "../../tests/fixtures/shipping32";
export type Fixture32 = Awaited<ReturnType<typeof shipping32Fixture>>;
export const directory32 = "test-results/live-phase32",
  archive32 = "docs/validation/phase32-live-2026-10-13.json";
export function measure32(f: Fixture32, r: ShippingResult | undefined) {
  const d = r?.document,
    issues: {
      path: string;
      correct: boolean;
      status: string | null;
      code: string | null;
    }[] = [];
  const check = (
    path: string,
    w: ShippingField,
    a: ShippingField | undefined,
  ) => {
    if (w.original.value === null) return;
    issues.push({
      path,
      correct: a?.original.value === w.original.value,
      status: a?.original.status ?? null,
      code: a?.original.verificationCode ?? null,
    });
  };
  Object.entries(f.document.fields).forEach(([k, w]) =>
    check(k, w, d?.fields[k]),
  );
  for (const [i, w] of f.document.items.entries()) {
    const matches =
      d?.items.filter(
        (a) =>
          a.fields.goodsDescription.original.value ===
          w.fields.goodsDescription.original.value,
      ) ?? [];
    Object.entries(w.fields).forEach(([k, v]) =>
      check(
        `item${i}.${k}`,
        v,
        matches.length === 1 ? matches[0].fields[k] : undefined,
      ),
    );
  }
  for (const [i, w] of f.document.containers.entries()) {
    const matches =
      d?.containers.filter(
        (a) =>
          a.containerNumber.original.value === w.containerNumber.original.value,
      ) ?? [];
    for (const k of [
      "containerNumber",
      "sealNumber",
      "packageCount",
      "packageUnit",
      "grossWeight",
      "weightUnit",
    ] as const)
      check(
        `container${i}.${k}`,
        w[k],
        matches.length === 1 ? matches[0][k] : undefined,
      );
  }
  for (const [i, w] of f.document.cargoRecords.entries()) {
    const matches =
      d?.cargoRecords.filter((a) =>
        ["houseBlNumber", "containerNumber", "goodsDescription"].every(
          (k) => a.fields[k].original.value === w.fields[k].original.value,
        ),
      ) ?? [];
    Object.entries(w.fields).forEach(([k, v]) =>
      check(
        `cargo${i}.${k}`,
        v,
        matches.length === 1 ? matches[0].fields[k] : undefined,
      ),
    );
  }
  for (const [i, w] of f.document.references.entries()) {
    const matches =
      d?.references.filter(
        (a) =>
          a.kind === w.kind &&
          a.number.original.value === w.number.original.value,
      ) ?? [];
    check(
      `reference${i}`,
      w.number,
      matches.length === 1
        ? matches[0].number
        : d?.fields[
            w.kind === "house_bl"
              ? "houseBlNumber"
              : w.kind === "export_declaration"
                ? "declarationNumber"
                : "__no_own_reference"
          ],
    );
  }
  const present = d
    ? shippingValues(d).filter((f) => f.original.value !== null)
    : [];
  return {
    type: f.wire.type,
    structured: !!d && !r?.error,
    classificationCorrect:
      d?.classificationStatus === "classified" &&
      d.detectedType === f.wire.type,
    expected: issues.length,
    correct: issues.filter((f) => f.correct).length,
    groundedCorrect: issues.filter((f) => f.correct && f.status === "verified")
      .length,
    returned: present.length,
    returnedGrounded: present.filter((f) => f.original.status === "verified")
      .length,
    issues: issues.filter((f) => !f.correct || f.status !== "verified"),
    unverifiedPaths: present
      .filter((f) => f.original.status !== "verified")
      .map((f) => f.original.verificationCode ?? "context_unverified"),
    errorCode: r?.error?.code ?? null,
    diagnostics: r?.error?.diagnostics ?? null,
    extractionStatus: d?.extractionStatus ?? null,
  };
}
export async function paidBatch32(
  sha: string,
  stage: string,
  fixtures: Fixture32[],
  expectedPhase: string,
) {
  if (
    !/^[a-f0-9]{40}$/.test(sha) ||
    !["baseline", "normal", "mismatch", "uncertain", "repair"].includes(stage)
  )
    throw new Error("Invalid approved test stage");
  await mkdir(directory32, { recursive: true });
  const lock = openSync(directory32 + "/run.lock", "wx");
  try {
    let budget: TestBudget = {
      documents: 0,
      measuredCostUsd: 0,
      unresolvedCostUpperUsd: 0,
      maxDocuments: 12,
      maxCostUsd: 0.5,
    };
    for (const file of [archive32, directory32 + "/ledger.json"])
      try {
        const p = JSON.parse(await readFile(file, "utf8")),
          b = file === archive32 ? p.budget : p;
        if (!b) throw new Error("Missing budget");
        if (b.documents >= budget.documents) budget = b;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT")
          throw new Error("Unreadable budget; never reset");
      }
    // Reports are preserved separately so committing paid-test evidence does
    // not change the Production SHA that was actually tested. Recover the
    // latest budget there after a workspace replacement; fail closed on Git
    // network/auth failures rather than silently recreating a spent budget.
    const evidenceRef = "refs/heads/validation/phase32-evidence";
    const remote = spawnSync(
      "git",
      ["ls-remote", "--exit-code", "origin", evidenceRef],
      { encoding: "utf8" },
    );
    if (remote.status !== 0 && remote.status !== 2)
      throw new Error("Cannot verify archived validation budget; no paid call");
    if (remote.status === 0) {
      const fetched = spawnSync(
        "git",
        [
          "fetch",
          "--no-tags",
          "origin",
          evidenceRef + ":refs/remotes/origin/validation/phase32-evidence",
        ],
        { encoding: "utf8" },
      );
      const archived =
        fetched.status === 0
          ? spawnSync(
              "git",
              [
                "show",
                "refs/remotes/origin/validation/phase32-evidence:" + archive32,
              ],
              { encoding: "utf8" },
            )
          : null;
      if (archived?.status !== 0)
        throw new Error("Cannot read archived validation budget; no paid call");
      const b = JSON.parse(archived.stdout).budget as TestBudget;
      if (!b) throw new Error("Archived validation budget missing");
      if (
        b.documents > budget.documents ||
        (b.documents === budget.documents &&
          b.measuredCostUsd + b.unresolvedCostUpperUsd >
            budget.measuredCostUsd + budget.unresolvedCostUpperUsd)
      )
        budget = b;
    }
    if (
      budget.maxDocuments !== 12 ||
      budget.maxCostUsd !== 0.5 ||
      !Number.isSafeInteger(budget.documents) ||
      budget.documents < 0 ||
      budget.documents > 12 ||
      ![budget.measuredCostUsd, budget.unresolvedCostUpperUsd].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    )
      throw new Error("Invalid PHASE32 budget");
    const base = "https://oceanrisk-ai.vercel.app",
      s = await (
        await fetch(base + "/api/status?live32=" + Date.now(), {
          signal: AbortSignal.timeout(15000),
        })
      ).json();
    assertProduction(s, sha);
    if (s.phase !== expectedPhase || s.model !== "gpt-6-luna")
      throw new Error("Unexpected phase/model; no paid request");
    const bounds = fixtures.map((f) =>
      requestUpperCost(
        Buffer.byteLength(
          JSON.stringify(shippingOpenAIRequest(f.pdf, "gpt-6-luna")),
        ),
        8192,
      ),
    );
    reserveTestBudget(budget, bounds);
    const save = async () => {
      await writeFile(
        directory32 + "/ledger.tmp",
        JSON.stringify(budget, null, 2),
      );
      await rename(directory32 + "/ledger.tmp", directory32 + "/ledger.json");
    };
    await save();
    console.log(
      JSON.stringify({
        stage,
        sourceSha: sha,
        reservedDocuments: fixtures.length,
        reservedUpperUsd: bounds.reduce((a, b) => a + b, 0),
        totalDocumentReservations: budget.documents,
        maxDocuments: 12,
        maxUsd: 0.5,
        retries: 0,
      }),
    );
    const form = new FormData();
    for (const f of fixtures)
      form.append(
        "files",
        new File([new Uint8Array(f.bytes)], f.pdf.fileName, {
          type: "application/pdf",
        }),
      );
    form.append("slots", JSON.stringify(fixtures.map((f) => f.wire.type)));
    form.append("operation", "analyze");
    let body: { results: ShippingResult[]; review?: unknown } | null = null;
    try {
      const r = await fetch(base + "/api/analyze", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(115000),
      });
      const p = await r.json().catch(() => null);
      if (
        r.ok &&
        p?.mode === "shipping-analysis" &&
        p.results?.length === fixtures.length
      )
        body = p;
    } catch {
      /* preserve unknown reservation, never retry */
    }
    const results = body?.results ?? [];
    results.forEach((r, i) =>
      reconcileTestBudget(
        budget,
        bounds[i],
        r.aiUsage?.estimatedCostUsd ?? null,
      ),
    );
    await save();
    let postSha: string | null = null;
    try {
      postSha =
        (
          await (
            await fetch(base + "/api/status", {
              signal: AbortSignal.timeout(15000),
            })
          ).json()
        ).deployment?.commitSha ?? null;
    } catch {}
    const report = {
      stage,
      sourceSha: sha,
      postSha,
      sourceShaStable: postSha === sha,
      recordedAtUtc: new Date().toISOString(),
      model: "gpt-6-luna",
      budget,
      automaticRetries: 0,
      batchRequests: 1,
      measurements: fixtures.map((f, i) => measure32(f, results[i])),
      usage: results.map((r) => r.aiUsage ?? null),
    };
    await writeFile(
      directory32 + "/" + stage + "-" + sha.slice(0, 7) + ".json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
    return { results, body, report };
  } finally {
    closeSync(lock);
    unlinkSync(directory32 + "/run.lock");
  }
}
