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

    // Split on boundaries where a new YAML frontmatter block begins, or (if no frontmatter) where an H1 header begins
    const hasFrontmatter = /---\s*\r?\n(?:aliases:|tags:|source:|date:)/i.test(strippedText);
    const blocks = hasFrontmatter
      ? strippedText.split(/(?=\n---\s*\r?\n(?:aliases:|tags:|source:|date:))/i)
      : strippedText.split(/(?=\n#\s+)/i);

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

export function sanitizeYamlValue(val: string): string {
  if (val === undefined || val === null) return "";
  const trimmed = val.trim();
  if (!trimmed) return "";

  // If already wrapped in double quotes: "..."
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    const inner = trimmed.slice(1, -1).replace(/\\"/g, '"');
    const escaped = inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  // If already wrapped in single quotes: '...'
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    const inner = trimmed.slice(1, -1);
    const escaped = inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  // Rule 2: Quote any frontmatter value that contains a colon (:).
  // Rule 3: Quote values with [ ] { } , & * # ? | - < > = ! % @ ` at the start,
  //         or ": " anywhere inside it.
  const containsColon = trimmed.includes(':');
  const startsWithSpecial = /^[\[\]{},&*#?|\-<>!=%@`]/.test(trimmed);
  const containsColonSpace = trimmed.includes(': ');
  const containsQuotes = trimmed.includes('"');

  if (containsColon || startsWithSpecial || containsColonSpace || containsQuotes) {
    const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  return trimmed;
}

export function sanitizeFlowSequence(sequenceStr: string): string {
  const inner = sequenceStr.trim().replace(/^\[\s*/, '').replace(/\s*\]$/, '');
  if (!inner) return "[]";

  const items: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    if ((char === '"' || char === "'") && (i === 0 || inner[i - 1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      }
      current += char;
    } else if (char === ',' && !inQuotes) {
      items.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    items.push(current.trim());
  }

  const sanitizedItems = items.map(item => sanitizeYamlValue(item));
  return `[${sanitizedItems.join(', ')}]`;
}

export function sanitizeYamlFrontmatter(fmContent: string): string {
  const lines = fmContent.split(/\r?\n/);
  const resultLines: string[] = [];
  let hasTags = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    // Key-value pair: e.g. "source: Foo" or "aliases: [A, B]"
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+):(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawVal = kvMatch[2].trim();

      if (key.toLowerCase() === 'tags') {
        hasTags = true;
        // Parse tag elements
        let tagItems: string[] = [];
        if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
          const innerTags = rawVal.slice(1, -1);
          tagItems = innerTags.split(',').map(t => t.replace(/['"\[\]#]/g, '').trim()).filter(Boolean);
        } else if (rawVal) {
          tagItems = rawVal.split(',').map(t => t.replace(/['"\[\]#]/g, '').trim()).filter(Boolean);
        }

        if (!tagItems.some(t => t.toLowerCase() === 'atomicnote')) {
          tagItems.unshift('atomicnote');
        }

        const sanitizedTags = tagItems.map(t => sanitizeYamlValue(t));
        resultLines.push(`tags: [${sanitizedTags.join(', ')}]`);
        continue;
      }

      if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        resultLines.push(`${key}: ${sanitizeFlowSequence(rawVal)}`);
      } else if (rawVal) {
        resultLines.push(`${key}: ${sanitizeYamlValue(rawVal)}`);
      } else {
        resultLines.push(`${key}:`);
      }
      continue;
    }

    // List item under a key: e.g. "  - Item"
    const listMatch = line.match(/^(\s*-\s+)(.*)$/);
    if (listMatch) {
      const prefix = listMatch[1];
      const rawVal = listMatch[2].trim();
      resultLines.push(`${prefix}${sanitizeYamlValue(rawVal)}`);
      continue;
    }

    resultLines.push(line);
  }

  if (!hasTags) {
    resultLines.push('tags: [atomicnote]');
  }

  return resultLines.join('\n');
}

export function sanitizeObsidianNote(content: string): string {
  let trimmed = content.trim();
  if (!trimmed) return "";

  let frontmatterStr = "";
  let bodyStr = trimmed;

  // Rule 1: Only one frontmatter block per file.
  if (trimmed.startsWith("---")) {
    const lines = trimmed.split(/\r?\n/);
    let closingLineIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        closingLineIdx = i;
        break;
      }
    }

    if (closingLineIdx !== -1) {
      frontmatterStr = lines.slice(1, closingLineIdx).join("\n");
      bodyStr = lines.slice(closingLineIdx + 1).join("\n");
    }
  }

  const sanitizedFm = sanitizeYamlFrontmatter(frontmatterStr);

  // Sanitize body lines: convert unindented "---" outside code fences to "***"
  const bodyLines = bodyStr.split(/\r?\n/);
  let inCodeFence = false;
  const sanitizedBodyLines = bodyLines.map(line => {
    const lineTrim = line.trim();
    if (lineTrim.startsWith("```") || lineTrim.startsWith("~~~")) {
      inCodeFence = !inCodeFence;
      return line;
    }
    if (!inCodeFence) {
      // Obsidian's linter treats any unindented --- on its own line as a frontmatter delimiter
      if (/^---[ \t]*$/.test(line)) {
        return "***";
      }
    }
    return line;
  });

  const cleanBody = sanitizedBodyLines.join("\n").trim();
  return cleanBody ? `---\n${sanitizedFm}\n---\n\n${cleanBody}` : `---\n${sanitizedFm}\n---`;
}

function addNoteFromContent(notes: ParsedNote[], noteContent: string) {
  let cleanContent = noteContent
    .replace(/^```(?:markdown)?\s*\n?/gi, '')
    .replace(/\n?```\s*$/gi, '')
    .replace(/(?:\r?\n)+---\s*$/, '')
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

  // Sanitize full note content according to strict Obsidian YAML frontmatter & single block rules
  cleanContent = sanitizeObsidianNote(cleanContent);

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
    if (sourceMatch) source = sourceMatch[1].replace(/['"]/g, '').trim();
    if (dateMatch) date = dateMatch[1].replace(/['"]/g, '').trim();
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(',')
        .map(t => t.replace(/['"\[\]#]/g, '').trim())
        .filter(Boolean)
        .join(', ');
    }
  }

  notes.push({
    title,
    fileName,
    content: cleanContent,
    frontmatter: { aliases, tags, source, date }
  });
}
