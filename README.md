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
  <img src="https://img.shields.io/badge/OpenWA-%E2%89%A5%200.16.0-25D366.svg" alt="OpenWA >= 0.16.0"/>
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

> **API key role:** send-message and webhook operations require an **OPERATOR**-role key (the default). A read-only **VIEWER** key passes the credential test but returns `403` when sending or managing webhooks. VIEWER-safe operations include Session → Get Status / List All / Get Proxy, and Contact → Check Exists / Get Info. Two need more than OPERATOR: **Webhook → Get Delivery Failures** is **ADMIN**-only. The **API Key** resource is administration except for **Validate**, which any valid key may call to report its own role. An **ADMIN** key (the first-boot default) works for every operation.

> **Per-key scoping:** the server enforces each key's `allowedIps` and `allowedSessions`. An IP-whitelisted key must allow the n8n host's IP, and a session-restricted key returns `401` for operations on sessions outside its allow-list. Three surfaces are instance-level rather than per-session and refuse a session-scoped key with a `403` whatever its role: **Session → Create**, **Session → Update Proxy**, and every **API Key** operation except **Validate**. Configure these on the server, not in the node.

---

## 🧩 Nodes

### OpenWA (action)

| Resource            | Operation                   | Description                                          |
| ------------------- | --------------------------- | ---------------------------------------------------- |
| **API Key**         | Create                      | Create an API key                                    |
| **API Key**         | Delete                      | Delete an API key                                    |
| **API Key**         | Get                         | Get an API key                                       |
| **API Key**         | List                        | List all API keys                                    |
| **API Key**         | Revoke                      | Revoke an API key                                    |
| **API Key**         | Update                      | Update an API key                                    |
| **API Key**         | Validate                    | Validate the credential in use                       |
| **Automation Rule** | Create                      | Create an autoreply rule                             |
| **Automation Rule** | Delete                      | Delete an autoreply rule                             |
| **Automation Rule** | Get                         | Get an autoreply rule                                |
| **Automation Rule** | List                        | List the autoreply rules of a session                |
| **Automation Rule** | Update                      | Update an autoreply rule                             |
| **Call**            | Create Link                 | Create a shareable call link                         |
| **Call**            | Reject                      | Reject an incoming call                              |
| **Catalog**         | Get                         | Get the business catalog                             |
| **Catalog**         | Get Product                 | Get one catalog product                              |
| **Catalog**         | List Products               | List catalog products                                |
| **Channel**         | Create                      | Create a channel                                     |
| **Channel**         | Delete                      | Permanently delete a channel this account owns       |
| **Channel**         | Demote Admin                | Demote a channel admin back to a subscriber          |
| **Channel**         | Get                         | Get a channel                                        |
| **Channel**         | Get Messages                | Get the messages of a channel                        |
| **Channel**         | List                        | List followed channels                               |
| **Channel**         | Mute                        | Mute or unmute a channel                             |
| **Channel**         | Subscribe                   | Follow a channel by invite code                      |
| **Channel**         | Transfer Ownership          | Transfer channel ownership to another account        |
| **Channel**         | Unsubscribe                 | Unfollow a channel                                   |
| **Chat**            | Archive                     | Archive or unarchive a chat                          |
| **Chat**            | Clear Messages              | Delete every message in a chat                       |
| **Chat**            | Delete                      | Delete a chat                                        |
| **Chat**            | List                        | List all chats                                       |
| **Chat**            | Mark Read                   | Mark a chat as read                                  |
| **Chat**            | Mark Unread                 | Mark a chat as unread                                |
| **Chat**            | Mute                        | Mute or unmute a chat                                |
| **Chat**            | Pin                         | Pin or unpin a chat                                  |
| **Chat**            | Set State                   | Send a typing or recording indicator                 |
| **Contact**         | Block                       | Block a contact                                      |
| **Contact**         | Check Exists                | Check if a number exists                             |
| **Contact**         | Delete                      | Delete a contact from the addressbook                |
| **Contact**         | Get Info                    | Get contact information                              |
| **Contact**         | Get Phone                   | Resolve a contact phone number                       |
| **Contact**         | Get Profile Picture         | Get a contact profile picture                        |
| **Contact**         | Get Profile Pictures        | Get profile pictures for many contacts               |
| **Contact**         | List                        | List all contacts                                    |
| **Contact**         | List Blocked                | List blocked contacts                                |
| **Contact**         | Save                        | Save a contact to the addressbook                    |
| **Contact**         | Unblock                     | Unblock a contact                                    |
| **Group**           | Add Participants            | Add participants to a group                          |
| **Group**           | Approve Membership Requests | Approve pending join requests                        |
| **Group**           | Create                      | Create a group                                       |
| **Group**           | Delete Picture              | Remove the group picture                             |
| **Group**           | Demote Participants         | Demote participants from admin                       |
| **Group**           | Get                         | Get group info including participants                |
| **Group**           | Get Invite Code             | Get the group invite code                            |
| **Group**           | Get Join Info               | Preview a group from its invite code without joining |
| **Group**           | Get Membership Requests     | List pending join requests                           |
| **Group**           | Get Picture                 | Get the group picture                                |
| **Group**           | Get Settings                | Get group settings                                   |
| **Group**           | Join                        | Join a group via invite code                         |
| **Group**           | Leave                       | Leave a group                                        |
| **Group**           | List                        | List all groups                                      |
| **Group**           | Promote Participants        | Promote participants to admin                        |
| **Group**           | Reject Membership Requests  | Reject pending join requests                         |
| **Group**           | Remove Participants         | Remove participants from a group                     |
| **Group**           | Revoke Invite Code          | Revoke the group invite code                         |
| **Group**           | Set Picture                 | Set the group picture                                |
| **Group**           | Update Description          | Update the group description                         |
| **Group**           | Update Settings             | Update group settings                                |
| **Group**           | Update Subject              | Update the group subject                             |
| **Label**           | Add to Chat                 | Add a label to a chat                                |
| **Label**           | Create or Update            | Create or update a label                             |
| **Label**           | Delete                      | Delete a label                                       |
| **Label**           | Get                         | Get a label                                          |
| **Label**           | Get Chats                   | Get every chat carrying a label                      |
| **Label**           | Get for Chat                | Get the labels of a chat                             |
| **Label**           | List                        | List all labels                                      |
| **Label**           | Remove From Chat            | Remove a label from a chat                           |
| **Media**           | Check Availability          | Check whether media conversion is available          |
| **Media**           | Convert to Video            | Convert video into a compatible format               |
| **Media**           | Convert to Voice Note       | Convert audio into a voice note                      |
| **Message**         | Cancel Batch                | Cancel a bulk batch                                  |
| **Message**         | Delete                      | Delete a message                                     |
| **Message**         | Edit                        | Edit a sent message                                  |
| **Message**         | Forward                     | Forward a message to another chat                    |
| **Message**         | Get Batch Status            | Get bulk batch status                                |
| **Message**         | Get History                 | Get the message history of a chat                    |
| **Message**         | Get Media                   | Download the stored media of a message               |
| **Message**         | Get Reactions               | Get the reactions on a message                       |
| **Message**         | List                        | List stored messages                                 |
| **Message**         | Pin                         | Pin a message in its chat                            |
| **Message**         | React                       | React to a message                                   |
| **Message**         | Reply                       | Reply to a message                                   |
| **Message**         | Send Audio                  | Send an audio or voice message                       |
| **Message**         | Send Bulk                   | Send messages in bulk                                |
| **Message**         | Send Contact                | Send a contact card                                  |
| **Message**         | Send Document               | Send a document                                      |
| **Message**         | Send Image                  | Send an image                                        |
| **Message**         | Send Location               | Send a location                                      |
| **Message**         | Send Poll                   | Send a poll                                          |
| **Message**         | Send Product                | Send a product card from the catalog                 |
| **Message**         | Send Sticker                | Send a sticker                                       |
| **Message**         | Send Template               | Send a rendered template                             |
| **Message**         | Send Text                   | Send a text message                                  |
| **Message**         | Send Video                  | Send a video                                         |
| **Message**         | Star                        | Star or unstar a message                             |
| **Message**         | Unpin                       | Remove the pin from a message                        |
| **Message**         | Vote Poll                   | Cast a vote on a poll                                |
| **Observability**   | Check                       | Check server health                                  |
| **Observability**   | Check Liveness              | Check the liveness probe                             |
| **Observability**   | Check Readiness             | Check the readiness probe                            |
| **Presence**        | Get                         | Get the last reported presence for a chat            |
| **Presence**        | Set Own Presence            | Set whether the account appears online               |
| **Presence**        | Subscribe                   | Subscribe to presence updates for a chat             |
| **Profile**         | Delete Picture              | Remove the profile picture                           |
| **Profile**         | Set Name                    | Set the profile display name                         |
| **Profile**         | Set Picture                 | Set the profile picture                              |
| **Profile**         | Set Status                  | Set the profile about text                           |
| **Session**         | Create                      | Create a new session                                 |
| **Session**         | Delete                      | Delete a session                                     |
| **Session**         | Force Kill                  | Force kill a stuck session                           |
| **Session**         | Get Config                  | Get the tunable configuration for a session          |
| **Session**         | Get Proxy                   | Get the egress proxy for a session                   |
| **Session**         | Get QR                      | Get the QR code for authentication                   |
| **Session**         | Get Stats Overview          | Get an overview of all sessions                      |
| **Session**         | Get Status                  | Get session status                                   |
| **Session**         | List All                    | List all sessions                                    |
| **Session**         | Log Out                     | Log out and unlink this device                       |
| **Session**         | Request Pairing Code        | Request a phone pairing code                         |
| **Session**         | Start                       | Start a session                                      |
| **Session**         | Stop                        | Stop a session                                       |
| **Session**         | Update Config               | Update the tunable configuration for a session       |
| **Session**         | Update Proxy                | Update the egress proxy for a session                |
| **Status**          | Delete                      | Delete a status update                               |
| **Status**          | Get by Contact              | Get the statuses of a contact                        |
| **Status**          | Get Media                   | Get the media of a status update                     |
| **Status**          | List                        | List the status feed                                 |
| **Status**          | Send Image                  | Post an image status                                 |
| **Status**          | Send Text                   | Post a text status                                   |
| **Status**          | Send Video                  | Post a video status                                  |
| **Status**          | Send Voice                  | Post an audio status as a voice note                 |
| **System**          | Get Audit Log               | Get the audit log                                    |
| **System**          | Get Message Stats           | Get message statistics                               |
| **System**          | Get Session Stats           | Get statistics for one session                       |
| **System**          | Get Settings                | Get the server settings                              |
| **System**          | Get Stats Overview          | Get an overview of the statistics                    |
| **System**          | Search                      | Search messages across sessions                      |
| **Template**        | Create                      | Create a template                                    |
| **Template**        | Delete                      | Delete a template                                    |
| **Template**        | Get                         | Get a template                                       |
| **Template**        | List                        | List all templates                                   |
| **Template**        | Update                      | Update a template                                    |
| **Webhook**         | Create                      | Create a webhook                                     |
| **Webhook**         | Delete                      | Delete a webhook                                     |
| **Webhook**         | Get                         | Get a webhook                                        |
| **Webhook**         | Get Delivery Failures       | List failed webhook deliveries                       |
| **Webhook**         | List                        | List the webhooks of a session                       |
| **Webhook**         | List All                    | List webhooks across all sessions                    |
| **Webhook**         | Test                        | Send a test delivery to a webhook                    |
| **Webhook**         | Update                      | Update a webhook                                     |

