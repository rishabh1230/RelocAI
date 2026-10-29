# 🌍 RelocAI — Smart Relocation Intelligence Platform

<p align="center">
  <img width="240" alt="Home Screen" src="https://github.com/user-attachments/assets/f8f6a0d7-7b23-46be-b426-65f51b65f151" />
  <img width="240" alt="Map Selection" src="https://github.com/user-attachments/assets/9d9d4b47-d92a-4b9d-8fed-66fa80e91c83" />
  <img width="240" alt="Recommendations" src="https://github.com/user-attachments/assets/03997144-f50c-44e1-8a4e-76c87fe430a2" />
</p>

RelocAI is an AI-driven relocation intelligence platform that recommends personalized neighborhoods and places when relocating to a new city, powered by a **Retrieval-Augmented Generation (RAG) pipeline**, **PostgreSQL pgvector**, **Gemini AI**, and **Google Geospatial APIs**.

> *"Your lifestyle shouldn't reset when you change cities."*

---

## 🏗️ End-to-End Architecture

```mermaid
flowchart TD
    subgraph Ingestion ["1. Data Ingestion Pipeline"]
        CSV["data/localities.csv\n(Localities & Attributes)"] --> Ingest["scripts/ingest.js\n(Parser & Rich Document Builder)"]
        Ingest --> Embed["Gemini Embedding Model\ngemini-embedding-001 (768-dim)"]
        Embed --> PGVector[("PostgreSQL 16 + pgvector\n(Table: localities, HNSW Index)")]
    end

    subgraph RetrievalRanking ["2. Vector Retrieval & Distance Ranking"]
        Query["User Relocation Query / Prefs"] --> VectorSearch["services/retriever.js\nCosine Similarity (1 - <=> )"]
        PGVector --> VectorSearch
        VectorSearch --> Candidates["Top-K Candidate Localities"]
        Anchors["User Anchor Coordinates\n(Workplace, Schools, Cafes)"] --> DistMatrix["services/distanceMatrix.service.js\n(Driving Duration & Distance)"]
        Candidates --> DistMatrix
        DistMatrix --> RankedCandidates["Distance-Weighted Ranked Localities"]
    end

    subgraph Generation ["3. Grounded Generation & Structured Output"]
        RankedCandidates --> GroundedPrompt["RAG Prompt Builder\n(Strict Context & Hallucination Guard)"]
        GroundedPrompt --> GeminiGen["Gemini Generation Model\n(temperature: 0.1, JSON Mode)"]
        GeminiGen --> Validator{"Schema Validator\nvalidateRecommendationResponse()"}
        Validator -- "Valid" --> StructuredOutput["{ recommendations, followup_question }"]
        Validator -- "Invalid (Retry once)" --> GeminiGen
    end

    subgraph Memory ["4. Conversational Memory & Rewriting"]
        ChatInput["Mobile Chat Message"] --> Rewriter["services/queryRewriter.service.js\n(Extract Prefs & Rewrite Query)"]
        SessionStore[("services/memory.service.js\n(Session Memory & Cumulative Prefs)")] <--> Rewriter
        Rewriter --> VectorSearch
        StructuredOutput --> ChatResponse["/api/chat Endpoint\n(Inline Cards & Refined Context)"]
        ChatResponse --> MobileChat["Mobile App Chat Screen\n(frontend/app/chat.tsx)"]
    end

    subgraph Evaluation ["5. Evaluation Harness"]
        Queries40["eval/queries.json\n(40 Benchmark Queries)"] --> EvalRunner["eval/run_eval.js"]
        EvalRunner --> Metrics["Hit@3, Hit@5, MRR\nLLM-as-a-Judge (1-5 Rubric)"]
        Metrics --> EvalReport["eval/results.md\n(Benchmark Report)"]
    end
```

---

## 🧩 Tech Stack

