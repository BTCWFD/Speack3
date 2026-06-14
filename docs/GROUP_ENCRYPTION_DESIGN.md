# Group Message Encryption — Design

Status: **implemented as a draft** on branch `feature/group-encryption`
(compiles/bundles; **not yet verified on a real device**). The shipped stable
build still treats groups as plaintext until this is device-verified and merged.

## Implemented (draft) — symmetric group key

Rather than the per-recipient fan-out below, the draft uses a shared symmetric
**group key** so message history, edit and delete keep working unchanged
(one ciphertext per message, server stays a blind relay — no server changes):

- `GroupCryptoService` — AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC); the
  32-byte key is split into enc/MAC subkeys via SHA-256.
- The key is generated on group creation and **distributed to each member over
  their pairwise Signal session** (a `{__speack3:'group-key'}` control message
  tunnelled through `message:direct`); receivers detect it and store the key in
  the Keychain (`StorageService.saveGroupKey`).
- `SocketService.sendGroupMessage` encrypts with the group key;
  `message:receive`/`message:edited` decrypt group payloads with it.
- Adding a member re-shares the existing key (`GroupInfoScreen`).

Known gaps before this can be promoted out of draft:
- crypto-js RNG is not a hardware CSPRNG — move to a platform secure-random.
- No per-message forward secrecy and no re-key when a member leaves.
- Needs on-device testing of the Signal session handshake used for key delivery.

---

## Original plan (kept for reference): pairwise fan-out
Status: **superseded** by the symmetric approach above for v1.

## Goal

Stop sending group message bodies in plaintext, reusing the Signal pairwise
sessions that already work for 1-to-1, without adding a native crypto library
(`react-native-quick-crypto` was removed; the Signal lib brings its own crypto).

## Chosen approach: pairwise fan-out (simplest correct option)

The sender encrypts each group message **once per recipient** using the existing
`SignalService.encryptMessage(memberId, plaintext)` (the same primitive that
already works 1-to-1), producing one ciphertext per member. The server relays
each member their own ciphertext. Each member decrypts with their pairwise
session — exactly like a direct message.

Trade-offs:
- ✅ Reuses working, audited pairwise Signal sessions; no new crypto.
- ✅ Server never sees plaintext.
- ⚠️ O(N) ciphertexts per message (fine for the ~30-member target).
- ⚠️ Not the same as Signal "Sender Keys" (which is O(1) per message). A future
  optimization, not required for correctness.

## Required changes

### Client — `SignalService`
- Ensure a session exists with every member before encrypting: if missing,
  fetch the member's prekey bundle (`ApiService.getUserPreKeys`) and
  `buildSession` (this already exists for 1-to-1).

### Client — `SocketService.sendGroupMessage(groupId, text, tempId)`
- Keep the public signature. Internally:
  1. Get the member list (cache from the group, or `ApiService.getGroupById`).
  2. For each member ≠ self: `enc = encryptMessage(memberId, text)`.
  3. Emit `message:group` with `recipients: [{ memberId, encryptedContent }]`
     instead of a single plaintext `encryptedContent`.
- On `message:receive` for a group, decrypt with the pairwise session (same code
  path as direct), keyed by `sender.id`.

### Server — `sockets/messageHandler.js` (`message:group`)
- Accept `recipients: [{ memberId, encryptedContent }]`.
- Validate the sender is a member; validate each entry.
- Deliver to each member their own `encryptedContent` (look up by memberId).
- Storage: persist per-recipient rows, OR persist the sender's-eyes copy plus the
  map. Simplest: store one row per recipient (sender included for history).

### Edit/delete
- Mirror the same per-recipient encryption for `message:edit` group payloads.

## Migration / compatibility

- Bump a small protocol marker so old clients don't misread the new shape.
- Until shipped, the UI should label group chats as **not yet E2E** to avoid
  over-claiming (see SECURITY.md).

## Out of scope (future)

- True Sender Keys (O(1) fan-out with a ratcheted group key).
- Key rotation on membership change (re-key when a member leaves).
