# 🐾 Inkpaw — a private, end‑to‑end encrypted journal with a pet

Intern ID: CITS8559
Inkpaw is a full‑stack MERN journaling platform: a rich‑text + Markdown diary that's encrypted in your browser before it ever touches the server, syncs across devices, works offline, has six diary themes, an anonymous community for venting, and **Mochi** — a little virtual pet who greets you, chats with you, and gets happier when you write.

## Features

| Area | What you get |
|---|---|
| **Zero‑knowledge privacy** | Password never leaves the browser. AES‑256‑GCM encryption of every entry, title, tag, category, mood and attachment (including file names). Server stores only ciphertext. |
| **Authentication** | PBKDF2‑derived auth proof → bcrypt on server, httpOnly SameSite=strict JWT cookie, CSRF header, rate limiting, account lockout, timing‑safe login, anti‑enumeration decoy salts, auto‑lock after 15 min idle, password change without re‑encryption, account deletion. |
| **Rich editor** | Tiptap: H1–H3, bold/italic/underline/strike/highlight, quotes, bullet & numbered lists, **checklists**, code blocks, links, dividers, undo/redo, word count. Markdown shortcuts while typing, Markdown paste, and a raw **Markdown mode**. |
| **Organization** | Categories (custom ones too), tags, 8 moods (auto‑suggested from text), favorites, entries grouped by month, full‑text search (runs locally on decrypted data), entry templates (daily reflection, gratitude, dream log, plan, private vent). |
| **Media** | Photos, audio, video, PDFs — encrypted client‑side, stored in MongoDB GridFS, 10 MB each, 500 MB quota. Drag & drop. |
| **Cloud sync** | Offline‑first: IndexedDB cache holds only ciphertext. Delta sync with tombstones, optimistic concurrency (`version`), and conflict copies so no words are ever lost. |
| **Themes** | Parchment, Sakura, Forest, Ocean, Lavender, Midnight (dark) + 4 writing fonts (book, handwritten, clean, typewriter). Ruled‑paper editor. |
| **Anonymous community** | "The Quiet Room": a fresh random alias per post, unlinkable HMAC author keys, PII scrubbing (emails/phones/links/handles), mood filters, supportive reactions (🫂 💛 🤝 💪), threaded replies, reports auto‑hide at 3, slur filter, crisis detection that surfaces helplines. |
| **Virtual pet** | Original SVG character (cat / bunny / bear), 9 expressions, blinking, bobbing, breathing exercise mode. Time‑aware greetings, streak celebration, "missed you" after absences. Hunger meter fed by writing, XP & levels, private on‑device chat with intents, writing prompts and mood‑aware replies. |

## Quick start

Requirements: **Node 18+** and **MongoDB 6+** (local or Atlas).

```bash
# 1. MongoDB (skip if you already have one)
docker compose up -d mongo

# 2. API
cd server
cp .env.example .env          # then fill in the three secrets
npm install
npm run dev                   # http://localhost:5000

# 3. Web app (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Production:** `cd client && npm run build`, then run the server with `NODE_ENV=production` — Express serves `client/dist` on the same origin with a strict Content‑Security‑Policy. Serve over HTTPS (WebCrypto requires a secure context; `localhost` counts).

## How the zero‑trust model works

```
            ┌──────────── browser ─────────────┐                ┌──── server ────┐
password ──▶ PBKDF2(salt|"auth", 310k) ─▶ authKey ─────────────▶ bcrypt(authKey)
         └─▶ PBKDF2(salt|"enc",  310k) ─▶ KEK  (never sent)
                                         │
             random AES‑256 DEK ◀─unwrap─┴──────── wrappedKey ◀── stored
                │
                ├─▶ encrypt entry JSON ───────────────────────▶ ciphertext + iv
                └─▶ encrypt file bytes + {name,type} ─────────▶ GridFS blob + encMeta
```

- **The server can't read your journal.** A full database leak exposes ciphertext and bcrypt hashes of a derived key.
- **Every request is authenticated** (no trust by network location); state‑changing requests also need the `X-Requested-With: inkpaw` header.
- **Reloading or idling locks the journal**: the session cookie survives, but the DEK only lives in memory, so you re‑enter your password to decrypt.
- **Password change** re‑wraps the same DEK, so entries don't need re‑encryption.
- **Trade‑off:** forget your password and the data is unrecoverable (the sign‑up form makes users acknowledge this). A recovery‑key flow — wrapping the DEK a second time with a printable random key — is the natural next addition.
- **Community posts are public by design** and therefore plaintext, but anonymous: `authorKey = HMAC(ANON_SECRET, userId)` is never returned to clients.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/salt?email=` | KDF salt (decoy for unknown emails) |
| POST | `/api/auth/register` | `{ email, displayName, authKey, salt, iterations, wrappedKey, wrapIv }` |
| POST | `/api/auth/login` | `{ email, authKey }` → session cookie + wrapped key |
| GET | `/api/auth/me` | Restore session (journal stays locked) |
| POST | `/api/auth/logout` · `/change-password` | |
| DELETE | `/api/auth/account` | `{ authKey }` — erases entries & files |
| GET | `/api/entries/sync?since=` | Delta incl. tombstones, returns `serverTime` |
| PUT | `/api/entries/:clientId` | `{ ciphertext, iv, baseVersion }` → 409 on conflict |
| DELETE | `/api/entries/:clientId` | Tombstone |
| POST/GET/DELETE | `/api/attachments[/:id]` | Encrypted blob upload/download |
| GET/POST | `/api/community` | Feed (`?mood=&mine=&before=`) / new post |
| POST | `/api/community/:id/react` · `/report` · `/comments` | |
| PATCH | `/api/settings` | Theme, font, pet name/species, display name |

## Project structure

```
server/src
  index.js                 Express app, helmet/CSP, CORS, rate limits
  config/db.js             Mongo + GridFS bucket
  middleware/              auth (JWT cookie, CSRF), validation & errors
  models/                  User, Entry, Attachment, Community (Post, Comment)
  routes/                  auth, entries (sync), attachments, community, settings
  utils/                   anon (aliases, HMAC keys), moderation (PII, crisis)
client/src
  lib/crypto.js            WebCrypto key derivation & AES‑GCM
  lib/store.js             Offline‑first encrypted sync engine
  lib/attachments.js       Encrypted upload/download
  context/                 Auth (keys, lock, sync) and Pet state
  components/              Editor (Tiptap + Markdown), Attachments, TagInput
  pages/                   Journal, Community, Settings, Auth pages
  pet/                     PetAvatar (SVG), Pet widget, brain (chat & moods)
  styles/                  themes.css (6 themes), app.css
```

## Ideas for next steps
- Recovery key at sign‑up; WebAuthn / passkey unlock
- Argon2id via WASM instead of PBKDF2
- Calendar and mood‑over‑time charts (computed locally)
- Optional LLM pet replies via a server proxy that only receives what the user types to the pet
- PWA install + service worker for full offline launch