> **Roles:** most reads work with a plain API key, while writes generally need an **OPERATOR** key. A `403` almost always means the credential's role is too low, not that the request was malformed. Two groups need **ADMIN**: the whole **API Key** resource, and the **System** reads **Get Settings**, **Get Stats Overview**, **Get Message Stats** and **Get Audit Log**. The three stats and settings reads additionally need a key that is *not* restricted to specific sessions, because they report across the whole server.

> **Observability:** **Check** / **Check Liveness** / **Check Readiness** return the server's health JSON as-is, so a workflow can alert on availability. **Check Readiness** is the one that also probes the database connections. `/api/metrics` is deliberately not offered — it authenticates with its own bearer token rather than the API key this credential carries, so it could only ever answer `401` or `404` from here.

> **Not offered:** the server's administration surface, which a workflow has no business driving: the infrastructure, plugin, ingress and integration controllers, plus `/api/metrics`, which authenticates with its own bearer token rather than the API key this credential carries. **Send Catalog** is gone from the server entirely. Settings are environment-derived, and the server publishes no write route for them, so the System resource reads them only. **Search** needs a search provider configured server-side, otherwise it answers `501`, and can answer `502` or `503` when a plugin provider misbehaves or does not respond.

> **Engine split:** several operations exist on one engine only, and the node says so on the field or resource rather than leaving a `501` to explain itself. **Catalog** and **Send Product** are Baileys only, as is **Presence > Subscribe** and both label writes; **Vote Poll**, the **Channel** listing and **Channel > Get Messages** are whatsapp-web.js only, and the label reads with them. Because the channel listing is whatsapp-web.js only, the Channel ID dropdown cannot populate on Baileys: supply the ID (`<digits>@newsletter`) from an expression there.

