import type { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class OpenWa implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: Record<string, (this: ILoadOptionsFunctions) => Promise<INodePropertyOptions[]>>;
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
