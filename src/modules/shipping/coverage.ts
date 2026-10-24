import { verifyShippingField } from "./verify";
import { nativeCell,cellHeading } from "../layout/shipping-geometry";
import { effectiveProof } from "./effective";
import { shippingCell, type EntityScope } from "../layout/shipping-cells";
import type { PdfDocument } from "../documents/schema";
import type { ShippingDocument, ShippingField } from "./schema";
export function collectionCoverage32(doc: ShippingDocument, pdf: PdfDocument) {
  const roles = {
    item: ["goodsDescription", "tradeDescription"],
    container: ["containerNumber"],
    cargo: ["houseBlNumber"],
  };
  const rows = (
    scope: Exclude<EntityScope, "document">,
    fields: ShippingField[],
  ) => {
    const actual = new Set<string>();
    const containerViews = new Map<string,Map<string,Set<string>>>();
    const identity=(v:unknown)=>String(v??"").normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
    for (const p of pdf.pages)
      for (const b of p.blocks ?? []) {
        const cell=nativeCell(p,b);
        const heading=cell&&cellHeading(p,cell);
        if(heading?.role && heading.blocks.includes(b))continue;
        const l = shippingCell(p, [b], scope);
        if (l && roles[scope].includes(l.role)) {
          const key=`${p.page}/${l.tableId}/${l.rowId}`;
          actual.add(key);
          if(scope === "container") {
            const id=identity(b.text),table=`${p.page}/${l.tableId}`,views=containerViews.get(id)??new Map<string,Set<string>>();
            const rows=views.get(table)??new Set<string>();rows.add(key);views.set(table,rows);containerViews.set(id,views);
          }
        }
      }
    const extracted = fields.map((f) => {
      const s = effectiveProof(f).source;
      return effectiveProof(f).status === "verified" && s?.layout
        ? `${s.page}/${s.layout.tableId}/${s.layout.rowId}`
        : null;
    });
    if(scope === "container") {
      // Repeated identities in DIFFERENT independently located tables can be
      // alternate views. Repeated rows WITHIN one table are never collapsed.
      const required=[...containerViews.values()].reduce((n,views)=>n+Math.max(...[...views.values()].map(rows=>rows.size)),0);
      const grouped=new Map<string,{key:string|null;verified:boolean}[]>();
      for(const [i,f]of fields.entries()) {
        const proof=effectiveProof(f),id=identity(proof.value),rows=grouped.get(id)??[];
        rows.push({key:extracted[i],verified:proof.status === "verified"});grouped.set(id,rows);
      }
      const complete=required>0&&fields.length===required&&new Set(extracted).size===extracted.length&&
        [...containerViews].every(([id,views])=>{
          const rows=grouped.get(id)??[],all=new Set([...views.values()].flatMap(s=>[...s]));
          return rows.length===Math.max(...[...views.values()].map(s=>s.size))&&rows.every(r=>r.verified&&r.key!==null&&all.has(r.key));
        });
      return {complete,rowCount:required};
    }
    // Cargo records that split one row's container/goods list are views of
    // that row (ground keeps their identity verified and withholds amounts;
    // other duplicates become unverified). Each native row must be covered.
    const keys = scope === "cargo" ? new Set(extracted) : null;
    return {
      complete:
        actual.size > 0 &&
        extracted.every((v) => v !== null && actual.has(v)) &&
        (keys
          ? keys.size === actual.size
          : extracted.length === actual.size &&
            new Set(extracted).size === extracted.length),
      rowCount: actual.size,
    };
  };
  return {
    items: rows(
      "item",
      doc.items.map((i) =>
        effectiveProof(i.fields.goodsDescription).value !== null
          ? i.fields.goodsDescription
          : i.fields.tradeDescription,
      ),
    ),
    containers: rows(
      "container",
      doc.containers.some(
        (c) => effectiveProof(c.containerNumber).value !== null,
      )
        ? doc.containers
            .filter((c) => effectiveProof(c.containerNumber).value !== null)
            .map((c) => c.containerNumber)
        : doc.cargoRecords
            .filter(
              (c) =>
                c.fields.containerNumber &&
                effectiveProof(c.fields.containerNumber).value !== null,
            )
            .map((c) => c.fields.containerNumber),
    ),
    cargoRecords: rows(
      "cargo",
      doc.cargoRecords.map((c) => c.fields.houseBlNumber),
    ),
  };
}

