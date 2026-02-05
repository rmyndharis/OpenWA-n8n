"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = exports.OpenWa = exports.OpenWaApi = void 0;
// Credentials
var OpenWaApi_credentials_1 = require("./credentials/OpenWaApi.credentials");
Object.defineProperty(exports, "OpenWaApi", { enumerable: true, get: function () { return OpenWaApi_credentials_1.OpenWaApi; } });
// Nodes
var OpenWa_node_1 = require("./nodes/OpenWa/OpenWa.node");
Object.defineProperty(exports, "OpenWa", { enumerable: true, get: function () { return OpenWa_node_1.OpenWa; } });
var OpenWaTrigger_node_1 = require("./nodes/OpenWaTrigger/OpenWaTrigger.node");
Object.defineProperty(exports, "OpenWaTrigger", { enumerable: true, get: function () { return OpenWaTrigger_node_1.OpenWaTrigger; } });
//# sourceMappingURL=index.js.map