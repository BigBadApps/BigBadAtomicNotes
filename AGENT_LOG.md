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
