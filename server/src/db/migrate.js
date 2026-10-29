import { pool } from "./pg.js";

export const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log("🚀 Starting Postgres pgvector migration...");

    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("✅ pgvector extension enabled.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS localities (
        id SERIAL PRIMARY KEY,
        city VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        rent_range VARCHAR(100),
        safety_notes TEXT,
        commute_notes TEXT,
        amenities TEXT[],
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        embedding vector(768),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_city_locality UNIQUE (city, name)
      );
    `);
    console.log("✅ 'localities' table verified/created.");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_localities_city ON localities(city);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_localities_embedding 
      ON localities USING hnsw (embedding vector_cosine_ops);
    `);
    console.log("✅ Indices created on city and embedding vector (HNSW cosine).");

    console.log("🎉 Database migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
};

// If run directly from command line
if (process.argv[1]?.endsWith("migrate.js")) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
