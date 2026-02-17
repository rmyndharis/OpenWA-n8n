# Changelog

## [0.1.1](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.1.0...v0.1.1) (2026-02-17)

### Security

* add webhook secret authentication for trigger node ([#1](https://github.com/rmyndharis/OpenWA-n8n/issues/1))
* sanitize all URL path parameters to prevent path traversal injection
* default credential server URL to HTTPS instead of HTTP

### Bug Fixes

* add fallback error for unhandled resource/operation combinations
* validate webhook ID extraction from API response in trigger lifecycle
* propagate errors in webhook `create()` instead of silently returning false
* only ignore 404 errors in webhook `delete()`, rethrow other errors
* validate session ID, chat ID, phone number, and contact ID inputs
* validate events array is not empty before creating webhook
* omit empty caption and location name from request body

### Features

* add binary data support for sendImage and sendDocument operations
* add `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` to devDependencies

## [0.1.0](https://github.com/rmyndharis/OpenWA-n8n/releases/tag/v0.1.0) (2025-01-01)

### Features

* initial release with OpenWA node and OpenWA Trigger node
* session management (get status, list all)
* message operations (send text, image, document, location)
* contact operations (check exists, get info)
* webhook management (create, delete)
