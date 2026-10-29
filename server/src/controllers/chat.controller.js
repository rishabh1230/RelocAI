import { GoogleGenAI } from "@google/genai";
import {
  getOrCreateSession,
  addTurn,
  updatePreferences,
} from "../services/memory.service.js";
import { extractPreferencesAndRewriteQuery } from "../services/queryRewriter.service.js";
import { generateGroundedRecommendations } from "../services/ragRecommendation.service.js";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const handleChat = async (req, res) => {
  try {
    const { session_id, message, city, anchor_coordinates } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "A message string is required" });
    }

    // 1. Get or create session
    const session = getOrCreateSession(session_id);

    // 2. Extract preferences & rewrite retrieval query using conversational history
    const { extractedPreferences, rewrittenQuery } =
      await extractPreferencesAndRewriteQuery({
        message: message.trim(),
        history: session.history,
        currentPreferences: session.preferences,
      });

    // 3. Update accumulated preferences
    const updatedPrefs = updatePreferences(session.id, {
      ...extractedPreferences,
      city: city || extractedPreferences.city || session.preferences.city,
    });

    const targetCity = updatedPrefs.city || city || null;

    // 4. Run grounded RAG generation using the rewritten query
    const ragResult = await generateGroundedRecommendations({
      query: rewrittenQuery,
      city: targetCity,
      k: 3,
      anchorCoordinates: anchor_coordinates,
    });

    // 5. Generate conversational explanation grounded in retrieved facts
    let assistantMessage = "";
    if (ai) {
      const chatPrompt = `
You are RelocAI's friendly, highly knowledgeable neighborhood relocation advisor.
Address the user directly in a concise, warm, helpful conversational tone (2-3 sentences).
Present the best recommendations that were retrieved, referencing their specific preferences (such as budget, commute, and lifestyle).
Do NOT hallucinate any facts not in the recommendations list.

USER'S LATEST MESSAGE:
"${message}"

USER'S RUNNING PREFERENCES:
${JSON.stringify(updatedPrefs)}

RECOMMENDED LOCALITIES (GROUND TRUTH):
${JSON.stringify(ragResult.recommendations.map(r => ({ name: r.name, rent: r.locality?.rent_range, reasons: r.reasons, tradeoffs: r.tradeoffs, commute: r.commute_to_anchor })))}

FOLLOWUP QUESTION TO ASK:
${ragResult.followup_question || ""}
`;

      try {
        const resp = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: chatPrompt,
          config: { temperature: 0.3 },
        });
        assistantMessage = resp.text?.trim() || "";
      } catch (err) {
        console.warn("⚠️ Conversational synthesis fallback:", err.message);
      }
    }

    if (!assistantMessage) {
      if (ragResult.recommendations.length > 0) {
        const top = ragResult.recommendations[0];
        assistantMessage = `Based on your preferences, ${top.name} is your strongest match (${Math.round(top.score * 100)}% fit). ${top.reasons[0] || ""}`;
      } else {
        assistantMessage = "I searched our neighborhood intelligence base, but couldn't find a direct match. Could you tell me more about your preferred budget or commute distance?";
      }
    }

    // 6. Record turns in memory
    addTurn(session.id, "user", message.trim());
    addTurn(session.id, "assistant", assistantMessage);

    res.json({
      success: true,
      session_id: session.id,
      message: assistantMessage,
      preferences: updatedPrefs,
      rewritten_query: rewrittenQuery,
      recommendations: ragResult.recommendations,
      followup_question: ragResult.followup_question,
    });
  } catch (err) {
    console.error("❌ handleChat ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getSessionHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = getOrCreateSession(sessionId);
    res.json({
      success: true,
      session_id: session.id,
      history: session.history,
      preferences: session.preferences,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
