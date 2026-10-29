export const PORT = process.env.PORT || 5000;

export const GOOGLE_PLACES_BASE_URL =
  "https://maps.googleapis.com/maps/api/place";

export const PLACE_DETAILS_FIELDS = [
  "name",
  "rating",
  "user_ratings_total",
  "reviews",
  "formatted_address",
  "geometry",
  "opening_hours",
  "business_status",
  "types",
  "price_level"
].join(",");


export const SUPPORTED_PLACE_TYPES = [
  "gym",
  "cafe",
  "park",
  "hospital",
  "school",
  "restaurant"
];
