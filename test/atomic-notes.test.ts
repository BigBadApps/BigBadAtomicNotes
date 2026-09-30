import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownNotes, sanitizeObsidianNote, sanitizeYamlValue, sanitizeFlowSequence, sanitizeYamlFrontmatter } from '../src/types';

describe('Atomic Note Tagging Requirements', () => {
  test('automatically injects atomicnote into frontmatter tags if missing from LLM response', () => {
    const rawNote = `---
aliases: [Deep Work Concept]
tags: [productivity, focus]
source: Cal Newport Book
date: 2026-09-05
---
# Deep Work vs Shallow Work

Deep work is the ability to focus without distraction on a cognitively demanding task.

## Context / Application
Essential for modern knowledge workers.

## Related
- [[Focus]]
- [[Cognitive Load]]`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);
    
    // Check parsed frontmatter tags object
    const tagsArray = notes[0].frontmatter.tags.split(',').map(t => t.trim());
    assert.ok(tagsArray.includes('atomicnote'), `Expected 'atomicnote' in tags, got: ${notes[0].frontmatter.tags}`);
    
    // Check note.content YAML frontmatter
    assert.match(notes[0].content, /tags:\s*\[?[^\]\r\n]*atomicnote/i);
  });

  test('does not duplicate atomicnote if already present in LLM tags', () => {
    const rawNote = `---
aliases: [Zettelkasten Atomic]
tags: [atomicnote, pkm]
source: Luhmann
date: 2026-09-05
---
# Atomic Principle

One note per thought.

## Context / Application
Maintains vault hygiene.

## Related
- [[Zettelkasten]]
- [[Evergreen Notes]]`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);
    
    const tagsArray = notes[0].frontmatter.tags.split(',').map(t => t.trim());
    const count = tagsArray.filter(t => t.toLowerCase() === 'atomicnote').length;
    assert.strictEqual(count, 1, `Expected atomicnote to appear once, got: ${notes[0].frontmatter.tags}`);
  });

  test('adds atomicnote tag even when note has no tags in frontmatter', () => {
    const rawNote = `---
aliases: [Untagged Concept]
source: Web
date: 2026-09-05
---
# Untagged Concept

Concept without tags initially.

## Context / Application
Testing fallback tag creation.

## Related
- [[Note]]
- [[Test]]`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);
    
    const tagsArray = notes[0].frontmatter.tags.split(',').map(t => t.trim());
    assert.ok(tagsArray.includes('atomicnote'), `Expected atomicnote tag in empty tags note, got: ${notes[0].frontmatter.tags}`);
    assert.match(notes[0].content, /tags:\s*\[?[^\]\r\n]*atomicnote/i);
  });

  test('correctly parses multiple notes and ensures each has atomicnote tag', () => {
    const multiNotes = `---
aliases: [Concept One]
tags: [alpha]
source: Article 1
date: 2026-09-05
---
# Concept One
Body of concept one.

## Related
- [[Concept Two]]

---

---
aliases: [Concept Two]
tags: [beta]
source: Article 1
date: 2026-09-05
---
# Concept Two
Body of concept two.

## Related
- [[Concept One]]`;

    const notes = parseMarkdownNotes(multiNotes);
    assert.strictEqual(notes.length, 2);
    
    assert.ok(notes[0].frontmatter.tags.includes('atomicnote'));
    assert.ok(notes[1].frontmatter.tags.includes('atomicnote'));
    assert.match(notes[0].content, /tags:\s*\[?[^\]\r\n]*atomicnote/i);
    assert.match(notes[1].content, /tags:\s*\[?[^\]\r\n]*atomicnote/i);
    assert.strictEqual(notes[0].title, 'Concept One');
    assert.strictEqual(notes[1].title, 'Concept Two');
  });
});

