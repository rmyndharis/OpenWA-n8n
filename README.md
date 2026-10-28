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
  <a href="https://buymeacoffee.com/rmyndharis"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"/></a>
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

> **API key role:** sends and webhook management require **OPERATOR**. **ADMIN** is required for Webhook > Get Delivery Failures / Redrive Delivery Failures, Session > Update Proxy, Session > Create when Proxy URL is set, the System reads Get Settings / Get Stats Overview / Get Message Stats / Get Audit Log, and API Key operations other than Validate. VIEWER keys can perform permitted reads but cannot send or manage webhooks, and the few reads listed under Roles below also need OPERATOR. Validate reports the credential role and engine; it refuses keys restricted with `allowedChats`.

> **Per-key scoping:** the server enforces each key's `allowedIps` and `allowedSessions`. An IP-whitelisted key must allow the n8n host's IP, and a session-restricted key is refused with `403` for operations on sessions outside its allow-list (servers before 0.24.0 answered `401`). Some surfaces are instance-level rather than per-session and refuse a session-scoped key with a `403` whatever its role: **Session → Create**, **Session → Update Proxy**, the **System** reads **Get Settings**, **Get Stats Overview** and **Get Message Stats**, and every **API Key** operation except **Validate**. Configure all of this on the server, not in the node.

> **Chat-restricted keys:** `allowedChats` (server **>= 0.23.6**) is default-deny on routes without chat scope. On **v0.25.0**, Chat > List and Group > List return only allowed chats; Message > List works when its Chat ID filter names an allowed chat. Allowed group reads and settings are available, and built-in System > Search enforces the allowlist; plugin search is refused. The credential test, Session dropdown, OpenWA Trigger and API Key > Validate still return `403`, so supply the session ID with an expression for these action workflows. Other dropdowns depend on their route: chat and group pickers work, while routes without chat scope fail. Optional Quoted Message ID on sends remains refused; Reply can quote a message within its allowed chat.

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
| **Message**         | Click Button                | Click a button on a business prompt                  |
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
| **Webhook**         | Redrive Delivery Failures   | Replay a bounded batch of retained failed deliveries  |
| **Webhook**         | List All                    | List webhooks across all sessions                    |
| **Webhook**         | Test                        | Send a test delivery to a webhook                    |
| **Webhook**         | Update                      | Update a webhook                                     |

> **Roles:** most reads work with VIEWER; writes generally require OPERATOR. These reads need OPERATOR as well and answer `403` to a VIEWER key: Session > Get QR, Contact > Check Exists, Group > Get Invite Code, Template > Get and List, Automation Rule > Get and List, Webhook > Get, List and List All, and System > Search. A `403` can also mean an IP, session or chat restriction. ADMIN is required for API key administration, webhook failure inspection and redrive, proxy writes (including Session > Create with a Proxy URL), and the server-wide settings, statistics and audit reads. Server-wide settings/statistics, session creation, proxy updates and API key administration also refuse session-scoped keys.

> **List output and node versions:** a list operation (Session > List All, Chat > List, Contact > List, Group > List, Label > List, Webhook > List, and the rest that answer a bare array) emits **one item per row** on node version 2, the version a newly added node gets, so `$json.<field>` reads a row directly and Split Out is not needed. An empty list then yields zero items and the downstream node does not run; enable **Always Output Data** where that matters. A node saved on any release up to and including 1.0.0 stays on version 1 across package upgrades and keeps the whole array on a single item, so an existing workflow reading `$json[0]` is unaffected. A node added while on 1.0.0 got the per-row output without a version of its own, so it returns to the whole array on upgrade; delete and re-add it to move it to version 2. Routes that answer an envelope, such as Message > List and System > Search, keep their shape on both versions because flattening them would drop `total` and the other envelope fields.

> **Failed items:** with **On Error** set to *Continue (using error output)*, a failed item reaches the error output with the input item's fields and an `error` that ends with the gateway's own reason, so an input field such as `message` is still there for a retry. With *Continue (regular output)* it stays on the main output as `error` plus that reason under `description`.

