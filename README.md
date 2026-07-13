# BigBadAtomicNotes

A modern, full-stack, AI-powered tool designed to transform long-form text, articles, research papers, or web URLs into highly cohesive, atomic, and Wikilink-connected Markdown notes (`.md`). The output is perfectly optimized for modern non-linear note-taking applications like **Obsidian**, **Logseq**, or **Roam Research**.

---

## 🎨 Visual Preview & Concept

BigBadAtomicNotes automates the process of dissecting dense informational sources into single-topic, highly connected atomic notes. It constructs a semantic web of knowledge by automatically creating internal link-references (`[[WikiLinks]]`) between synthesized topics.

---

## 🚀 Key Features

### 1. Dual Ingestion Engine
*   **Raw Text**: Paste articles, book chapters, essays, or messy scratchpad notes directly.
*   **Web URLs**: Provide any article or website link; the backend securely pulls and parses the webpage content.

### 2. Intelligent Atomic Synthesis (AI-Powered)
*   Powered by server-side **Gemini API** integration.
*   Dissects complex, unstructured materials into discrete, single-concept notes following classic principles of atomicity (Principle of Atomicity).

### 3. Automatic Wikilink Connection Grid
*   The AI evaluates semantic relationships among the synthesized notes.
*   Injects bi-directional internal links (`[[Link Name]]`) automatically so they relate to each other immediately upon import.

### 4. Active Synthesis Review Panel
*   Toggle between **Card Preview** (rendered styled markdown with live formatting) and **Markdown Editor** (raw content editing).
*   **Live Editing**: Modify note titles (updates target file names instantly) or rewrite content directly in-app.
*   Copy individual card markdown with a single click.

### 5. Seamless Local Storage Export & Obsidian Vault Integration
*   **Direct Local Folder Sync**: Connects to your local folder/Obsidian Vault directly using the browser's **File System Access API**.
*   **High-Compatibility Fallback**: If browser restrictions are active, it falls back to batch-downloading files cleanly with standardized date-prefix names (`YYYY:MM:DD:HH - Note Title.md`).
*   **Obsidian URI Configuration**: Define your Obsidian Vault name in the configuration sidebar to generate vault-specific deep links.

### 6. Local Persistence History
*   Stores up to 20 past ingestion batches in the browser's `localStorage`.
*   Retains your raw input text/URL, customized parameters, and any post-generation edits so you never lose your progress.

---

## 🛠️ Architecture & Tech Stack

*   **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, and Framer Motion for smooth transitions and interfaces.
*   **Backend**: Node.js & Express custom server. Mounts Vite in development and handles static asset serving in production.
*   **AI Integration**: Server-side Google GenAI SDK integration (`process.env.GEMINI_API_KEY`) to proxy request parsing securely. No API keys are ever leaked to the browser.

---

## 📋 How to Use

### Step 1: Ingest Content
1. Open the app interface.
2. Select **Text Input** or **URL Ingest** at the top.
3. Paste your content or input the desired webpage URL.

### Step 2: Configure Generation Parameters
1. Under the configuration panel, adjust target note count and customize any extraction prompts (e.g., target language, tone, or specific themes to emphasize).
2. Specify your **Obsidian Vault Name** in the configuration panel.
3. Optionally click **Browse Folder** (or type a folder path) to register your Obsidian vault or folder label for file saving.

### Step 3: Synthesize
1. Click **Synthesize Notes**.
2. Wait a few moments as the AI processes the source, isolates core ideas, and designs the inter-connected markdown.

### Step 4: Review, Edit, & Polish
1. View the newly minted notes in the **Synthesis Review Panel**.
2. Toggle the sub-tab to **Editor Mode** to tweak the title or body markdown.
3. Any edits you make are synced immediately to the file save compiler.

### Step 5: Save & Sync
1. Click **Save Draft** in the active review header.
2. The files will write directly to your selected directory or batch-download to your browser's default download folder, ready to be copied into your Obsidian Vault!

---

## 💻 Development & Deployment Setup

### Environment Configuration
The application requires a Gemini API key. Create a `.env` file in the root directory (based on `.env.example`):

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run in Development Mode
Launches the custom Express + Vite dev environment on port `3000`:
```bash
npm run dev
```

### Production Build & Compilation
Vite compiles the React client-side assets into `dist/`, and `esbuild` bundles the Express `server.ts` into a self-contained CommonJS `dist/server.cjs` bundle:
```bash
npm run build
```

### Start Production Server
Boot up the production server on host `0.0.0.0:3000`:
```bash
npm run start
```
