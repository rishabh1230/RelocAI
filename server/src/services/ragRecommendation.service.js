import { GoogleGenAI } from "@google/genai";
import { retrieve } from "./retriever.js";
import { getDrivingDistanceWithTraffic } from "./distanceMatrix.service.js";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Strict JSON schema for Gemini structured output
 */
const RECOMMENDATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    recommendations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          locality_id: { type: "INTEGER" },
          name: { type: "STRING" },
          score: { type: "NUMBER" },
          reasons: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          tradeoffs: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
        },
        required: ["locality_id", "name", "score", "reasons", "tradeoffs"],
      },
    },
    followup_question: { type: "STRING" },
  },
  required: ["recommendations"],
};

/**
 * Validate response structure against expected schema
 */
export function validateRecommendationResponse(data) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.recommendations)) return false;

  for (const item of data.recommendations) {
    if (typeof item.locality_id !== "number") return false;
    if (typeof item.name !== "string" || !item.name.trim()) return false;
    if (typeof item.score !== "number" || item.score < 0 || item.score > 1) return false;
    if (!Array.isArray(item.reasons) || item.reasons.length === 0) return false;
    if (!Array.isArray(item.tradeoffs)) return false;
  }

  if (data.followup_question !== undefined && typeof data.followup_question !== "string") {
    return false;
  }

  return true;
}

/**
 * Execute grounded generation with Gemini using strict locality context and structured JSON schema
 */
async function callGeminiStructured(prompt) {
  if (!ai) {
    throw new Error("Gemini AI client is not initialized");
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      temperature: 0.1, // Low temperature for high factual groundedness
      responseMimeType: "application/json",
      responseSchema: RECOMMENDATION_SCHEMA,
    },
  });

  const rawText = response.text || "";
  try {
    return JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Invalid JSON returned by Gemini: ${rawText}`);
  }
}

/**
 * Generate grounded locality recommendations based on retrieved vector context
 *
 * @param {object} params
 * @param {string} params.query - User's search query or preference description
 * @param {string} [params.city] - Target destination city (e.g. "Bangalore" or "Mumbai")
 * @param {number} [params.k=5] - Number of top localities to retrieve
 * @param {object} [params.anchorCoordinates] - User's workplace or center coordinates { lat, lng }
 * @returns {Promise<object>} Structured recommendation object with distance rankings
 */
export async function generateGroundedRecommendations({
  query,
  city,
  k = 5,
  anchorCoordinates,
}) {
  if (!query || typeof query !== "string") {
    throw new Error("A query string is required for grounded generation");
  }

  // 1. Retrieve top-k localities from pgvector
  const retrievedLocalities = await retrieve(query, { k, city });

  if (!retrievedLocalities.length) {
    return {
      recommendations: [],
      followup_question: `We couldn't find registered neighborhoods in ${city || "this city"} matching your criteria. Would you like to broaden your search?`,
    };
  }

  // 2. Build grounded context document for Gemini
  const contextString = retrievedLocalities
    .map((loc) => {
      return [
        `--- LOCALITY RECORD [ID: ${loc.id}] ---`,
        `Name: ${loc.name}`,
        `City: ${loc.city}`,
        `Description: ${loc.description}`,
        loc.rent_range ? `Rent Range: ${loc.rent_range}` : null,
        loc.safety_notes ? `Safety: ${loc.safety_notes}` : null,
        loc.commute_notes ? `Commute: ${loc.commute_notes}` : null,
        loc.amenities?.length ? `Amenities: ${loc.amenities.join(", ")}` : null,
        loc.lat && loc.lng ? `Coordinates: ${loc.lat}, ${loc.lng}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const prompt = `
You are RelocAI's grounded relocation intelligence assistant.
Your task is to recommend the best matching neighborhoods for a user relocating to ${city || "their new city"}.

CRITICAL INSTRUCTIONS:
1. Answer ONLY using the facts present in the LOCALITY CONTEXT below.
2. Do NOT invent, assume, or extrapolate any facts (rent numbers, metro stations, safety statistics) that are not explicitly stated in the context.
3. If an amenity or feature is not mentioned in the context, do NOT claim it exists.
4. For each recommended locality:
   - "locality_id": Must match the exact integer ID from the context.
   - "name": Must match the locality name from the context.
   - "score": A float between 0.0 and 1.0 representing fit to the user's criteria.
   - "reasons": Array of 2-3 specific grounded reasons drawn from the context.
   - "tradeoffs": Array of 1-2 honest drawbacks or caveats drawn from the context (e.g. rent range, traffic).
5. "followup_question": Ask one clarifying question to help narrow down budget, commute, or lifestyle.

USER QUERY & PREFERENCES:
"${query}"

LOCALITY CONTEXT:
${contextString}
`;

  // 3. Structured Generation with Retry once
  let parsed;
  let isValid = false;

  try {
    parsed = await callGeminiStructured(prompt);
    isValid = validateRecommendationResponse(parsed);
  } catch (err) {
    console.warn("⚠️ First attempt at structured generation failed:", err.message);
  }

  if (!isValid) {
    console.log("🔄 Retrying structured generation with reinforced schema instruction...");
    const retryPrompt = `${prompt}\n\nIMPORTANT: Previous attempt had formatting errors. Ensure exact adherence to the JSON schema.`;
    parsed = await callGeminiStructured(retryPrompt);
    if (!validateRecommendationResponse(parsed)) {
      throw new Error("Failed to produce valid structured recommendations after retry");
    }
  }

  // 4. Combine Google Distance Matrix logic to user's workplace / anchor
  const localityMap = new Map(retrievedLocalities.map((loc) => [loc.id, loc]));

  const enrichedRecommendations = await Promise.all(
    parsed.recommendations.map(async (rec) => {
      const locDetails = localityMap.get(rec.locality_id);
      let commute = null;

      if (
        anchorCoordinates &&
        typeof anchorCoordinates.lat === "number" &&
        locDetails?.lat &&
        locDetails?.lng
      ) {
        commute = await getDrivingDistanceWithTraffic({
          origin: anchorCoordinates,
          destination: { lat: locDetails.lat, lng: locDetails.lng },
        });
      }

      // Proximity penalty/bonus (if commute exists, penalize long distances > 15km)
      let adjustedScore = rec.score;
      if (commute && typeof commute.distance_km === "number") {
        if (commute.distance_km <= 5) {
          adjustedScore = Math.min(1.0, adjustedScore + 0.05);
        } else if (commute.distance_km > 15) {
          adjustedScore = Math.max(0.1, adjustedScore - 0.1);
        }
      }

      return {
        ...rec,
        score: Math.round(adjustedScore * 100) / 100,
        commute_to_anchor: commute
          ? {
              distance_km: commute.distance_km,
              duration_text: commute.duration_text,
            }
          : null,
        locality: locDetails
          ? {
              id: locDetails.id,
              city: locDetails.city,
              name: locDetails.name,
              rent_range: locDetails.rent_range,
              safety_notes: locDetails.safety_notes,
              commute_notes: locDetails.commute_notes,
              amenities: locDetails.amenities,
              coordinates: { lat: locDetails.lat, lng: locDetails.lng },
            }
          : null,
      };
    })
  );

  // Sort by final combined score descending
  enrichedRecommendations.sort((a, b) => b.score - a.score);

  return {
    recommendations: enrichedRecommendations,
    followup_question: parsed.followup_question || null,
  };
}

export default {
  generateGroundedRecommendations,
  validateRecommendationResponse,
};
