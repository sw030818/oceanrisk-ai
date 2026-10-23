import { describe, it, expect } from "vitest";
import { shipping34Fixture } from "../fixtures/shipping34";
import { portIdentity, portMeaning, relatePorts, countryCode } from "../../src/modules/shipping/ports";
import { reviewShipping } from "../../src/modules/shipping/review";
import data from "../../src/modules/shipping/ports-data.json" with { type: "json" };
import gazetteer from "../../src/modules/shipping/ports-gazetteer.json" with { type: "json" };
import exonyms from "../../src/modules/shipping/ports-exonyms.json" with { type: "json" };

const rel = (a: string, b: string, ca?: string, cb?: string) =>
  relatePorts({ value: a, country: ca ?? null }, { value: b, country: cb ?? null });

describe("port gazetteer provenance", () => {
  it("is generated from the pinned UN/LOCODE bytes and holds port-function entries only", () => {
    expect(gazetteer.sha256).toBe(data.supplementalSource.sha256);
    const rows = gazetteer.rows.split("\n");
    expect(rows.length).toBeGreaterThan(17000);
    expect(new Set(rows.map((r) => r.split("|")[0])).size).toBe(rows.length);
    // Industry codes now assigned to airports in UN/LOCODE are not ports here.
    for (const airport of ["CNSHA", "CNNGB", "CNTAO"]) expect(rows.some((r) => r.startsWith(airport + "|"))).toBe(false);
  });
  it("keeps every earlier curated seaport", () => {
    for (const e of data.entries) expect(portIdentity(e.Country + e.Location).all).toEqual([e.Country + e.Location]);
  });
  it.each(exonyms.aliases)("curated alias %s points to an existing port %s", (alias, code) => {
    expect(portIdentity(alias).all).toContain(code);
  });
});

describe("same port, different notation → same", () => {
  it.each([
    ["ANTWERP", "ANTWERPEN"], ["ANTWERP", "BEANR"], ["Antwerp, Belgium", "BE ANR"],
    ["ROTTERDAM", "NLRTM"], ["Rotterdam, Netherlands", "ROTTERDAM"], ["PORT OF ROTTERDAM", "NLRTM"],
    ["SHANGHAI", "SHANGHAI, CHINA"], ["SHANGHAI CN", "CNSGH"], ["NINGBO", "CNNBO"],
    ["BOMBAY", "MUMBAI"], ["NHAVA SHEVA", "INNSA"], ["GENOA", "GENOVA"], ["GOTHENBURG", "GÖTEBORG"],
    ["PUSAN", "BUSAN"], ["KRPUS", "Busan (KRPUS)"], ["VANCOUVER, CANADA", "CAVAN"],
  ])("%s ≡ %s", (a, b) => expect(rel(a, b)).toBe("same"));
  it("reads the same unlisted text as agreement without inventing an identity", () => {
    expect(rel("UNKNOWN HARBOUR", "unknown  harbour")).toBe("same");
    expect(portMeaning("UNKNOWN HARBOUR")).toBeNull();
  });
});

describe("distinct identified ports → different", () => {
  it.each([
    ["ANTWERP", "ROTTERDAM"], ["SHANGHAI", "NINGBO"], ["BEANR", "NLRTM"], ["HAMBURG", "BREMERHAVEN"],
    ["VANCOUVER", "SEATTLE"], ["VANCOUVER, CANADA", "SEATTLE, USA"], ["BUSAN", "INCHEON"],
  ])("%s ≠ %s", (a, b) => expect(rel(a, b)).toBe("different"));
});

describe("same name, conflicting country", () => {
  it("never equates same-name ports in different countries", () => {
    expect(rel("VANCOUVER, CANADA", "VANCOUVER, USA")).toBe("different");
    expect(rel("ROTTERDAM, NETHERLANDS", "ROTTERDAM, USA")).toBe("different");
    expect(rel("VANCOUVER", "VANCOUVER", "CA", "US")).toBe("different");
  });
  it("treats an explicit qualifier contradicting the verified country as unresolved", () => {
    expect(portIdentity("Vancouver, Canada", "US").conflict).toBe(true);
    expect(rel("Vancouver, Canada", "VANCOUVER, CANADA", "US")).toBe("unknown");
    expect(portMeaning("ANTWERP, NETHERLANDS")).toBeNull();
  });
});

