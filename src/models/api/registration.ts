
/**
 *  "password": "sandman",
            "newRegistration": true,
            "clientId": "e64bec40-eb61-4fb8-a2d0-532925c6df2f",
            "email": "stefano.falda@gmail.com",
            "deleteRemoteData": false,
            "name": "ste",
            "clientDescription": "{\"name\":\"Stefano’s MacBook Pro\",\"systemName\":\"MACOS\",\"systemVersion\":\"Version 13.3.1 (a) (Build 22E772610a)\",\"model\":\"MacBookPro18,1\"}"
 */
export interface RegistrationData {
    name?: string;
    email: string;
    password: string;
    language: string;
    clientId: string;
    clientDescription: string;
    newRegistration: boolean;
    deleteRemoteData?: boolean;
}

export interface LoginData {
    clientId: string;
}

export interface PasswordChangeData {
    email: string;
    password: string;
    pin: string;
}

export class RegistrationResult {
    constructor(public message: string,
        public user: RegistrationData) { };
}