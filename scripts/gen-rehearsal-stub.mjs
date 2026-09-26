import { readFileSync, writeFileSync } from "node:fs";
const base = JSON.parse(readFileSync("test/fixtures/drafter/writer-stub.json", "utf8"));

function writerEntry(marker, extra = "") {
  return {
    matchIncludes: [marker],
    response: {
      control_text: `The reviewer screens ${marker} every new correspondent relationship before onboarding and records the outcome, since this addresses the onboarding risk before exposure begins.${extra}`,
      rationale: `This addresses the onboarding risk because it catches issues before exposure begins for ${marker}.`,
      placeholders: [],
    },
  };
}

base.writer["pra-writer-enhancement-v1"].entries.push(
  writerEntry("RQJPASSMK"),
  writerEntry("RQJMINORMK"),
  writerEntry("RQJCRITMK"),
  writerEntry("RQJQNFMK"),
  writerEntry("RQJUNKMK"),
  { matchIncludes: ["RQJMALMK"], malformed: true },
  writerEntry("RQTGOODMK"),
  writerEntry("RQTOOLMK"),
  writerEntry("RQTMALMK"),
);

// judge entries keyed on the SAME marker text the writer above just wrote into control_text
function judgeEntry(marker, verdicts) {
  const quote = `The reviewer screens ${marker} every new correspondent relationship before onboarding and records the outcome, since this addresses the onboarding risk before exposure begins.`;
  const rationaleQuote = `This addresses the onboarding risk because it catches issues before exposure begins for ${marker}.`;
  const crit = (name, pass, reason, useRationale) => ({
    [name]: { quote: useRationale ? rationaleQuote : quote, pass, reason, suggested_rewrite: pass ? null : "See reason." },
  });
  return {
    matchIncludes: [marker],
    response: {
      criteria: {
        ...crit("mechanism_not_policy_restatement", verdicts.mechanism ?? true, "ok"),
        ...crit("trigger_actor_action_outcome", verdicts.trigger ?? true, "ok"),
        ...crit("rationale_explains_risk", verdicts.rationale ?? true, "ok", true),
        ...crit("scope_stated", verdicts.scope ?? true, "ok"),
        ...crit("tone_measured", verdicts.tone ?? true, "ok"),
        ...crit("correct_section", verdicts.section ?? true, "ok"),
      },
    },
  };
}
const judgeEntries = base.judge["pra-judge-rubric-v1"].entries;
judgeEntries.push(judgeEntry("RQJPASSMK", {}));
judgeEntries.push(judgeEntry("RQJMINORMK", { tone: false }));
judgeEntries.push(judgeEntry("RQJCRITMK", { mechanism: false, trigger: false, rationale: false, scope: false }));

base.tagger = {
  "pra-tag-suggestion-v1": {
    entries: [
      { matchIncludes: ["RQTGOODMK"], response: { tags: [
        { tag_type: "risk_addressed", value: "sanctions", evidence_phrase: "screens" },
        { tag_type: "customer_type", value: "legal person", evidence_phrase: "correspondent relationship" },
        { tag_type: "lifecycle_stage", value: "onboarding", evidence_phrase: "before onboarding" },
      ] } },
      { matchIncludes: ["RQTOOLMK"], response: { tags: [
        { tag_type: "risk_addressed", value: "sanctions", evidence_phrase: "screens" },
        { tag_type: "risk_addressed", value: "invented-risk-category-xyz", evidence_phrase: "screens" },
        { tag_type: "customer_type", value: "shell company (invented)", evidence_phrase: "correspondent relationship" },
      ] } },
      { matchIncludes: ["RQTMALMK"], malformed: true },
    ],
  },
};

writeFileSync("test/fixtures/drafter-rehearsal/rehearsal-stub.json", JSON.stringify(base, null, 2));
console.log("wrote extended rehearsal-stub.json");
