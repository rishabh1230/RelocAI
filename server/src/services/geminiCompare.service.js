import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch (err) {
    console.warn("⚠️ Failed to create GoogleGenAI instance:", err.message);
    return null;
  }
};

const getModelName = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";

/* ----------------------------------------------------
   Score normalizers (0 to 10 scale)
---------------------------------------------------- */
const normalizeDistanceScore = (km) => {
  if (!Number.isFinite(km)) return 5;
  if (km <= 1) return 10;
  if (km >= 12) return 1;
  return Math.round((12 - km) * (10 / 11) * 10) / 10;
};

const normalizeDensityScore = (count) => {
  if (!Number.isFinite(count)) return 5;
  if (count >= 15) return 10;
  return Math.round(Math.max(2, (count / 15) * 10) * 10) / 10;
};

/* ----------------------------------------------------
   SAFE Gemini text extraction & JSON parsing
---------------------------------------------------- */
const parseGeminiJson = (rawText) => {
  if (!rawText) throw new Error("Empty AI response");
  // Clean markdown fences
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON structure found in AI response");
  return JSON.parse(jsonMatch[0]);
};

/* ----------------------------------------------------
   Gemini review & profile comparison
---------------------------------------------------- */
const getGeminiReviewComparison = async (source, candidate) => {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error("Gemini API key not configured");
  }

  const prompt = `
Compare these two places to assess how well the CANDIDATE place replicates the lifestyle vibe, atmosphere, and quality of the user's favorite SOURCE place in their new city.

SOURCE PLACE:
- Name: ${source.name}
- Type: ${source.type}
- Rating: ${source.rating || "N/A"} (${source.reviews_count || 0} reviews)
- Sample Reviews: ${JSON.stringify((source.reviews || []).slice(0, 3).map(r => r.text || r))}

CANDIDATE PLACE (New City):
- Name: ${candidate.name}
- Type: ${candidate.type}
- Rating: ${candidate.rating || "N/A"} (${candidate.reviews_count || 0} reviews)
- Sample Reviews: ${JSON.stringify((candidate.reviews || []).slice(0, 3).map(r => r.text || r))}

Return ONLY a valid JSON object with this exact format:
{
  "gemini_similarity": <number between 5.0 and 9.8 representing similarity to source vibe>,
  "reasoning": "<1-2 sentence explanation of why this spot matches the user's taste and what vibe they will recognize>",
  "pros": ["<key advantage 1>", "<key advantage 2>"],
  "cons": ["<minor difference or caveat>"]
}
`;

  const result = await genAI.models.generateContent({
    model: getModelName(),
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });

  const rawText =
    result?.text ||
    result?.candidates?.[0]?.content?.parts?.map(p => p.text)?.join("")?.trim();

  const parsed = parseGeminiJson(rawText);

  // Validate parsed fields
  let sim = Number(parsed.gemini_similarity);
  if (isNaN(sim) || sim <= 0) sim = 8.0;
  if (sim > 10) sim = sim > 10 ? Math.round(sim / 10 * 10) / 10 : 8.5;

  return {
    gemini_similarity: Math.min(9.9, Math.max(4.0, sim)),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "Shares a very similar ambient vibe and customer satisfaction.",
    pros: Array.isArray(parsed.pros) && parsed.pros.length ? parsed.pros : ["Similar ambiance", "Popular local favorite"],
    cons: Array.isArray(parsed.cons) && parsed.cons.length ? parsed.cons : ["Can get busy during peak hours"]
  };
};

/* ----------------------------------------------------
   Fallback comparison when AI service is unavailable
---------------------------------------------------- */
const getHeuristicComparison = (source, candidate, distanceKm) => {
  const ratingDelta = Math.abs((source.rating || 4.2) - (candidate.rating || 4.2));
  const baseSim = Math.max(6.0, 9.2 - ratingDelta * 1.5);

  return {
    gemini_similarity: Math.round(baseSim * 10) / 10,
    reasoning: `Matches the ${candidate.type || "spot"} profile of ${source.name} with comparable customer ratings and community popularity.`,
    pros: [
      `High-rated ${candidate.type || "destination"} (${candidate.rating || 4.3}⭐)`,
      distanceKm <= 3 ? "Very close to your current location" : "Easily accessible by vehicle"
    ],
    cons: [
      distanceKm > 6 ? "Slightly farther commute" : "Popular spot, may have waiting time"
    ]
  };
};

/* ----------------------------------------------------
   PUBLIC FUNCTION
---------------------------------------------------- */
export const comparePlacesWithGemini = async ({
  sourcePlace,
  candidatePlace,
  distanceFromCurrentCityKm,
  nearbyPlacesCount
}) => {
  const distScore = normalizeDistanceScore(distanceFromCurrentCityKm);
  const densScore = normalizeDensityScore(nearbyPlacesCount);

  let ai;
  try {
    ai = await getGeminiReviewComparison(sourcePlace, candidatePlace);
  } catch (err) {
    console.warn("⚠️ Gemini AI unavailable, using intelligent heuristic:", err.message);
    ai = getHeuristicComparison(sourcePlace, candidatePlace, distanceFromCurrentCityKm);
  }

  const finalScore =
    0.65 * (ai.gemini_similarity * 10) +
    0.25 * (distScore * 10) +
    0.10 * (densScore * 10);

  return {
    similarity_score: Math.min(98, Math.max(55, Math.round(finalScore))),
    gemini_similarity: ai.gemini_similarity,
    distance_score: distScore,
    density_score: densScore,
    reasoning: ai.reasoning,
    pros: ai.pros,
    cons: ai.cons,
    provider: getGeminiClient() ? "gemini" : "heuristic"
  };
};
