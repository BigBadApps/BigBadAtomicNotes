import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownNotes } from '../src/types';

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