export function nativeFactCoverage(doc: ShippingDocument, pdf: PdfDocument) {
  const nativeCargoRows = new Map<string,string>();
  let allCargoAnchorsVerified = !pdf.pages.some(p=>p.textSource === "ocr");
  for (const p of pdf.pages) for (const b of p.blocks ?? []) {
    const link=shippingCell(p,[b],"cargo");
    if (!link || link.role!=="houseBlNumber") continue;
    const tested=verifyShippingField({value:b.text,evidence:{page:p.page,blockIds:[b.id]}},pdf,"houseBlNumber","cargo");
    const key=`${p.page}/${link.tableId}/${link.rowId}`;
    if(tested.current.status!=="verified") { allCargoAnchorsVerified=false;continue; }
    const old=nativeCargoRows.get(key);
    if(old && old!==b.text)allCargoAnchorsVerified=false;
    nativeCargoRows.set(key,b.text);
  }
  const build = (
    kind: "items" | "containers" | "cargoRecords",
    fields: ShippingField[],
  ) => {
    const native = fields.every(
      (f) =>
        effectiveProof(f).status === "verified" &&
        effectiveProof(f).source?.provenance !== "ocr" &&
        !!effectiveProof(f).source?.layout?.tableId,
    );
    const cited = fields
      .flatMap((f) => {
        const s = effectiveProof(f).source;
        return s?.layout
          ? [`${s.page}/${s.layout.tableId}/${s.layout.rowId}`]
          : [];
      })
      .sort();
    // Verified cargo views of one row count that row once.
    const rows = kind === "cargoRecords" ? [...new Set(cited)] : cited;
    return {
      complete:
        !!doc.collectionCoverage?.[kind].complete &&
        native &&
        new Set(rows).size === rows.length &&
        rows.length > 0,
      rows,
      ...(kind === "cargoRecords" && allCargoAnchorsVerified && nativeCargoRows.size>0 && nativeCargoRows.size<=100 && nativeCargoRows.size===doc.collectionCoverage?.cargoRecords.rowCount ? {
        nativeRows:[...nativeCargoRows.keys()].sort(),nativeHbls:[...new Set(nativeCargoRows.values())].sort(),
      } : {}),
    };
  };
  const limitations: (
    | "partial"
    | "combined_packages"
    | "incomplete_table"
    | "ocr"
  )[] = [];
  if (doc.nativeScopeLimitation) limitations.push(doc.nativeScopeLimitation);
  if (pdf.pages.some((p) => p.textSource === "ocr")) limitations.push("ocr");
  if (
    pdf.pages.some((p) =>
      /일부\s*품목|부분\s*목록|일부\s*화물|일부\s*내역|subset\s+of|selected\s+items/i.test(
        p.text,
      ),
    )
  )
    limitations.push("incomplete_table");
  return {
    items: build(
      "items",
      doc.items.map((i) =>
        effectiveProof(i.fields.goodsDescription).value !== null
          ? i.fields.goodsDescription
          : i.fields.tradeDescription,
      ),
    ),
    containers: build(
      "containers",
      doc.containers
        .filter((c) => effectiveProof(c.containerNumber).value !== null)
        .map((c) => c.containerNumber),
    ),
    cargoRecords: build(
      "cargoRecords",
      doc.cargoRecords.map((c) => c.fields.houseBlNumber),
    ),
    limitations,
  };
}
