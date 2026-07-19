import assert from "node:assert/strict";
import test from "node:test";
import { bearerToken, configuredAdminToken, resolveRole, tokenMatches } from "../server/auth.js";

test("admin role is derived from the server token instead of a client role value", () => {
  assert.equal(resolveRole("Bearer correct-token", "correct-token"), "admin");
  assert.equal(resolveRole("Bearer wrong-token", "correct-token"), "customer");
  assert.equal(resolveRole(undefined, "correct-token"), "customer");
});

test("bearer parsing rejects other authentication schemes and empty values", () => {
  assert.equal(bearerToken("Bearer secret"), "secret");
  assert.equal(bearerToken("Basic secret"), null);
  assert.equal(bearerToken(undefined), null);
  assert.equal(tokenMatches("secret", "secret"), true);
  assert.equal(tokenMatches("short", "longer"), false);
});

test("local development defaults to admin while production requires configuration", () => {
  assert.equal(configuredAdminToken({ NODE_ENV: "development" }), "admin");
  assert.equal(configuredAdminToken({ NODE_ENV: "production" }), undefined);
  assert.equal(configuredAdminToken({ NODE_ENV: "production", ATHENE_ADMIN_TOKEN: "secure-production-token" }), "secure-production-token");
});