describe("unsupported or ambiguous designations stay unresolved", () => {
  it.each([
    ["UNKNOWN CITY A", "UNKNOWN CITY B"],
    ["VANCOUVER", "CAVAN"], // US Vancouver is also a port
    ["SOUTHAMPTON", "BMSOU"], // Bermuda has a same-name location
    ["DUNKIRK", "DUNKERQUE"], // US Dunkirk is an approved port too
    ["CNSHA", "SHANGHAI"], // industry code, airport in current UN/LOCODE
    ["CNSHA", "CNNGB"],
    ["ROTTERDAM", "ROTERDAM"], // misspelling is not a proven different port
    ["VICTORIA", "CAVIC"], // Canada, Seychelles and Hong Kong list Victoria
    ["NAPLES", "NAPOLI"], // US Naples is a listed port; the exonym adds, never replaces
    ["ROTTERDAM", "ROTTERDAM, USA"], // the plain name keeps its reference meaning only for equality
  ])("%s / %s", (a, b) => expect(rel(a, b)).toBe("unknown"));
});

it("never ranks same-name ports by status or size", () => {
  expect(portMeaning("Victoria")).toBeNull();
  expect(portIdentity("Victoria").all.length).toBeGreaterThan(2);
  expect(portMeaning("Naples")).toBeNull();
});

describe("country code and name written together", () => {
  it.each([["CN / 중국", "CN"], ["China (CN)", "CN"], ["BE / 벨기에", "BE"], ["Belgium", "BE"], ["NL / 네덜란드", "NL"], ["KOREA", "KR"]])("%s → %s", (v, c) =>
    expect(countryCode(v)).toBe(c));
  it.each(["CN / 일본", "Belgium (NL)"])("rejects conflicting qualifier %s", (v) => expect(countryCode(v)).toBeNull());
});

async function podCheck(values: [string, string?][]) {
  const types = ["house_bl", "export_declaration", "house_manifest"] as const;
  const docs = [];
  for (const [i, [pod, destinationCountry]] of values.entries())
    docs.push((await shipping34Fixture(types[i], destinationCountry ? { pod, destinationCountry } : { pod })).document);
  return reviewShipping(docs).primaryChecks!.find((c) => c.comparison?.meaning === "portOfDischarge")?.assessment;
}

describe("review verdicts use geographic identity", () => {
  it.each([
    [[["ROTTERDAM"], ["ROTTERDAM"]], "confirmed_match"],
    [[["ANTWERPEN"], ["ANTWERP"]], "confirmed_match"],
    [[["ROTTERDAM"], ["ANTWERP"]], "confirmed_mismatch"],
    [[["SHANGHAI"], ["NINGBO"]], "confirmed_mismatch"],
    [[["SHANGHAI"], ["SHANGHAI"]], "confirmed_match"],
    [[["CNSHA"], ["SHANGHAI"]], "provisional_mismatch"],
    [[["UNKNOWN CITY A"], ["UNKNOWN CITY B"]], "provisional_mismatch"],
  ] as [[string, string?][], string][])("two documents %j → %s", async (values, expected) => {
    expect(await podCheck(values)).toBe(expected);
  });
  it.each([
    [[["ROTTERDAM"], ["ROTTERDAM"], ["ROTTERDAM"]], "confirmed_match"],
    [[["ROTTERDAM"], ["ANTWERP"], ["ROTTERDAM"]], "confirmed_mismatch"],
    [[["NLRTM"], ["Rotterdam", "NL / 네덜란드"], ["ROTTERDAM, NETHERLANDS"]], "confirmed_match"],
    [[["SEATTLE"], ["Vancouver", "US / 미국"], ["SEATTLE"]], "confirmed_mismatch"],
    [[["UNKNOWN CITY A"], ["UNKNOWN CITY B"], ["UNKNOWN CITY A"]], "provisional_mismatch"],
  ] as [[string, string?][], string][])("three documents %j → %s", async (values, expected) => {
    expect(await podCheck(values)).toBe(expected);
  });
  it("reads each document's country only for its own value", async () => {
    // The declaration's verified US country qualifies only its own value.
    // Equal printed text agrees; a B/L CAVAN is then provably different, while
    // an unqualified B/L "Vancouver" is never resolved through the other document.
    expect(await podCheck([["Vancouver"], ["Vancouver", "US / 미국"]])).toBe("confirmed_match");
    expect(await podCheck([["CAVAN"], ["Vancouver", "US / 미국"]])).toBe("confirmed_mismatch");
    expect(await podCheck([["Vancouver"], ["USVAN", "US / 미국"]])).toBe("provisional_mismatch");
  });
});
