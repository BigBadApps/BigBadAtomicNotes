1.  **Analyze & Baseline**:
    *   I've identified the bottleneck in `src/App.tsx`. There are two places where a `for...of` loop is used to sequentially save files:
        1. Direct folder save via `dirHandle`.
        2. Fallback folder save via `pickerHandle`.
    *   The sequential `await` for `getFileHandle`, `createWritable`, `write`, and `close` causes poor performance.
    *   I created a simple baseline simulation in `perf_test.ts` showing concurrent execution using `Promise.all` is significantly faster (11ms vs 1026ms for 100 notes).

2.  **Implementation**:
    *   Refactor the `for...of` loops in `src/App.tsx` (around lines 440-451 and 476-487) to map each note to a promise, and await `Promise.all()` to resolve them concurrently.
    *   I will replace this:
        ```typescript
        let savedCount = 0;
        for (const note of validNotes) {
          let baseName = note.fileName ? note.fileName.replace(/\.md$/i, "") : note.title;
          baseName = baseName.trim().replace(/[\\/:*?"<>|]/g, "").substring(0, 60).trim() || "Note";
          const fileName = `${baseName}.md`;

          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(sanitizeObsidianNote(note.content));
          await writable.close();
          savedCount++;
        }
        ```
    *   With this:
        ```typescript
        await Promise.all(validNotes.map(async (note) => {
          let baseName = note.fileName ? note.fileName.replace(/\.md$/i, "") : note.title;
          baseName = baseName.trim().replace(/[\\/:*?"<>|]/g, "").substring(0, 60).trim() || "Note";
          const fileName = `${baseName}.md`;

          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(sanitizeObsidianNote(note.content));
          await writable.close();
        }));
        let savedCount = validNotes.length;
        ```
    *   Apply this optimization to both instances of this loop.

3.  **Verification**:
    *   Run `npm run lint` and `npm run test`.
    *   Check that the UI and functionality are not broken by the changes.

4.  **Pre-commit steps**:
    *   Follow instructions from `pre_commit_instructions` to ensure proper verification.

5.  **Submit PR**:
    *   Use `submit` to push the changes to a new branch, describing the performance fix.
