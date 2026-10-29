import axios from "axios";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

/* Haversine fallback (km) */
const haversineDistance = (o, d) => {
  if (!o || !d || typeof o.lat !== "number" || typeof d.lat !== "number") return 3.0;
  const toRad = v => (v * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(d.lat - o.lat);
  const dLng = toRad(d.lng - o.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(o.lat)) *
      Math.cos(toRad(d.lat)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

export const getDrivingDistanceWithTraffic = async ({ origin, destination }) => {
  if (!origin || !destination || typeof origin.lat !== "number" || typeof destination.lat !== "number") {
    return {
      distance_km: 3.5,
      duration_text: "10 mins",
      duration_in_traffic_text: null
    };
  }

  try {
    if (!API_KEY) throw new Error("Missing API key");

    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        timeout: 5000,
        params: {
          origins: `${origin.lat},${origin.lng}`,
          destinations: `${destination.lat},${destination.lng}`,
          mode: "driving",
          departure_time: "now",
          traffic_model: "best_guess",
          key: API_KEY
        }
      }
    );

    const el = res?.data?.rows?.[0]?.elements?.[0];

    if (res.data.status !== "OK" || !el || el.status !== "OK") {
      throw new Error(res.data.error_message || "Invalid Distance Matrix response");
    }

    return {
      distance_km: Math.round((el.distance.value / 1000) * 10) / 10,
      duration_text: el.duration.text,
      duration_in_traffic_text: el.duration_in_traffic?.text || null
    };
  } catch (err) {
    const km = haversineDistance(origin, destination);
    const estimatedMinutes = Math.max(3, Math.round(km * 2.5 + 4));

    return {
      distance_km: km,
      duration_text: `${estimatedMinutes} mins`,
      duration_in_traffic_text: null
    };
  }
};
