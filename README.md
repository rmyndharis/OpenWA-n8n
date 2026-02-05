# n8n-nodes-openwa

Official n8n community nodes for [OpenWA](https://github.com/rmyndharis/OpenWA) - Self-hosted WhatsApp API Gateway.

This package provides two nodes:
- **OpenWA** - Execute operations like sending messages, checking contacts, managing webhooks
- **OpenWA Trigger** - Start workflows when WhatsApp events occur (incoming messages, session status changes)

## Installation

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-openwa` and agree to the risks
4. Restart n8n

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-openwa
```

## Credentials

You need to configure OpenWA API credentials:

| Field | Description |
|-------|-------------|
| **Server URL** | Your OpenWA server URL (e.g., `https://wa.example.com`) |
| **API Key** | API key from your OpenWA dashboard |

## Nodes

### OpenWA Node

Execute operations on your OpenWA server.

#### Resources & Operations

| Resource | Operation | Description |
|----------|-----------|-------------|
| **Session** | Get Status | Get the status of a session |
| **Session** | List All | List all sessions |
| **Message** | Send Text | Send a text message |
| **Message** | Send Image | Send an image (URL or Base64) |
| **Message** | Send Document | Send a document/file |
| **Message** | Send Location | Send a location pin |
| **Contact** | Check Exists | Check if a number is on WhatsApp |
| **Contact** | Get Info | Get contact information |
| **Webhook** | Create | Create a webhook |
| **Webhook** | Delete | Delete a webhook |

#### Example: Send Text Message

1. Add an **OpenWA** node
2. Select **Message** resource and **Send Text** operation
3. Configure:
   - **Session ID**: `default` (or your session name)
   - **Chat ID**: `628123456789@c.us`
   - **Message**: `Hello from n8n!`

### OpenWA Trigger Node

Start workflows when events occur on your WhatsApp session.

#### Supported Events

| Event | Description |
|-------|-------------|
| `message.received` | New incoming message |
| `message.sent` | Message successfully sent |
| `session.connected` | Session authenticated |
| `session.disconnected` | Session lost connection |
| `session.qr_ready` | QR code generated for scanning |

#### Example: Auto-reply Workflow

1. Add an **OpenWA Trigger** node
2. Configure:
   - **Session ID**: `default`
   - **Events**: `Message Received`
3. Connect to an **OpenWA** node to send a reply

#### Trigger Output Data

```json
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "sessionId": "default",
  "data": {
    "messageId": "3EB0F5A2B4C...",
    "chatId": "628123456789@c.us",
    "from": "628123456789@c.us",
    "body": "Hello!",
    "type": "text",
    "timestamp": 1705312200
  }
}
```

## Example Workflows

### Auto-reply to Messages

```
[OpenWA Trigger] → [IF: Check keyword] → [OpenWA: Send Text]
```

### Session Monitoring

```
[OpenWA Trigger: session.disconnected] → [Slack: Send Alert]
```

### Lead Collection

```
[OpenWA Trigger] → [Google Sheets: Append Row] → [OpenWA: Send Text]
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Lint
npm run lint

# Format
npm run format
```

## Links

- [OpenWA Repository](https://github.com/rmyndharis/OpenWA)
- [OpenWA Documentation](https://github.com/rmyndharis/OpenWA/tree/main/_docs)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

MIT
