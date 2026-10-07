---
name: Planner storage scope
description: The user's storage and backup boundary for the personal finance planner.
---

The user reopened cloud backup: the planner now supports optional Google sign-in (Google Identity Services, no Firebase) and manual backup/restore to the user's private Google Drive `appDataFolder`.

**Why:** the user explicitly requested Google login + Google Drive backup after the first local-only release.

**How to apply:** Keep planner records local-first in browser storage by default. Cloud is opt-in and manual — signing in only enables the "Back up now" / "Restore from Drive" actions in Settings; nothing syncs automatically and no data goes to the api-server. Drive access uses the `drive.appdata` scope only.
