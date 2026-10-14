import { render37, type Document37 } from "./render";
import { types37, type Scenario37 } from "./development";
export async function scenario37(s: Scenario37) {
  const hbl = "HBL-" + s.id.toUpperCase(),
    decl = "DECL-" + s.id.toUpperCase();
  const base: Document37 = {
    id: "",
    type: "house_bl",
    layout: s.layout,
    language: s.language,
    hbl,
    declaration: decl,
    loading: s.loading,
    discharge: s.discharge,
    rows: [
      {
        name: s.product.en,
        hs: s.product.hs,
        quantity: s.product.quantity,
        unit: "PCS",
      },
    ],
    shipper:
      "SYNTHETIC " +
      ["HORIZON", "BLUE HARBOR", "CEDAR", "SILVER LEAF", "ATLAS", "ORION"][
        Number(s.id.match(/\d+$/)?.[0] ?? 0) % 6
      ] +
      " EXPORT CO",
    consignee:
      "SYNTHETIC " +
      ["NORTHLAND", "MAPLE", "PACIFIC", "SUNRISE", "WESTPORT"][
        Number(s.id.match(/\d+$/)?.[0] ?? 0) % 5
      ] +
      " IMPORT CO",
    packages: 42,
    gross: 987.5,
    container: "TEST" + s.id.replace(/[^0-9]/g, "").padStart(7, "0"),
    seal: "SEAL-" + s.id,
    scope: "full shipment",
  };
  const specs = types37.map((type) => ({
    ...structuredClone(base),
    id: s.id + "-" + type,
    type,
    language: s.language,
    rows: [
      {
        ...base.rows[0],
        name:
          s.language === "en" || type === "house_bl"
            ? s.product.en
            : s.product.ko,
      },
    ],
  }));
  const m = specs[2];
  if (s.error) {
    const k = s.error;
    if (k === "quantity") m.rows[0].quantity -= 12;
    else if (k === "goodsDescription")
      m.rows[0].name = "POLYPROPYLENE INDUSTRIAL PIPE 30MM";
    else if (k === "packageCount") m.packages -= 4;
    else if (k === "grossWeight") m.gross -= 87.5;
    else if (k === "containerNumber") m.container = "OTHER-CN-37";
    else if (k === "sealNumber") m.seal = "OTHER-SEAL-37";
    else if (k === "houseBlNumber") m.hbl = "OTHER-HBL-37";
    else if (k === "declarationNumber") {
      specs[0].declarations = [decl];
      m.declarations = ["OTHER-DECL-37"];
    } else if (k === "portOfLoading") m.loading = "NZAKL";
    else m.discharge = "NZAKL";
  }
  if (s.variant === "multi-container")
    for (const d of specs)
      d.containerRows = [
        { number: d.container, seal: d.seal, packages: 21, gross: 493.75 },
        {
          number: d.container + "B",
          seal: d.seal + "B",
          packages: 21,
          gross: 493.75,
        },
      ];
  if (
    s.variant === "multi-item" ||
    s.variant === "multi-declaration" ||
    s.variant === "split-item"
  )
    for (const d of specs)
      d.rows = [
        { ...d.rows[0], quantity: Math.floor(s.product.quantity / 2) },
        {
          ...d.rows[0],
          name: d.rows[0].name + " MODEL B2",
          quantity: s.product.quantity - Math.floor(s.product.quantity / 2),
        },
      ];
  if (s.variant === "multi-declaration" || s.variant === "split-item") {
    const a = {
        ...specs[1],
        id: s.id + "-declaration-a",
        declaration: decl + "-A",
        rows: [specs[1].rows[0]],
      },
      b = {
        ...specs[1],
        id: s.id + "-declaration-b",
        declaration: decl + "-B",
        rows: [specs[1].rows[1]],
      };
    if (s.variant === "split-item")
      b.rows = [
        { ...a.rows[0], quantity: base.rows[0].quantity - a.rows[0].quantity },
      ];
    specs[0].declarations = [a.declaration, b.declaration];
    specs.splice(1, 1, a, b);
  }
  if (s.variant === "partial") m.scope = "partial shipment";
  if (s.variant === "partial") m.rows[0].quantity -= 12;
  if (s.variant === "shared") m.scope = "combined packages / shared container";
  if (s.variant === "missing-reference") delete specs[1].hbl;
  if (s.variant === "duplicate")
    specs.push({ ...structuredClone(specs[0]), id: s.id + "-bl-amended" });
  if (s.variant === "omitted-row") {
    m.rows.push({
      ...m.rows[0],
      name: "ADDITIONAL UNEXTRACTED GOODS",
      quantity: 25,
    });
    m.omitRows = [1];
  }
  if (s.variant === "unsupported") m.unsupported = true;
  return { scenario: s, fixtures: await Promise.all(specs.map(render37)) };
}
