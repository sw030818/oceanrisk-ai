// Bounded, explainable vocabulary, not a translation model. Unknown text is
// retained; HS equality never supplies a missing product meaning or qualifier.
export type GoodsMeaning =
  | "exact"
  | "semantic"
  | "partial"
  | "different"
  | "insufficient";
const vocabulary: [string, RegExp][] = [
  [
    "kind:bottle",
    /보온병|물병|\bbottles?\b|(?<=vacuum\s)flasks?\b|\bthermos(?:es)?\b/gi,
  ],
  ["kind:shirt", /티셔츠|\bt[ -]?shirts?\b/gi],
  ["kind:glove", /장갑|\bgloves?\b/gi],
  ["kind:valve", /밸브|\bvalves?\b/gi],
  ["kind:jar", /유리\s*저장\s*용기|\bjars?\b/gi],
  ["kind:backpack", /배낭|\bbackpacks?\b/gi],
  ["kind:notebook", /공책|노트북(?!\s*컴퓨터)|\bnotebooks?\b/gi],
  ["kind:plate", /접시|\bplates?\b/gi],
  ["kind:cable", /케이블|\bcables?\b/gi],
  ["kind:box", /상자|\bboxes\b|\bbox\b/gi],
  ["kind:pipe", /파이프|\bpipes?\b/gi],
  ["kind:mug", /머그컵|머그|\bmugs?\b/gi],
  ["material:stainless", /스테인리스(?:강)?|\bstainless(?:\s+steel)?\b/gi],
  ["material:cotton", /면(?=\s|티셔츠|$)|\bcotton\b/gi],
  ["material:rubber", /고무|\brubber\b/gi],
  ["material:aluminium", /알루미늄|\balumin(?:ium|um)\b/gi],
  ["material:glass", /유리|\bglass\b/gi],
  ["material:polyester", /폴리에스터|\bpolyester\b/gi],
  ["material:paper", /종이|\bpaper\b/gi],
  ["material:ceramic", /도자기|세라믹|\bceramic\b/gi],
  ["material:copper", /구리|\bcopper\b/gi],
  ["material:plastic", /플라스틱|\bplastic\b/gi],
  ["material:polypropylene", /폴리프로필렌|\bpolypropylene\b/gi],
  ["feature:vacuum", /진공|\bvacuum\b/gi],
  ["feature:safety", /안전|\bsafety\b/gi],
  ["feature:ball", /볼(?=\s|$)|\bball\b/gi],
  ["feature:storage", /저장|수납|\bstorage\b/gi],
  ["feature:dinner", /식사|\bdinner\b/gi],
  ["feature:electric", /전기|\belectric(?:al)?\b/gi],
];
const clean = (v: unknown) =>
  typeof v === "string"
    ? v.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim()
    : "";
export function goodsMeaning(value: unknown) {
  const original = typeof value === "string" ? value : "",
    normalized = clean(value);
  let rest = normalized.replace(/[()]/g, " ");
  const attributes = new Set<string>();
  // Korean jar phrase carries both literal material and kind.
  if (/유리\s*저장\s*용기/.test(rest)) {
    attributes.add("material:glass");
    attributes.add("feature:storage");
  }
  for (const [attribute, pattern] of vocabulary) {
    rest = rest.replace(pattern, () => {
      attributes.add(attribute);
      return " ";
    });
  }
  rest = rest.replace(
    /(\d+(?:\.\d+)?)\s*(ml|밀리리터|리터|l|mm|밀리미터|cm|센티미터)\b/gi,
    (_, number: string, unit: string) => {
      const dimension = /^(ml|밀리리터|리터|l)$/i.test(unit)
        ? "volume"
        : "length";
      const factor = /^(리터|l)$/i.test(unit)
        ? 1000
        : /^(cm|센티미터)$/i.test(unit)
          ? 10
          : 1;
      attributes.add(`${dimension}:${Number(number) * factor}`);
      return " ";
    },
  );
  rest = rest.replace(
    /(?:\bmodel\b|모델)\s*([a-z0-9]+(?:[.-][a-z0-9]+)*)/gi,
    (_, model: string) => {
      attributes.add("model:" + model);
      return " ";
    },
  );
  rest = rest.replace(
    /(?:\bsize\b|사이즈)\s*(xxl|xl|xs|[sml]|\d+)\b/gi,
    (_, size: string) => {
      attributes.add("size:" + size);
      return " ";
    },
  );
  rest = rest.replace(/\ba[0-6]\b/g, (s) => {
    attributes.add("format:" + s);
    return " ";
  });
  rest = rest
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const attrs = [...attributes].sort(),
    knownKind = attrs.some((a) => a.startsWith("kind:"));
  return {
    original,
    normalized,
    language: /[가-힣]/.test(original)
      ? /[a-z]{3}/i.test(original)
        ? "mixed"
        : "ko"
      : "other",
    attributes: attrs,
    residual: rest,
    complete: knownKind && !rest,
    key: knownKind && !rest ? attrs.join("|") : normalized,
  };
}
export function compareGoods(
  a: unknown,
  b: unknown,
): { status: GoodsMeaning; reasons: string[] } {
  const l = goodsMeaning(a),
    r = goodsMeaning(b);
  if (!l.normalized || !r.normalized)
    return { status: "insufficient", reasons: ["품명이 없습니다."] };
  if (l.normalized === r.normalized)
    return { status: "exact", reasons: ["원문 품명이 같습니다."] };
  for (const dimension of [
    "kind",
    "material",
    "model",
    "size",
    "format",
    "volume",
    "length",
  ]) {
    const x = l.attributes.filter((v) => v.startsWith(dimension + ":")),
      y = r.attributes.filter((v) => v.startsWith(dimension + ":"));
    if (x.length && y.length && x.join() !== y.join())
      return {
        status: "different",
        reasons: [`${dimension} 명시 속성이 충돌합니다.`],
      };
  }
  if (l.complete && r.complete && l.key === r.key)
    return {
      status: "semantic",
      reasons: [
        "명시된 품목·재질·모델·규격 속성이 제한된 한영 사전에서 대응합니다.",
      ],
    };
  const kind = l.attributes.find((v) => v.startsWith("kind:"));
  return kind && r.attributes.includes(kind)
    ? {
        status: "partial",
        reasons: ["같은 품목군이지만 잔여 설명 또는 속성을 확인해야 합니다."],
      }
    : {
        status: "insufficient",
        reasons: [
          "지원되지 않는 설명을 번역하거나 HS만으로 동일 상품을 추정하지 않습니다.",
        ],
      };
}
