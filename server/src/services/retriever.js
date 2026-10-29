import { GoogleGenAI } from "@google/genai";
import { query as dbQuery } from "../db/pg.js";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIM = 768;

/**
 * Embed query text into 768-dim vector
 */
export async function embedQuery(text) {
  if (!ai) {
    throw new Error("Gemini API key is not configured for embedding");
  }

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIM,
    },
  });

  const vector = response.embedding?.values || response.embeddings?.[0]?.values;
  if (!vector || !vector.length) {
    throw new Error("Empty embedding returned for query");
  }
  return vector;
}

/**
 * Retrieve top-k localities using cosine similarity in pgvector
 *
 * @param {string} queryText - User's lifestyle / preferences query
 * @param {object} options - Retrieval options
 * @param {number} [options.k=5] - Number of results to return
 * @param {string} [options.city] - Optional city filter (e.g. "Bangalore" or "Mumbai")
 * @returns {Promise<Array>} List of ranked localities with cosine similarity scores
 */
export async function retrieve(queryText, { k = 5, city } = {}) {
  if (!queryText || typeof queryText !== "string") {
    throw new Error("A valid query string is required for retrieval");
  }

  const limit = Math.max(1, parseInt(k, 10) || 5);
  const queryVector = await embedQuery(queryText);
  const vectorStr = `[${queryVector.join(",")}]`;

  let sql;
  let params;

  if (city && city.trim()) {
    sql = `
      SELECT
        id,
        city,
        name,
        description,
        rent_range,
        safety_notes,
        commute_notes,
        amenities,
        lat,
        lng,
        ROUND((1 - (embedding <=> $1::vector))::numeric, 4)::float AS similarity
      FROM localities
      WHERE LOWER(city) = LOWER($2)
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3;
    `;
    params = [vectorStr, city.trim(), limit];
  } else {
    sql = `
      SELECT
        id,
        city,
        name,
        description,
        rent_range,
        safety_notes,
        commute_notes,
        amenities,
        lat,
        lng,
        ROUND((1 - (embedding <=> $1::vector))::numeric, 4)::float AS similarity
      FROM localities
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2;
    `;
    params = [vectorStr, limit];
  }

  const result = await dbQuery(sql, params);
  return result.rows.map((row) => ({
    id: row.id,
    city: row.city,
    name: row.name,
    description: row.description,
    rent_range: row.rent_range,
    safety_notes: row.safety_notes,
    commute_notes: row.commute_notes,
    amenities: row.amenities || [],
    lat: row.lat,
    lng: row.lng,
    similarity: row.similarity,
  }));
}

export default {
  retrieve,
  embedQuery,
};
