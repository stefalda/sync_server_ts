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
        public user: RegistrationData) { }
}