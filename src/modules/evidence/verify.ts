import { productQuantities } from "./quantity-evidence";
import { canonicalUnit } from "../documents/units";
import { numericTokens } from "./numbers";
import {
  evidenceBlocks,
  relatedLabel,
  tableLink,
  labelForValue,
  labelRole as labelForInline,
  type LayoutRole,
} from "../layout/relations";
import type {
  Evidence,
  EvidenceIssue,
  ExtractedDocument,
  GroundedDocument,
  GroundedField,
  PdfDocument,
} from "../documents/schema";
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}
function verifyFieldCore<T extends string | number>(
  field: {
    value: T | null;
    evidence: Evidence | null;
    evidenceIssue?: EvidenceIssue;
  },
  pdf: PdfDocument,
  role?: LayoutRole,
): GroundedField<T> {
  const source: GroundedField<T>["source"] = field.evidence
    ? { fileId: pdf.id, fileName: pdf.fileName, ...field.evidence }
    : null;
  const base = { value: field.value, source };
  if (field.value === null || field.value === "")
    return {
      ...base,
      status: "missing",
      reason: "문서에서 확인할 수 없는 값입니다.",
    };
  if (!field.evidence)
    return {
      ...base,
      status: "unverified",
      reason: field.evidenceIssue
        ? {
            page_missing: "AI가 지정한 근거 페이지가 실제 PDF에 없습니다.",
            block_missing:
              "AI 근거 블록이 해당 PDF 페이지에 존재하지 않습니다.",
            duplicate_block:
              "근거 후보에 중복 블록이 있어 유일한 인용을 확인하지 못했습니다.",
            citation_too_long:
              "근거 인용이 너무 길어 안전한 필드 단위로 확인하지 못했습니다.",
          }[field.evidenceIssue]
        : "원문 근거 후보가 없습니다.",
    };
  const page = pdf.pages.find((page) => page.page === field.evidence!.page);
  const quote = normalizeText(field.evidence.quote);
  const blocks = page ? evidenceBlocks(field.evidence, page) : null;
  if (
    !page ||
    !quote ||
    (field.evidence.segments
      ? !blocks
      : !normalizeText(page.text).includes(quote))
  )
    return {
      ...base,
      status: "unverified",
      reason: "근거 문구가 해당 페이지 원문과 일치하지 않습니다.",
    };
  const compatible = (actual: string) =>
    actual === role ||
    (role === "unit" && actual === "quantity") ||
    (role === "weightUnit" && ["netWeight", "grossWeight"].includes(actual)) ||
    (role === "packageQuantity" && actual === "packaging");
  // Anchor the field to the literal value cell, not every cited header/unit.
  // This keeps split numeric/unit blocks valid without accepting another row.
  const valueBlocks = blocks?.filter((block) =>
    typeof field.value === "number"
      ? numericTokens(block.text).includes(field.value)
      : normalizeText(block.text).includes(normalizeText(String(field.value))),
  );
  const anchored =
    valueBlocks
      ?.map((block) => tableLink(page!, [block]))
      .filter((link) => link && compatible(link.role)) ?? [];
  if (
    anchored.length > 1 &&
    new Set(anchored.map((link) => `${link!.tableId}/${link!.rowId}`)).size > 1
  )
    return {
      ...base,
      status: "unverified",
      reason:
        "인용된 값/단위가 서로 다른 상품 행에 걸쳐 있어 유일한 근거를 확인하지 못했습니다.",
    };
  const layout =
    role === "description"
      ? blocks && page
        ? tableLink(page, blocks)
        : null
      : anchored.length >= 1
        ? (anchored.find((link) => link?.role === role) ?? anchored[0])
        : blocks && page
          ? tableLink(page, blocks)
          : null;
  const valuePresent =
    typeof field.value === "number"
      ? role === "quantity" && !layout
        ? productQuantities(field.evidence.quote).some(
            (item) => item.value === field.value,
          )
        : numericTokens(quote).includes(field.value)
      : quote.includes(normalizeText(field.value));
  if (!valuePresent)
    return {
      ...base,
      status: "unverified",
      reason: "원문 근거에서 추출값을 확인하지 못했습니다.",
    };
  if (role === "sku" && layout && blocks) {
    const cells = blocks.filter(
      (block) =>
        block.row > Number(layout.tableId.split(":t")[1]) &&
        tableLink(page, [block])?.role === "sku",
    );
    if (
      normalizeText(cells.map((block) => block.text).join(" ")) !==
      normalizeText(String(field.value))
    )
      return {
        ...base,
        status: "unverified",
        reason: "제품 식별자의 전체 값이 실제 원문 셀과 일치하지 않습니다.",
      };
  }
  if (blocks) {
    if (source) {
      source.blocks = blocks;
      if (layout) source.layout = layout;
      const semanticRole = labelForValue(page, blocks, field.value);
      if (semanticRole) source.semanticRole = semanticRole;
    }
    if (
      layout &&
      role &&
      [
        "description",
        "unit",
        "amount",
        "netWeight",
        "grossWeight",
        "weightUnit",
        "sku",
        "unitPrice",
        "packageQuantity",
        "packageUnit",
      ].includes(role) &&
      !compatible(layout.role)
    )
      return {
        ...base,
        status: "unverified",
        reason: "추출 필드의 의미가 실제 표 열의 제목과 맞지 않습니다.",
      };
    if (role === "quantity" && layout) {
      const cells = blocks
        .filter((block) => block.row > Number(layout.tableId.split(":t")[1]))
        .filter((block) => tableLink(page, [block])?.role === "quantity");
      const values = cells.flatMap((block) => numericTokens(block.text));
      if (
        layout.role !== "quantity" ||
        values.length !== 1 ||
        values[0] !== field.value
      )
        return {
          ...base,
          status: "unverified",
          reason:
            "표의 상품 수량 열과 실제 데이터 셀을 유일하게 연결하지 못했습니다.",
        };
      return {
        ...base,
        status: "verified",
        reason: "실제 PDF의 상품 수량 열·데이터 행·숫자를 대조했습니다.",
      };
    }
    if (
      role &&
      [
        "seller",
        "buyer",
        "transactionReference",
        "purchaseOrder",
        "invoiceReference",
        "documentNumber",
        "shipmentReference",
        "bookingReference",
      ].includes(role) &&
      relatedLabel(page, blocks, field.value, role)
    )
      return {
        ...base,
        status: "verified",
        reason: "실제 원문 블록과 인접 라벨의 행·열 위치 관계를 확인했습니다.",
      };
    if (
      role &&
      [
        "seller",
        "buyer",
        "transactionReference",
        "purchaseOrder",
        "invoiceReference",
        "documentNumber",
        "shipmentReference",
        "bookingReference",
      ].includes(role)
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "인용된 실제 블록의 필드 역할과 값의 위치 관계가 확인되지 않습니다.",
      };
  }
  if (
    role &&
    [
      "netWeight",
      "grossWeight",
      "amount",
      "sku",
      "unitPrice",
      "packageQuantity",
      "shipmentReference",
      "bookingReference",
      "subtotalAmount",
      "discountAmount",
      "freightAmount",
      "taxAmount",
      "totalNetWeight",
      "totalGrossWeight",
      "totalPackages",
      "totalQuantity",
      "totalAmount",
    ].includes(role) &&
    (!layout ||
      ![
        "netWeight",
        "grossWeight",
        "amount",
        "sku",
        "unitPrice",
        "packageQuantity",
      ].includes(role))
  ) {
    const inlineRole =
      blocks && page
        ? labelForValue(page, blocks, field.value)
        : field.evidence.quote
            .split(/\r?\n/)
            .map((line) => line.split(":")[0])
            .map((label) => labelForInline(label))
            .find(Boolean);
    if (
      !(role === "packageQuantity"
        ? ["packaging", "packageQuantity"].includes(inlineRole ?? "")
        : inlineRole === role)
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "숫자/값은 존재하지만 해당 필드의 라벨·셀 의미를 확인하지 못했습니다.",
      };
    if (source && inlineRole) source.semanticRole = inlineRole;
    if (
      source &&
      ![
        "netWeight",
        "grossWeight",
        "amount",
        "sku",
        "unitPrice",
        "packageQuantity",
      ].includes(role)
    )
      delete source.layout;
  }
  if (
    typeof field.value === "string" &&
    role &&
    [
      "unit",
      "weightUnit",
      "packageUnit",
      "totalWeightUnit",
      "totalQuantityUnit",
    ].includes(role) &&
    !layout
  ) {
    const parents: Record<string, string[]> = {
      unit: ["unit", "quantity"],
      weightUnit: ["weightUnit", "netWeight", "grossWeight"],
      packageUnit: ["packageUnit", "packageQuantity", "packaging"],
      totalWeightUnit: [
        "totalWeightUnit",
        "totalNetWeight",
        "totalGrossWeight",
      ],
      totalQuantityUnit: ["totalQuantityUnit", "totalQuantity"],
    };
    const roles = (
      blocks?.map((b) => b.text) ?? field.evidence.quote.split(/\r?\n/)
    )
      .map((text) => labelForInline(text.split(":")[0]))
      .filter((r): r is string => !!r);
    if (!roles.length || roles.some((r) => !parents[role].includes(r)))
      return {
        ...base,
        status: "unverified",
        reason:
          "단위 문구는 있지만 상품·중량·포장 중 해당 단위의 실제 라벨 의미를 확인하지 못했습니다.",
      };
  }
  if (role === "quantity") {
    const quantities = productQuantities(field.evidence.quote);
    const quoteLines = field.evidence.quote.split(/\r?\n/).map(normalizeText);
    const context = page.text.split(/\r?\n/).filter((line) => {
      const normalized = normalizeText(line);
      return (
        normalized &&
        quoteLines.some(
          (quoted) =>
            quoted &&
            (normalized.includes(quoted) || quoted.includes(normalized)),
        )
      );
    });
    const productContext = context.some((line) =>
      productQuantities(line).some((item) => item.value === field.value),
    );
    if (
      !quantities.length ||
      quantities.some((item) => item.value !== field.value) ||
      !productContext
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "상품 수량 라벨의 수치를 명확히 확인하지 못했습니다. 포장 개수·다른 행 수량과 구분해 주세요.",
      };
  }
  if (role === "seller" || role === "buyer") {
    const label =
      role === "seller"
        ? /(?:seller|exporter|shipper|판매자|수출자)\s*[:=-]\s*/
        : /(?:buyer|importer|consignee|구매자|수입자)\s*[:=-]\s*/;
    const partyLine = field.evidence.quote
      .split(/\r?\n/)
      .map(normalizeText)
      .find((line) => label.test(line));
    const match = label.exec(partyLine ?? "");
    if (
      !match ||
      partyLine!.slice(match.index + match[0].length).trim() !==
        normalizeText(String(field.value))
    )
      return {
        ...base,
        status: "unverified",
        reason:
          "거래당사자 역할과 값을 원문 라벨에서 명확하게 확인하지 못했습니다.",
      };
  }
  if (
    (role === "transactionReference" ||
      role === "purchaseOrder" ||
      role === "invoiceReference") &&
    !/(?:order reference|purchase order|order no|p\.?o\.?\s*(?:no|number|#)|invoice reference|invoice no|주문 번호|거래 참조)\s*[:=#-]/.test(
      quote,
    )
  )
    return {
      ...base,
      status: "unverified",
      reason:
        "같은 거래를 연결하는 주문/Invoice 참조 근거가 명확하지 않습니다.",
    };
  if (
    role &&
    [
      "seller",
      "buyer",
      "purchaseOrder",
      "invoiceReference",
      "documentNumber",
    ].includes(role) &&
    field.evidence.segments
  )
    return {
      ...base,
      status: "unverified",
      reason:
        "원문 블록은 존재하지만 필드 라벨과 값의 연결이 확인되지 않습니다.",
    };
  return {
    ...base,
    status: "verified",
    reason:
      "원문 위치와 값이 대조되었습니다. 문서 자체의 진실성을 보증하지는 않습니다.",
  };
}
export function verifyField<T extends string | number>(
  field: {
    value: T | null;
    evidence: Evidence | null;
    evidenceIssue?: EvidenceIssue;
  },
  pdf: PdfDocument,
  role?: LayoutRole,
): GroundedField<T> {
  const result = verifyFieldCore(field, pdf, role);
  result.verificationCode =
    result.status === "verified"
      ? "verified"
      : result.status === "missing"
        ? "missing_value"
        : !field.evidence
          ? (field.evidenceIssue ?? "missing_evidence")
          : result.reason.includes("페이지 원문")
            ? "quote_mismatch"
            : result.reason.includes("추출값")
              ? "value_mismatch"
              : result.reason.includes("서로 다른 상품 행")
                ? "row_mismatch"
                : result.reason.includes("열") && result.reason.includes("유일")
                  ? "ambiguous_cell"
                  : result.reason.includes("라벨") ||
                      result.reason.includes("의미")
                    ? "role_mismatch"
                    : "context_unverified";
  return result;
}
export function groundDocument(
  data: ExtractedDocument,
  pdf: PdfDocument,
): GroundedDocument {
  const partial = verifyField(data.partialShipment, pdf);
  if (data.partialShipment.value === "unknown") {
    partial.status = "missing";
    partial.reason = "부분선적 여부가 원문에 명시되지 않았습니다.";
  } else if (partial.source) {
    const page = pdf.pages.find((page) => page.page === partial.source!.page);
    const quote = normalizeText(partial.source.quote);
    const noLine = (line: string) =>
      /^(?:partial shipment\s*[:=-]\s*no[.]?|(?:full|complete) shipment(?:\s*[:=-]\s*yes)?[.]?|부분선적\s*[:=-]\s*(?:아니오|없음)|전량 선적)$/.test(
        normalizeText(line),
      );
    const yesLine = (line: string) =>
      /^(?:partial shipment\s*[:=-]\s*yes[.]?|부분선적\s*[:=-]\s*(?:예|있음))$/.test(
        normalizeText(line),
      );
    const sourceLines = partial.source.quote.split(/\r?\n/);
    const allLines = pdf.pages.flatMap((page) => page.text.split(/\r?\n/));
    const scopeQualification = allLines.some(
      (line) =>
        /\bback[ -]?orders?\b|balance\s+(?:to|remaining)|remaining\s+(?:quantity|shipment)|over\s*\/\s*under\s*(?:delivery|shipment)|delivery\s+tolerance/i.test(
          line,
        ) &&
        !/\bno back[ -]?orders?\b|back[ -]?orders?\s*[:=-]\s*(?:none|0(?:\s*pcs)?\b)/i.test(
          line,
        ),
    );
    const conflicting =
      (allLines.some(noLine) && allLines.some(yesLine)) ||
      (data.partialShipment.value === "no" && scopeQualification);
    const sourceInActualLine = (line: string) =>
      normalizeText(line).includes(quote);
    const actualSourceLines =
      page?.text.split(/\r?\n/).filter(sourceInActualLine) ?? [];
    const explicit =
      !conflicting &&
      sourceLines.some(
        data.partialShipment.value === "no" ? noLine : yesLine,
      ) &&
      actualSourceLines.some(
        data.partialShipment.value === "no" ? noLine : yesLine,
      );
    partial.status =
      page &&
      (!partial.source.segments ||
        evidenceBlocks(partial.source, page) !== null) &&
      normalizeText(page.text).includes(quote) &&
      explicit
        ? "verified"
        : "unverified";
    partial.reason =
      partial.status === "verified"
        ? "원문의 명시적 선적 범위를 확인했습니다."
        : "부분선적 여부를 원문의 명시적 표현으로 확인하지 못했습니다.";
  }
  partial.verificationCode =
    partial.status === "verified"
      ? "verified"
      : partial.status === "missing"
        ? "missing_value"
        : "context_unverified";
  return {
    id: pdf.id,
    fileName: pdf.fileName,
    type: data.type,
    seller: verifyField(data.seller, pdf, "seller"),
    buyer: verifyField(data.buyer, pdf, "buyer"),
    documentNumber: verifyField(data.documentNumber, pdf, "documentNumber"),
    transactionReference: verifyField(
      data.transactionReference,
      pdf,
      "transactionReference",
    ),
    purchaseOrder: verifyField(
      data.purchaseOrder ?? { value: null, evidence: null },
      pdf,
      "purchaseOrder",
    ),
    invoiceReference: verifyField(
      data.invoiceReference ?? { value: null, evidence: null },
      pdf,
      "invoiceReference",
    ),
    shipmentReference: verifyField(
      data.shipmentReference ?? { value: null, evidence: null },
      pdf,
      "shipmentReference",
    ),
    bookingReference: verifyField(
      data.bookingReference ?? { value: null, evidence: null },
      pdf,
      "bookingReference",
    ),
    ...Object.fromEntries(
      (
        [
          "subtotalAmount",
          "discountAmount",
          "freightAmount",
          "taxAmount",
          "totalNetWeight",
          "totalGrossWeight",
          "totalWeightUnit",
          "totalPackages",
          "packageUnit",
          "totalQuantity",
          "totalQuantityUnit",
        ] as const
      ).map((key) => [
        key,
        verifyField<string | number>(
          data[key] ?? { value: null, evidence: null },
          pdf,
          key,
        ),
      ]),
    ),
    currency: verifyField(data.currency, pdf),
    totalAmount: verifyField(data.totalAmount, pdf, "totalAmount"),
    partialShipment: partial,
    items: data.items.map((item) => {
      const row = {
        description: verifyField(item.description, pdf, "description"),
        quantity: verifyField(item.quantity, pdf, "quantity"),
        unit: verifyField(item.unit, pdf, "unit"),
        netWeight: verifyField(item.netWeight, pdf, "netWeight"),
        grossWeight: verifyField(item.grossWeight, pdf, "grossWeight"),
        weightUnit: verifyField(item.weightUnit, pdf, "weightUnit"),
        amount: verifyField(item.amount, pdf, "amount"),
        sku: verifyField(
          item.sku ?? { value: null, evidence: null },
          pdf,
          "sku",
        ),
        unitPrice: verifyField(
          item.unitPrice ?? { value: null, evidence: null },
          pdf,
          "unitPrice",
        ),
        packageQuantity: verifyField(
          item.packageQuantity ?? { value: null, evidence: null },
          pdf,
          "packageQuantity",
        ),
        packageUnit: verifyField(
          item.packageUnit ?? { value: null, evidence: null },
          pdf,
          "packageUnit",
        ),
      };
      const quantityLayout = row.quantity.source?.layout;
      const descriptionLayout = row.description.source?.layout;
      const unitLayout = row.unit.source?.layout;
      if (data.items.length > 1 && !quantityLayout && !descriptionLayout) {
        row.quantity.status = row.quantity.value === null ? "missing" : "unverified";
        row.quantity.verificationCode = row.quantity.value === null ? "missing_value" : "row_mismatch";
        row.quantity.reason =
          "여러 상품이 있지만 품명과 수량을 같은 원문 행에 유일하게 연결하지 못했습니다.";
      }
      if (
        (quantityLayout || descriptionLayout) &&
        (!quantityLayout ||
          quantityLayout.role !== "quantity" ||
          descriptionLayout?.role !== "description" ||
          descriptionLayout.rowId !== quantityLayout.rowId ||
          descriptionLayout.tableId !== quantityLayout.tableId ||
          (unitLayout &&
            (unitLayout.rowId !== quantityLayout.rowId ||
              unitLayout.tableId !== quantityLayout.tableId ||
              !["unit", "quantity"].includes(unitLayout.role))))
      ) {
        row.quantity.status = "unverified";
        row.quantity.verificationCode = "row_mismatch";
        row.quantity.reason =
          "품명·상품 수량·단위가 같은 표의 동일 상품 행에 연결되지 않습니다.";
      }
      // A bad quantity citation must not invalidate correctly cited weights or
      // identifiers. Anchor each independent item field to its description row.
      const itemLayout = descriptionLayout ?? quantityLayout;
      if (itemLayout)
        for (const key of [
          "netWeight",
          "grossWeight",
          "weightUnit",
          "amount",
          "sku",
          "unitPrice",
          "packageQuantity",
          "packageUnit",
        ] as const) {
          const location = row[key].source?.layout;
          if (
            location &&
            (location.rowId !== itemLayout.rowId ||
              location.tableId !== itemLayout.tableId)
          ) {
            row[key].status = "unverified";
            row[key].verificationCode = "row_mismatch";
            row[key].reason =
              "다른 상품 행의 값을 이 품목과 연결할 수 없습니다.";
          }
        }
      if (
        row.weightUnit.value &&
        [row.netWeight, row.grossWeight].some(
          (field) =>
            field.source?.layout?.unit &&
            canonicalUnit(field.source.layout.unit) !==
              canonicalUnit(row.weightUnit.value),
        )
      ) {
        row.weightUnit.status = "unverified";
        row.weightUnit.verificationCode = "role_mismatch";
        row.weightUnit.reason =
          "순중량/총중량 열의 실제 단위와 추출 중량 단위가 충돌합니다.";
      }
      return row;
    }),
  };
}
export function editField<T>(
  field: GroundedField<T>,
  value: T | null,
): GroundedField<T> {
  return {
    ...field,
    value,
    status: "user_edited",
    verificationCode: "user_edited",
    reason: "사용자가 수정한 값입니다. 기존 원문 근거로 재확정하지 않았습니다.",
  };
}
