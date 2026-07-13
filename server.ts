import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

  // Set payload limit to handle large texts/HTML
  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API endpoint to fetch a URL and/or generate the atomic notes
  app.post("/api/generate", async (req, res) => {
    try {
      const { input, isUrl, model } = req.body;
      const selectedModel = model || "gemini-3.5-flash";
      if (!input) {
        return res.status(400).json({ error: "Input text or URL is required." });
      }

      let contentToAnalyze = input;
      let sourceName = "User Provided Text";

      if (isUrl) {
        try {
          sourceName = input;
          const fetchRes = await fetch(input, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (!fetchRes.ok) {
            throw new Error(`Failed to fetch URL. Status code: ${fetchRes.status}`);
          }
          const html = await fetchRes.text();
          
          // Clean HTML
          contentToAnalyze = cleanHtml(html);
          if (!contentToAnalyze || contentToAnalyze.length < 50) {
            // Fallback to sending the raw HTML (truncated to protect tokens) if the cleaning was too aggressive
            contentToAnalyze = html.substring(0, 150000);
          }
        } catch (err: any) {
          console.error("Scraping error:", err);
          return res.status(422).json({ 
            error: `Could not fetch or read the URL: ${err.message || err}. Please copy and paste the article's text content directly instead.` 
          });
        }
      }

      // Check for Gemini API key
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured. Please add it via Settings > Secrets." 
        });
      }

      // Construct system prompt and user prompt
      const systemInstruction = `You are an expert knowledge manager and BigBadAtomicNotes practitioner. Your primary goal is to analyze provided articles, texts, or URLs and distill their core ideas into a series of highly dense, single-concept "atomic notes" formatted specifically for an Obsidian vault. 

Objective:
Do not simply summarize the article. Instead, deconstruct it into standalone, reusable building blocks of knowledge. Format the output as distinct Markdown code blocks so they can be easily copied and pasted into separate Obsidian .md files.

Core Rules:
1. Atomicity: Each note must focus on *one* single, specific concept or idea. If a topic requires multiple distinct ideas to explain, split it into multiple notes.
2. Synthesis over Copying: Explain the concept in your own words. Be concise, insightful, and high-density. Use bullet points for readability where appropriate.
3. Wikilinking: Aggressively identify key terms, broad themes, or related concepts and wrap them in Obsidian wikilinks (e.g., [[Cognitive Load]]). Do this naturally within the body text and in a dedicated "Related" section.
4. Formatting: Use strict Markdown. Each note must begin with YAML frontmatter.

Note Template:
For every atomic concept you identify, output a separate code block using the exact structure below:

\`\`\`markdown
---
aliases: [{Alternative name 1}, {Alternative name 2}]
tags: [{tag1}, {tag2}, {tag3}]
source: {URL or Title of the provided text}
date: {Current Date}
---
# {Concise, Declarative Note Title}

{1-3 paragraphs explaining the atomic concept in your own words. Integrate [[internal links]] to broader concepts, themes, or related ideas directly into these sentences.}

> "{Optional short, impactful quote directly from the source text that grounds the concept}"

## Context / Application
{Brief explanation of why this concept matters, how it connects to the broader theme of the article, or how it can be applied in practice.}

## Related
- [[{Broad Category/Parent Concept}]]
- [[{Related Specific Concept 1}]]
- [[{Related Specific Concept 2}]]
\`\`\`

Execution Steps:
1. Read and analyze the provided text/URL.
2. Identify 3 to 7 (depending on length) distinct, high-value atomic concepts.
3. Generate the Markdown notes using the exact template above, separating each note with a thematic divider (---). 
4. Ensure every note can be read and understood completely independently of the original article.`;

      const currentDate = new Date().toISOString().split('T')[0];
      const prompt = `Analyze the following source material and generate the atomic notes.
Source: ${sourceName}
Current Date for Frontmatter: ${currentDate}

Source Material:
${contentToAnalyze}`;

      console.log(`Calling Gemini (${selectedModel}) with content length: ${contentToAnalyze.length}...`);

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2,
        },
      });

      const markdown = response.text;
      if (!markdown) {
        throw new Error("No response generated from the Gemini model.");
      }

      res.json({ markdown });
    } catch (error: any) {
      console.error("Generation error:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred during generation." });
    }
  });

  // Helper function to clean HTML
  function cleanHtml(html: string): string {
    let clean = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    clean = clean.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    clean = clean.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
    clean = clean.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    clean = clean.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');
    const bodyMatch = clean.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      clean = bodyMatch[1];
    }
    clean = clean.replace(/<[^>]+>/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
