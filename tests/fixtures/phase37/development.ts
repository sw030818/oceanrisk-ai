import type { ShippingType } from "../../../src/modules/shipping/catalog";
export type Layout37 =
  | "cards"
  | "ledger"
  | "reversed"
  | "bilingual"
  | "continued"
  | "header-units";
export interface Product37 {
  en: string;
  ko: string;
  hs: string;
  quantity: number;
  model?: string;
}
export interface Scenario37 {
  id: string;
  partition: "development" | "holdout";
  kind: "normal" | "error" | "complex" | "uncertain";
  layout: Layout37;
  language: "en" | "ko" | "mixed";
  product: Product37;
  loading: string;
  discharge: string;
  error?:
    | "quantity"
    | "packageCount"
    | "grossWeight"
    | "containerNumber"
    | "sealNumber"
    | "houseBlNumber"
    | "declarationNumber"
    | "goodsDescription"
    | "portOfLoading"
    | "portOfDischarge";
  variant?:
    | "multi-declaration"
    | "multi-item"
    | "multi-container"
    | "split-item"
    | "shared"
    | "partial"
    | "missing-reference"
    | "duplicate"
    | "omitted-row"
    | "unsupported";
}
const products: Product37[] = [
  {
    en: "STAINLESS STEEL VACUUM BOTTLE 500ML",
    ko: "스테인리스 진공 보온병 500ML",
    hs: "7323.93-0000",
    quantity: 840,
  },
  {
    en: "COTTON T SHIRT MODEL TX7",
    ko: "면 티셔츠 모델 TX7",
    hs: "6109.10-0000",
    quantity: 360,
  },
  {
    en: "RUBBER SAFETY GLOVES SIZE XL",
    ko: "고무 안전 장갑 사이즈 XL",
    hs: "4015.19-0000",
    quantity: 1250,
  },
  {
    en: "ALUMINIUM BALL VALVE MODEL BV12",
    ko: "알루미늄 볼 밸브 모델 BV12",
    hs: "8481.80-0000",
    quantity: 96,
  },
  {
    en: "GLASS STORAGE JAR 1000ML",
    ko: "유리 저장 용기 1000ML",
    hs: "7010.90-0000",
    quantity: 540,
  },
  {
    en: "POLYESTER BACKPACK MODEL BP9",
    ko: "폴리에스터 배낭 모델 BP9",
    hs: "4202.92-0000",
    quantity: 420,
  },
  {
    en: "PAPER NOTEBOOK A5",
    ko: "종이 공책 A5",
    hs: "4820.10-0000",
    quantity: 1800,
  },
  {
    en: "CERAMIC DINNER PLATE 25CM",
    ko: "도자기 식사 접시 25CM",
    hs: "6912.00-0000",
    quantity: 720,
  },
  {
    en: "COPPER ELECTRIC CABLE 2MM",
    ko: "구리 전기 케이블 2MM",
    hs: "8544.49-0000",
    quantity: 280,
  },
  {
    en: "PLASTIC STORAGE BOX 20L",
    ko: "플라스틱 수납 상자 20L",
    hs: "3924.90-0000",
    quantity: 150,
  },
];
const layouts: Layout37[] = [
  "cards",
  "ledger",
  "reversed",
  "bilingual",
  "continued",
  "header-units",
];
const routes = [
  ["NLRTM", "SGSIN"],
  ["DEHAM", "GBSOU"],
  ["CNSHA", "JPTYO"],
  ["USNYC", "AUSYD"],
  ["KRPUS", "AEJEA"],
  ["BEANR", "FRLEH"],
];
function base(i: number): Scenario37 {
  return {
    id: `dev37-${i + 1}`,
    partition: "development",
    kind: "normal",
    layout: layouts[i % 6],
    language: (["en", "ko", "mixed"] as const)[i % 3],
    product: products[i % products.length],
    loading: routes[i % 6][0],
    discharge: routes[i % 6][1],
  };
}
// Truth is fixed before rendering/extraction. Each changes structure, language,
// cargo or an independent fault; identifiers alone do not create a new case.
export const development37: Scenario37[] = [
  ...Array.from({ length: 10 }, (_, i) => base(i)),
  ...(
    [
      "quantity",
      "packageCount",
      "grossWeight",
      "containerNumber",
      "sealNumber",
      "houseBlNumber",
      "declarationNumber",
      "goodsDescription",
      "portOfLoading",
      "portOfDischarge",
    ] as const
  ).map((error, i) => ({ ...base(i + 10), kind: "error" as const, error })),
  ...(
    [
      "multi-declaration",
      "multi-item",
      "multi-container",
      "split-item",
      "shared",
    ] as const
  ).map((variant, i) => ({
    ...base(i + 20),
    kind: "complex" as const,
    variant,
  })),
  ...(
    [
      "partial",
      "missing-reference",
      "duplicate",
      "omitted-row",
      "unsupported",
    ] as const
  ).map((variant, i) => ({
    ...base(i + 25),
    kind: "uncertain" as const,
    variant,
  })),
];
export const types37: ShippingType[] = [
  "house_bl",
  "export_declaration",
  "house_manifest",
];