> **Observability:** **Check** / **Check Liveness** / **Check Readiness** return the server's health JSON as-is, so a workflow can alert on availability. **Check Readiness** is the one that also probes the database connections. `/api/metrics` is deliberately not offered — it authenticates with its own bearer token rather than the API key this credential carries, so it could only ever answer `401` or `404` from here.

> **Not offered:** the server's administration surface, which a workflow has no business driving: the infrastructure, plugin, ingress and integration controllers, plus `/api/metrics`, which authenticates with its own bearer token rather than the API key this credential carries. **Send Catalog** is gone from the server entirely. Settings are environment-derived, and the server publishes no write route for them, so the System resource reads them only. **Search** needs a search provider configured server-side, otherwise it answers `501`, and can answer `502` or `503` when a plugin provider misbehaves or does not respond.

> **Engine split:** several operations exist on one engine only. The node says so on the field or resource wherever it can, rather than leaving a `501` to explain itself. **Catalog**, **Send Product**, **Click Button** and **Group > Create** are Baileys only, as are **Presence > Subscribe**, **Call > Reject** and the label edits (**Create or Update** and **Delete**); **Vote Poll**, **Message > Get Reactions**, the **Channel** listing and **Channel > Get Messages** are whatsapp-web.js only, and the label reads with them. **Label > Add to Chat** and **Remove From Chat** work on both. Because the channel listing is whatsapp-web.js only, the Channel ID dropdown cannot populate on Baileys: supply the ID (`<digits>@newsletter`) from an expression there.

> **Send Product** returns `{id, timestamp}` where every other send returns `{messageId, timestamp}`. The node passes the response through unchanged rather than normalising it, so the difference stays visible.

> **Dropdowns:** ID fields with a listing endpoint behind them offer a dropdown — in both nodes, including the Trigger's **Session Name or ID** — and fetch a single page: up to 1000 entries where the route pages (sessions, groups, chats, contacts), and whatever the route returns where it does not (templates, labels, webhooks, channels, API keys). On an account with more than that, set the field from an expression instead of picking from the list. The **Label Name or ID** dropdown is whatsapp-web.js only, because the label listing behind it answers `501` on Baileys.

> **Status posts:** WhatsApp Status is never posted to a group, so **Recipients** takes `@c.us`/`@lid` JIDs (max 256). The Baileys engine *requires* an explicit recipient list and is the only engine that honors it. whatsapp-web.js ignores the list entirely and posts to every contact whether one is supplied or not, so do not rely on it to limit the audience there.

> **Group operations:** reads (List, Get, Get Settings) work with a plain API key, while **Get Invite Code** needs **OPERATOR** from server **≥ 0.23.5**, since the code lets anyone join the group. Every write — create, join, leave, participant changes, subject/description/settings, and invite-code revoke — needs a key with the **OPERATOR** role, otherwise the server answers `403`. Add/Remove/Promote/Demote report a per-participant outcome in `results[]` and a partial refusal does *not* fail the batch, so check `results[].success` rather than the top-level `success`. **Update Settings** is partial — fields you leave out stay untouched — and `ephemeralSeconds` is Baileys-only (whatsapp-web.js returns `501`).

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
> Media (`image`/`video`/`audio`/`document`) uses `url` or `base64` (add `mimetype` for base64) — there is no binary source in bulk. An item can also carry a `variables` object that fills `{{name}}` placeholders in its content, and `content.mentions` as on the single sends. Send Bulk returns a `batchId` immediately and sends in the background; poll **Get Batch Status** until the status is `completed`, `cancelled`, or `failed`, or stop it early with **Cancel Batch**.

**Message List filters (v0.25.0):** Since is inclusive and Until is exclusive, both using WhatsApp message time. Date values are converted to epoch milliseconds in the workflow timezone. Direction selects incoming or outgoing, Type is an exact stored token, and Message ID is the WhatsApp reference, distinct from the stored row ID used by After Row ID. Order By defaults to ingestion time (`createdAt`); `timestamp` orders by message time and excludes rows without one. Keep the selection and ordering unchanged while paging with a cursor. Poll choices and media omission markers are preserved in the returned envelope.

