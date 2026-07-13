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
  
  // Find all markdown code blocks: ```markdown ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:markdown)?\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const noteContent = match[1].trim();
    if (!noteContent) continue;
    
    // Find the title, which is the first line starting with "# "
    const titleMatch = noteContent.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled Atomic Note";
    
    // Generate clean filename
    let fileName = title.replace(/[\\/:*?"<>|]/g, "").trim();
    if (!fileName.endsWith(".md")) {
      fileName += ".md";
    }
    
    // Parse basic frontmatter info for UI displays
    let aliases = "";
    let tags = "";
    let source = "";
    let date = "";
    
    const frontmatterMatch = noteContent.match(/^---([\s\S]*?)---/);
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
      content: noteContent,
      frontmatter: { aliases, tags, source, date }
    });
  }
  
  // Fallback: If no code blocks were found, but the model output contains "---" and markdown anyway,
  // let's try splitting by thematic dividers "---" if it looks like there are notes.
  if (notes.length === 0 && rawText.includes("---")) {
    const blocks = rawText.split(/\r?\n---\r?\n/);
    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || trimmedBlock.length < 50) continue;
      
      const titleMatch = trimmedBlock.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        const title = titleMatch[1].trim();
        let fileName = title.replace(/[\\/:*?"<>|]/g, "").trim() + ".md";
        
        notes.push({
          title,
          fileName,
          content: trimmedBlock,
          frontmatter: { aliases: "", tags: "", source: "", date: "" }
        });
      }
    }
  }
  
  return notes;
}
