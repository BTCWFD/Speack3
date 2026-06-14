# Testing Speack3 on an Emulator

This guide gets the app running on an Android emulator and gives a concrete
checklist to verify Phase 2 security and the **group-encryption draft**.

## 0. One-time emulator setup

```powershell
# Installs JDK + Android SDK + system image, creates an AVD, launches it.
powershell -ExecutionPolicy Bypass -File scripts/setup-android-emulator.ps1
```
Requirements: winget, ~6–8 GB free, and "Windows Hypervisor Platform" enabled
(Turn Windows features on/off) for acceleration. First boot takes a few minutes.

To just relaunch a configured emulator later:
```powershell
powershell -File scripts/setup-android-emulator.ps1 -LaunchOnly
```

## 1. Start the backend

```powershell
cd server
# create .env with strong-ish secrets if you haven't:
#   JWT_SECRET=...  JWT_REFRESH_SECRET=...
npm install
npm run dev          # http://localhost:3000  (health: /health)
```
The Android emulator reaches the host machine at **10.0.2.2**, so set the app's
server host accordingly:
- Edit `mobile/src/config/api.js` and set `SERVER_HOST = '10.0.2.2'`.

## 2. Run the app

```powershell
cd mobile
npm install
npx react-native run-android      # builds + installs on the running emulator
```

## 3. Test checklist

### Auth & Phase 2 hardening
- [ ] Register a user (password must be ≥8 chars with a letter and a number — try a weak one, expect rejection).
- [ ] Log in / log out; after logout the refresh token should no longer work (token revocation).
- [ ] Hammer the login endpoint >10x quickly → expect HTTP 429 (rate limiting).
- [ ] Kill and relaunch the app while logged in → session restored (tokens read from Keychain).

### 1-to-1 chat (Signal E2E)
- [ ] Register a second user (second emulator or a real device on the same backend).
- [ ] Send messages both ways; confirm they appear decrypted.
- [ ] On the server, inspect `server/data/messages.db` — `encryptedContent` for direct messages must NOT be readable plaintext.
- [ ] Edit and delete a message; the other side updates live.

### Group encryption (DRAFT — the point of this branch)
- [ ] User A creates a group including user B.
- [ ] A sends a group message; B sees it **decrypted**.
- [ ] On the server, inspect the stored group message `encryptedContent` — it must be the AES payload `{"v":1,"iv":...,"ct":...,"mac":...}`, **not** plaintext.
- [ ] B replies; A sees it decrypted.
- [ ] A adds user C via Group info; C should receive the group key and be able to read **new** messages.
- [ ] Edit/delete a group message; both sides update.
- [ ] Tamper test (optional): modify a stored group `ct` byte and confirm the client rejects it (MAC failure → message shows blank rather than garbage).

## 4. Known caveats for the group draft
- crypto-js RNG is not a hardware CSPRNG.
- No per-message forward secrecy; no re-key when a member leaves (C cannot read history sent before being added).
- If the Signal session handshake used to deliver the group key fails on device, group messages won't decrypt — capture logs (`npx react-native log-android`) and check for "Group key received" / "Build session" lines.