**Idempotent sends (v0.25.0):** Idempotency Key is optional on Send Text, Image, Video, Audio, Document, Sticker, Location, Contact, Poll, Template, Reply and Forward. Supply 1-255 visible ASCII characters without spaces, with a distinct key per intended message and session. Retrying the same route and body within 24 hours returns the first result without sending again. A changed request with the same key returns `422 IDEMPOTENCY_KEY_REUSED`; an in-progress or uncertain outcome returns `409`. Keep the same key on a retry and inspect an uncertain outcome before deciding whether to send again. The node never generates a key. Trigger delivery deduplication is configured separately.

**Webhook redrive (v0.25.0):** Redrive Delivery Failures requires ADMIN and server-side `WEBHOOK_FAILURE_PAYLOAD_RETENTION_HOURS > 0`. It replays one bounded batch of eligible terminal failures with retained payloads. Session ID, Webhook ID and Failure IDs narrow the selection. Limit accepts 1-500; omitting the option uses the server default of 100, while adding it starts at 50. An explicit empty ID list replays nothing. Each replay keeps the original event idempotency key, applies current subscription eligibility, and respects the calling key session restrictions. Read `delivered`, `failed`, `skipped` and `remaining` from the result; redrive uses direct attempts, so `enqueued` stays zero.

**Session configuration (v0.25.0):** Creating a session with Proxy URL requires ADMIN. Without a proxy, OPERATOR is sufficient, subject to key restrictions. The recognized config keys are validated at creation (server **>= 0.24.0**): `autoRejectCalls` is boolean, `maxReconnectAttempts` is 0-20 or null for unlimited, and `reconnectBaseDelay` is 1000-300000 milliseconds. An invalid value is rejected with `400`. Reconnect changes take effect on the next Start; call rejection applies to the next incoming call.

> **Voice notes** (server **≥ 0.7.17**): Send Audio has a **Send as Voice Note** toggle. When on, the clip is delivered as a true WhatsApp voice note (the microphone bubble with a waveform) instead of a plain audio file. Voice notes require `audio/ogg; codecs=opus` audio for reliable playback. Leave the toggle off (plain audio file) on older servers.

**Example — send a text message**

1. Add an **OpenWA** node
2. Select the **Message** resource and **Send Text** operation
3. Configure **Session ID** — pick it from the dropdown, which lists the sessions on your server;
   it is the session's UUID, not its name, and a literal `default` resolves to nothing — then
   **Chat ID** (`628123456789@c.us`) and **Message**

> **Provisioning a session:** sessions are identified by a **UUID** (returned by **Create**, **Get Status**, or **List All**). A full end-to-end flow is **Create → Start → Get QR** (scan) or **Request Pairing Code** (enter on the phone) → wait for `session.authenticated`. The Trigger can listen for `session.qr` and `session.authenticated` events; these session operations are what drive those state transitions.

### Using as an AI tool

The OpenWA node can be attached to an AI agent as a tool. You choose the resource and operation when you build the workflow; the model only fills the fields you map to `$fromAI()`.

- Give the tool a key with the lowest role it needs, and restrict it with `allowedSessions` and `allowedChats`. Set Session ID yourself rather than leaving it to the model, and do not map the target ID of a destructive operation (Session > Delete, Group > Remove Participants, Webhook > Create or Update) to `$fromAI()`.
- Everything an operation returns becomes part of the model's context and is stored in the execution data like any other output. API Key > Create returns the new key in plaintext, and a key created without a Role is an OPERATOR key. Session > Get QR, Session > Request Pairing Code and Group > Get Invite Code return codes that grant access.
- Message > Get Media and Status > Get Media return a file, which an agent tool cannot carry; use them from a regular node.
- Webhook secrets, webhook headers and a session Proxy URL that carries credentials are saved as ordinary node parameters. They appear in the workflow JSON, in exports and Git sync, and in execution snapshots. Treat those as sensitive.

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
| `call.received`         | Incoming call detected (not reliable on whatsapp-web.js) |
| `call.accepted`         | Incoming call answered — **Baileys only** |
| `call.rejected`         | Incoming call declined, including auto-reject — **Baileys only** |
| `call.missed`           | Incoming call went unanswered — **Baileys only** |
| `presence.update`       | Subscribed chat's presence changed — needs `POST /presence/subscribe` first, and **Baileys only** |
| `group.join_request`    | Someone asked to join an administered group (server **≥ 0.15.0**) |
| `event.response`        | RSVP to a WhatsApp event invitation (server **>= 0.25.0**, Baileys only) |
| `message.receipt`       | One recipient received, read or played a group or Status message you sent (server **>= 0.26.0**, Baileys only; select it by name, `*` does not include it) |
| `poll.vote`             | Someone voted on a poll or cleared their vote (server **>= 0.26.0**, whatsapp-web.js only) |

