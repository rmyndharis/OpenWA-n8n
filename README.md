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
  <img src="https://img.shields.io/badge/OpenWA-%E2%89%A5%200.2.8-25D366.svg" alt="OpenWA >= 0.2.8"/>
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"/>
</p>

---

## ✨ Overview

Two n8n nodes that connect your workflows to a self-hosted [OpenWA](https://github.com/rmyndharis/OpenWA) WhatsApp API Gateway — send and receive WhatsApp messages, manage contacts, and react to events in real time.

| Node               | Type    | Purpose                                                    |
| ------------------ | ------- | ---------------------------------------------------------- |
| **OpenWA**         | Action  | Send messages, check contacts, manage sessions and webhooks |
| **OpenWA Trigger** | Trigger | Start workflows on incoming messages, session and group events |

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
| **Server URL** | OpenWA server URL, without a trailing slash or `/api` (e.g. `https://wa.example.com`). Use HTTPS in production. |
| **API Key**    | API key from your OpenWA dashboard. Sent as the `X-API-Key` header.                                  |

The credential is validated against `GET /api/health`.

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
| **Message** | Send Location | Send a location pin                      |
| **Contact** | Check Exists  | Check whether a number is on WhatsApp    |
| **Contact** | Get Info      | Get contact information                  |
| **Webhook** | Create        | Register a webhook (optional signing secret) |
| **Webhook** | Delete        | Remove a webhook                         |

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
| `session.status`        | Session status changed                |
| `session.qr`            | QR code generated for scanning        |
| `session.authenticated` | Session authenticated                 |
| `session.disconnected`  | Session lost connection               |
| `group.join`            | Participant joined a group            |
| `group.leave`           | Participant left a group              |
| `group.update`          | Group metadata changed                |

#### 🔐 Signature verification

The Trigger has an optional **Webhook Secret**. When set, the secret is registered with OpenWA at webhook creation, and OpenWA signs every delivery with HMAC-SHA256 in the `X-OpenWA-Signature: sha256=<hex>` header. The node verifies each delivery against the raw request body and rejects (HTTP 401) any that fail. Leave it empty to skip verification.

> Changing or clearing the secret takes effect on the next activation — deactivate and reactivate the workflow to re-register it.

#### Trigger output

```json
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "default",
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
> - Read the message identifier from `data.id` (incoming payloads use `id`, not `messageId`).
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

Requires an OpenWA server **≥ 0.2.8**. Verified against OpenWA **v0.4.0**.

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
