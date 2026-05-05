import type { TestCatalogueEntry, TestId } from "../types";

// Source of truth for the 8 tests. Keep prices/TAT in sync with the Jeen
// product pages. Only Complete Plus is twin/donor/surrogate eligible in v1.
export const TESTS: Record<TestId, TestCatalogueEntry> = {
  "aneuploidy-nipt": {
    id: "aneuploidy-nipt",
    name: "Aneuploidy NIPT",
    shortName: "Aneuploidy NIPT",
    price: 295,
    turnaroundLabel: "7–10 days",
    turnaroundDaysMax: 10,
    scope:
      "Screens for Down's, Edwards' and Patau's syndromes (trisomies 21, 18, 13).",
    scopeTags: ["aneuploidy-13-18-21"],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "10-plus",
    },
    notable:
      "Our most affordable entry point if you only want the three main conditions screened.",
    caveats: [
      "Does not screen for sex chromosome conditions or rarer genetic differences.",
      "Does not detect structural anomalies — that is what your 12- and 20-week scans are for.",
    ],
  },
  "prenatalsafe-3-uk": {
    id: "prenatalsafe-3-uk",
    name: "PrenatalSafe 3 UK",
    shortName: "PrenatalSafe 3",
    price: 325,
    turnaroundLabel: "2–4 days",
    turnaroundDaysMax: 4,
    scope:
      "Screens for Down's, Edwards' and Patau's syndromes — with our fastest turnaround.",
    scopeTags: ["aneuploidy-13-18-21"],
    eligibility: {
      // The only test in our range validated for vanishing-twin pregnancies.
      // Important: needs ≥5 weeks since the vanishing twin was seen on scan
      // (handled in UI via a red banner on the result screen).
      allowedPregnancyTypes: ["singleton", "vanishing-twin"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "10-plus",
    },
    notable: "Fastest results in our range — usually back inside a working week.",
    caveats: [
      "Does not screen for sex chromosome conditions or rarer genetic differences.",
    ],
  },
  "panorama-basic": {
    id: "panorama-basic",
    name: "Panorama Basic",
    shortName: "Panorama Basic",
    price: 375,
    turnaroundLabel: "7–10 days",
    turnaroundDaysMax: 10,
    scope:
      "Screens for the three main trisomies plus sex chromosome conditions and triploidy. Includes baby's sex.",
    scopeTags: ["aneuploidy-13-18-21", "sex-chromosomes", "triploidy"],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "9-to-10",
    },
    notable:
      "Popular middle-ground: the main conditions plus baby's sex and sex chromosome findings.",
    caveats: [
      "Sex chromosome findings are less common than the main trisomies and sometimes need follow-up diagnostic testing to confirm.",
    ],
  },
  "panorama-microdeletions": {
    id: "panorama-microdeletions",
    name: "Panorama with Microdeletions",
    shortName: "Panorama + Microdeletions",
    price: 525,
    turnaroundLabel: "7–10 days",
    turnaroundDaysMax: 10,
    scope:
      "Everything in Panorama Basic, plus screening for five specific microdeletion syndromes including DiGeorge (22q11.2).",
    scopeTags: [
      "aneuploidy-13-18-21",
      "sex-chromosomes",
      "triploidy",
      "microdeletions",
    ],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "9-to-10",
    },
    // Not currently recommended through this tool — KNOVA / Niptify cover the
    // useful "extended" panel space with stronger clinical signal, and the
    // basic Panorama / PrenatalSafe / Aneuploidy options handle the narrow
    // request. Panorama + Microdeletions sits in an awkward middle ground.
    recommendable: false,
    notable:
      "Currently only available via midwife consultation (not via this self-service tool).",
    caveats: [
      "Microdeletions are individually rare, so a positive screening result often needs a follow-up diagnostic test (CVS or amniocentesis) to confirm.",
    ],
  },
  niptify: {
    id: "niptify",
    name: "Niptify",
    shortName: "Niptify",
    price: 525,
    turnaroundLabel: "5–10 days",
    turnaroundDaysMax: 10,
    scope:
      "Broader screen covering around 30 conditions including the main trisomies, sex chromosome conditions and selected microdeletions.",
    scopeTags: [
      "aneuploidy-13-18-21",
      "sex-chromosomes",
      "microdeletions",
      "expanded-panel",
    ],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "10-plus",
    },
    notable: "Mid-tier option if you want breadth without stepping up to KNOVA or Complete Plus.",
    caveats: [
      "The broader the panel, the more likely you'll see a flag that turns out to be benign on follow-up. Your midwife will talk you through this.",
    ],
  },
  "unity-complete": {
    id: "unity-complete",
    name: "Unity Complete",
    shortName: "Unity Complete",
    price: 800,
    turnaroundLabel: "17–21 days",
    turnaroundDaysMax: 21,
    scope:
      "Screens for the main trisomies plus recessive carrier conditions (cystic fibrosis, SMA, sickle cell, thalassaemias and more) that you and your partner could be silent carriers of.",
    scopeTags: [
      "aneuploidy-13-18-21",
      "sex-chromosomes",
      "recessive-carrier",
    ],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "10-plus",
    },
    notable:
      "Different from the others — Unity looks at conditions you or your partner could be silent carriers of, then screens baby only if both of you are carriers.",
    caveats: [
      "Recessive conditions require both biological parents to be carriers, so Unity is most useful when partner information is available.",
      "Turnaround is longer than other tests because it works in two stages.",
    ],
  },
  knova: {
    id: "knova",
    name: "KNOVA",
    shortName: "KNOVA",
    price: 950,
    turnaroundLabel: "around 14 days",
    turnaroundDaysMax: 14,
    scope:
      "Screens for around 38 conditions including de novo (new) dominant mutations such as achondroplasia, Noonan syndrome and CHARGE syndrome that can appear even without family history.",
    scopeTags: [
      "aneuploidy-13-18-21",
      "sex-chromosomes",
      "de-novo-monogenic",
      "expanded-panel",
    ],
    eligibility: {
      allowedPregnancyTypes: ["singleton"],
      allowedConceptions: ["natural", "ivf-own-eggs"],
      minGestationalBand: "10-plus",
    },
    notable:
      "Strong choice when paternal age is higher — new mutations become more common as paternal age rises.",
    caveats: [
      "Focuses on new (de novo) mutations rather than inherited ones — it is not designed to replace carrier screening.",
      "Positive screening results typically need a diagnostic test to confirm.",
    ],
  },
  "prenatalsafe-complete-plus": {
    id: "prenatalsafe-complete-plus",
    name: "PrenatalSafe Complete Plus",
    shortName: "Complete Plus",
    price: 1490,
    turnaroundLabel: "around 14 days",
    turnaroundDaysMax: 14,
    scope:
      "Our broadest screen: genome-wide copy number changes (CNVs) plus a panel of dominant single-gene conditions.",
    scopeTags: [
      "aneuploidy-13-18-21",
      "sex-chromosomes",
      "microdeletions",
      "genome-wide-cnv",
      "de-novo-monogenic",
      "expanded-panel",
    ],
    eligibility: {
      // Validated for twin pregnancies, donor-egg and surrogacy. NOT for
      // vanishing twin — only PrenatalSafe 3 UK is.
      allowedPregnancyTypes: ["singleton", "twin"],
      allowedConceptions: [
        "natural",
        "ivf-own-eggs",
        "donor-egg",
        "surrogate",
      ],
      minGestationalBand: "10-plus",
    },
    // Not currently recommended through this tool — broad genome-wide CNVs
    // generate too many findings that need follow-up counselling. KNOVA covers
    // the most clinically useful subset for singletons; for twin / donor egg /
    // surrogate pregnancies we route patients to a midwife consult instead of
    // recommending Complete Plus.
    recommendable: false,
    notable:
      "Currently only available via midwife consultation (not via this self-service tool).",
    caveats: [
      "Because the panel is so broad, small numbers of flagged findings are expected that turn out to be benign after follow-up.",
      "A broad panel is not always the right answer — your midwife will help you decide if its scope matches your concerns.",
    ],
  },
};

export const ALL_TEST_IDS: TestId[] = Object.keys(TESTS) as TestId[];

export function getTest(id: TestId): TestCatalogueEntry {
  return TESTS[id];
}