- **Frontend**: React Native (Expo SDK 54), TypeScript, Cross-platform Web & Native Maps.
- **Backend**: Node.js, Express.js.
- **Vector Database**: PostgreSQL 16 + `pgvector` extension with HNSW cosine distance indexing (`vector(768)`).
- **AI & LLM**: Google Gemini API (`gemini-embedding-001` for 768-dim embeddings, `gemini-flash-lite-latest` / `gemini-2.5-flash` for generation & evaluation).
- **Geospatial**: Google Places API (New), Google Distance Matrix API.

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/) (running)
- [Node.js](https://nodejs.org/) (v18 or higher; tested on v22)
- [npm](https://www.npmjs.com/)

### 2. Clone and Configure Environment
Clone the repository and configure API keys in `server/.env`:
```bash
# Clone repository
git clone https://github.com/rishabh1230/RelocAI-Smart-Relocation-Intelligence-Platform.git
cd RelocAI-Smart-Relocation-Intelligence-Platform

# Configure server environment (server/.env)
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/relocai
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_API_KEY=your_gemini_api_key_here
PLACES_API_KEY=your_google_places_api_key_here
GEMINI_MODEL=gemini-flash-lite-latest
```

### 3. Start PostgreSQL with pgvector
Start the pgvector container via Docker Compose:
```bash
docker compose up -d
```
> **Note**: Pgvector runs on port `5433` (mapped from container `5432`) to prevent port conflicts with any existing PostgreSQL instances.

### 4. Run Database Migrations
Create the `localities` table and HNSW index:
```bash
cd server
npm run migrate
```

### 5. Ingest Sample Locality Dataset
Embed and upsert the locality seed dataset into pgvector:
```bash
npm run ingest
```
*(Data template located in `data/localities.csv` clearly labeled with `[SAMPLE]` indicators).*

### 6. Start the Backend API Server
```bash
# From server/
npm run dev
# Server will start on http://localhost:5000
```

### 7. Start the Frontend Mobile App
```bash
cd ../frontend
npm install
npx expo start --web
# Open http://localhost:8081 in your browser
```

---

## 🧪 Testing

RelocAI includes unit and integration tests covering vector retrieval, schema validation, and conversational memory:
```bash
cd server
npm test
```
**Test Coverage:**
- `test/retriever.test.js`: Cosine similarity ranking, result shape validation, and city filtering.
- `test/schemaValidator.test.js`: Strict validation of Gemini JSON schemas, score ranges `[0, 1]`, and tradeoff arrays.
- `test/memory.test.js`: Session management, turn history ordering, and multi-turn preference aggregation.

---

## 📊 Evaluation Harness & Benchmark Results

RelocAI features an automated evaluation harness in `eval/` with 40 realistic relocation benchmark queries covering Bangalore and Mumbai:

```bash
# Run the evaluation benchmark
cd server
npm run eval
# (or from root: node eval/run_eval.js)
```

The benchmark computes **Hit@3**, **Hit@5**, **Mean Reciprocal Rank (MRR)**, and evaluates generation quality using an impartial **LLM-as-a-Judge** scoring on a 1–5 scale with `temperature: 0.0`. Results are published to [`eval/results.md`](file:///c:/Users/RISHABH/OneDrive/Desktop/Projects/RelocAI/RelocAI-Smart-Relocation-Intelligence-Platform/eval/results.md).

### Benchmark Summary:

| Evaluation Dimension | Baseline (Zero-Shot) | RelocAI (RAG Pipeline) | Delta | Impact |
| :--- | :---: | :---: | :---: | :--- |
| **Retrieval Hit@3** | — | **100.0%** (40/40) | — | Target locality in top 3 |
| **Retrieval Hit@5** | — | **100.0%** (40/40) | — | Target locality in top 5 |
| **Mean Reciprocal Rank (MRR)** | — | **0.9750** | — | Near-perfect rank-1 retrieval |
| **Groundedness Score** | 4.00 / 5.0 | **5.00 / 5.0** | **+1.00** | **Zero hallucinations**; verified rents & transit |
| **Relevance Score** | 4.90 / 5.0 | **5.00 / 5.0** | **+0.10** | Precise adherence to user preferences |
| **Completeness Score** | 5.00 / 5.0 | **5.00 / 5.0** | **+0.00** | Full pros, cons, and commute caveats |
| **Overall Score** | 4.63 / 5.0 | **5.00 / 5.0** | **+0.37** | **Superior End-to-End Quality** |

---

## 💬 Conversational RAG Advisor (`/api/chat`)

In addition to traditional one-shot recommendations, RelocAI provides an interactive mobile chat advisor:
- **Endpoint**: `POST /api/chat`
- **Session Continuity**: Remembers running budget, pets, transit mode, and amenities across conversational turns.
- **Query Rewriting**: Analyzes conversation history to generate optimized search queries for vector retrieval.
- **Mobile Chat Interface**: Accessible directly from the recommendations screen (`frontend/app/chat.tsx`).

---

## 👨‍💻 Author & License
- **Author**: Rishabh Pandey
- **License**: ISC