describe('Obsidian YAML Frontmatter & Single Block Compliance', () => {
  test('Rule 1: Only one frontmatter block per file and converts unindented body --- to *** outside code blocks', () => {
    const noteWithBodyDividers = `---
tags: [atomicnote]
source: Article
date: 2026-09-14
---
# Single Block Test

Some introductory text.

---

A second paragraph after an unindented divider.

\`\`\`yaml
---
example_frontmatter: inside code block
---
\`\`\`

More body text.`;

    const sanitized = sanitizeObsidianNote(noteWithBodyDividers);

    // Opening frontmatter block exists
    assert.ok(sanitized.startsWith('---\n'));
    
    // Check that unindented --- outside code fence was converted to ***
    assert.ok(!sanitized.includes('\n---\n\nA second paragraph'));
    assert.ok(sanitized.includes('\n***\n\nA second paragraph'));

    // Check that --- inside triple-backtick fenced code block is preserved
    assert.ok(sanitized.includes('```yaml\n---\nexample_frontmatter: inside code block\n---\n```'));
  });

  test('Rule 2: Quotes any frontmatter value containing a colon (:)', () => {
    const rawNote = `---
aliases: [Independent Intelligence: Auditing Algorithms, Second Alias]
source: Independent Intelligence: Auditing Algorithms
title: Artificial Intelligence: An Overview
date: 2026-09-14
---
# Auditing Algorithms Note
Body content.`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);
    
    // Frontmatter source should be double quoted
    assert.match(notes[0].content, /source:\s*"Independent Intelligence: Auditing Algorithms"/);
    // Frontmatter title should be double quoted
    assert.match(notes[0].content, /title:\s*"Artificial Intelligence: An Overview"/);
    // Flow list alias with colon should be double quoted
    assert.match(notes[0].content, /aliases:\s*\["Independent Intelligence: Auditing Algorithms",\s*Second Alias\]/);
  });

  test('Rule 3: Quotes values starting with special control characters or containing colon-space', () => {
    // Starting with #, -, [, @, etc.
    assert.strictEqual(sanitizeYamlValue('#hashtag'), '"#hashtag"');
    assert.strictEqual(sanitizeYamlValue('- bullet value'), '"- bullet value"');
    assert.strictEqual(sanitizeYamlValue('@mention'), '"@mention"');
    assert.strictEqual(sanitizeYamlValue('[brackets]'), '"[brackets]"');
    assert.strictEqual(sanitizeYamlValue('{braces}'), '"{braces}"');
    assert.strictEqual(sanitizeYamlValue('!exclamation'), '"!exclamation"');
    assert.strictEqual(sanitizeYamlValue('Contains: Space'), '"Contains: Space"');

    // Values without special characters or colons remain clean
    assert.strictEqual(sanitizeYamlValue('CleanTitle'), 'CleanTitle');
    assert.strictEqual(sanitizeYamlValue('2026-09-14'), '2026-09-14');
  });

  test('Rule 4: Escapes existing double quotes inside quoted values as \\"', () => {
    const rawNote = `---
source: The "Golden" Age: A Retrospective
title: Notes on "AI Ethics"
date: 2026-09-14
---
# Quoting Test
Body text.`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);

    assert.match(notes[0].content, /source:\s*"The \\"Golden\\" Age: A Retrospective"/);
    assert.match(notes[0].content, /title:\s*"Notes on \\"AI Ethics\\""/);
  });

  test('Handles URLs with colons in source correctly', () => {
    const rawNote = `---
source: https://example.com/research/note?id=1
date: 2026-09-14
---
# URL Test
Body text.`;

    const notes = parseMarkdownNotes(rawNote);
    assert.strictEqual(notes.length, 1);

    assert.match(notes[0].content, /source:\s*"https:\/\/example\.com\/research\/note\?id=1"/);
  });
});

describe('sanitizeFlowSequence', () => {
  test('handles empty sequences', () => {
    assert.strictEqual(sanitizeFlowSequence('[]'), '[]');
    assert.strictEqual(sanitizeFlowSequence('[ ]'), '[]');
    assert.strictEqual(sanitizeFlowSequence('  [   ]  '), '[]');
    assert.strictEqual(sanitizeFlowSequence(''), '[]');
  });

  test('sanitizes simple values', () => {
    assert.strictEqual(sanitizeFlowSequence('[a, b, c]'), '[a, b, c]');
    assert.strictEqual(sanitizeFlowSequence('[ a , b , c ]'), '[a, b, c]');
  });

  test('respects values with commas inside quotes', () => {
    assert.strictEqual(sanitizeFlowSequence('["a, b", \'c, d\']'), '["a, b", "c, d"]');
    assert.strictEqual(sanitizeFlowSequence('["last, first", "name, other"]'), '["last, first", "name, other"]');
  });

  test('sanitizes values that require escaping', () => {
    // #hash requires quotes
    assert.strictEqual(sanitizeFlowSequence('[#hash, normal]'), '["#hash", normal]');
    // key: value requires quotes
    assert.strictEqual(sanitizeFlowSequence('[key: value, another]'), '["key: value", another]');
  });
});

describe('sanitizeYamlFrontmatter', () => {
  test('sanitizes basic key-value pairs', () => {
    const input = 'source: Foo bar\nauthor: John Doe';
    const output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('source: Foo bar'));
    assert.ok(output.includes('author: John Doe'));
  });

  test('sanitizes flow sequences for non-tag keys', () => {
    const input = 'aliases: [A, B]';
    const output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('aliases: [A, B]'));
  });

  test('handles keys with empty values', () => {
    const input = 'source:\nempty:   ';
    const output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('source:'));
    assert.ok(output.includes('empty:'));
  });

  test('handles list items under a key', () => {
    const input = 'related:\n  - Item 1\n  - Item 2';
    const output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('  - Item 1'));
    assert.ok(output.includes('  - Item 2'));
  });

  test('processes tags and ensures atomicnote is present as first tag', () => {
    // array format
    let input = 'tags: [productivity, focus]';
    let output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('tags: [atomicnote, productivity, focus]'));

    // comma separated string format
    input = 'tags: productivity, focus';
    output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('tags: [atomicnote, productivity, focus]'));

    // handles hash characters and quotes
    input = 'tags: ["#productivity", \'#focus\']';
    output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('tags: [atomicnote, productivity, focus]'));

    // doesn\'t duplicate atomicnote
    input = 'tags: [atomicnote, pkm]';
    output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('tags: [atomicnote, pkm]'));
  });

  test('appends tags: [atomicnote] if no tags exist', () => {
    const input = 'source: Internet\naliases: [Test]';
    const output = sanitizeYamlFrontmatter(input);
    assert.ok(output.includes('tags: [atomicnote]'));
    assert.ok(output.endsWith('tags: [atomicnote]'));
  });
});
