# ⚛️ BigBadAtomicNotes

> A modern, full-stack, AI-powered knowledge management web application designed to transform long-form articles, research papers, web URLs, or raw text into dense, single-concept **Atomic Notes** (`.md`) formatted for **Obsidian**, **Logseq**, **Roam Research**, and **Zettelkasten** vaults.

[![Live on Google Cloud Run](https://img.shields.io/badge/Google%20Cloud%20Run-Live-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://bigbadatomicnotes-299556828507.us-central1.run.app)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Static%20SPA-22c55e?style=for-the-badge&logo=github&logoColor=white)](https://bigbadapps.github.io/BigBadAtomicNotes/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Gemini API](https://img.shields.io/badge/Google%20Gemini-SDK%20v2.4-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)

---

## 🌐 Live Application Instances

| Environment | Host URL | Description & Capability |
| :--- | :--- | :--- |
| **🚀 Google Cloud Run** | [bigbadatomicnotes-299556828507.us-central1.run.app](https://bigbadatomicnotes-299556828507.us-central1.run.app) | **Full Node.js Express Server**: Live `/api/generate` endpoint, Google OAuth 2.0 sign-in, Gemini 3.5 Flash, BYOK API, and server-side web article scraping. |
| **🌐 GitHub Pages** | [bigbadapps.github.io/BigBadAtomicNotes](https://bigbadapps.github.io/BigBadAtomicNotes/) | **Static SPA Client**: Single-page application export with Custom Provider (BYOK) direct browser execution. |
| **💻 Local Server** | `http://localhost:3003` | **Local Desktop Mode**: Full backend with direct file-saving to local Obsidian Vault folders on macOS, Windows, and Linux. |

---

## ✨ Key Features

### 1. 🔐 Google Account OAuth 2.0 Sign-In
- Integrated Google Identity Services (GSI) OAuth 2.0 sign-in.
- Secure access to Google Gemini synthesis models (`Gemini 3.5 Flash`, `Gemini 3.1 Pro`, `Gemini 3.1 Flash Lite`).
- Clean user profile header with avatar, identity indicator, and instant sign-out.

### 2. ⚡ Multi-Model & Custom Provider (BYOK) Support
- **Gemini 3.5 Flash**: Speed-optimized, high quality atomic note distillation.
- **Gemini 3.1 Pro**: Analytical synthesis for complex technical papers and books.
- **Gemini 3.1 Flash Lite**: Low-latency atomic splits.
- **Custom OpenAI Provider (BYOK)**: Connect any OpenAI-compatible API (Ollama, LM Studio, Groq, OpenRouter, vLLM) with custom Base URL, API Key, and Model testing.

### 3. 🌐 Dual Ingestion Engine
- **Web URL Fetching**: Enter any article or documentation URL; server-side scrapers clean HTML tags and extract main content.
- **Raw Text Ingestion**: Paste chapters, raw notes, or transcripts directly.

### 4. 🧠 Automatic Wikilink Network Grid
- Synthesizes notes following strict **Principles of Atomicity** (one concept per note).
- Automatically injects bidirectional internal links (`[[WikiLinks]]`) across related notes to construct a non-linear knowledge graph upon import.

### 5. 📂 Universal Cross-Platform Folder Selector
- Supports **macOS**, **iOS (iPhone & iPad Files app)**, **Windows**, **Linux**, and **Android**.
- Combines File System Access API with native HTML5 directory selection (`webkitdirectory`) and direct path inputs (`/Volumes/...`, `~/Vault`).

### 6. 🚫 Anti-Redundancy & Clean Export System
- **Zero Extra Index Files**: Automatically filters out `index.md`, `overview.md`, or sync-conflict index files.
- **YAML Frontmatter**: Each note starts with YAML metadata (`aliases`, `tags`, `source`, `date`).
- **Batch Export**: Save notes directly into target Obsidian Vault directories or batch-download cleanly formatted `.md` files.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend Server**: Node.js, Express, `@google/genai` SDK v2.4.
- **Authentication**: Google Identity Services OAuth 2.0 (`@google/gsi`).
- **Build Systems**: Vite 6 (client SPA), esbuild (Express server CommonJS bundle).
- **Containerization**: Docker (`linux/amd64`), Google Cloud Run, Google Artifact Registry.

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/BigBadApps/BigBadAtomicNotes.git
cd BigBadAtomicNotes
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3003
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3003](http://localhost:3003)** in your web browser.

---

## 🐳 Docker & Google Cloud Run Deployment

### Build Local `linux/amd64` Image
```bash
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/gen-lang-client-0360433070/bigbadapps-repo/bigbadatomicnotes:v1 .
```

### Push to Google Artifact Registry
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/gen-lang-client-0360433070/bigbadapps-repo/bigbadatomicnotes:v1
```

### Deploy to Google Cloud Run
```bash
gcloud run deploy bigbadatomicnotes \
  --image us-central1-docker.pkg.dev/gen-lang-client-0360433070/bigbadapps-repo/bigbadatomicnotes:v1 \
  --region us-central1 \
  --allow-unauthenticated \
  --project=gen-lang-client-0360433070 \
  --set-env-vars="GEMINI_API_KEY=your_key,GOOGLE_CLIENT_ID=your_client_id,GOOGLE_CLIENT_SECRET=your_client_secret"
```

---

## 📄 License

Distributed under the MIT License. Built with ❤️ for knowledge managers and Obsidian power users.