> **Send Product** returns `{id, timestamp}` where every other send returns `{messageId, timestamp}`. The node passes the response through unchanged rather than normalising it, so the difference stays visible.

> **Dropdowns:** ID fields with a listing endpoint behind them offer a dropdown — in both nodes, including the Trigger's **Session Name or ID** — and fetch a single page: up to 1000 entries where the route pages (sessions, groups, chats, contacts), and whatever the route returns where it does not (templates, labels, webhooks, channels, API keys). On an account with more than that, set the field from an expression instead of picking from the list. The **Label Name or ID** dropdown is whatsapp-web.js only, because the label listing behind it answers `501` on Baileys.

> **Status posts:** WhatsApp Status is never posted to a group, so **Recipients** takes `@c.us`/`@lid` JIDs (max 256). The Baileys engine *requires* an explicit recipient list and is the only engine that honors it. whatsapp-web.js ignores the list entirely and posts to every contact whether one is supplied or not, so do not rely on it to limit the audience there.

> **Group operations:** reads (List, Get, Get Settings, Get Invite Code) work with a plain API key, but every write — create, join, leave, participant changes, subject/description/settings, and invite-code revoke — needs a key with the **OPERATOR** role, otherwise the server answers `403`. Add/Remove/Promote/Demote report a per-participant outcome in `results[]` and a partial refusal does *not* fail the batch, so check `results[].success` rather than the top-level `success`. **Update Settings** is partial — fields you leave out stay untouched — and `ephemeralSeconds` is Baileys-only (whatsapp-web.js returns `501`).