#### 🎯 Server-side filters

The Trigger's optional **Filters** field is registered with the webhook, so the gateway drops non-matching events before delivering them and they never start a workflow execution. Supply it as JSON:

```json
{ "conditions": [{ "field": "isGroup", "operator": "is", "value": false }] }
```

Conditions are ANDed, at most 20. Fields are `sender`, `recipient`, `body`, `type`, `isGroup`, `kind`, `chatId`, `fromMe`, `hasMedia` and `mentions`. `kind` (server >= 0.23.4) distinguishes `individual`, `group`, `channel`, `status`, `broadcast` and `unknown`; `isGroup: false` includes all non-group kinds. `chatId` (server >= 0.23.6) scopes a conversation. On v0.25.0, Message Ack and Message Failed also match a `chatId` or `kind` filter when their payload identifies the chat. An `is` condition suppresses a payload missing its ID, type or kind field; a sender filter therefore still suppresses acks without a sender. ID, mentions, type and kind values take non-empty arrays, `body` takes text, and boolean fields take real booleans.

> Filters narrow **message** events; `session.*`, `group.*`, `call.*`, `poll.vote` and `event.response` arrive regardless. A filtered-out delivery is silent. Changing a filter re-registers the webhook on the next activation. Activation removes other registrations using this Trigger URL, so give each filter set its own Trigger and URL.

#### 🔐 Signature verification

The Trigger has an optional **Webhook Secret**. When set, the secret is registered with OpenWA at webhook creation, and OpenWA signs every delivery with HMAC-SHA256 in the `X-OpenWA-Signature: sha256=<hex>` header. The node verifies each delivery against the raw request body and rejects (HTTP 401) any that fail. Leave it empty to skip verification, in which case anyone who knows the Trigger's URL can start the workflow, so set one when the n8n instance is reachable from outside. The signature covers the body only and OpenWA sends no signed timestamp header, so a captured delivery can be replayed unless the workflow de-duplicates on `idempotencyKey`.

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

It is best-effort: n8n saves the record of seen events once per delivery, so deliveries that overlap can each miss the other, and a replay of one of them can then still run. The same happens when the workflow writes its own static data and an earlier run finishes after a later delivery arrived. Enable it when downstream actions are not idempotent.

> **n8n 2.x:** from n8n 2.19.2 onward (checked up to 2.45.3) the record of seen events is not saved, because n8n resets its change flag before it persists the Trigger's static data, so the option has no effect there. n8n 1.123.87 and 2.19.0 save it as described. Until n8n fixes this, de-duplicate downstream on `idempotencyKey`.

---

## 📡 Example Workflows

| Pattern         | Flow                                                              |
| --------------- | ----------------------------------------------------------------- |
| Auto-reply      | `[OpenWA Trigger]` → `[IF: keyword]` → `[OpenWA: Send Text]`       |
| Session monitor | `[OpenWA Trigger: session.disconnected]` → `[Slack: Alert]`        |
| Lead capture    | `[OpenWA Trigger]` → `[Google Sheets: Append]` → `[OpenWA: Send Text]` |

---

## 🔗 Compatibility

The nodes need an `n8n-workflow` that exports `NodeConnectionTypes` (1.83.0 or later, which ships with n8n 1.85.0 or later); with an older copy they fail to load. Requires an OpenWA server **≥ 0.16.0** for the base operations. The current contract target is **OpenWA v0.26.0**; newer operations, fields and events have their own floors below. CI verifies the contract fixture against source pinned to release commit `386464e229e1762d95c8a1c0ddb9e2c8b13604bc`.

