# Agent Activity Log

This log tracks project configuration changes, architecture decisions, and system setups.

## 2026-07-17
### 1. Project Directory Migration & Git Sync
- **What**: Migrated all codebase files from the legacy workspace to `/Volumes/BigBadDrive_1/BigBadAtomicNotes`.
- **Why**: Moved the project to the external drive `/Volumes/BigBadDrive_1` for dedicated storage and version control isolation.
- **Git Push**: Initialized git and pushed the codebase to the remote repository `https://github.com/BigBadApps/BigBadAtomicNotes.git`.

### 2. Branding Renaming (BigBadAtomicNotes)
- **What**: Replaced all references to "Obsidian Zettelkasten Generator", "Zettlels", "Zettels", "Zettel-Agent", and "Zettelkasten Mode" with "BigBadAtomicNotes".
- **Files Modified**: `metadata.json`, `README.md`, `server.ts`, and `src/App.tsx`.
- **Impact**: Standardized all DOM IDs, localStorage keys, system instruction prompts, and UI headers under the new `BigBadAtomicNotes` branding.

### 3. Local Workspace Restoration (Cloud Run Sync)
- **What**: Synced the updated, renamed project files back to `/Users/robertburmaster/antigravity/BigBadAtomicNotes` (excluding `node_modules` and `.git` folders).
- **Why**: Restored the local directory so that the Google AI Studio / Cloud Run app synchronization mechanism continues to function and deploy the code to Google Cloud Run correctly.

### 4. launchd & caffeinate Persistent Service
- **What**: Set up a persistent macOS launchd agent at `/Users/robertburmaster/Library/LaunchAgents/com.bbos.bigbadatomicnotes.plist`.
- **Details**:
  - Runs the dev server on port `3003` (avoiding port conflicts with other services on 3000-3002).
  - Spawns the process using `/usr/bin/caffeinate -i` to prevent system sleep while the server is active.
  - Automatically loads and runs on system boot/login, keeping it alive continuously.
- **Logs**: Output is directed to `launchd-stdout.log` and `launchd-stderr.log` in the local workspace directory.

## 2026-09-05
### 1. Restoration of Google Signon Prompt & Auth Flow
- **What**: Restored the Google Signon Prompt (`google.accounts.id.prompt()`) for unauthenticated sessions and enhanced the "Google Sign-In Required" UX.
- **Root Cause**: `google.accounts.id.prompt()` was omitted during the design refresh, and `GoogleAuth.tsx` did not configure `auto_select: true` or `use_fedcm_for_prompt: true`. Unmemoized callbacks in `App.tsx` were causing repeated DOM clears on `buttonRef.current`, while the Primary CTA button remained disabled with no clickable action.
- **Files Modified**: `src/GoogleAuth.tsx`, `src/App.tsx`, `AGENT_LOG.md`.
- **Impact**:
  1. On page load, unauthenticated users automatically receive the native Google Signon Prompt (One Tap / FedCM).
  2. Users can trigger the prompt on demand via the "Show Prompt" or "Sign In with Google" buttons in the "Google Sign-In Required" alert.
  3. The Primary Synthesize button switches to an active "Sign in with Google to Synthesize" trigger rather than a disabled dead end.
  4. Callbacks in `App.tsx` are wrapped with `useCallback`, and sign-out invokes `disableAutoSelect()`.

### 2. GitHub Pages & Static Build Client ID Injection Fix
- **What**: Added `VITE_GOOGLE_CLIENT_ID` environment variable to the Build step in `.github/workflows/deploy.yml` and added the GCP Authorized Client ID fallback in `src/GoogleAuth.tsx`.
- **Root Cause**: `.github/workflows/deploy.yml` executed `npm run build` without providing `VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}`, causing Vite to build with an empty `client_id` for GitHub Pages. `GoogleAuth.tsx` lacked a fallback to the authorized client ID.
- **Files Modified**: `.github/workflows/deploy.yml`, `src/GoogleAuth.tsx`, `src/App.tsx`, `AGENT_LOG.md`.
- **Impact**: GitHub Pages (`https://bigbadapps.github.io/BigBadAtomicNotes/`) and local/container builds consistently bundle the authorized client ID, eliminating the console error and enabling Google Signon Prompt.

### 3. Direct Local Vault Save via File System Access API
- **What**: Fixed the "Save Vault" function so notes save directly to the user's local directory on their Mac via the HTML5 File System Access API, with IndexedDB handle persistence.
- **Root Cause**: When running on Google Cloud Run, clicking "Save Vault" sent a `POST /api/save-files` to the remote server. The Cloud Run container was creating the local directory path inside its ephemeral Linux container in Google Cloud and returning HTTP 200, creating a false confirmation toast while leaving the user's actual Mac vault empty.
- **Files Modified**: `src/App.tsx`, `src/idb.ts`, `server.ts`, `AGENT_LOG.md`.
- **Impact**:
  1. In Brave/Chrome, clicking "Save Vault" writes notes directly to the chosen local directory on the user's machine using `FileSystemDirectoryHandle`.
  2. If no directory handle is active, `showDirectoryPicker` is automatically invoked to let the user select their vault folder.
  3. The directory handle is persisted in IndexedDB so subsequent saves require zero re-prompting.
  4. Remote Cloud Run containers now block `/api/save-files` from silently writing to container storage.

### 4. Mandatory #atomicnote Tagging Across All Generated Notes
- **What**: Enforced `#atomicnote` tagging on all generated and synthesized notes across backend prompts, browser BYOK synthesis, parser fail-safes, placeholder notes, and UI badge renders.
- **Details**:
  1. Updated `server.ts` system instructions to mandate the `atomicnote` tag in Core Rules, the note YAML template (`tags: [atomicnote, ...]`), and Execution Steps.
  2. Updated `executeByokClientSynthesis` in `src/App.tsx` to require the `atomicnote` tag for browser-based custom provider syntheses.
  3. Added deterministic parsing and injection logic in `src/types.ts`: whenever notes are parsed from LLM markdown, the parser guarantees `atomicnote` is present in `frontmatter.tags` and in the raw YAML frontmatter block if missing, without duplication.
  4. Fixed multi-note split regex in `src/types.ts` so frontmatter blocks are never prematurely detached from note headers.
  5. Updated placeholder note generation in `src/App.tsx` to include `atomicnote`.
  6. Sanitized tag chip rendering in `src/App.tsx` (`#{tag.trim().replace(/^#/, '')}`) to prevent double hashes (`##atomicnote`).
  7. Updated `.agents/skills/obsidian-atomic-notes-validator/SKILL.md` to require `atomicnote`.
  8. Added unit test suite in `test/atomic-notes.test.ts` with `npm test` script.
- **Files Modified**: `server.ts`, `src/App.tsx`, `src/types.ts`, `package.json`, `test/atomic-notes.test.ts`, `.agents/skills/obsidian-atomic-notes-validator/SKILL.md`, `AGENT_LOG.md`.
