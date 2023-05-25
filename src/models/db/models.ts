export class Tables {
    static User = "users";
    static UserToken = "user_tokens";
    static UserClient = "user_clients";
    static Data = "data";
    static SyncData = "sync_data";
}

export class UserToken {
    clientid?: string;
    token?: string;
    refreshtoken?: string;
    lastrefresh?: number;
}

export class User {
    id?: number;
    name?: string;
    email?: string;
    password?: string;
    salt?: string;
}

export class UserClient {
    id?: number;
    clientid?: string;
    userid?: number;
    clientdetails?: ClientDetails;
    lastsync?: number;
    syncing?: number | null;
}

export interface Data {
    rowguid: string;
    json: string;
}

export interface ClientDetails {
    name: string;
    systemName: string;
    systemVersion: string;
    model: string;
}
