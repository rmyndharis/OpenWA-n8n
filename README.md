<p align="center">
  <img src="https://raw.githubusercontent.com/rmyndharis/OpenWA/main/docs/logo/openwa_logo.webp" alt="OpenWA Logo" width="180"/>
</p>

<h1 align="center">n8n-nodes-openwa</h1>

<p align="center">
  <strong>n8n community nodes for the <a href="https://github.com/rmyndharis/OpenWA">OpenWA</a> WhatsApp API Gateway</strong>
</p>

<p align="center">
  <a href="#-installation">Installation</a> •
  <a href="#-credentials">Credentials</a> •
  <a href="#-nodes">Nodes</a> •
  <a href="#-example-workflows">Examples</a> •
  <a href="#-compatibility">Compatibility</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa"><img src="https://img.shields.io/npm/v/@rmyndharis/n8n-nodes-openwa.svg?color=blue" alt="npm version"/></a>
  <a href="https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa"><img src="https://img.shields.io/npm/dm/@rmyndharis/n8n-nodes-openwa.svg" alt="npm downloads"/></a>
  <a href="https://github.com/rmyndharis/OpenWA-n8n/actions/workflows/ci.yml"><img src="https://github.com/rmyndharis/OpenWA-n8n/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"/></a>
  <img src="https://img.shields.io/badge/n8n-community_node-EA4B71.svg" alt="n8n community node"/>
  <img src="https://img.shields.io/badge/OpenWA-%E2%89%A5%200.4.0-25D366.svg" alt="OpenWA >= 0.4.0"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"/>
</p>

---

## ✨ Overview

