# Changelog

All notable changes to Speack3 are documented here. Dates are ISO-8601.

## [Unreleased]

### Added
- **Chat features**: edit/delete messages (socket + REST, sender-only,
  soft-delete), last-seen presence in the chat header, user **Profile** screen
  (with a Signal safety-number fingerprint), and a **Group info** screen with
  admin add/remove members and delete-group.
- **Screens** that previously did nothing now exist and are wired:
  `CreateGroup`, `Settings` (with logout), `Profile`, `GroupInfo`.
- **CI/CD**: GitHub Actions workflow that builds the Android debug APK in the
  cloud and publishes it to the `apk-latest` release; server `Dockerfile`,
  `docker-compose.yml`, and a Render blueprint (`render.yaml`) for one-click
  deploy.
- **Build config** that was missing: `metro.config.js`, `babel.config.js`.
- Project files: root `.gitignore`, `LICENSE` (MIT), `SECURITY.md`,
  `docs/GROUP_ENCRYPTION_DESIGN.md`.

### Fixed
- **Critical**: group member add/remove and prekey rotation were silently
  broken because the model wrapped every update in `$set`, swallowing
  `$pull`/`$addToSet`. Operators now reach NeDB (verified end-to-end).
- `group.settings` is now initialized on creation; defensive reads elsewhere.
- Missing `await` on the socket online-status update.
- Hardcoded LAN IP replaced with a single configurable `SERVER_HOST`.
- README MongoDB/NeDB contradiction, contact placeholders, and personal paths
  in the setup docs; `cdserver` typo.
- Stopped tracking `server/data/*.db` runtime files in git.

### In progress (Phase 2 — security)
- Server hardening (rate limiting, fail-closed CORS, refresh-token revocation,
  socket input validation, password strength).
- First automated test suite (Jest + supertest, in-memory NeDB).
- Local token storage moving from plaintext AsyncStorage to the OS Keychain.
- Group message encryption (currently plaintext — see SECURITY.md).
