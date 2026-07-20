import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetJozGeoCacheForTests,
  resolveJozRequestGeo,
} from "./jozGeoLocation.js";

test("does not look up local or private addresses", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({}) };
  };

  assert.equal(await resolveJozRequestGeo("127.0.0.1", { fetchImpl }), null);
  assert.equal(await resolveJozRequestGeo("10.0.0.4", { fetchImpl }), null);
  assert.equal(calls, 0);
});

test("normalizes provider data without retaining the IP address", async () => {
  __resetJozGeoCacheForTests();
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      async json() {
        return {
          country_code: "sg",
          country: "Singapore",
          region: "Central Region",
          region_code: "01",
          city: "Singapore",
          timezone: { id: "Asia/Singapore" },
        };
      },
    };
  };

  const geo = await resolveJozRequestGeo("8.8.8.8", { fetchImpl });
  assert.deepEqual(geo, {
    source: "ipwho.is",
    accuracy: "approximate",
    label: "Singapore, Central Region, Singapore",
    countryCode: "SG",
    country: "Singapore",
    region: "Central Region",
    regionCode: "01",
    city: "Singapore",
    timezone: "Asia/Singapore",
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /8\.8\.8\.8/);
  assert.doesNotMatch(JSON.stringify(geo), /8\.8\.8\.8/);

  await resolveJozRequestGeo("8.8.8.8", { fetchImpl });
  assert.equal(calls.length, 1);
});

test("fails closed when the provider fails", async () => {
  __resetJozGeoCacheForTests();
  const geo = await resolveJozRequestGeo("1.1.1.1", {
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
  });
  assert.equal(geo, null);
});
