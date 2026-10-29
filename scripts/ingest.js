import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(path.join(rootDir, "server", "index.js"));

const { parse } = require("csv-parse/sync");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const pg = require("pg");
const axios = require("axios");

// Load env variables
dotenv.config({ path: path.join(rootDir, "server", ".env") });
dotenv.config({ path: path.join(rootDir, ".env") });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY or GOOGLE_API_KEY missing from environment!");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_DIM = 768;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/relocai";

const pool = new pg.Pool({ connectionString });

/**
 * Build a rich descriptive text document for a locality to generate a high-signal embedding
 */
export function buildLocalityDocument(loc) {
  const parts = [
    `Locality: ${loc.name}, ${loc.city}`,
    `Overview: ${loc.description}`,
    loc.rent_range ? `Estimated Rent: ${loc.rent_range}` : null,
    loc.safety_notes ? `Safety & Security: ${loc.safety_notes}` : null,
    loc.commute_notes ? `Commute & Transit: ${loc.commute_notes}` : null,
    Array.isArray(loc.amenities) && loc.amenities.length
      ? `Key Amenities: ${loc.amenities.join(", ")}`
      : null,
    loc.lat && loc.lng ? `Coordinates: ${loc.lat}, ${loc.lng}` : null,
  ].filter(Boolean);

  return parts.join("\n");
}

/**
 * Generate embedding vector using Gemini
 */
async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIM,
    },
  });

  const vector = response.embedding?.values || response.embeddings?.[0]?.values;
  if (!vector || !vector.length) {
    throw new Error("Failed to receive vector embedding from Gemini API");
  }
  return vector;
}

/**
 * Optional Google Places / OSM Geocoding enrichment if coordinates are missing
 */
async function enrichCoordinates(locality) {
  if (locality.lat && locality.lng && !isNaN(locality.lat) && !isNaN(locality.lng)) {
    return locality;
  }

  const cleanName = locality.name.replace(/\[SAMPLE\]/gi, "").trim();
  const placesKey = process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (placesKey) {
    try {
      const resp = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
        params: { query: `${cleanName}, ${locality.city}`, key: placesKey },
        timeout: 4000,
      });
      if (resp.data?.results?.[0]?.geometry?.location) {
        const loc = resp.data.results[0].geometry.location;
        console.log(`📍 Enriched ${locality.name} via Google Places: (${loc.lat}, ${loc.lng})`);
        return { ...locality, lat: loc.lat, lng: loc.lng };
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  try {
    const osm = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { q: `${cleanName}, ${locality.city}`, format: "json", limit: 1 },
      headers: { "User-Agent": "RelocAI-Ingestion/1.0" },
      timeout: 4000,
    });
    if (osm.data?.[0]) {
      const p = osm.data[0];
      console.log(`📍 Enriched ${locality.name} via OSM: (${p.lat}, ${p.lon})`);
      return { ...locality, lat: Number(p.lat), lng: Number(p.lon) };
    }
  } catch {
    // Ignore fallback
  }

  return locality;
}

/**
 * Main ingestion routine
 */
export async function runIngestion(csvPath) {
  const filePath = csvPath || path.join(rootDir, "data", "localities.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at: ${filePath}`);
  }

  console.log(`📂 Reading localities from: ${filePath}`);
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const records = parse(rawContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`📊 Found ${records.length} records to process.`);

  let upsertCount = 0;

  for (const record of records) {
    const amenitiesArr = record.amenities
      ? record.amenities.split(",").map((a) => a.trim()).filter(Boolean)
      : [];

    let locality = {
      id: record.id ? parseInt(record.id, 10) : undefined,
      city: record.city?.trim() || "Unknown",
      name: record.name?.trim() || "Unknown",
      description: record.description?.trim() || "",
      rent_range: record.rent_range?.trim() || null,
      safety_notes: record.safety_notes?.trim() || null,
      commute_notes: record.commute_notes?.trim() || null,
      amenities: amenitiesArr,
      lat: record.lat ? parseFloat(record.lat) : null,
      lng: record.lng ? parseFloat(record.lng) : null,
    };

    // Enrich missing coordinates if needed
    locality = await enrichCoordinates(locality);

    // Build document representation
    const documentText = buildLocalityDocument(locality);
    console.log(`\n🧠 Generating embedding for: [${locality.city}] ${locality.name}...`);
    const embedding = await generateEmbedding(documentText);

    // Format embedding vector for pgvector
    const vectorString = `[${embedding.join(",")}]`;

    // Upsert into Postgres
    const upsertSql = `
      INSERT INTO localities (
        id, city, name, description, rent_range, safety_notes, commute_notes, amenities, lat, lng, embedding
      ) VALUES (
        COALESCE($1, nextval('localities_id_seq')), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector
      )
      ON CONFLICT (city, name) DO UPDATE SET
        description = EXCLUDED.description,
        rent_range = EXCLUDED.rent_range,
        safety_notes = EXCLUDED.safety_notes,
        commute_notes = EXCLUDED.commute_notes,
        amenities = EXCLUDED.amenities,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        embedding = EXCLUDED.embedding
      RETURNING id, name;
    `;

    const res = await pool.query(upsertSql, [
      locality.id || null,
      locality.city,
      locality.name,
      locality.description,
      locality.rent_range,
      locality.safety_notes,
      locality.commute_notes,
      locality.amenities,
      locality.lat,
      locality.lng,
      vectorString,
    ]);

    upsertCount++;
    console.log(`✅ Upserted locality ID ${res.rows[0].id}: ${res.rows[0].name}`);
  }

  console.log(`\n🎉 Ingestion finished! Successfully upserted ${upsertCount} localities into pgvector.`);
}

// Execute if run as script
if (process.argv[1]?.endsWith("ingest.js")) {
  runIngestion()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("❌ Ingestion error:", err);
      await pool.end();
      process.exit(1);
    });
}
