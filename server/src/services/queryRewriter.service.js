import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const REWRITE_SCHEMA = {
  type: "OBJECT",
  properties: {
    extracted_preferences: {
      type: "OBJECT",
      properties: {
        budget: { type: "STRING" },
        commute_limit: { type: "STRING" },
        lifestyle: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        pets: { type: "BOOLEAN" },
        family: { type: "BOOLEAN" },
        city: { type: "STRING" },
        amenities: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
      },
    },
    rewritten_retrieval_query: { type: "STRING" },
  },
  required: ["extracted_preferences", "rewritten_retrieval_query"],
};

/**
 * Extract user preferences from dialogue and rewrite retrieval query
 */
export async function extractPreferencesAndRewriteQuery({
  message,
  history = [],
  currentPreferences = {},
}) {
  if (!ai) {
    return {
      extractedPreferences: {},
      rewrittenQuery: message,
    };
  }

  const historyText = history
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n");

  const prompt = `
You are the query reformulation and preference extraction engine for RelocAI.
Analyze the user's latest message in the context of their relocation conversation history and existing accumulated preferences.

CONVERSATION HISTORY:
${historyText || "(Beginning of conversation)"}

CURRENT ACCUMULATED PREFERENCES:
${JSON.stringify(currentPreferences, null, 2)}

LATEST USER MESSAGE:
"${message}"

YOUR TASK:
1. "extracted_preferences": Extract any NEW or UPDATED preferences explicitly mentioned or implied in the latest message:
   - budget: monthly rental range (e.g. "under 40k", "INR 35000-50000")
   - commute_limit: maximum travel time or distance (e.g. "< 30 mins", "within 10 km of tech park")
   - lifestyle: tags like ["cafes", "nightlife", "quiet", "walkable", "greenery"]
   - pets: true if user mentions dogs/cats/pets, false if not suitable, omit if unmentioned
   - family: true if user mentions kids/schools/family, false if single/bachelor, omit if unmentioned
   - city: target relocation city if mentioned
   - amenities: specific requirements like ["metro", "parks", "gyms", "supermarkets"]

2. "rewritten_retrieval_query": A comprehensive, dense standalone search query incorporating both the latest user intent AND all relevant accumulated preferences (budget, commute, lifestyle, family/pets, city). This query will be passed directly into a pgvector semantic search engine over neighborhood descriptions.
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: REWRITE_SCHEMA,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      extractedPreferences: parsed.extracted_preferences || {},
      rewrittenQuery: parsed.rewritten_retrieval_query || message,
    };
  } catch (err) {
    console.warn("⚠️ Query rewriting failed, falling back to original message:", err.message);
    return {
      extractedPreferences: {},
      rewrittenQuery: message,
    };
  }
}

export default {
  extractPreferencesAndRewriteQuery,
};
