// PHASE 3.1–3.2 contract only; PHASE 3.0 produces no checks or verdicts.
import type { Assessment } from "../rules/model";
import type { ShippingField } from "./schema";
export interface ShippingCheck {
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
  assessment: Assessment;
  relationshipIds: string[];
  fields: {
    documentId: string;
    itemId?: string;
    containerId?: string;
    fieldName: string;
    field: ShippingField;
  }[];
  explanation: string;
  followUp: string;
}
export interface ShippingReview {
  status: "not_performed" | "complete" | "needs_review";
  checks: ShippingCheck[];
}
