export interface ParsedNote {
  title: string;
  fileName: string;
  content: string; // Complete Markdown content inside the code block (including YAML frontmatter)
  frontmatter: {
    aliases: string;
    tags: string;
    source: string;
    date: string;
  };
}

export function parseMarkdownNotes(rawText: string): ParsedNote[] {
  const notes: ParsedNote[] = [];
  
  let cleanedText = rawText.trim();

  // Try parsing by code blocks if present
  const codeBlockRegex = /```(?:markdown)?\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(cleanedText)) !== null) {
    const noteContent = match[1].trim();
    if (!noteContent) continue;
    addNoteFromContent(notes, noteContent);
  }
  
  // Primary / Fallback: Parse notes by note boundaries (start of YAML frontmatter or H1 header)
  if (notes.length === 0) {
    const strippedText = cleanedText
      .replace(/^```(?:markdown)?\s*/gm, '')
      .replace(/^```\s*$/gm, '')
      .trim();

    // Split on boundaries where a new YAML frontmatter block or H1 header begins
    const blocks = strippedText.split(/(?=\n---\s*\n(?:aliases:|tags:|source:|date:))|(?=\n#\s+)/i);
    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || trimmedBlock.length < 20) continue;
      addNoteFromContent(notes, trimmedBlock);
    }
  }

  if (notes.length === 0 && cleanedText.length > 0) {
    const stripped = cleanedText.replace(/^```(?:markdown)?\s*/gm, '').replace(/^```\s*$/gm, '').trim();
    addNoteFromContent(notes, stripped);
  }

  return filterOutIndexNotes(notes);
}

export function isMocOrIndexNote(title: string, fileName: string): boolean {
  const t = (title || "").toLowerCase().trim();
  const fn = (fileName || "").toLowerCase().trim();

  if (!t && !fn) return false;

  return (
    t === "index" ||
    t === "overview" ||
    t === "moc" ||
    t === "map of content" ||
    t.includes("index") ||
    t.includes("overview") ||
    t.includes("map of content") ||
    t.endsWith("-moc") ||
    t.endsWith(" moc") ||
    fn === "index.md" ||
    fn === "overview.md" ||
    fn.includes("index") ||
    fn.includes("overview") ||
    fn.includes("moc")
  );
}

export function filterOutIndexNotes(notes: ParsedNote[]): ParsedNote[] {
  return notes.filter(n => !isMocOrIndexNote(n.title, n.fileName));
}

function addNoteFromContent(notes: ParsedNote[], noteContent: string) {
  const cleanContent = noteContent
    .replace(/^```(?:markdown)?\s*\n?/gi, '')
    .replace(/\n?```\s*$/gi, '')
    .trim();

  if (!cleanContent || cleanContent.length < 10) return;

  // 1. Extract title from "# Title" or "## Title" header
  let title = "";
  const headerMatch = cleanContent.match(/^(?:#|##)\s+(.+)$/m);
  if (headerMatch && headerMatch[1].trim()) {
    title = headerMatch[1].trim();
  }

  // If there is no H1/H2 header and the block is just a YAML frontmatter fragment, skip it!
  if (!title) {
    const bodyWithoutFrontmatter = cleanContent.replace(/^---[\s\S]*?---/, '').trim();
    if (!bodyWithoutFrontmatter || bodyWithoutFrontmatter.length < 15) {
      return; // Skip isolated YAML frontmatter fragments!
    }
  }

  // 2. Fallback: extract title from YAML frontmatter aliases/source or first readable body line
  if (!title) {
    const lines = cleanContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let inFrontmatter = false;
    for (const line of lines) {
      if (line === "---") {
        inFrontmatter = !inFrontmatter;
        continue;
      }
      if (inFrontmatter) {
        if (line.toLowerCase().startsWith("aliases:")) {
          const aliasVal = line.replace(/aliases:\s*\[?([^\]]+)\]?/i, "$1").replace(/['"]/g, "").trim();
          if (aliasVal) {
            title = aliasVal.split(",")[0].trim();
            break;
          }
        }
      } else {
        const candidate = line.replace(/^[#*->\s]+/, "").trim();
        if (candidate) {
          title = candidate.substring(0, 50).trim();
          break;
        }
      }
    }
  }

  if (!title) {
    title = `Atomic Note ${notes.length + 1}`;
  }

  // Generate clean filename
  let baseFileName = title.replace(/[\\/:*?"<>|]/g, "").trim();
  if (!baseFileName) {
    baseFileName = `Atomic Note ${notes.length + 1}`;
  }

  let fileName = baseFileName.endsWith(".md") ? baseFileName : `${baseFileName}.md`;

  // Ensure unique filenames across the batch
  let counter = 1;
  while (notes.some(n => n.fileName.toLowerCase() === fileName.toLowerCase())) {
    counter++;
    fileName = `${baseFileName} (${counter}).md`;
  }

  let aliases = "";
  let tags = "";
  let source = "";
  let date = "";

  const frontmatterMatch = cleanContent.match(/^---([\s\S]*?)---/);
  if (frontmatterMatch) {
    const fmContent = frontmatterMatch[1];
    const aliasesMatch = fmContent.match(/aliases:\s*\[?([^\]\r\n]+)\]?/i);
    const tagsMatch = fmContent.match(/tags:\s*\[?([^\]\r\n]+)\]?/i);
    const sourceMatch = fmContent.match(/source:\s*([^\r\n]+)/i);
    const dateMatch = fmContent.match(/date:\s*([^\r\n]+)/i);

    if (aliasesMatch) aliases = aliasesMatch[1].replace(/['"\[\]]/g, '').trim();
    if (tagsMatch) tags = tagsMatch[1].replace(/['"\[\]]/g, '').trim();
    if (sourceMatch) source = sourceMatch[1].replace(/['"]/g, '').trim();
    if (dateMatch) date = dateMatch[1].trim();
  }

  notes.push({
    title,
    fileName,
    content: cleanContent,
    frontmatter: { aliases, tags, source, date }
  });
}