Two n8n nodes that connect your workflows to a self-hosted [OpenWA](https://github.com/rmyndharis/OpenWA) WhatsApp API Gateway — send and receive WhatsApp messages, manage contacts, and react to events in real time.

| Node               | Type    | Purpose                                                    |
| ------------------ | ------- | ---------------------------------------------------------- |
| **OpenWA**         | Action  | Send messages and manage sessions, chats, contacts, groups, status, and more |
| **OpenWA Trigger** | Trigger | Start workflows on incoming messages and session events |

---

## 📦 Installation

### Community Nodes (recommended)

1. In n8n, open **Settings → Community Nodes**
2. Select **Install**
3. Enter `@rmyndharis/n8n-nodes-openwa` and accept the risk prompt
4. Restart n8n

### Manual

```bash
cd ~/.n8n/nodes
npm install @rmyndharis/n8n-nodes-openwa
```

---

## 🔑 Credentials

Create an **OpenWA API** credential:

| Field          | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Server URL** | OpenWA server URL, without a trailing slash or `/api`. Defaults to `http://localhost:2785` for a local server (e.g. `https://wa.example.com` behind a reverse proxy). Use HTTPS in production. |
| **API Key**    | API key from your OpenWA dashboard. Sent as the `X-API-Key` header.                                  |

The credential is validated with an authenticated `GET /api/sessions` request, so an invalid API key fails the test.

> **API key role:** send-message and webhook operations require an **OPERATOR**-role key (the default). A read-only **VIEWER** key passes the credential test but returns `403` when sending or managing webhooks. VIEWER-safe operations: Session → Get Status / List All, and Contact → Check Exists / Get Info. An **ADMIN** key (the first-boot default) also works for every operation.

> **Per-key scoping:** the server enforces each key's `allowedIps` and `allowedSessions`. An IP-whitelisted key must allow the n8n host's IP, and a session-restricted key returns `401` for operations on sessions outside its allow-list. Configure these on the server, not in the node.

---

## 🧩 Nodes

### OpenWA (action)

| Resource    | Operation           | Description                                   |
| ----------- | ------------------- | --------------------------------------------- |
| **Session** | Create              | Create a new session (returns its UUID)       |
| **Session** | Start               | Start a session and connect to WhatsApp       |
| **Session** | Stop                | Stop a session and disconnect                 |
| **Session** | Force Kill          | Force-kill a stuck session's engine           |
| **Session** | Delete              | Delete a session                              |
| **Session** | Get QR              | Get the QR code for scanning authentication   |
| **Session** | Request Pairing Code| Get an 8-char phone linking code              |
| **Session** | Get Status          | Get the status of a session                   |
| **Session** | List All            | List all sessions (paginated)                 |
| **Session** | Get Stats Overview  | Overview statistics across all sessions       |
| **Message** | Send Text           | Send a text message                           |
| **Message** | Send Image          | Send an image (binary, URL, or Base64)        |
| **Message** | Send Video          | Send a video (binary, URL, or Base64)         |
| **Message** | Send Document       | Send a document / file                        |
| **Message** | Send Audio          | Send an audio file or a voice note (PTT)      |
| **Message** | Send Sticker        | Send a sticker (WebP)                         |
| **Message** | Send Location       | Send a location pin                           |
| **Message** | Send Contact        | Send a contact card (vCard)                   |
| **Message** | Reply               | Reply to a message, quoting it                |
| **Message** | React               | Add or remove an emoji reaction               |
| **Message** | Delete              | Delete / revoke a message                     |
| **Message** | Send Poll           | Send a poll with 2–12 options                 |
| **Message** | Send Template       | Render and send a stored template             |
| **Message** | Edit                | Edit the body of a sent message               |
| **Message** | Forward             | Forward a message to another chat             |
| **Message** | List                | List stored messages (filterable)             |
| **Message** | Get History         | Get the message history of a chat             |
| **Message** | Get Reactions       | Get the reactions on a message                |
| **Message** | Send Bulk           | Send up to 100 messages as a throttled batch  |
| **Message** | Get Batch Status    | Poll a bulk batch's progress                  |
| **Message** | Cancel Batch        | Cancel a running bulk batch                   |
| **Contact** | Check Exists        | Check whether a number is on WhatsApp         |
| **Contact** | Get Info            | Get contact information                       |
| **Contact** | Get Profile Picture | Get a contact's profile-photo URL             |
| **Contact** | Get Phone           | Resolve a contact's phone number              |
| **Contact** | Get Profile Pictures| Get pictures for up to 50 contacts at once    |
| **Contact** | List                | List all contacts (paginated)                 |
| **Contact** | Block               | Block a contact                               |
| **Contact** | Unblock             | Unblock a contact                             |
| **Chat**    | List                | List a session's chats (paginated)            |
| **Chat**    | Mark Read           | Mark a chat as read                           |
| **Chat**    | Mark Unread         | Mark a chat as unread                         |
| **Chat**    | Delete              | Delete a chat                                 |
| **Chat**    | Set State           | Send a typing / recording indicator           |
| **Group**   | List                | List a session's groups (paginated)           |
| **Group**   | Get                 | Get group info including participants         |
| **Group**   | Create              | Create a group with initial participants      |
| **Group**   | Join                | Join a group via an invite code or link       |
| **Group**   | Leave               | Leave a group                                 |
| **Group**   | Add Participants    | Add participants to a group                   |
| **Group**   | Remove Participants | Remove participants from a group              |
| **Group**   | Promote Participants| Promote participants to group admin           |
| **Group**   | Demote Participants | Demote participants from group admin          |
| **Group**   | Update Subject      | Change the group name / subject               |
| **Group**   | Update Description  | Change the description (empty clears it)      |
| **Group**   | Get Settings        | Read announce / locked / disappearing timer   |
| **Group**   | Update Settings     | Update group settings (partial)               |
| **Group**   | Get Invite Code     | Get the invite code and link                  |
| **Group**   | Revoke Invite Code  | Revoke the code and generate a new one        |
| **Profile** | Set Name            | Set the session's own display name (≤ 25)     |
| **Profile** | Set Status          | Set the about text (≤ 139, empty clears)      |
| **Profile** | Set Picture         | Set the profile picture                       |
| **Label**   | List                | List all labels (WhatsApp Business)           |
| **Label**   | Get                 | Get one label                                 |
| **Label**   | Get for Chat        | Get the labels attached to a chat             |
| **Label**   | Add to Chat         | Attach a label to a chat                      |
| **Label**   | Remove From Chat    | Detach a label from a chat                    |
| **Status**  | List                | List the status feed                          |
| **Status**  | Get by Contact      | Get a contact's status updates                |
| **Status**  | Get Media           | Get the media of a status update              |
| **Status**  | Delete              | Delete one of your status updates             |
| **Status**  | Send Text           | Post a text status (color + font)             |
| **Status**  | Send Image          | Post an image status                          |
| **Status**  | Send Video          | Post a video status                           |
| **Template**| List / Get          | Read stored message templates                 |
| **Template**| Create              | Create a template with {{variables}}          |
| **Template**| Update              | Update a template (partial)                   |
| **Template**| Delete              | Delete a template                             |
| **Channel** | List / Get          | Read followed channels                        |
| **Channel** | Get Messages        | Get a channel's messages                      |
| **Channel** | Subscribe           | Follow a channel by invite code or link       |
| **Channel** | Unsubscribe         | Unfollow a channel                            |
| **Call**    | Reject              | Reject an incoming call                       |
| **Observability** | Check         | Server health (`{ status, timestamp, version }`) |
| **Observability** | Check Liveness | Liveness probe                              |
| **Observability** | Check Readiness | Readiness probe, incl. database connections |
| **System**  | Get Stats           | Overview, message, and per-session statistics |
| **System**  | Search              | Search messages across sessions               |
| **System**  | Get Audit Log       | Read the audit log (filterable)               |
| **System**  | Get Settings        | Read the server settings (read-only)          |
| **API Key** | List / Get          | Read API keys (admin credential required)     |
| **API Key** | Create              | Create a key — plaintext is returned once     |
| **API Key** | Update / Revoke / Delete | Manage an existing key                   |
| **API Key** | Validate            | Validate the credential currently in use      |
| **Webhook** | Create              | Register a webhook (optional signing secret)  |
| **Webhook** | Update              | Update a webhook (partial — only changed fields) |
| **Webhook** | Test                | Send a test delivery to a webhook             |
| **Webhook** | List / Get          | Read a session's webhooks                     |
| **Webhook** | List All            | Read webhooks across all sessions             |
| **Webhook** | Get Delivery Failures | Inspect failed webhook deliveries           |
| **Webhook** | Delete              | Remove a webhook                              |

> **Roles:** most reads work with a plain API key, while writes generally need an **OPERATOR** key and the whole **API Key** resource needs an **ADMIN** one — a `403` almost always means the credential's role is too low, not that the request was malformed.

> **Observability:** **Check** / **Check Liveness** / **Check Readiness** return the server's health JSON as-is, so a workflow can alert on availability. **Check Readiness** is the one that also probes the database connections. `/api/metrics` is deliberately not offered — it authenticates with its own bearer token rather than the API key this credential carries, so it could only ever answer `401` or `404` from here.

> **Not offered, because the server cannot serve them:** catalog reads, Send Catalog and Send Product are documented as "not supported by any engine" (`501`), and settings are environment-derived and read-only at runtime. **Search** needs a search provider configured server-side, otherwise it too answers `501`.

> **Dropdowns:** ID fields with a listing endpoint behind them offer a dropdown — in both nodes, including the Trigger's **Session Name or ID** — and fetch a single page of up to 1000 entries. On an account with more than that, set the field from an expression instead of picking from the list.

> **Status posts:** WhatsApp Status is never posted to a group, so **Recipients** takes `@c.us`/`@lid` JIDs (max 256). The Baileys engine *requires* an explicit recipient list; on whatsapp-web.js an empty list posts to all contacts.

> **Group operations:** reads (List, Get, Get Settings, Get Invite Code) work with a plain API key, but every write — create, join, leave, participant changes, subject/description/settings, and invite-code revoke — needs a key with the **OPERATOR** role, otherwise the server answers `403`. Add/Remove/Promote/Demote report a per-participant outcome in `results[]` and a partial refusal does *not* fail the batch, so check `results[].success` rather than the top-level `success`. **Update Settings** is partial — fields you leave out stay untouched — and `ephemeralSeconds` is Baileys-only (whatsapp-web.js returns `501`).

> **Base64 media:** when sending an image, document, or audio clip from a **Base64** source, also set the **MIME Type** field (e.g. `image/png`, `application/pdf`, `audio/ogg; codecs=opus`) — OpenWA requires a MIME type for base64 payloads. The **Binary** source fills it in automatically from the binary metadata, and the **URL** source needs nothing extra.

> **Mentions** (server **≥ 0.7.14**): Send Text, Send Image, Send Video, and Send Document accept an optional **Mentions** list of WhatsApp IDs (e.g. `628123456789@c.us`). For each one to render as an @mention, the message text or caption must also contain the matching `@628123456789` token. Leave the list empty on older servers.

> **Message actions:** Reply, React, and Delete act on an existing message identified by its full serialized ID (e.g. `true_628123456789@c.us_3EB0…`) — the value returned by the send operations and delivered by the Trigger. React with an empty **Emoji** to remove your reaction; Delete defaults to revoking for everyone.

> **Bulk send:** provide **Messages (JSON)** as an array of up to 100 items. The media object nests under the `type` key, and `caption` sits alongside it on `content`:
>
> ```json
> [
>   { "chatId": "628123456789@c.us", "type": "text", "content": { "text": "Hello" } },
>   { "chatId": "628123456789@c.us", "type": "image", "content": { "image": { "url": "https://example.com/a.jpg" }, "caption": "Hi" } }
> ]
> ```
>
> Media (`image`/`video`/`audio`/`document`) uses `url` or `base64` (add `mimetype` for base64) — there is no binary source in bulk. Send Bulk returns a `batchId` immediately and sends in the background; poll **Get Batch Status** until the status is `completed`, `cancelled`, or `failed`, or stop it early with **Cancel Batch**.

> **Voice notes** (server **≥ 0.7.17**): Send Audio has a **Send as Voice Note** toggle. When on, the clip is delivered as a true WhatsApp voice note (the microphone bubble with a waveform) instead of a plain audio file. Voice notes require `audio/ogg; codecs=opus` audio for reliable playback. Leave the toggle off (plain audio file) on older servers.

**Example — send a text message**

1. Add an **OpenWA** node
2. Select the **Message** resource and **Send Text** operation
3. Configure **Session ID** (`default`), **Chat ID** (`628123456789@c.us`), and **Message**

> **Provisioning a session:** sessions are identified by a **UUID** (returned by **Create**, **Get Status**, or **List All**). A full end-to-end flow is **Create → Start → Get QR** (scan) or **Request Pairing Code** (enter on the phone) → wait for `session.authenticated`. The Trigger can listen for `session.qr` and `session.authenticated` events; these session operations are what drive those state transitions.

### OpenWA Trigger

Starts a workflow when the selected events arrive on your session.

The Trigger listens on a session-scoped webhook URL (`…/webhook/openwa-<sessionId>`), so several active workflows can each run a Trigger on the same n8n instance without colliding on one shared path. When you change the session, events, or secret — or when the URL shape changes across a package upgrade — the server-side webhook is re-registered automatically on the next activation.

| Event                   | Description                           |
| ----------------------- | ------------------------------------- |
| `message.received`      | New incoming message                  |
| `message.sent`          | Message successfully sent             |
| `message.ack`           | Message delivery / read acknowledgement |
| `message.failed`        | Message failed to send                |
| `message.revoked`       | Message deleted for everyone          |
| `message.reaction`      | Reaction added to or removed from a message (server **≥ 0.7.2**) |
| `session.status`        | Session status changed                |
| `session.qr`            | QR code generated for scanning        |
| `session.authenticated` | Session authenticated                 |
| `session.disconnected`  | Session lost connection               |
| `group.join`            | Participant joined a group — _reserved: accepted on subscribe but not yet emitted by OpenWA_ |
| `group.leave`           | Participant left a group — _reserved: not yet emitted_ |
| `group.update`          | Group metadata changed — _reserved: not yet emitted_ |

#### 🔐 Signature verification

The Trigger has an optional **Webhook Secret**. When set, the secret is registered with OpenWA at webhook creation, and OpenWA signs every delivery with HMAC-SHA256 in the `X-OpenWA-Signature: sha256=<hex>` header. The node verifies each delivery against the raw request body and rejects (HTTP 401) any that fail. Leave it empty to skip verification.

> Changing or clearing the secret — or changing the events or session — re-registers the webhook automatically on the next activation (deactivate/reactivate, or an n8n restart). No manual cleanup on the server is needed.

> Signature verification requires the raw request body, which all current n8n versions provide. On a severely outdated n8n that cannot supply it, signed deliveries are rejected with a logged warning — upgrade n8n or leave the secret empty.

#### Trigger output

```json
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "default",
  "idempotencyKey": "a1b2c3d4-...",
  "deliveryId": "e5f6a7b8-...",
  "data": {
    "id": "3EB0F5A2B4C...",
    "chatId": "628123456789@c.us",
    "from": "628123456789@c.us",
    "body": "Hello!",
    "type": "text",
    "timestamp": 1705312200
  }
}
```

> **Payload notes**
>
> - Each delivery is an envelope (`event`, `timestamp`, `sessionId`, `idempotencyKey`, `deliveryId`, …); the actual event payload is under `data`. Read message fields from `data` (e.g. `data.body`, `data.chatId`).
> - Read the message identifier from `data.id` (incoming payloads use `id`, not `messageId`).
> - OpenWA retries failed deliveries with the same `deliveryId` — de-duplicate on it if your downstream actions aren't idempotent.
> - Message `type` is engine-neutral: voice notes are `voice`, shared contacts are `contact`, and plain chats are `text`.
> - **Check Exists** returns `whatsappId`, the engine-canonical chat id, which may differ from the number you sent (for example an `@lid` id).

#### ♻️ Duplicate deliveries

OpenWA retries failed deliveries with the same `deliveryId`, so a delivery whose acknowledgement was lost (n8n restart, a slow network) can arrive twice and would otherwise run the workflow twice. Enable **Deduplicate Deliveries** on the Trigger to drop repeats; the node remembers the 500 most recent delivery IDs (kept in workflow static data). Trade-offs: a retry whose first execution *failed* is also dropped, and two deliveries arriving at the exact same moment can both pass — enable it when downstream actions are not idempotent and failed runs are rare.

---

## 📡 Example Workflows

| Pattern         | Flow                                                              |
| --------------- | ----------------------------------------------------------------- |
| Auto-reply      | `[OpenWA Trigger]` → `[IF: keyword]` → `[OpenWA: Send Text]`       |
| Session monitor | `[OpenWA Trigger: session.disconnected]` → `[Slack: Alert]`        |
| Lead capture    | `[OpenWA Trigger]` → `[Google Sheets: Append]` → `[OpenWA: Send Text]` |

---

## 🔗 Compatibility

Requires an OpenWA server **≥ 0.4.0** — the webhook event contract and HMAC signature verification the Trigger relies on landed in v0.4.0. Verified against OpenWA **v0.8.13**.

> The **Message Reaction** event requires server **≥ 0.7.2**. Selecting it against an older
> server returns a 400 when the webhook is created.

---

## 🛠 Development

```bash
npm install      # install dependencies
npm run build    # compile TypeScript + copy icons
npm run dev      # watch mode
npm run lint     # ESLint (flat config, shared with n8n-node lint)
npm test         # build + signature-verification unit tests
```

Linting uses the flat config in `eslint.config.mjs`, which re-exports the shared
config from `@n8n/node-cli`, so `npm run lint` and `n8n-node lint` apply the same
rules. `package.json` sets `n8n.strict`, which makes `n8n-node lint` additionally
verify that config is unmodified — adding project-specific rules there requires
setting `"strict": false`.

CI runs one further gate on top: the n8n Creator Portal scanner (see
`scripts/n8n-scan.mjs`), which pins the portal's own, newer rule versions.

---

## 📚 Links

- [OpenWA Server](https://github.com/rmyndharis/OpenWA) — the WhatsApp API Gateway
- [OpenWA Documentation](https://github.com/rmyndharis/OpenWA/tree/main/docs)
- [OpenWA API Reference](https://github.com/rmyndharis/OpenWA/blob/main/docs/06-api-specification.md)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)

---

## 📄 License

[MIT](./LICENSE) — free for personal and commercial use.

---

<div align="center">

[📦 npm](https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa) · [🐛 Report Bug](https://github.com/rmyndharis/OpenWA-n8n/issues) · [💡 Request Feature](https://github.com/rmyndharis/OpenWA-n8n/issues)

<br/>

<sub>Built for the <a href="https://github.com/rmyndharis/OpenWA">OpenWA</a> community.</sub>

</div>
