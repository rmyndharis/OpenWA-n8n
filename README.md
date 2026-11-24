<div align="center">

<img src="https://raw.githubusercontent.com/rmyndharis/OpenWA/main/docs/logo/openwa_logo.webp" alt="OpenWA Logo" width="160"/>

# n8n-nodes-openwa

**n8n community nodes for the [OpenWA](https://github.com/rmyndharis/OpenWA) WhatsApp API Gateway.**

Send and receive WhatsApp messages, manage sessions, chats, contacts and groups, and start workflows from real-time events, all from inside n8n.

[![npm version](https://img.shields.io/npm/v/@rmyndharis/n8n-nodes-openwa.svg?color=blue)](https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa)
[![npm downloads](https://img.shields.io/npm/dm/@rmyndharis/n8n-nodes-openwa.svg)](https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa)
[![CI](https://github.com/rmyndharis/OpenWA-n8n/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rmyndharis/OpenWA-n8n/actions/workflows/ci.yml)
[![n8n community node](https://img.shields.io/badge/n8n-community_node-EA4B71.svg)](https://docs.n8n.io/integrations/community-nodes/)
[![OpenWA ≥ 0.16.0](https://img.shields.io/badge/OpenWA-%E2%89%A5%200.16.0-25D366.svg)](#compatibility)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy_Me_a_Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/rmyndharis)

[Installation](#installation) · [Credentials](#credentials) · [Quick start](#quick-start) · [Action node](#openwa-node) · [Trigger](#openwa-trigger) · [Compatibility](#compatibility) · [Contributing](#contributing)

</div>

---

> **Status:** Active. The nodes follow the OpenWA release line; see [Compatibility](#compatibility) for the server version each operation, field and event needs.

## Overview

Two n8n nodes connect your workflows to a self-hosted [OpenWA](https://github.com/rmyndharis/OpenWA) WhatsApp API Gateway. Send and receive WhatsApp messages, manage sessions, chats, contacts, groups, labels, templates and status posts, and react to events in real time.

| Node | Type | Purpose |
| ---- | ---- | ------- |
| **OpenWA** | Action | Send messages and manage sessions, chats, contacts, groups, status, and more |
| **OpenWA Trigger** | Trigger | Start workflows on incoming messages and session events |

## Installation

### Community Nodes (recommended)

1. In n8n, open **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `@rmyndharis/n8n-nodes-openwa` and accept the risk prompt.
4. Restart n8n.

### Manual

```bash
cd ~/.n8n/nodes
npm install @rmyndharis/n8n-nodes-openwa
```

Restart n8n afterwards so it loads the nodes.

## Credentials

Create an **OpenWA API** credential. Both nodes share it.

| Field | Description |
| ----- | ----------- |
| **Server URL** | URL of your OpenWA server, without a trailing slash or `/api`. Defaults to `http://localhost:2785` for a local server; behind a reverse proxy, use its public URL (for example `https://wa.example.com`). Use HTTPS in production. |
| **API Key** | API key from your OpenWA dashboard. Sent as the `X-API-Key` header. |

The credential is validated with an authenticated `GET /api/sessions` request, so an invalid API key fails the test.

### Roles and key restrictions

The role of your API key decides what a workflow may do. The server enforces it, so configure it there, not in the node.

- **VIEWER:** most reads. A VIEWER key cannot send messages or manage webhooks.
- **OPERATOR:** sends, webhook management and writes in general. These reads need OPERATOR as well and answer `403` to a VIEWER key: Session > Get QR, Contact > Check Exists and Get LID, Group > Get Invite Code, Template > Get and List, Automation Rule > Get and List, Webhook > Get, List and List All, and System > Search.
- **ADMIN:** API key operations other than Validate, Webhook > Get Delivery Failures and Redrive Delivery Failures, proxy operations (Session > Get Proxy on server ≥ 0.32.0, Session > Update Proxy, and Session > Create when a Proxy URL is set), and the server-wide System reads Get Settings, Get Stats Overview, Get Message Stats and Get Audit Log.

A `403` can also mean an IP, session or chat restriction. **API Key > Validate** reports the credential's role and engine; it refuses keys restricted with `allowedChats`.

**Per-key scoping.** The server enforces each key's `allowedIps` and `allowedSessions`.

- An IP-whitelisted key must allow the n8n host's IP.
- A session-restricted key is refused with `403` for operations on sessions outside its allow-list (servers before 0.24.0 answered `401`).
- Some surfaces are instance-level rather than per-session and refuse a session-scoped key with a `403` whatever its role: **Session > Create**, **Session > Get Proxy** (server ≥ 0.32.0), **Session > Update Proxy**, the **System** reads **Get Settings**, **Get Stats Overview** and **Get Message Stats**, and every **API Key** operation except **Validate**. **Session > Get Stats Overview** omits `memoryUsage` for non-admin and session-scoped keys (server ≥ 0.32.0).

**Chat-restricted keys.** `allowedChats` (server ≥ 0.23.6) is default-deny on routes without chat scope.

- On v0.25.0, Chat > List and Group > List return only allowed chats, and Message > List works when its Chat ID filter names an allowed chat.
- Allowed group reads and settings are available, and built-in System > Search enforces the allowlist (on server ≥ 0.32.0, `SEARCH_PROVIDER=auto` falls back to `builtin-fts` even when a search plugin is enabled; plugin-only search without built-in fallback is refused).
- The credential test, the Session dropdown, the OpenWA Trigger and API Key > Validate still return `403`, so supply the session ID with an expression for these action workflows.
- Other dropdowns depend on their route: chat and group pickers work, while routes without chat scope fail.
- The optional Quoted Message ID on sends remains refused; Reply can quote a message within its allowed chat.

## Quick start

1. Add an **OpenWA** node.
2. Select the **Message** resource and the **Send Text** operation.
3. Pick the **Session ID** from the dropdown, which lists the sessions on your server. It is the session's UUID, not its name, and a literal `default` resolves to nothing.
4. Enter the **Chat ID** (`628123456789@c.us`) and the **Message**.

> **Provisioning a session:** sessions are identified by a UUID, returned by **Create**, **Get Status** and **List All**. A full end-to-end flow is **Create → Start → Get QR** (scan) or **Request Pairing Code** (enter it on the phone), then wait for `session.authenticated`. The Trigger can listen for the `session.qr` and `session.authenticated` events; these session operations are what drive those state transitions.

### Example workflows

| Pattern | Flow |
| ------- | ---- |
| Auto-reply | `[OpenWA Trigger]` → `[IF: keyword]` → `[OpenWA: Send Text]` |
| Session monitor | `[OpenWA Trigger: session.disconnected]` → `[Slack: Alert]` |
| Lead capture | `[OpenWA Trigger]` → `[Google Sheets: Append]` → `[OpenWA: Send Text]` |

## OpenWA node

The action node. Choose a **Resource** and an **Operation** to call the gateway from a workflow step. Required API key roles are listed under [Roles and key restrictions](#roles-and-key-restrictions).

### Operations

Expand a resource to see what it offers. Operations that exist on one engine only are listed under [Engine support](#engine-support).

<details>
<summary><strong>API Key</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create an API key |
| Delete | Delete an API key |
| Get | Get an API key |
| List | List all API keys |
| Revoke | Revoke an API key |
| Update | Update an API key |
| Validate | Validate the credential in use |

</details>

<details>
<summary><strong>Automation Rule</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create an autoreply rule |
| Delete | Delete an autoreply rule |
| Get | Get an autoreply rule |
| List | List the autoreply rules of a session |
| Update | Update an autoreply rule |

</details>

<details>
<summary><strong>Call</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create Link | Create a shareable call link |
| Reject | Reject an incoming call |

</details>

<details>
<summary><strong>Catalog</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Get | Get the business catalog |
| Get Product | Get one catalog product |
| List Products | List catalog products |

</details>

<details>
<summary><strong>Channel</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create a channel |
| Delete | Permanently delete a channel this account owns |
| Demote Admin | Demote a channel admin back to a subscriber |
| Get | Get a channel |
| Get Messages | Get the messages of a channel |
| List | List followed channels |
| Mute | Mute or unmute a channel |
| Subscribe | Follow a channel by invite code |
| Transfer Ownership | Transfer channel ownership to another account |
| Unsubscribe | Unfollow a channel |

</details>

<details>
<summary><strong>Chat</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Archive | Archive or unarchive a chat |
| Clear Messages | Delete every message in a chat |
| Delete | Delete a chat |
| List | List all chats |
| Mark Read | Mark a chat as read |
| Mark Unread | Mark a chat as unread |
| Mute | Mute or unmute a chat |
| Pin | Pin or unpin a chat |
| Set State | Send a typing or recording indicator |

</details>

<details>
<summary><strong>Contact</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Block | Block a contact |
| Check Exists | Check if a number exists |
| Delete | Delete a contact from the addressbook |
| Get Info | Get contact information |
| Get LID | Look up the privacy ID of a phone number |
| Get Phone | Resolve a contact phone number |
| Get Profile Picture | Get a contact profile picture |
| Get Profile Pictures | Get profile pictures for many contacts |
| List | List all contacts |
| List Blocked | List blocked contacts |
| Save | Save a contact to the addressbook |
| Unblock | Unblock a contact |

</details>

<details>
<summary><strong>Group</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Add Participants | Add participants to a group |
| Approve Membership Requests | Approve pending join requests |
| Create | Create a group |
| Delete Picture | Remove the group picture |
| Demote Participants | Demote participants from admin |
| Get | Get group info including participants |
| Get Invite Code | Get the group invite code |
| Get Join Info | Preview a group from its invite code without joining |
| Get Membership Requests | List pending join requests |
| Get Picture | Get the group picture |
| Get Settings | Get group settings |
| Join | Join a group via invite code |
| Leave | Leave a group |
| List | List all groups |
| Promote Participants | Promote participants to admin |
| Reject Membership Requests | Reject pending join requests |
| Remove Participants | Remove participants from a group |
| Revoke Invite Code | Revoke the group invite code |
| Set Member Label | Set the member label in a group |
| Set Picture | Set the group picture |
| Update Description | Update the group description |
| Update Settings | Update group settings |
| Update Subject | Update the group subject |

</details>

<details>
<summary><strong>Label</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Add to Chat | Add a label to a chat |
| Create or Update | Create or update a label |
| Delete | Delete a label |
| Get | Get a label |
| Get Chats | Get every chat carrying a label |
| Get for Chat | Get the labels of a chat |
| List | List all labels |
| Remove From Chat | Remove a label from a chat |

</details>

<details>
<summary><strong>Media</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Check Availability | Check whether media conversion is available |
| Convert to Video | Convert video into a compatible format |
| Convert to Voice Note | Convert audio into a voice note |

</details>

<details>
<summary><strong>Message</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Cancel Batch | Cancel a bulk batch |
| Click Button | Click a button on a business prompt |
| Delete | Delete a message |
| Edit | Edit a sent message |
| Forward | Forward a message to another chat |
| Get Batch Status | Get bulk batch status |
| Get History | Get the message history of a chat |
| Get Media | Download the stored media of a message |
| Get Reactions | Get the reactions on a message |
| Get Receipts | Get the receipts on a message |
| List | List stored messages |
| Pin | Pin a message in its chat |
| React | React to a message |
| Reply | Reply to a message |
| Send Audio | Send an audio or voice message |
| Send Bulk | Send messages in bulk |
| Send Contact | Send a contact card |
| Send Document | Send a document |
| Send Image | Send an image |
| Send Location | Send a location |
| Send Poll | Send a poll |
| Send Product | Send a product card from the catalog |
| Send Sticker | Send a sticker |
| Send Template | Send a rendered template |
| Send Text | Send a text message |
| Send Video | Send a video |
| Star | Star or unstar a message |
| Unpin | Remove the pin from a message |
| Vote Poll | Cast a vote on a poll |

</details>

<details>
<summary><strong>Observability</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Check | Check server health |
| Check Liveness | Check the liveness probe |
| Check Readiness | Check the readiness probe |

</details>

<details>
<summary><strong>Presence</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Get | Get the last reported presence for a chat |
| Set Own Presence | Set whether the account appears online |
| Subscribe | Subscribe to presence updates for a chat |

</details>

<details>
<summary><strong>Profile</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Delete Picture | Remove the profile picture |
| Set Name | Set the profile display name |
| Set Picture | Set the profile picture |
| Set Status | Set the profile about text |

</details>

<details>
<summary><strong>Session</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create a new session |
| Delete | Delete a session |
| Force Kill | Force kill a stuck session |
| Get Config | Get the tunable configuration for a session |
| Get Proxy | Get the egress proxy for a session |
| Get QR | Get the QR code for authentication |
| Get Stats Overview | Get an overview of all sessions |
| Get Status | Get session status |
| List All | List all sessions |
| Log Out | Log out and unlink this device |
| Request Pairing Code | Request a phone pairing code |
| Start | Start a session |
| Stop | Stop a session |
| Update Config | Update the tunable configuration for a session |
| Update Proxy | Update the egress proxy for a session |

</details>

<details>
<summary><strong>Status</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Delete | Delete a status update |
| Get by Contact | Get the statuses of a contact |
| Get Media | Get the media of a status update |
| List | List the status feed |
| Send Image | Post an image status |
| Send Text | Post a text status |
| Send Video | Post a video status |
| Send Voice | Post an audio status as a voice note |

</details>

<details>
<summary><strong>System</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Get Audit Log | Get the audit log |
| Get Message Stats | Get message statistics |
| Get Session Stats | Get statistics for one session |
| Get Settings | Get the server settings |
| Get Stats Overview | Get an overview of the statistics |
| Search | Search messages across sessions |

</details>

<details>
<summary><strong>Template</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create a template |
| Delete | Delete a template |
| Get | Get a template |
| List | List all templates |
| Update | Update a template |

</details>

<details>
<summary><strong>Webhook</strong></summary>

| Operation | Description |
| --------- | ----------- |
| Create | Create a webhook |
| Delete | Delete a webhook |
| Get | Get a webhook |
| Get Delivery Failures | List failed webhook deliveries |
| List | List the webhooks of a session |
| List All | List webhooks across all sessions |
| Redrive Delivery Failures | Replay a bounded batch of retained failed deliveries |
| Test | Send a test delivery to a webhook |
| Update | Update a webhook |

</details>


### Output and errors

**List output and node versions.** A list operation (Session > List All, Chat > List, Contact > List, Group > List, Label > List, Webhook > List, and the rest that answer a bare array) emits **one item per row** on node version 2, the version a newly added node gets. `$json.<field>` then reads a row directly and Split Out is not needed.

- An empty list yields zero items and the downstream node does not run; enable **Always Output Data** where that matters.
- A node saved on any release up to and including 1.0.0 stays on version 1 across package upgrades and keeps the whole array on a single item, so an existing workflow reading `$json[0]` is unaffected.
- A node added while on 1.0.0 got the per-row output without a version of its own, so it returns to the whole array on upgrade; delete and re-add it to move it to version 2.
- Routes that answer an envelope, such as Message > List and System > Search, keep their shape on both versions, because flattening them would drop `total` and the other envelope fields.

**Failed items.** With **On Error** set to *Continue (using error output)*, a failed item reaches the error output with the input item's fields and an `error` that ends with the gateway's own reason, so an input field such as `message` is still there for a retry. With *Continue (regular output)* it stays on the main output as `error` plus that reason under `description`.

**Response shapes.** **Send Product** returns `{id, timestamp}` where every other send returns `{messageId, timestamp}`. The node passes the response through unchanged rather than normalising it, so the difference stays visible.

### Dropdowns

ID fields with a listing endpoint behind them offer a dropdown, in both nodes (including the Trigger's **Session Name or ID**). Each fetches a single page: up to 1000 entries where the route pages (sessions, groups, chats, contacts), and whatever the route returns where it does not (templates, labels, webhooks, channels, API keys). On an account with more than that, set the field from an expression instead of picking from the list.

- The **Label Name or ID** dropdown is whatsapp-web.js only, because the label listing behind it answers `501` on Baileys.
- Because the channel listing is whatsapp-web.js only, the Channel ID dropdown cannot populate on Baileys: supply the ID (`<digits>@newsletter`) from an expression there.
- A Baileys chat held under a privacy ID that has no name is listed by its phone number when the server reports one (server ≥ 0.31.0), and by its ID otherwise.

### Sending messages

**Message actions.** Reply, React and Delete act on an existing message identified by its full serialized ID (for example `true_628123456789@c.us_3EB0…`), the value returned by the send operations and delivered by the Trigger. React with an empty **Emoji** to remove your reaction; Delete defaults to revoking for everyone.

**Base64 media.** When sending an image, document or audio clip from a **Base64** source, also set the **MIME Type** field (for example `image/png`, `application/pdf`, `audio/ogg; codecs=opus`), because OpenWA requires a MIME type for base64 payloads. The **Binary** source fills it in automatically from the binary metadata, and the **URL** source needs nothing extra.

**Voice notes** (server ≥ 0.7.17). Send Audio has a **Send as Voice Note** toggle. When on, the clip is delivered as a true WhatsApp voice note (the microphone bubble with a waveform) instead of a plain audio file. Voice notes require `audio/ogg; codecs=opus` audio for reliable playback. Leave the toggle off (plain audio file) on older servers.

**Mentions.** An optional list of WhatsApp IDs (for example `628123456789@c.us`). For each one to render as an @mention, the message text or caption must also contain the matching `@628123456789` token. Send Audio and Send Sticker carry no text, so the tag notifies without anything visible.

- The floor differs by operation. **Send Text**, **Send Image**, **Send Video**, **Send Document**, **Send Sticker** and **Send Audio** have accepted it since server ≥ 0.7.14. **Reply**, **Edit** and **Send Template** need server ≥ 0.23.0. Leave the list empty on an older server.
- On **Edit** the list is re-applied rather than preserved, because an edit replaces the message content: name every ID the edited message should still tag, or leave it empty to drop the tags the original carried.

**Bulk send.** Provide **Messages (JSON)** as an array of up to 100 items. The media object nests under the `type` key, and `caption` sits alongside it on `content`:

```json
[
  { "chatId": "628123456789@c.us", "type": "text", "content": { "text": "Hello" } },
  { "chatId": "628123456789@c.us", "type": "image", "content": { "image": { "url": "https://example.com/a.jpg" }, "caption": "Hi" } }
]
```

Media (`image`, `video`, `audio`, `document`) uses `url` or `base64` (add `mimetype` for base64); there is no binary source in bulk. An item can also carry a `variables` object that fills `{{name}}` placeholders in its content, and `content.mentions` as on the single sends. Send Bulk returns a `batchId` immediately and sends in the background; poll **Get Batch Status** until the status is `completed`, `cancelled` or `failed`, or stop it early with **Cancel Batch**.

**Idempotent sends (v0.25.0).**

- Idempotency Key is optional on Send Text, Image, Video, Audio, Document, Sticker, Location, Contact, Poll, Template, Reply, Forward (server ≥ 0.25.0) and Click Button (server ≥ 0.32.0).
- Supply 1-255 visible ASCII characters without spaces, with a distinct key per intended message and session.
- Retrying the same route and body within 24 hours returns the first result without sending again. A changed request with the same key returns `422 IDEMPOTENCY_KEY_REUSED`; an in-progress or uncertain outcome returns `409`.
- Keep the same key on a retry and inspect an uncertain outcome before deciding whether to send again. The node never generates a key. Trigger delivery deduplication is configured separately.

**Message List filters (v0.25.0).**

- Since is inclusive and Until is exclusive, both using WhatsApp message time. Date values are converted to epoch milliseconds in the workflow timezone.
- Direction selects incoming or outgoing, Type is an exact stored token, and Message ID is the WhatsApp reference, distinct from the stored row ID used by After Row ID.
- Order By defaults to ingestion time (`createdAt`); `timestamp` orders by message time and excludes rows without one. Keep the selection and ordering unchanged while paging with a cursor.
- Poll choices and media omission markers are preserved in the returned envelope.

### Groups and status posts

**Groups.**

- Reads (List, Get, Get Settings) work with a plain API key, while **Get Invite Code** needs **OPERATOR** from server ≥ 0.23.5, since the code lets anyone join the group.
- Every write (create, join, leave, participant changes, subject, description and settings, and invite-code revoke) needs a key with the **OPERATOR** role, otherwise the server answers `403`.
- Add, Remove, Promote and Demote Participants report a per-participant outcome in `results[]`, and a partial refusal does *not* fail the batch, so check `results[].success` rather than the top-level `success`.
- **Update Settings** is partial: fields you leave out stay untouched. `ephemeralSeconds` is Baileys only (whatsapp-web.js returns `501`).

**Status posts.** WhatsApp Status is never posted to a group, so **Recipients** takes `@c.us` or `@lid` JIDs (max 256). The Baileys engine *requires* an explicit recipient list and is the only engine that honors it. whatsapp-web.js ignores the list entirely and posts to every contact whether one is supplied or not, so do not rely on it to limit the audience there.

### Sessions and webhooks

**Session configuration (v0.25.0).** Creating a session with a Proxy URL requires ADMIN; without a proxy, OPERATOR is sufficient, subject to key restrictions. The recognized config keys are validated at creation (server ≥ 0.24.0, capped at 16384 bytes of JSON from v0.27.1). An invalid value is rejected with `400`.

| Key | Accepts | Takes effect |
| --- | ------- | ------------ |
| `autoRejectCalls` | boolean | the next incoming call |
| `maxReconnectAttempts` | 0-20, or null for unlimited | the next Start |
| `reconnectBaseDelay` | 1000-300000 milliseconds | the next Start |
| `linkPreview` (server ≥ 0.30.3) | boolean, or null for the engine default | the next Send Text or Send Template that sets neither Link Preview nor a custom preview |

Update Config offers `linkPreview` as Link Preview: Engine Default sends null, Generate a Preview sends true, and No Preview sends false. A server older than 0.30.3 refuses the field with `400`; in the Session Config JSON of Create, an older server stores the key and ignores it.

**Webhook redrive (v0.25.0).** Redrive Delivery Failures requires ADMIN and server-side `WEBHOOK_FAILURE_PAYLOAD_RETENTION_HOURS > 0`. It replays one bounded batch of eligible terminal failures with retained payloads.

- Session ID, Webhook ID and Failure IDs narrow the selection. An explicit empty ID list replays nothing.
- Limit accepts 1-500; omitting the option uses the server default of 100, while adding it starts at 50.
- Each replay keeps the original event idempotency key, applies current subscription eligibility, and respects the calling key's session restrictions.
- Read `delivered`, `failed`, `skipped` and `remaining` from the result; redrive uses direct attempts, so `enqueued` stays zero.

### Engine support

Several operations exist on one engine only. The node says so on the field or resource wherever it can, rather than leaving a `501` to explain itself.

- **Baileys only:** Catalog, Send Product, Click Button, Group > Create, Presence > Subscribe, Call > Reject, and the label edits (Create or Update, and Delete).
- **whatsapp-web.js only:** Vote Poll, Message > Get Reactions, Message > Get Receipts, the Channel listing, Channel > Get Messages, and the label reads.
- **Both engines:** Label > Add to Chat and Remove From Chat.

### Observability, System and scope

**Check**, **Check Liveness** and **Check Readiness** return the server's health JSON as-is, so a workflow can alert on availability. **Check Readiness** is the one that also probes the database connections.

The **System** resource reads settings, statistics and the audit log. Settings are environment-derived and the server publishes no write route for them, so the resource reads them only. **Search** needs a search provider configured server-side, otherwise it answers `501`, and it can answer `502` or `503` when a plugin provider misbehaves or does not respond.

**Not offered.** The server's administration surface, which a workflow has no business driving, is deliberately left out: the infrastructure, plugin, ingress and integration controllers, the browser-session cookie endpoints (`/api/auth/session`, added in v0.32.0 for the dashboard), plus `/api/metrics`, which authenticates with its own bearer token rather than the API key this credential carries, so it could only ever answer `401` or `404` from here. **Send Catalog** is gone from the server entirely.

### Using as an AI tool

The OpenWA node can be attached to an AI agent as a tool. You choose the resource and operation when you build the workflow; the model only fills the fields you map to `$fromAI()`.

- Give the tool a key with the lowest role it needs, and restrict it with `allowedSessions` and `allowedChats`. Set Session ID yourself rather than leaving it to the model, and do not map the target ID of a destructive operation (Session > Delete, Group > Remove Participants, Webhook > Create or Update) to `$fromAI()`.
- Everything an operation returns becomes part of the model's context and is stored in the execution data like any other output. API Key > Create returns the new key in plaintext, and a key created without a Role is an OPERATOR key. Session > Get QR, Session > Request Pairing Code and Group > Get Invite Code return codes that grant access.
- Message > Get Media and Status > Get Media return a file, which an agent tool cannot carry; use them from a regular node.
- Webhook secrets, webhook headers and a session Proxy URL that carries credentials are saved as ordinary node parameters. They appear in the workflow JSON, in exports and Git sync, and in execution snapshots. Treat those as sensitive.

## OpenWA Trigger

Starts a workflow when the selected events arrive on your session. The node registers a session-scoped webhook with the gateway for you; see [Registration and server changes](#registration-and-server-changes).

### Events

| Event | Fires when | Availability |
| ----- | ---------- | ------------ |
| `message.received` | New incoming message | |
| `message.sent` | Message successfully sent | |
| `message.ack` | Message delivery or read acknowledgement | |
| `message.failed` | Message failed to send | |
| `message.revoked` | Message deleted for everyone | |
| `message.edited` | Message text or media caption edited | |
| `message.reaction` | Reaction added to or removed from a message | server ≥ 0.7.2 |
| `message.receipt` | One recipient received, read or played a group or Status message you sent | server ≥ 0.26.0, Baileys only. Select it by name: `*` does not include it |
| `poll.vote` | Someone voted on a poll or cleared their vote | server ≥ 0.26.0 on whatsapp-web.js; ≥ 0.30.2 on Baileys, and only for a poll whose creation message is still in the session's message store |
| `status.received` | A contact's Status (Story) received | |
| `session.status` | Session status changed | |
| `session.qr` | QR code generated for scanning | |
| `session.authenticated` | Session authenticated | |
| `session.disconnected` | Session lost connection | |
| `session.reconnect_loop` | Session stuck in a reconnect loop | server ≥ 0.10.0 |
| `session.restriction` | WhatsApp placed or lifted a restriction on the account | server ≥ 0.14.0 |
| `group.join` | Participant joined a group | |
| `group.leave` | Participant left a group | |
| `group.update` | Group metadata changed | |
| `group.join_request` | Someone asked to join an administered group | server ≥ 0.15.0 |
| `call.received` | Incoming call detected | Not reliable on whatsapp-web.js |
| `call.accepted` | Incoming call answered | server ≥ 0.14.0, Baileys only |
| `call.rejected` | Incoming call declined, including auto-reject | server ≥ 0.14.0, Baileys only |
| `call.missed` | Incoming call went unanswered | server ≥ 0.14.0, Baileys only |
| `presence.update` | Subscribed chat's presence changed | server ≥ 0.14.0, Baileys only. Needs `POST /presence/subscribe` first |
| `event.response` | RSVP to a WhatsApp event invitation | server ≥ 0.25.0, Baileys only |

### Server-side filters

The Trigger's optional **Filters** field is registered with the webhook, so the gateway drops non-matching events before delivering them and they never start a workflow execution. Supply it as JSON:

```json
{ "conditions": [{ "field": "isGroup", "operator": "is", "value": false }] }
```

- Conditions are ANDed, at most 20.
- Fields are `sender`, `recipient`, `body`, `type`, `isGroup`, `kind`, `chatId`, `fromMe`, `hasMedia` and `mentions`.
- `kind` (server ≥ 0.23.4) distinguishes `individual`, `group`, `channel`, `status`, `broadcast` and `unknown`; `isGroup: false` includes all non-group kinds. `chatId` (server ≥ 0.23.6) scopes a conversation.
- On v0.25.0, Message Ack and Message Failed also match a `chatId` or `kind` filter when their payload identifies the chat.
- An `is` condition suppresses a payload missing its ID, type or kind field; a sender filter therefore still suppresses acks without a sender.
- ID, mentions, type and kind values take non-empty arrays, `body` takes text, and boolean fields take real booleans.
- Filters narrow **message** events; `session.*`, `group.*`, `call.*`, `poll.vote` and `event.response` arrive regardless. A filtered-out delivery is silent.
- Changing a filter re-registers the webhook on the next activation. Activation removes other registrations using this Trigger URL, so give each filter set its own Trigger and URL.

### Signature verification

The Trigger has an optional **Webhook Secret**. When set, the secret is registered with OpenWA at webhook creation, and OpenWA signs every delivery with HMAC-SHA256 in the `X-OpenWA-Signature: sha256=<hex>` header. The node verifies each delivery against the raw request body and rejects (HTTP 401) any that fail.

Leave it empty to skip verification, in which case anyone who knows the Trigger's URL can start the workflow, so set one when the n8n instance is reachable from outside. The signature covers the body only and OpenWA sends no signed timestamp header, so a captured delivery can be replayed unless the workflow de-duplicates on `idempotencyKey`.

- **Secret length:** the secret must be between **16 and 255 characters**. The server enforces both bounds at registration (server ≥ 0.20.0; a short secret on an older server was already brute-forcible from one observed signature), and the node checks them before sending so the error names the field instead of surfacing a raw `400`. Webhooks registered with a short secret before the floor keep working until re-registered.
- **Changing the secret:** changing or clearing it, or changing the events or session, re-registers the webhook automatically on the next activation (deactivate and reactivate, or an n8n restart). No manual cleanup on the server is needed.
- **Raw body:** signature verification requires the raw request body, which all current n8n versions provide. On a severely outdated n8n that cannot supply it, signed deliveries are rejected with a logged warning; upgrade n8n or leave the secret empty.

### Trigger output

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

Payload notes:

- Each delivery is an envelope (`event`, `timestamp`, `sessionId`, `idempotencyKey`, `deliveryId`, …); the actual event payload is under `data`. Read message fields from `data` (for example `data.body`, `data.chatId`).
- Read the message identifier from `data.id` (incoming payloads use `id`, not `messageId`).
- De-duplicate on `idempotencyKey`, not `deliveryId`. `idempotencyKey` identifies the *event* and is reused across both retries and crash replays; `deliveryId` identifies a single *attempt* and is re-minted on every replay, so keying on it misses exactly the duplicate you are trying to catch.
- Message `type` is engine-neutral: voice notes are `voice`, shared contacts are `contact`, and plain chats are `text`.
- Forwarded messages carry `data.isForwarded: true` (omitted when not forwarded) and `data.forwardingScore` (when positive) on `message.received` and `message.sent` deliveries, and `isForwarded` / `forwardingScore` on **Message > Get History** items (server ≥ 0.29.1; stripped on `revoked` placeholders and not stored in **Message > List** rows).
- `session.restriction` deliveries (`data.kind`) and **Session > Get Status** / **List All** items (`restriction.kind`) report `reachout_timelock`, `tos_block`, `proxy_block` or `passkey_required`. `passkey_required` (server ≥ 0.30.0) means WhatsApp asks for a passkey to finish a Baileys device link, and it clears once the link reaches `ready`.
- **Check Exists** returns `whatsappId`, the engine-canonical chat id, which may differ from the number you sent (for example an `@lid` id).

### Duplicate deliveries

OpenWA guarantees at-least-once delivery: it retries a failed POST, and it replays any delivery stranded by a gateway crash. Both carry the same `idempotencyKey`, so the same event can reach n8n twice and would otherwise run the workflow twice. Enable **Deduplicate Deliveries** on the Trigger to drop repeats; the node remembers the 500 most recent idempotency keys (kept in workflow static data), falling back to `deliveryId` on a gateway too old to send one.

It is best-effort: n8n saves the record of seen events once per delivery, so deliveries that overlap can each miss the other, and a replay of one of them can then still run. The same happens when the workflow writes its own static data and an earlier run finishes after a later delivery arrived. Enable it when downstream actions are not idempotent.

> **n8n 2.19.2 to 2.45:** from n8n 2.19.2 (checked up to 2.45.3) the record of seen events is not saved, because n8n resets its change flag before it persists the Trigger's static data, so the option has no effect there. n8n 1.123.87 and 2.19.0 save it as described. n8n fixed this in 2.46 ([n8n-io/n8n#42081](https://github.com/n8n-io/n8n/pull/42081)); the fix is in the source of 2.46.4 and later. On the affected versions, de-duplicate downstream on `idempotencyKey`.

### Registration and server changes

The Trigger listens on a session-scoped webhook URL (`…/webhook/openwa-<sessionId>`), so several active workflows can each run a Trigger on the same n8n instance without colliding on one shared path.

- When you change the session, events, filters or secret, or when the URL shape changes across a package upgrade, the server-side webhook is re-registered automatically on the next activation.
- The Trigger also re-registers when the registration on the server no longer matches what the node created: deactivated, repointed at another URL, or subscribed to a different event set. `active`, `url` and `events` have been part of the webhook response since v0.4.0, so this needs nothing newer.
- Before changing the Server URL on credentials used by an active Trigger, deactivate the workflow while the original credentials are still configured, and verify that its webhook was removed from the original gateway. Activate it again after switching servers. If the URL was changed first, remove the leftover webhook from the original gateway manually.

## Compatibility

### Requirements

The nodes need an `n8n-workflow` that exports `NodeConnectionTypes` (1.83.0 or later, which ships with n8n 1.85.0 or later); with an older copy they fail to load. Requires an OpenWA server **≥ 0.16.0** for the base operations. The current contract target is **OpenWA v0.32.0**; newer operations, fields and events have their own floors below. CI verifies the contract fixture against source pinned to release commit `0be1e960d52741befca89cc6b985f6a634c38553`.

### Operation floors

| Operation or feature | Needs server |
| -------------------- | ------------ |
| Most operations | ≥ 0.14.0 |
| Membership requests, blocklist reads and session config | ≥ 0.15.0 |
| Call > Create Link (sets the base floor) | ≥ 0.16.0 |
| Session > Get Proxy and Update Proxy | ≥ 0.23.4 |
| Message > Click Button | ≥ 0.23.6 |
| Webhook > Redrive Delivery Failures | ≥ 0.25.0 |
| Group > Set Member Label | ≥ 0.27.0 |
| Contact > Get LID | ≥ 0.27.1 |
| Message > Get Receipts | ≥ 0.28.0 |

These operations return `404` on servers predating their route.

### Event floors

The event catalog includes all 26 events of v0.32.0, and the Availability column of the [events table](#events) lists the server floor of each.

- Subscribing to an event an older server does not recognize fails registration with `400`.
- The default subscription stays `message.received`, and a subscription to `*` does not include `message.receipt`.
- The Trigger alone still works against much older servers if you subscribe only to events that existed then; its webhook contract and HMAC verification landed in v0.4.0.

### Optional fields

A few **optional fields** need a server newer than the badge. They are opt-in, so a workflow that leaves them alone runs against any server at or above the floor, but filling one in against an older server returns a `400`, because the server rejects a request body carrying a field it does not know.

| Field | Where | Needs |
| ----- | ----- | ----- |
| **Idempotency Key** | Message > Click Button | server ≥ 0.32.0 |
| **Link Preview (Config Fields)** | Session > Update Config | server ≥ 0.30.3 |
| **Thumbnail URL / Thumbnail Base64** | Message > Send Text (Custom Link Preview) | server ≥ 0.27.0 |
| **Match** | System > Search | server ≥ 0.27.0 |
| **Since / Until / Direction / Order By / Type / Message ID** | Message > List | server ≥ 0.25.0 |
| **Idempotency Key** | twelve single-recipient sends | server ≥ 0.25.0 |
| **Quoted Message ID** | the nine single-message sends | server ≥ 0.17.0 |
| **Message IDs** | Chat > Mark Read | server ≥ 0.23.0 |
| **Mentions** | Message > Edit, Reply and Send Template | server ≥ 0.23.0 |
| **Link Preview** | Message > Send Template | server ≥ 0.23.0 |
| **After Row ID** | Message > List | server ≥ 0.23.4 |
| **Inline Media** | Message > List | server ≥ 0.23.4 |
| **`kind` filter field** | Trigger Filters, Webhook > Create / Update | server ≥ 0.23.4 |
| **Name** | Session > List All | server ≥ 0.23.5 |
| **Allowed Chats** | API Key > Create / Update | server ≥ 0.23.6 |
| **`chatId` filter field** | Trigger Filters, Webhook > Create / Update, Automation Rule conditions | server ≥ 0.23.6 |

- Query parameters behave differently on older servers: After Row ID, Inline Media, Name, Match and the six v0.25.0 Message List filters can be ignored, so a request may read a broader selection or use older pagination. Idempotency Key is an HTTP header older servers ignore, so retry protection requires v0.25.0 (v0.32.0 for Click Button). The `kind` and `chatId` filter fields are validated when the webhook or rule is saved and are refused if unsupported.
- Existing operations keep their earlier server floors when the newer optional fields are left unset. Engine-specific limitations are described on the relevant operation.

## Development

```bash
npm install          # install dependencies
npm run build        # compile TypeScript and copy icons
npm run dev          # watch mode
npm run lint         # ESLint (.eslintrc.js)
npm run format       # format with Prettier
npm run check:openwa # compare the contract with pinned upstream source
npm test             # build, then run the unit tests (route mapping, guards, trigger delivery, webhook lifecycle)
```

- Linting uses the legacy `.eslintrc.js`, which extends `eslint:recommended`. It is the only ESLint config in the repository.
- The contract check downloads seventeen source files from the pinned release commit. For offline verification, run `npm run check:openwa -- /path/to/OpenWA` against a checkout of v0.32.0. Unit tests use the checked-in fixture and run without an upstream checkout.
- CI also runs the n8n Creator Portal scanner (see `scripts/n8n-scan.mjs`), which pins the portal's own, newer rule versions.

## Contributing

Contributions are welcome: fixes, new operations and documentation.

1. Fork the repository and branch from `main`.
2. Make the change with tests under `test/`, and run `npm test`.
3. Run `npm run build` and commit the updated `dist/` with your change. GitHub installs serve the committed `dist/`, and CI fails when it differs from a fresh build.
4. Use a [Conventional Commits](https://www.conventionalcommits.org/) title such as `feat: ...` or `fix: ...`. CI lints it, and the release version and changelog are derived from it.
5. Open a pull request describing what changed and the OpenWA version you tested against.

## Resources

- [OpenWA Project](https://github.com/rmyndharis/OpenWA): the WhatsApp API Gateway these nodes connect to
- [OpenWA Documentation](https://docs.open-wa.org)
- [API Reference](https://docs.open-wa.org/api-reference)
- [n8n Integration Guide](https://docs.open-wa.org/integrations/n8n)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [npm package](https://www.npmjs.com/package/@rmyndharis/n8n-nodes-openwa)
- [Report a bug or request a feature](https://github.com/rmyndharis/OpenWA-n8n/issues)

## Support

If these nodes save you time, you can support OpenWA development by buying me a coffee.

<a href="https://buymeacoffee.com/rmyndharis"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" height="50"/></a>

## License

[MIT](LICENSE) © Yudhi Armyndharis & OpenWA Contributors.

<div align="center">
<sub>Built for <a href="https://github.com/rmyndharis/OpenWA">OpenWA</a>, the free, self-hosted WhatsApp API Gateway.</sub>
</div>
