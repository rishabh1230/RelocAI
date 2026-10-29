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
 * Clear session memory
 */
export function clearSession(sessionId) {
  return sessions.delete(sessionId);
}

export default {
  getOrCreateSession,
  addTurn,
  updatePreferences,
  clearSession,
};
