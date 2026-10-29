import test from "node:test";
import assert from "node:assert/strict";
import { memoryService } from "../src/services/memory.service.js";

test("Memory Service - session initialization and retrieval", () => {
  const sessionId = "test-session-1";
  const session = memoryService.getOrCreateSession(sessionId);

  assert.strictEqual(session.id, sessionId);
  assert.ok(Array.isArray(session.history));
  assert.strictEqual(session.history.length, 0);
  assert.ok(session.preferences);
  assert.ok(Array.isArray(session.preferences.amenities));
});

test("Memory Service - records conversational turns in order", () => {
  const sessionId = "test-session-2";
  memoryService.clearSession(sessionId);

  memoryService.addTurn(sessionId, "user", "I want a quiet place in Bangalore.");
  memoryService.addTurn(sessionId, "assistant", "I recommend HSR Layout.");

  const history = memoryService.getHistory(sessionId);
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].role, "user");
  assert.strictEqual(history[0].content, "I want a quiet place in Bangalore.");
  assert.strictEqual(history[1].role, "assistant");
  assert.strictEqual(history[1].content, "I recommend HSR Layout.");
});

test("Memory Service - preserves and merges cumulative preferences across turns", () => {
  const sessionId = "test-session-3";
  memoryService.clearSession(sessionId);

  // Turn 1 preferences
  memoryService.updatePreferences(sessionId, {
    city: "Bangalore",
    budget: "30k-50k",
    amenities: ["metro", "cafes"],
  });

  let prefs = memoryService.getPreferences(sessionId);
  assert.strictEqual(prefs.city, "Bangalore");
  assert.strictEqual(prefs.budget, "30k-50k");
  assert.deepStrictEqual(prefs.amenities, ["metro", "cafes"]);

  // Turn 2 preferences: user adds new amenity and commute constraint
  memoryService.updatePreferences(sessionId, {
    amenities: ["parks", "gyms"],
    commute_limit: "30 mins",
  });

  prefs = memoryService.getPreferences(sessionId);
  // Original city and budget preserved
  assert.strictEqual(prefs.city, "Bangalore");
  assert.strictEqual(prefs.budget, "30k-50k");
  assert.strictEqual(prefs.commute_limit, "30 mins");
  // Amenities merged without duplicates
  assert.ok(prefs.amenities.includes("metro"));
  assert.ok(prefs.amenities.includes("cafes"));
  assert.ok(prefs.amenities.includes("parks"));
  assert.ok(prefs.amenities.includes("gyms"));
});

test("Memory Service - generates compact formatted summary for LLM context", () => {
  const sessionId = "test-session-4";
  memoryService.clearSession(sessionId);

  memoryService.updatePreferences(sessionId, {
    city: "Mumbai",
    budget: "60k-100k",
    amenities: ["promenade", "cafes"],
  });

  const summary = memoryService.getSummary(sessionId);
  assert.ok(summary.includes("Target City: Mumbai"));
  assert.ok(summary.includes("Budget: 60k-100k"));
  assert.ok(summary.includes("Amenities: promenade, cafes"));
});

test("Memory Service - clearSession removes session state", () => {
  const sessionId = "test-session-5";
  memoryService.addTurn(sessionId, "user", "Hello");
  assert.strictEqual(memoryService.getHistory(sessionId).length, 1);

  memoryService.clearSession(sessionId);
  assert.strictEqual(memoryService.getHistory(sessionId).length, 0);
});