> **Base64 media:** when sending an image, document, or audio clip from a **Base64** source, also set the **MIME Type** field (e.g. `image/png`, `application/pdf`, `audio/ogg; codecs=opus`) — OpenWA requires a MIME type for base64 payloads. The **Binary** source fills it in automatically from the binary metadata, and the **URL** source needs nothing extra.

> **Mentions:** an optional list of WhatsApp IDs (e.g. `628123456789@c.us`). For each one to render as an @mention, the message text or caption must also contain the matching `@628123456789` token. Send Audio and Send Sticker carry no text, so the tag notifies without anything visible.
>
> The floor differs by operation. **Send Text**, **Send Image**, **Send Video**, **Send Document**, **Send Sticker** and **Send Audio** have accepted it since server **≥ 0.7.14**. **Reply**, **Edit** and **Send Template** need server **≥ 0.23.0**. Leave the list empty on an older server.
>
> On **Edit** the list is re-applied rather than preserved, because an edit replaces the message content: name every ID the edited message should still tag, or leave it empty to drop the tags the original carried.

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
3. Configure **Session ID** — pick it from the dropdown, which lists the sessions on your server;
   it is the session's UUID, not its name, and a literal `default` resolves to nothing — then
   **Chat ID** (`628123456789@c.us`) and **Message**

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
| `group.join`            | Participant joined a group             |
| `group.leave`           | Participant left a group               |
| `group.update`          | Group metadata changed                 |
| `message.edited`        | Message text or media caption edited   |
| `status.received`       | A contact's Status (Story) received    |
| `session.reconnect_loop`| Session stuck in a reconnect loop (server **≥ 0.10.0**) |
| `session.restriction`   | WhatsApp placed or lifted a restriction on the account |
| `call.received`         | Incoming call detected                 |
| `call.accepted`         | Incoming call answered — **Baileys only** |
| `call.rejected`         | Incoming call declined, including auto-reject — **Baileys only** |
| `call.missed`           | Incoming call went unanswered — **Baileys only** |
| `presence.update`       | Subscribed chat's presence changed — needs `POST /presence/subscribe` first, and **Baileys only** |
| `group.join_request`    | Someone asked to join an administered group (server **≥ 0.15.0**) |

