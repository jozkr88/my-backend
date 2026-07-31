import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeConsultantProfile,
  applyConsultantAnswer,
  createEmptyConsultantProfile,
  getNextConsultantField,
  validateConsultantProfile,
} from "./worldModelConsultant.js";

test("consultant discovery advances through explicit fields and validates completion", () => {
  let profile = createEmptyConsultantProfile();
  assert.equal(getNextConsultantField(profile).key, "companyName");
  profile = applyConsultantAnswer(profile, "companyName", "Northstar");
  profile = applyConsultantAnswer(profile, "industry", "SaaS");
  assert.equal(getNextConsultantField(profile).key, "companySize");
  assert.equal(validateConsultantProfile(profile).valid, false);
});

test("consultant analysis produces deterministic opportunities with evidence and assumptions", () => {
  const analysis = analyzeConsultantProfile({
    companyName: "Northstar",
    industry: "SaaS",
    companySize: "80 employees",
    systems: ["Jira", "GitHub", "CRM", "Snowflake"],
    processes: ["Project delivery"],
    painPoints: ["Deadlines move late"],
    decisions: ["Whether to add capacity or reduce scope"],
    dataAndGoals: "We have historical delivery events and want fewer surprises.",
  });
  assert.equal(analysis.opportunities.length, 3);
  assert.match(analysis.priorityPilot.title, /Project Delivery/);
  assert.ok(analysis.opportunities[0].evidence.length > 0);
  assert.ok(analysis.opportunities[0].assumptions.length > 0);
  assert.ok(analysis.maturity.score > 40);
});
