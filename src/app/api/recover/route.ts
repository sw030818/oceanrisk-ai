import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/modules/security/origin";
import { boundedFormData } from "@/modules/upload/request";
import { validateUploads } from "@/modules/upload/validate";
import { prepareShippingFile } from "@/modules/shipping/prepare";
import { emptyShippingField } from "@/modules/shipping/schema";
import {
  nativeCandidates,
  mergeRecovery,
  type RecoveryTarget,
} from "@/modules/shipping/recovery";
import { extractTargeted } from "@/modules/shipping/targeted-recovery";
import { verifyShippingField } from "@/modules/shipping/verify";
import { shippingRole } from "@/modules/shipping/roles";
import { safeError, AnalysisError } from "@/modules/documents/errors";
import type { AIUsage } from "@/modules/documents/schema";
export const runtime = "nodejs",
  maxDuration = 120,
  dynamic = "force-dynamic";
const input = z
  .array(
    z
      .object({
        id: z.string().min(1).max(100),
        role: z.enum([
          "quantity",
          "quantityUnit",
          "packageCount",
          "packageUnit",
          "grossWeight",
          "grossWeightUnit",
          "portOfLoading",
          "portOfDischarge",
          "shipper",
          "consignee",
        ]),
        scope: z.enum(["document", "item", "container", "cargo"]),
        entityId: z.string().min(1).max(100),
        owner: z
          .object({
            page: z.number().int().positive(),
            blockIds: z.array(z.string().max(40)).min(1).max(12),
          })
          .optional(),
      })
      .strict(),
  )
  .min(1)
  .max(6);
// Explicit bounded recovery is separate from automatic recovery (off by default).
// This returns independently checked proposals, never a forged full analysis or
// client-supplied verified state. Callers merge with protected original/current.
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store, private" };
  let usage: AIUsage | undefined;
  let supplierCalls = 0;
  let recoveryError: ReturnType<typeof safeError> | null = null;
  try {
    requireSameOrigin(request);
    const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(105000),
      ]),
      form = await boundedFormData(request, signal);
    const files = form.getAll("files");
    if (files.length !== 1 || !(files[0] instanceof File))
      throw new AnalysisError(
        "INVALID_REQUEST",
        "복구 요청에는 PDF 한 개가 필요합니다.",
        400,
      );
    validateUploads(files as File[]);
    const raw = String(form.get("targets") ?? "");
    if (raw.length > 5000)
      throw new AnalysisError(
        "INVALID_REQUEST",
        "복구 대상이 너무 많습니다.",
        400,
      );
    const selected = input.parse(JSON.parse(raw));
    if (new Set(selected.map((t) => t.id)).size !== selected.length)
      throw new AnalysisError("INVALID_REQUEST", "중복 복구 대상입니다.", 400);
    const prepared = await prepareShippingFile(
      files[0],
      "house_manifest",
      signal,
      typeof form.get("documentId") === "string"
        ? z.string().min(1).max(100).parse(form.get("documentId"))
        : undefined,
    );
    if (prepared.error)
      throw new AnalysisError("INVALID_REQUEST", prepared.error.message, 400);
    const pdf = prepared.pdf,
      targets: RecoveryTarget[] = [];
    for (const s of selected) {
      let owner: RecoveryTarget["owner"];
      if (s.scope !== "document") {
        if (!s.owner)
          throw new AnalysisError(
            "INVALID_REQUEST",
            "품목 또는 화물의 원문 식별 근거가 필요합니다.",
            400,
          );
        const p = pdf.pages.find((p) => p.page === s.owner!.page);
        const bs =
          p?.blocks?.filter((b) => s.owner!.blockIds.includes(b.id)) ?? [];
        const anchor =
          s.scope === "item"
            ? "goodsDescription"
            : s.scope === "container"
              ? "containerNumber"
              : "houseBlNumber";
        const text = bs
          .filter((b) => !shippingRole(b.text))
          .map((b) => b.text)
          .join(" ");
        const f = verifyShippingField(
          { value: text, evidence: s.owner },
          pdf,
          anchor,
          s.scope,
        );
        if (f.current.status !== "verified" || !f.current.source?.layout)
          throw new AnalysisError(
            "INVALID_REQUEST",
            "원문 행 소유권을 확인하지 못했습니다.",
            400,
          );
        owner = f.current.source.layout;
      }
      targets.push({
        id: s.id,
        role: s.role,
        scope: s.scope,
        entityId: s.entityId,
        field: emptyShippingField(),
        owner,
      });
    }
    const unresolved: RecoveryTarget[] = [];
    for (const t of targets) {
      const tested = nativeCandidates(pdf, t)
        .map((c) => ({
          c,
          f: verifyShippingField(c, pdf, t.role, t.scope, t.owner),
        }))
        .filter((v) => v.f.current.status === "verified");
      const unique = [
        ...new Map(
          tested.map((v) => [
            JSON.stringify([v.f.current.value, v.f.current.source?.segments]),
            v,
          ]),
        ).values(),
      ];
      if (unique.length === 1) mergeRecovery(pdf, t, unique[0].c, "native");
      else if (tested.length) unresolved.push(t);
    }
    if (unresolved.length) {
      try {
        supplierCalls = 1;
        const r = await extractTargeted(pdf, unresolved, {
          signal,
          onUsage: (u) => (usage = u),
        });
        for (const c of r.candidates) {
          const t = unresolved.find((t) => t.id === c.target);
          if (
            t &&
            r.candidates.filter((v) => v.target === c.target).length === 1 &&
            c.entityOwner === t.entityId &&
            c.candidateStatus === "found" &&
            c.value !== null &&
            c.page !== null
          )
            mergeRecovery(
              pdf,
              t,
              {
                value: c.value,
                evidence: { page: c.page, blockIds: c.blockIds },
              },
              "targeted_ai",
            );
        }
      } catch (e) {
        recoveryError = safeError(e);
      }
    }
    return NextResponse.json(
      {
        phase: "3.8",
        mode: "targeted-recovery",
        supplierCalls,
        error: recoveryError,
        usage: usage ?? null,
        proposals: targets.map((t) => ({
          target: t.id,
          entityOwner: t.entityId,
          field: t.field,
        })),
      },
      { headers },
    );
  } catch (e) {
    return NextResponse.json(
      {
        phase: "3.8",
        mode: "targeted-recovery",
        error: safeError(e),
        supplierCalls,
        usage: usage ?? null,
      },
      { status: e instanceof AnalysisError ? e.httpStatus : 400, headers },
    );
  }
}
