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
| **OpenWA**         | Action  | Send messages, check contacts, manage sessions and webhooks |
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

> **API key role:** send-message and webhook operations require an **OPERATOR**-role key (the default). A read-only **VIEWER** key passes the credential test but returns `403` when sending or managing webhooks. VIEWER-safe operations: Session → Get Status / List All, and Contact → Check Exists / Get Info.

---

## 🧩 Nodes

### OpenWA (action)

| Resource    | Operation     | Description                              |
| ----------- | ------------- | ---------------------------------------- |
| **Session** | Get Status    | Get the status of a session              |
| **Session** | List All      | List all sessions                        |
| **Message** | Send Text     | Send a text message                      |
| **Message** | Send Image    | Send an image (binary, URL, or Base64)   |
| **Message** | Send Document | Send a document / file                   |
| **Message** | Send Audio    | Send an audio file or a voice note (PTT) |
| **Message** | Send Location | Send a location pin                      |
| **Contact** | Check Exists  | Check whether a number is on WhatsApp    |
| **Contact** | Get Info      | Get contact information                  |
| **Webhook** | Create        | Register a webhook (optional signing secret) |
| **Webhook** | Delete        | Remove a webhook                         |

> **Base64 media:** when sending an image, document, or audio clip from a **Base64** source, also set the **MIME Type** field (e.g. `image/png`, `application/pdf`, `audio/ogg; codecs=opus`) — OpenWA requires a MIME type for base64 payloads. The **Binary** source fills it in automatically from the binary metadata, and the **URL** source needs nothing extra.

> **Mentions** (server **≥ 0.7.14**): Send Text, Send Image, and Send Document accept an optional **Mentions** list of WhatsApp IDs (e.g. `628123456789@c.us`). For each one to render as an @mention, the message text or caption must also contain the matching `@628123456789` token. Leave the list empty on older servers.

> **Voice notes** (server **≥ 0.7.17**): Send Audio has a **Send as Voice Note** toggle. When on, the clip is delivered as a true WhatsApp voice note (the microphone bubble with a waveform) instead of a plain audio file. Voice notes require `audio/ogg; codecs=opus` audio for reliable playback. Leave the toggle off (plain audio file) on older servers.

**Example — send a text message**

1. Add an **OpenWA** node
2. Select the **Message** resource and **Send Text** operation
3. Configure **Session ID** (`default`), **Chat ID** (`628123456789@c.us`), and **Message**

### OpenWA Trigger

Starts a workflow when the selected events arrive on your session.

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

> Changing or clearing the secret takes effect on the next activation — deactivate and reactivate the workflow to re-register it.

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

---

## 📡 Example Workflows

| Pattern         | Flow                                                              |
| --------------- | ----------------------------------------------------------------- |
| Auto-reply      | `[OpenWA Trigger]` → `[IF: keyword]` → `[OpenWA: Send Text]`       |
| Session monitor | `[OpenWA Trigger: session.disconnected]` → `[Slack: Alert]`        |
| Lead capture    | `[OpenWA Trigger]` → `[Google Sheets: Append]` → `[OpenWA: Send Text]` |

---

## 🔗 Compatibility

Requires an OpenWA server **≥ 0.4.0** — the webhook event contract and HMAC signature verification the Trigger relies on landed in v0.4.0. Verified against OpenWA **v0.8.1**.

> The **Message Reaction** event requires server **≥ 0.7.2**. Selecting it against an older
> server returns a 400 when the webhook is created.

---

## 🛠 Development

```bash
npm install      # install dependencies
npm run build    # compile TypeScript + copy icons
npm run dev      # watch mode
npm run lint     # ESLint
npm test         # build + signature-verification unit tests
```

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
