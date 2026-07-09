import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class OpenWaApi implements ICredentialType {
  name = 'openWaApi';
  displayName = 'OpenWA API';
  documentationUrl = 'https://github.com/rmyndharis/OpenWA';
  icon = 'file:openwa.svg' as const;

  properties: INodeProperties[] = [
    {
      displayName: 'Server URL',
      name: 'serverUrl',
      type: 'string',
      default: 'http://localhost:2785',
      placeholder: 'https://wa.yourserver.com',
      description:
        'The URL of your OpenWA server (without trailing slash or /api). Use HTTPS in production.',
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

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.serverUrl}}',
      // Authenticated, side-effect-free endpoint so an invalid API key fails the test.
      // /api/health is public and would accept any key as valid.
      url: '/api/sessions',
      method: 'GET',
    },
  };
}