#### 🎯 Server-side filters

The Trigger's optional **Filters** field is registered with the webhook, so the gateway drops non-matching events before delivering them and they never start a workflow execution. Supply it as JSON:

```json
{ "conditions": [{ "field": "isGroup", "operator": "is", "value": false }] }
```

Conditions are ANDed, at most 20. The fields are `sender`, `recipient`, `body`, `type`, `isGroup`, `kind`, `fromMe`, `hasMedia` and `mentions`. `kind` (server >= 0.23.4) names the chat kind, one of `individual`, `group`, `channel`, `status`, `broadcast` or `unknown`; it is the only way to single out or exclude a Channel post, which `isGroup` reports as false along with everything else. Value shape is enforced at registration: the ID, mentions, type and kind fields take a non-empty array, `body` takes a plain string, and the boolean fields take a real boolean.

> Two things are worth knowing before relying on them. Filters only narrow **message** events, so `session.*`, `group.*` and `call.*` events are delivered whatever the filter says. And a filtered-out delivery is silent: from n8n it is indistinguishable from nothing having happened, so an over-strict filter looks like a broken trigger. Changing the filter re-registers the webhook on the next activation.

#### 🔐 Signature verification

The Trigger has an optional **Webhook Secret**. When set, the secret is registered with OpenWA at webhook creation, and OpenWA signs every delivery with HMAC-SHA256 in the `X-OpenWA-Signature: sha256=<hex>` header. The node verifies each delivery against the raw request body and rejects (HTTP 401) any that fail. Leave it empty to skip verification.

> **Secret length:** the secret must be between **16 and 255 characters**. The server enforces both bounds at registration (server **≥ 0.20.0**; a short secret on an older server was already brute-forcible from one observed signature), and the node checks them before sending so the error names the field instead of surfacing a raw `400`. Webhooks registered with a short secret before the floor keep working until re-registered.

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
> - De-duplicate on `idempotencyKey`, not `deliveryId`. `idempotencyKey` identifies the *event* and is reused across both retries and crash replays; `deliveryId` identifies a single *attempt* and is re-minted on every replay, so keying on it misses exactly the duplicate you are trying to catch.
> - Message `type` is engine-neutral: voice notes are `voice`, shared contacts are `contact`, and plain chats are `text`.
> - **Check Exists** returns `whatsappId`, the engine-canonical chat id, which may differ from the number you sent (for example an `@lid` id).

#### ♻️ Duplicate deliveries

OpenWA guarantees at-least-once delivery: it retries a failed POST, and it replays any delivery stranded by a gateway crash. Both carry the same `idempotencyKey`, so the same event can reach n8n twice and would otherwise run the workflow twice. Enable **Deduplicate Deliveries** on the Trigger to drop repeats; the node remembers the 500 most recent idempotency keys (kept in workflow static data), falling back to `deliveryId` on a gateway too old to send one.

It is best-effort: workflow static data is saved per execution, so two deliveries arriving at the exact same moment can both pass. Enable it when downstream actions are not idempotent.

