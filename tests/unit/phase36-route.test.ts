import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapped36 } from "../fixtures/shipping36";
import { fixture35 } from "../fixtures/shipping35";
const extractor = vi.hoisted(() => vi.fn());
vi.mock("../../src/modules/shipping/targeted-recovery", async (original) => ({
  ...(await original<
    typeof import("../../src/modules/shipping/targeted-recovery")
  >()),
  extractTargeted: extractor,
}));
import { POST } from "../../src/app/api/recover/route";
function request(
  f: { bytes: Uint8Array; pdf: { id: string; fileName: string } },
  targets: unknown,
  origin = "http://localhost",
) {
  const form = new FormData();
  form.append(
    "files",
    new File([new Uint8Array(f.bytes)], f.pdf.fileName, {
      type: "application/pdf",
    }),
  );
  form.append("documentId", f.pdf.id);
  form.append("targets", JSON.stringify(targets));
  return new Request("http://localhost/api/recover", {
    method: "POST",
    body: form,
    headers: { origin },
  });
}
beforeEach(() => {
  extractor.mockReset();
});
describe("bounded explicit recovery route", () => {
  it("missing source data makes zero supplier requests", async () => {
    const f = await wrapped36();
    const r = await POST(
      request(f, [
        { id: "qty", role: "quantity", scope: "document", entityId: f.pdf.id },
      ]),
    );
    const p = await r.json();
    expect(p.supplierCalls).toBe(0);
    expect(p.proposals[0].field.current.value).toBeNull();
    expect(extractor).not.toHaveBeenCalled();
  });
  it("native-only recovery makes zero supplier requests and preserves stable document ID", async () => {
    const f = await fixture35("house_manifest", { totals: { quantity: 720 } });
    const r = await POST(
      request(f, [
        { id: "qty", role: "quantity", scope: "document", entityId: f.pdf.id },
      ]),
    );
    const p = await r.json();
    expect(p.supplierCalls).toBe(0);
    expect(p.proposals[0].field.current.value).toBe(720);
    expect(p.proposals[0].field.current.source.fileId).toBe(f.pdf.id);
    expect(extractor).not.toHaveBeenCalled();
  });
  it("provider failure preserves checked proposals and reports one attempt without retry", async () => {
    const f = await wrapped36();
    extractor.mockImplementation(async () => {
      throw new Error("synthetic provider failure");
    });
    const r = await POST(
      request(f, [
        {
          id: "pol",
          role: "portOfLoading",
          scope: "document",
          entityId: f.pdf.id,
        },
      ]),
    );
    const p = await r.json();
    expect(r.status).toBe(200);
    expect(p.supplierCalls).toBe(1);
    expect(p.error).toBeTruthy();
    expect(p.proposals).toHaveLength(1);
    expect(extractor).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign origins before processing a supplier call", async () => {
    const f = await wrapped36();
    const r = await POST(
      request(
        f,
        [
          {
            id: "pol",
            role: "portOfLoading",
            scope: "document",
            entityId: f.pdf.id,
          },
        ],
        "https://foreign.example",
      ),
    );
    expect(r.status).toBe(403);
    expect(extractor).not.toHaveBeenCalled();
  });
  it("rejects duplicate targets and more than six targets", async () => {
    const f = await wrapped36(),
      t = {
        id: "pol",
        role: "portOfLoading",
        scope: "document",
        entityId: f.pdf.id,
      };
    expect((await POST(request(f, [t, t]))).status).toBe(400);
    expect(
      (
        await POST(
          request(
            f,
            Array.from({ length: 7 }, (_, i) => ({ ...t, id: String(i) })),
          ),
        )
      ).status,
    ).toBe(400);
    expect(extractor).not.toHaveBeenCalled();
  });
});
