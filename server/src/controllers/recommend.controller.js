import { SUPPORTED_PLACE_TYPES } from "../constants.js";
import { resolveSourcePlace } from "../services/recommendation.service.js";
import { getDrivingDistanceWithTraffic } from "../services/distanceMatrix.service.js";
import {
  findNearbyPlacesByTypeAtLocation,
  getPlaceDetails
} from "../services/places.service.js";
import { normalizePlaceProfile } from "../utils/normalizer.js";
import { comparePlacesWithGemini } from "../services/geminiCompare.service.js";

import { generateGroundedRecommendations } from "../services/ragRecommendation.service.js";

const normalizeType = (t) => {
  if (!t) return "restaurant";
  const cleaned = t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
  return cleaned;
};

export const recommendPlaces = async (req, res) => {
  try {
    const { previous_city, current_city, source_places, query: customQuery } = req.body;

    if (!Array.isArray(source_places) || !source_places.length) {
      return res.status(400).json({ success: false, message: "source_places array required" });
    }

    const prevCoords = previous_city?.coordinates || { lat: 28.6139, lng: 77.2090 };
    const currCoords = current_city?.coordinates || { lat: 19.0760, lng: 72.8777 };

    const results = [];

    for (const place of source_places) {
      let type = normalizeType(place.type);
      if (!SUPPORTED_PLACE_TYPES.includes(type)) {
        type = "restaurant";
      }

      const source = await resolveSourcePlace({
        name: place.name,
        type,
        coordinates: place.coordinates || prevCoords
      });

      const srcDist = await getDrivingDistanceWithTraffic({
        origin: prevCoords,
        destination: source.coordinates
      });

      const sourceDistanceKm =
        typeof srcDist.distance_km === "number"
          ? srcDist.distance_km
          : 3;

      const candidates = await findNearbyPlacesByTypeAtLocation({
        lat: currCoords.lat,
        lng: currCoords.lng,
        type,
        radius: 6000,
        maxResults: 3
      });

      const recommended = [];

      for (const c of candidates) {
        const d = await getDrivingDistanceWithTraffic({
          origin: currCoords,
          destination: c.coordinates
        });

        const details = await getPlaceDetails(c.place_id);
        const normalized = normalizePlaceProfile(details, type);

        const similarity = await comparePlacesWithGemini({
          sourcePlace: source,
          candidatePlace: normalized,
          distanceFromCurrentCityKm: d.distance_km || 3.5,
          nearbyPlacesCount: candidates.length
        });

        recommended.push({
          ...normalized,
          driving_distance_from_current_city_km: d.distance_km || 3.5,
          similarity
        });
      }

      results.push({
        source_place: {
          ...source,
          distance_from_previous_city_km: sourceDistanceKm
        },
        recommended_places_near_current_city: recommended
      });
    }

    // Grounded RAG locality recommendations
    let ragData = null;
    try {
      const ragQuery =
        customQuery ||
        `Neighborhoods matching lifestyle with favorite spots like ${source_places.map((p) => p.name).join(", ")}`;
      ragData = await generateGroundedRecommendations({
        query: ragQuery,
        city: current_city?.name,
        k: 4,
        anchorCoordinates: currCoords,
      });
    } catch (ragErr) {
      console.warn("⚠️ Grounded locality generation skipped in recommendPlaces:", ragErr.message);
    }

    res.json({
      success: true,
      results,
      rag_localities: ragData?.recommendations || [],
      followup_question: ragData?.followup_question || null,
    });
  } catch (err) {
    console.error("❌ recommendPlaces ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const recommendLocalities = async (req, res) => {
  try {
    const { query, city, k = 5, anchor_coordinates } = req.body;
    const result = await generateGroundedRecommendations({
      query: query || "Neighborhoods with vibrant cafes and good transit",
      city,
      k,
      anchorCoordinates: anchor_coordinates,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("❌ recommendLocalities ERROR:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
