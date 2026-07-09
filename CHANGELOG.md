# Changelog

## [0.7.2](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.7.1...v0.7.2) (2026-07-09)


### Bug Fixes

* move source to root credentials/nodes per n8n convention ([#26](https://github.com/rmyndharis/OpenWA-n8n/issues/26)) ([b9778e1](https://github.com/rmyndharis/OpenWA-n8n/commit/b9778e1688d82371ab8fd0d9007fbe74bc251daa))

## [0.7.1](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.7.0...v0.7.1) (2026-07-09)


### Bug Fixes

* satisfy n8n community-node package requirements ([#24](https://github.com/rmyndharis/OpenWA-n8n/issues/24)) ([00efab8](https://github.com/rmyndharis/OpenWA-n8n/commit/00efab8126ec6dad925bce7d7ea9d507d863ffb4))

## [0.7.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.6.0...v0.7.0) (2026-07-09)


### Features

* add session lifecycle ops, fix webhook update, publish with provenance ([#22](https://github.com/rmyndharis/OpenWA-n8n/issues/22)) ([ec5b669](https://github.com/rmyndharis/OpenWA-n8n/commit/ec5b669bea71a26310e0118d27bf4f7ca78b7043))

## [0.6.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.5.0...v0.6.0) (2026-07-02)


### Features

* expand OpenWA operations and harden webhook re-registration ([#18](https://github.com/rmyndharis/OpenWA-n8n/issues/18)) ([cbcb950](https://github.com/rmyndharis/OpenWA-n8n/commit/cbcb9506f15a319003ab03bff5abf1737b4b05fa))


### Bug Fixes

* correct bulk-send content docs and guard empty webhook update events ([#20](https://github.com/rmyndharis/OpenWA-n8n/issues/20)) ([c044895](https://github.com/rmyndharis/OpenWA-n8n/commit/c04489547badec07316139e30657e6928a86464a))

## [0.5.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.4.0...v0.5.0) (2026-07-01)


### Features

* add Send Audio operation with WhatsApp voice note (PTT) support ([b16cf93](https://github.com/rmyndharis/OpenWA-n8n/commit/b16cf93405308be03eed8d7a9feda1b0301dc895))

## [0.4.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.3.0...v0.4.0) (2026-07-01)


### Features

* add optional [@mentions](https://github.com/mentions) to send operations; verify OpenWA v0.7.16 compatibility ([bd19a4d](https://github.com/rmyndharis/OpenWA-n8n/commit/bd19a4dce4d5dd03efebf413985aec305a0f1228))

## [0.3.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.2.1...v0.3.0) (2026-06-24)


### Features

* sync webhook events, preserve item lineage, and harden webhook handling ([bf27433](https://github.com/rmyndharis/OpenWA-n8n/commit/bf27433633708215cda2b0b675d69c413b56a802))

## [0.2.1](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.2.0...v0.2.1) (2026-06-20)


### Bug Fixes

* align node with OpenWA 0.4.5 API changes ([9e7fbfb](https://github.com/rmyndharis/OpenWA-n8n/commit/9e7fbfb5fb959517e82e61dfd2e0f66570a7b2ca))
* align node with OpenWA 0.4.5 API changes ([4925c2c](https://github.com/rmyndharis/OpenWA-n8n/commit/4925c2c0850d095920dee9b3badd41ba647edbc5))

## [0.2.0](https://github.com/rmyndharis/OpenWA-n8n/compare/v0.1.1...v0.2.0) (2026-06-18)


### Features

* support a webhook secret in the action node Create Webhook operation ([7f0b62c](https://github.com/rmyndharis/OpenWA-n8n/commit/7f0b62ccf61aaffa961878f25b3facd344fca69d))


### Bug Fixes

* sync webhook events and HMAC verification with OpenWA v0.4.0 ([78ebaf7](https://github.com/rmyndharis/OpenWA-n8n/commit/78ebaf78af52fe0922979b6508f42ed9a02f92e7))
* sync webhook events and HMAC verification with OpenWA v0.4.0 ([379c703](https://github.com/rmyndharis/OpenWA-n8n/commit/379c703aaa7005cb62aa3cacb8b401823866758a)), closes [#1](https://github.com/rmyndharis/OpenWA-n8n/issues/1)

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
