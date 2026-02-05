import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class OpenWaApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    icon: "file:openwa.svg";
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
