// Deterministic shipping comparison contract; extraction is separate.
import type { ShipmentFact, FactReason } from "./facts";
import type { Assessment } from "../rules/model";
import type { z } from "zod";
import type { shipmentRelationshipSchema } from "./schema";
import type { ShippingField } from "./schema";
export type ShippingAssessment =
  Assessment | "not_comparable" | "not_applicable";
export type ShippingRelationship = z.infer<
  typeof shipmentRelationshipSchema
> & {
  mappingWarnings?: {
    role: "declarationNumber";
    code: "DECLARATION_MEMBERSHIP_UNRESOLVED";
  }[];
  sharedRoles: string[];
  conflictRoles: string[];
  evidence: ShippingCheck["fields"];
};
export interface ShippingCheck {
  // A proved AI language opinion is information, not a confirmed numeric match.
  disposition?: "informational";
  semantic?: { source: "openai"; relation: import("./semantic-schema").SemanticDecision["relation"]; validationCode: string; model?: string; claims: import("./semantic-schema").SemanticDecision["claims"]; nativeClaims?: import("./semantic-schema").SemanticDecision["claims"]; prior?: { assessment: ShippingAssessment; explanation: string; reasonCodes: FactReason[] } };
  // Produced only by deterministic, fully grounded declaration aggregation.
  declarationCoverage?: {
    hblDocumentId: string;
    declarationDocumentIds: string[];
  };
  scopeResolution?: {
    groupCheckId: string;
    kind: "subset" | "allocation" | "aligned_carriers";
  };
  documentIds?: string[];
  comparison?: {
    meaning: string;
    hbl: string | null;
    scope: "hbl_record" | "original_check" | "document_record";
    reasonCodes: FactReason[];
    relatedCheckIds: string[];
    facts: ShipmentFact[];
  };
  title?: string;
  importance?: "info" | "attention" | "high";
  uncertainties?: string[];
  computedValues?: {
    documentId: string;
    value: number;
    unit: string;
    formula: "sum" | "single_row";
    componentKeys: string[];
  }[];
  id: string;
  scope:
    | "house_bl_manifest"
    | "declaration_manifest"
    | "house_bl_declaration"
    | "triangle"
    | "document";
  category:
    | "reference"
    | "goods"
    | "quantity"
    | "unit"
    | "packaging"
    | "weight"
    | "container"
    | "party"
    | "port";
  assessment: ShippingAssessment;
  relationshipIds: string[];
  fields: {
    documentId: string;
    itemId?: string;
    containerId?: string;
    cargoId?: string;
    referenceId?: string;
    fieldName: string;
    field: ShippingField;
  }[];
  explanation: string;
  followUp: string;
}
export interface ShippingReview {
  semantic?: import("./semantic-schema").SemanticReport;
  issues?: import("./issues").ReviewIssue[];
  primaryChecks?: ShippingCheck[];
  outcomes?: {
    matches: number;
    informational?: number;
    mismatches: number;
    review: number;
    requiredMissing: number;
    notApplicable: number;
    notComparable: number;
    /** Original AI diagnostics, including fields subsequently recovered. */
    evidenceFailed: number;
    evidenceUnverified?: number;
    evidenceRecovered?: number;
    checksExecuted: number;
    independentChecks: number;
  };
  status: "not_performed" | "complete" | "needs_review";
  checks: ShippingCheck[];
  relationships?: ShippingRelationship[];
  pairStatus?: "performed" | "not_performed";
  triangleStatus?: "performed" | "not_comparable" | "insufficient_documents";
  reason?: string;
  summary?: {
    matches: number;
    confirmedMismatches: number;
    provisional: number;
    needsReview: number;
    insufficient: number;
    notComparable: number;
    confirmedRelationships: number;
    proposedRelationships: number;
    userConfirmedRelationships: number;
    conflictingRelationships: number;
    pairChecks: number;
    triangleChecks: number;
  };
}
