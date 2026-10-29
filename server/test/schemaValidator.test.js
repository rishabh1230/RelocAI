import test from "node:test";
import assert from "node:assert/strict";
import { validateRecommendationResponse } from "../src/services/ragRecommendation.service.js";

test("Schema Validator - accepts well-formed recommendation payload", () => {
  const validPayload = {
    recommendations: [
      {
        locality_id: 1,
        name: "Indiranagar",
        score: 0.94,
        reasons: ["Lively cafe culture", "Purple Line metro access"],
        tradeoffs: ["Heavy evening traffic on 100 Feet Road"],
      },
      {
        locality_id: 2,
        name: "HSR Layout",
        score: 0.88,
        reasons: ["Active startup ecosystem", "Wide residential avenues"],
        tradeoffs: ["Metro junction under construction"],
      },
    ],
    followup_question: "Would you prefer a quieter residential block or closer to the main commercial strip?",
  };

  assert.strictEqual(validateRecommendationResponse(validPayload), true);
});

test("Schema Validator - rejects null, undefined, or non-object inputs", () => {
  assert.strictEqual(validateRecommendationResponse(null), false);
  assert.strictEqual(validateRecommendationResponse(undefined), false);
  assert.strictEqual(validateRecommendationResponse("not an object"), false);
  assert.strictEqual(validateRecommendationResponse(123), false);
  assert.strictEqual(validateRecommendationResponse([]), false);
});

test("Schema Validator - rejects missing recommendations array", () => {
  assert.strictEqual(validateRecommendationResponse({}), false);
  assert.strictEqual(validateRecommendationResponse({ recommendations: "not an array" }), false);
});

test("Schema Validator - rejects locality items missing required fields", () => {
  // Missing locality_id
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          name: "Indiranagar",
          score: 0.9,
          reasons: ["Great cafes"],
          tradeoffs: ["Traffic"],
        },
      ],
    }),
    false
  );

  // Missing name
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          score: 0.9,
          reasons: ["Great cafes"],
          tradeoffs: ["Traffic"],
        },
      ],
    }),
    false
  );

  // Missing reasons or empty reasons
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          name: "Indiranagar",
          score: 0.9,
          reasons: [],
          tradeoffs: ["Traffic"],
        },
      ],
    }),
    false
  );

  // Missing tradeoffs
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          name: "Indiranagar",
          score: 0.9,
          reasons: ["Great cafes"],
        },
      ],
    }),
    false
  );
});

test("Schema Validator - rejects scores outside [0, 1] range", () => {
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          name: "Indiranagar",
          score: 1.5, // Invalid > 1
          reasons: ["Great cafes"],
          tradeoffs: ["Traffic"],
        },
      ],
    }),
    false
  );

  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          name: "Indiranagar",
          score: -0.2, // Invalid < 0
          reasons: ["Great cafes"],
          tradeoffs: ["Traffic"],
        },
      ],
    }),
    false
  );
});

test("Schema Validator - rejects invalid followup_question type", () => {
  assert.strictEqual(
    validateRecommendationResponse({
      recommendations: [
        {
          locality_id: 1,
          name: "Indiranagar",
          score: 0.9,
          reasons: ["Great cafes"],
          tradeoffs: ["Traffic"],
        },
      ],
      followup_question: 12345, // Must be string if present
    }),
    false
  );
});
