# TipTap WhatsApp Bot — Cloud API (v2.0)

WhatsApp bot ya TIPTAP — sasa inatumia **Meta Cloud API rasmi** badala ya Baileys.

> **Migration note:** `v1.x` ilikuwa Baileys (WhatsApp Web). `v2.0` imehama kabisa kwenye Graph API ya Meta. Faili za `auth_info_baileys/` na QR scan hazitumiki tena.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — nakili `.env.example` kwenda `.env` na ujaze:
   ```env
   API_BASE_URL=https://your-domain.com/api/bot
   BOT_TOKEN=sanctum-token-kutoka-admin-bots-page

   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   WHATSAPP_ACCESS_TOKEN=EAA...
   WHATSAPP_VERIFY_TOKEN=chagua-string-yoyote
   WHATSAPP_APP_SECRET=app-secret-kutoka-meta
   WHATSAPP_GRAPH_VERSION=v20.0

   PORT=3000
   NOTIFY_SECRET=ilingane-na-Laravel
   ```

3. **Configure Meta Business Manager** → WhatsApp → API Setup:
   - Callback URL: `https://<your-domain>/webhook`
   - Verify Token: ile uliyoweka kwenye `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to: `messages`

4. **Start the bot**
   ```bash
   npm start
   ```

5. **Hakuna QR scan** — Meta inatuma webhook moja kwa moja.

## Architecture

```
Customer (WhatsApp)
        │
        ▼
Meta Cloud API ─── webhook ──▶ TipTap bot (Node)
        ▲                          │
        │                          ├── Graph API (sendText / sendImage)
        │                          │
        └── messages ──────────────┘
                                   │
                                   ▼
                            Laravel API (/api/bot/*)
                                   │
                                   ▼
                            MySQL (orders, payments, bot_sessions)
```

## Project Structure

```
tiptopbot/
├── src/
│   ├── index.js            # Express server (replaces Baileys connection)
│   ├── webhook-server.js   # /webhook + /inbound — Meta webhook routes
│   ├── handler.js          # State machine (UNCHANGED business logic)
│   ├── whatsapp.js         # Cloud API client (replaces sock.sendMessage)
│   ├── session-store.js    # Persistent sessions via Laravel API
│   ├── notify-server.js    # /notify — Laravel pushes bill image events
│   ├── api.js              # Laravel /api/bot/* HTTP client
│   └── lang.js             # EN/SW translations
├── .env                    # Secrets (gitignored)
├── package.json            # axios + express + dotenv (NO baileys)
└── Dockerfile
```

## Inbound message flow

1. Customer scans QR / chats with the bot's business number
2. Meta → `POST https://<bot>/webhook` with payload `{ entry[].changes[].value.messages[] }`
3. `webhook-server.js` verifies `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET`
4. Each message handed to `handler.handleMessage(message, contact)`
5. Handler hydrates session from Laravel (`GET /api/bot/session?wa_id=...`)
6. State machine runs (same logic as v1)
7. Outbound reply via `whatsapp.sendMessage(to, payload)` → `POST graph.facebook.com/v20.0/{phone_id}/messages`
8. Session persisted back (`PUT /api/bot/session`)

## Outbound supported shapes

The handler still uses the Baileys-style call signature `sock.sendMessage(jid, payload)`:

| Payload | Cloud API translation |
|---------|----------------------|
| `{ text: '…' }` | `type: text` |
| `{ image: { url }, caption }` | `type: image` with `image.link` |

Interactive list/button payloads in `handler.js` are rendered as numbered text fallbacks (`1️⃣ Menu`, `2️⃣ Bill` …) for the widest device compatibility; upgrade them to native interactive messages later if needed.

## Required API endpoints (Laravel)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/bot/session` | GET | Load session by `wa_id` |
| `/api/bot/session` | PUT | Upsert session |
| `/api/bot/session` | DELETE | Clear session |
| `/api/bot/parse-entry` | POST | Identify QR / tag |
| `/api/bot/restaurant/{id}/full-menu` | GET | Menu |
| `/api/bot/order` | POST | Create order |
| `/api/bot/payment/ussd` | POST | Selcom USSD push |
| `/api/bot/feedback` | POST | Submit rating |
| `/api/bot/tip` | POST | Submit tip |
| `/api/bot/call-waiter` | POST | Service request |

(Full list in `docs/SYSTEM_OVERVIEW.md` of the Laravel app.)

## Session storage

Sessions are **persisted in MySQL** (`bot_sessions` table). Survives bot restarts, can be inspected via SQL, and supports horizontal scaling.

| Column | Description |
|--------|-------------|
| `wa_id` | Customer phone (digits, no `@s.whatsapp.net`) |
| `state` | Current screen (e.g. `HOME`, `PAYMENT_SUMMARY`) |
| `lang` | `en` (default) or `sw` |
| `data` | JSON: cart, restaurant_id, table_id, …  |
| `last_message_at` | Last interaction timestamp |

In-memory cache layer reduces DB chatter inside a single conversation tick.

## Authentication

- **Bot → Laravel**: Sanctum Bearer token (`BOT_TOKEN`) — same token v1 used.
- **Meta → Bot**: HMAC-SHA256 signature verified with `WHATSAPP_APP_SECRET`.
- **Laravel → Bot** (bill image push): shared secret in `X-Bot-Secret` header.

## Health check

```bash
curl http://localhost:3000/health
# → { "ok": true, "service": "tiptopbot", "version": "2.0.0", "time": "…" }
```

## Production notes

1. **HTTPS required.** Meta refuses non-HTTPS callback URLs. Front the bot with Nginx + Let's Encrypt, or use Cloudflare Tunnel.
2. **24-hour session window.** You can only message users freely within 24h of their last inbound message. Outside that, you must use approved templates (not yet wired — TODO).
3. **Rate limits.** Cloud API: ~80 messages/sec per phone number (free tier). Watch `429` responses.
4. **Webhook fan-out.** If you need multiple consumers (e.g. analytics) for the same payload, route Meta webhook through Laravel (`/api/whatsapp/webhook`) and let Laravel forward to the bot.

## Differences from v1 (Baileys)

| Concern | v1 (Baileys) | v2 (Cloud API) |
|---------|--------------|-----------------|
| Auth | QR scan, `auth_info_baileys/` | Access token + webhook |
| Stability | Unofficial, may break | Official, supported |
| Sessions | In-memory only | MySQL (durable) |
| Restart impact | Customers lose carts | No impact |
| Templates | Not needed | Required for >24h reach |
| Cost | Free | Free up to ~1k convos/mo, then per-conversation |
| Group chats | Supported | Not supported (yet) |
