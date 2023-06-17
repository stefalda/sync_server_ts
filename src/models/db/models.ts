export class Tables {
    static User = "users";
    static UserToken = "user_tokens";
    static UserClient = "user_clients";
    static Data = "data";
    static SyncData = "sync_data";
    static UserPin = "users_pin";

}

export class UserToken {
    clientid?: string;
    token?: string;
    refreshtoken?: string;
    lastrefresh?: number;
}

export class User {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    salt?: string;
    language?: string;
}

export class UserClient {
    id?: number;
    clientid?: string;
    userid?: string;
    clientdetails?: ClientDetails;
    lastsync?: number;
    syncing?: number | null;
}

export class UserPin {
    userid?: string;
    pin?: string;
    created?: number;
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
