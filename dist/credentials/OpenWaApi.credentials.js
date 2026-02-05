"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaApi = void 0;
class OpenWaApi {
    constructor() {
        this.name = 'openWaApi';
        this.displayName = 'OpenWA API';
        this.documentationUrl = 'https://github.com/rmyndharis/OpenWA';
        this.icon = 'file:openwa.svg';
        this.properties = [
            {
                displayName: 'Server URL',
                name: 'serverUrl',
                type: 'string',
                default: 'http://localhost:2785',
                placeholder: 'https://wa.yourserver.com',
                description: 'The URL of your OpenWA server (without trailing slash or /api)',
                required: true,
            },
            {
                displayName: 'API Key',
                name: 'apiKey',
                type: 'string',
                typeOptions: {
                    password: true,
                },
                default: '',
                description: 'The API key from your OpenWA dashboard',
                required: true,
            },
        ];
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'X-API-Key': '={{$credentials.apiKey}}',
                },
            },
        };
        this.test = {
            request: {
                baseURL: '={{$credentials.serverUrl}}',
                url: '/api/health',
                method: 'GET',
            },
        };
    }
}
exports.OpenWaApi = OpenWaApi;
//# sourceMappingURL=OpenWaApi.credentials.js.map