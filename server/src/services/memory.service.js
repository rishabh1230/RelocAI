const MAX_HISTORY_TURNS = 10;

// In-memory session store (keyed by sessionId)
const sessions = new Map();

/**
 * Get or create a session
 */
export function getOrCreateSession(sessionId) {
  const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      history: [],
      preferences: {
        budget: null,
        commute_limit: null,
        lifestyle: [],
        pets: null,
        family: null,
        city: null,
        amenities: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return sessions.get(id);
}

/**
 * Add a message turn to the session history
 */
export function addTurn(sessionId, role, content) {
  const session = getOrCreateSession(sessionId);
  session.history.push({
    role,
    content,
    timestamp: new Date(),
  });

  // Keep last N turns
  if (session.history.length > MAX_HISTORY_TURNS) {
    session.history = session.history.slice(-MAX_HISTORY_TURNS);
  }
  session.updatedAt = new Date();
  return session;
}

/**
 * Merge newly extracted preferences into the running preferences object
 */
export function updatePreferences(sessionId, newPrefs = {}) {
  const session = getOrCreateSession(sessionId);
  const current = session.preferences;

  if (newPrefs.budget) current.budget = newPrefs.budget;
  if (newPrefs.commute_limit) current.commute_limit = newPrefs.commute_limit;
  if (newPrefs.city) current.city = newPrefs.city;
  if (typeof newPrefs.pets === "boolean") current.pets = newPrefs.pets;
  if (typeof newPrefs.family === "boolean") current.family = newPrefs.family;

  if (Array.isArray(newPrefs.lifestyle)) {
    const set = new Set([...current.lifestyle, ...newPrefs.lifestyle]);
    current.lifestyle = Array.from(set);
  }

  if (Array.isArray(newPrefs.amenities)) {
    const set = new Set([...current.amenities, ...newPrefs.amenities]);
    current.amenities = Array.from(set);
  }

  session.updatedAt = new Date();
  return current;
}

/**
 * Get history turns
 */
export function getHistory(sessionId) {
  const session = getOrCreateSession(sessionId);
  return session.history;
}

/**
 * Get current preferences
 */
export function getPreferences(sessionId) {
  const session = getOrCreateSession(sessionId);
  return session.preferences;
}

/**
 * Generate a formatted textual summary of running preferences for LLM prompt context
 */
export function getSummary(sessionId) {
  const prefs = getPreferences(sessionId);
  const parts = [];
  if (prefs.city) parts.push(`Target City: ${prefs.city}`);
  if (prefs.budget) parts.push(`Budget: ${prefs.budget}`);
  if (prefs.commute_limit) parts.push(`Commute: ${prefs.commute_limit}`);
  if (prefs.amenities && prefs.amenities.length > 0) parts.push(`Amenities: ${prefs.amenities.join(", ")}`);
  if (prefs.lifestyle && prefs.lifestyle.length > 0) parts.push(`Lifestyle: ${prefs.lifestyle.join(", ")}`);
  if (typeof prefs.pets === "boolean") parts.push(`Pets: ${prefs.pets ? "Yes" : "No"}`);
  if (typeof prefs.family === "boolean") parts.push(`Family: ${prefs.family ? "Yes" : "No"}`);
  return parts.length > 0 ? parts.join(" | ") : "No explicit preferences recorded yet.";
}

/**
 * Clear session memory
 */
export function clearSession(sessionId) {
  return sessions.delete(sessionId);
}

export const memoryService = {
  getOrCreateSession,
  addTurn,
  updatePreferences,
  getHistory,
  getPreferences,
  getSummary,
  clearSession,
};

export default memoryService;
