import * as Location from "expo-location";

export const getCityFromCoord = async (
  latitude: number,
  longitude: number
): Promise<{ name: string; level: string }> => {
  try {
    const res = await Location.reverseGeocodeAsync({ latitude, longitude });

    if (res && res.length) {
      const p = res[0];
      if (p.city) return { name: p.city, level: "city" };
      if (p.subregion) return { name: p.subregion, level: "subregion" };
      if (p.district) return { name: p.district, level: "district" };
      if (p.region) return { name: p.region, level: "region" };
    }
  } catch {
    // Platform fallback (e.g. on web)
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      { headers: { "User-Agent": "RelocAI-Platform/1.0" } }
    );
    const data = await response.json();
    if (data && data.address) {
      const city =
        data.address.city ||
        data.address.town ||
        data.address.state_district ||
        data.address.state ||
        data.address.county;
      if (city) {
        return { name: city, level: "city" };
      }
    }
  } catch {
    // Fall through
  }

  return { name: "Current City", level: "default" };
};
