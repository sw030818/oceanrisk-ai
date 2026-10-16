// Server-only integrity receipt. This is not a login/access code or permission
// to skip evidence verification. It stops client-forged "verified" snapshots
// from being sent to the second paid provider stage.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { shippingDocumentSchema, type ShippingDocument } from "./schema";
import { stableJson } from "./semantic-schema";
export const semanticSnapshotSchema = z.strictObject({
  document: shippingDocumentSchema,
  sourceSha: z.string().regex(/^(?:local|[a-f0-9]{40})$/),
  expiresAt: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});
export type SemanticSnapshot = z.infer<typeof semanticSnapshotSchema>;
function mac(document:ShippingDocument,expiresAt:number,key:string,sourceSha:string) {
  return createHmac("sha256",key).update("oceanrisk-semantic-v39\n"+sourceSha+"\n"+expiresAt+"\n"+stableJson(document)).digest("hex");
}
export function signSemanticSnapshot(document:ShippingDocument,key=process.env.OPENAI_API_KEY,now=Date.now()):SemanticSnapshot|undefined {
  if(!key)return;
  const source=shippingDocumentSchema.parse(document),expiresAt=now+2*60*60*1000;
  const sourceSha=process.env.VERCEL_GIT_COMMIT_SHA??"local";
  return {document:source,sourceSha,expiresAt,signature:mac(source,expiresAt,key,sourceSha)};
}
export function verifySemanticSnapshot(snapshot:SemanticSnapshot,key=process.env.OPENAI_API_KEY,now=Date.now()) {
  if(!key||snapshot.sourceSha!==(process.env.VERCEL_GIT_COMMIT_SHA??"local")||snapshot.expiresAt<now||snapshot.expiresAt>now+2*60*60*1000)return false;
  const expected=Buffer.from(mac(snapshot.document,snapshot.expiresAt,key,snapshot.sourceSha),"hex"),actual=Buffer.from(snapshot.signature,"hex");
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
