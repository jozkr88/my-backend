import test from "node:test";
import assert from "node:assert/strict";
import { validateJozCausalDataset } from "./jozCausalDatasetRegistry.js";
import {
  getJozCustomerWaitTimeDemoRequest,
  JOZ_CUSTOMER_WAIT_TIME_DEMO_DATASET,
} from "./jozCustomerWaitTimeCausalDataset.js";

test("validates the versioned customer wait-time demo dataset", () => {
  const result = validateJozCausalDataset(JOZ_CUSTOMER_WAIT_TIME_DEMO_DATASET);
  assert.equal(result.ok, true);
  assert.equal(result.dataset.dataset_id, "joz-customer-wait-time-demo");
  assert.equal(result.dataset.model_version, "customer-wait-time-v1");
  assert.equal(result.dataset.data.length, 60);
});

test("maps the wait-time intervention to a bounded effect request", () => {
  assert.deepEqual(
    getJozCustomerWaitTimeDemoRequest("What would happen if customer wait time decreased by 20%?"),
    {
      modelId: "joz-customer-wait-time-demo",
      modelVersion: "customer-wait-time-v1",
      treatmentVariableId: "customer_wait_time",
      outcomeVariableId: "conversion_rate",
      treatmentValue: 8,
      controlValue: 10,
      samples: 1000,
    }
  );
});
