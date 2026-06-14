# Security Policy

Speack3 is an end-to-end encrypted messenger. This document states what is
protected today, what is **not yet** protected, and how to report issues.

## Reporting a vulnerability

Open a private security advisory on GitHub (Security → Advisories) or contact
the maintainers. Please do not file public issues for exploitable bugs.

## What is protected today

- **1-to-1 messages**: end-to-end encrypted with the Signal Protocol
  (X3DH + Double Ratchet). Private keys are generated on-device and stored in
  the OS secure enclave (iOS Keychain / Android Keystore).
- **Passwords**: hashed with bcrypt (10 rounds); never stored in plaintext.
- **Transport**: intended to run behind HTTPS/WSS in production.
- **Auth**: short-lived JWT access tokens (1h) + refresh tokens (7d).

## Known limitations (being addressed)

These are **current, honest** gaps. Do not rely on Speack3 for high-risk use
until they are closed:

| Area | Status |
|------|--------|
| **Group messages** | Not yet end-to-end encrypted (the server can read group message contents). True group encryption (sender keys / pairwise fan-out) is in progress. |
| **Metadata** | Not encrypted (who talks to whom, and when, is visible to the server). |
| **Local token storage** | Being migrated to the OS secure store; older builds kept tokens in plaintext AsyncStorage. |
| **Server hardening** | Rate limiting, strict CORS, refresh-token revocation and socket input validation are being added. |
| **Dependencies** | The Signal library in use is old; an upgrade is planned. |
| **Identity verification** | A human-comparable safety-number/QR flow is not yet implemented. |

## Supported versions

This project is pre-1.0 / beta. Only the latest `master` is supported. The
published APK is a **debug** build for testing, not a hardened release build.

## Hardening checklist for self-hosters

- Set strong, unique `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Set `ALLOWED_ORIGINS` explicitly (do not run with a wildcard in production).
- Terminate TLS at a reverse proxy (nginx + Let's Encrypt) so traffic is WSS.
- Use a release keystore (not the debug keystore) for any distributed build.