The base **routes** require v0.16.0 for Call > Create Link. Most other operations arrived in v0.14.0, with membership requests, blocklist reads and session config in v0.15.0. Session > Get Proxy / Update Proxy require **v0.23.4**, Message > Click Button requires **v0.23.6**, and Webhook > Redrive Delivery Failures requires **v0.25.0**. These operations return `404` on servers predating their route.

The **event catalog** includes all 26 events of v0.26.0. `message.receipt` (Baileys) and `poll.vote` (whatsapp-web.js) require **v0.26.0**, and a subscription to `*` does not include `message.receipt`. `event.response` requires **v0.25.0** and Baileys. `group.join_request` requires v0.15.0; `session.restriction`, `presence.update`, `call.accepted`, `call.rejected` and `call.missed` require v0.14.0. Subscribing to an event an older server does not recognize fails registration with `400`. The default subscription stays `message.received`.

A few **optional fields** need a server newer than the badge. They are opt-in, so a workflow that leaves them alone runs against any server at or above the floor, but filling one in against an older server returns a `400`, because the server rejects a request body carrying a field it does not know.

| Field | Where | Needs |
| ----- | ----- | ----- |
| **Since / Until / Direction / Order By / Type / Message ID** | Message > List | server **>= 0.25.0** |
| **Idempotency Key** | twelve single-recipient sends | server **>= 0.25.0** |
| **Quoted Message ID** | the nine single-message sends | server **≥ 0.17.0** |
| **Message IDs** | Chat > Mark Read | server **≥ 0.23.0** |
| **Mentions** | Message > Edit, Reply and Send Template | server **≥ 0.23.0** |
| **Link Preview** | Message > Send Template | server **≥ 0.23.0** |
| **After Row ID** | Message > List | server **≥ 0.23.4** |
| **Inline Media** | Message > List | server **≥ 0.23.4** |
| **`kind` filter field** | Trigger Filters, Webhook > Create / Update | server **≥ 0.23.4** |
| **Name** | Session > List All | server **≥ 0.23.5** |
| **Allowed Chats** | API Key > Create / Update | server **≥ 0.23.6** |
| **`chatId` filter field** | Trigger Filters, Webhook > Create / Update, Automation Rule conditions | server **≥ 0.23.6** |

> Query parameters behave differently on older servers: After Row ID, Inline Media, Name and the six v0.25.0 Message List filters can be ignored, so a request may read a broader selection or use older pagination. Idempotency Key is an HTTP header older servers ignore, so retry protection requires v0.25.0. The `kind` and `chatId` filter fields are validated when the webhook or rule is saved and are refused if unsupported.

> Existing operations keep their earlier server floors when the newer optional fields are left unset. Engine-specific limitations are described on the relevant operation.

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
npm run check:openwa # compare the contract with pinned upstream source
npm test         # build + unit tests (route mapping, guards, trigger delivery, webhook lifecycle)
```

Linting uses the legacy `.eslintrc.js`, which extends `eslint:recommended`. It is the only
ESLint config in the repository.

The contract check downloads three source files from the pinned release commit. For offline verification, run `npm run check:openwa -- /path/to/OpenWA` against a checkout of v0.26.0. Unit tests use the checked-in fixture and run without an upstream checkout.

CI also runs the n8n Creator Portal scanner (see
`scripts/n8n-scan.mjs`), which pins the portal's own, newer rule versions.

---

## 📚 Links

- [OpenWA Server](https://github.com/rmyndharis/OpenWA) — the WhatsApp API Gateway
- [OpenWA Documentation](https://github.com/rmyndharis/OpenWA/tree/main/docs)
- [OpenWA API Reference](https://github.com/rmyndharis/OpenWA/blob/main/docs/06-api-specification.md)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)

---

## ☕ Support

If these nodes save you time, you can support OpenWA development by buying me a coffee.

<a href="https://buymeacoffee.com/rmyndharis"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"/></a>

---

## 📄 License

[MIT](./LICENSE) — free for personal and commercial use.

---

<div align="center">

[📦 npm](https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa) · [🐛 Report Bug](https://github.com/rmyndharis/OpenWA-n8n/issues) · [💡 Request Feature](https://github.com/rmyndharis/OpenWA-n8n/issues)

<br/>

<sub>Built for the <a href="https://github.com/rmyndharis/OpenWA">OpenWA</a> community.</sub>

</div>