---

## 📡 Example Workflows

| Pattern         | Flow                                                              |
| --------------- | ----------------------------------------------------------------- |
| Auto-reply      | `[OpenWA Trigger]` → `[IF: keyword]` → `[OpenWA: Send Text]`       |
| Session monitor | `[OpenWA Trigger: session.disconnected]` → `[Slack: Alert]`        |
| Lead capture    | `[OpenWA Trigger]` → `[Google Sheets: Append]` → `[OpenWA: Send Text]` |

---

## 🔗 Compatibility

Requires an OpenWA server **≥ 0.16.0**. A floor is set by the newest thing the node needs, and three things move it independently.

The **routes** the action node calls set the badge at v0.16.0: **Call > Create Link** arrived there. Most of the rest of the surface landed in v0.14.0 (message pin/star/vote, chat archive/mute/pin/clear, presence, media conversion, voice statuses, group pictures and join preview, channel administration, label writes and automation rules) with membership requests, the blocklist read and session config in v0.15.0. Two operations sit above the badge: **Session > Get Proxy** and **Session > Update Proxy** need server **≥ 0.23.4**, where the per-session proxy became readable and patchable rather than fixed at creation. Against an older server those specific operations answer `404` and everything else still works.

The **event catalog** sets 0.15.0. `group.join_request` does not exist in core before v0.15.0, and `session.restriction`, `presence.update`, `call.accepted`, `call.rejected` and `call.missed` do not exist before v0.14.0 (a v0.14.x server knows 22 events, not 23), so a Trigger subscribing to any of the six is rejected at registration by the server's own event validation. That is a harder failure than a `404` on one operation.

A few **optional fields** need a server newer than the badge. They are opt-in, so a workflow that leaves them alone runs against any server at or above the floor, but filling one in against an older server returns a `400`, because the server rejects a request body carrying a field it does not know.

| Field | Where | Needs |
| ----- | ----- | ----- |
| **Quoted Message ID** | the nine single-message sends | server **≥ 0.17.0** |
| **Message IDs** | Chat > Mark Read | server **≥ 0.23.0** |
| **Mentions** | Message > Edit, Reply and Send Template | server **≥ 0.23.0** |
| **Link Preview** | Message > Send Template | server **≥ 0.23.0** |
| **After Message ID** | Message > List | server **≥ 0.23.4** |
| **Inline Media** | Message > List | server **≥ 0.23.4** |
| **`kind` filter field** | Trigger Filters, Webhook > Create / Update | server **≥ 0.23.4** |

> Three of those rows fail differently on an older server, because they are not body fields. **After Message ID** and **Inline Media** are query parameters the messages route reads loose, so a pre-0.23.4 server ignores them instead of refusing: a cursor walk silently falls back to offset paging, and the inline-media opt-out silently keeps inlining. The **`kind`** filter field is validated when the webhook is registered, so a condition naming it is refused with a `400` at activation rather than at delivery.

> Everything else in the table above is available at the badge floor. Where an operation exists on only one engine, the node says so on the field or resource rather than leaving a `501` to explain itself.

The Trigger alone still works against much older servers if you subscribe only to events that existed then; its webhook contract and HMAC verification landed in v0.4.0.

The Trigger also re-registers its webhook when the registration on the server no longer matches what the node created: deactivated, repointed at another URL, or subscribed to a different event set. `active`, `url` and `events` have been part of the webhook response since v0.4.0, so this needs nothing newer.

> The **Message Reaction** event requires server **≥ 0.7.2**. Selecting it against an older
> server returns a 400 when the webhook is created.

---

## 🛠 Development

```bash
npm install      # install dependencies
npm run build    # compile TypeScript + copy icons
npm run dev      # watch mode
npm run lint     # ESLint (.eslintrc.js)
npm test         # build + unit tests (route mapping, guards, trigger delivery, webhook lifecycle)
```

Linting uses the legacy `.eslintrc.js`, which extends `eslint:recommended`. It is the only
ESLint config in the repository.

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
