import test from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { retrieve } from "../src/services/retriever.js";
import { pool } from "../src/db/pg.js";

test("Retriever Integration - returns ranked localities with correct shape and similarity scores", async (t) => {
  const results = await retrieve("lively cafe culture with metro stations", { k: 3 });

  assert.ok(Array.isArray(results), "Result should be an array");
  assert.ok(results.length > 0, "Should return at least one result");
  assert.ok(results.length <= 3, "Should respect k=3 limit");

  const top = results[0];
  assert.ok(typeof top.id === "number", "id should be a number");
  assert.ok(typeof top.city === "string", "city should be a string");
  assert.ok(typeof top.name === "string", "name should be a string");
  assert.ok(typeof top.description === "string", "description should be a string");
  assert.ok(typeof top.rent_range === "string", "rent_range should be a string");
  assert.ok(typeof top.safety_notes === "string", "safety_notes should be a string");
  assert.ok(typeof top.commute_notes === "string", "commute_notes should be a string");
  assert.ok(typeof top.amenities === "string" || Array.isArray(top.amenities), "amenities should be an array or string");

  assert.ok(typeof top.similarity === "number", "similarity should be a number");
  assert.ok(top.similarity >= 0 && top.similarity <= 1, "similarity should be between 0 and 1");
});

test("Retriever Integration - respects city filtering", async () => {
  const bangaloreResults = await retrieve("quiet residential avenues with parks", {
    k: 3,
    city: "Bangalore",
  });

  assert.ok(bangaloreResults.length > 0, "Should return results for Bangalore");
  for (const loc of bangaloreResults) {
    assert.strictEqual(
      loc.city.toLowerCase(),
      "bangalore",
      `Expected city to be Bangalore, got ${loc.city}`
    );
  }

  const mumbaiResults = await retrieve("quiet residential avenues with parks", {
    k: 3,
    city: "Mumbai",
  });

  assert.ok(mumbaiResults.length > 0, "Should return results for Mumbai");
  for (const loc of mumbaiResults) {
    assert.strictEqual(
      loc.city.toLowerCase(),
      "mumbai",
      `Expected city to be Mumbai, got ${loc.city}`
    );
  }
});

test("Retriever Integration - teardown", async () => {
  // Allow pending pool queries to finish cleanly
  await pool.end();
});
