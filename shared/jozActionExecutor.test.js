import test from "node:test";
import assert from "node:assert/strict";

import { executeJozAllowlistedAction, verifyJozAllowlistedAction } from "./jozActionExecutor.js";

test("allowlisted report execution returns verifiable dataset state", () => {
  const result = executeJozAllowlistedAction({ proposal: { action: "generate_report" } });
  const verification = verifyJozAllowlistedAction({ proposal: { action: "generate_report" }, result });

  assert.equal(result.action, "generate_report");
  assert.equal(verification.verified, true);
});

test("unallowlisted actions are blocked", () => {
  assert.throws(
    () => executeJozAllowlistedAction({ proposal: { action: "deploy_change" } }),
    /not allowlisted/i
  );
});
