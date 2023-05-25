export interface SyncDataRequest {
    clientId: string;
    lastSync: number,
    changes: Array<SyncData>
}

export interface SyncData {
    operation: string;
    rowguid: string;
    tablename: string;
    clientdate: number;
    serverdate?: number;
    //id?: number;
    //userid?: number;
    clientid?: string;
    rowData: any;
}

export class SyncDataPullResponse {
    lastSync: number = 0;
    outdatedRowsGuid: Array<string> = [];
    data: Array<SyncData> = [];

    constructor(public clientId: string) { }
}


export class SyncDataPushResponse {
    constructor(public lastSync: number) { }
}