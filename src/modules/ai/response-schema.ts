import { z } from "zod";
import { extractedDocumentSchema } from "../documents/schema";

// Use the documented REST JSON-schema subset. Unsupported string constraints stay
// mandatory in the local Zod validator; they are never relaxed on returned data.
export function geminiResponseSchema() {
  const schema = z.toJSONSchema(extractedDocumentSchema);
  const supported = new Set(["type", "format", "title", "description", "enum", "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties", "required"]);
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => supported.has(key)).map(([key, child]) => [key,
      key === "properties" && child && typeof child === "object"
        ? Object.fromEntries(Object.entries(child).map(([name, property]) => [name, clean(property)]))
        : clean(child),
    ]));
  };
  return clean(schema);
}
