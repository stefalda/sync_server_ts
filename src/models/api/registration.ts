export interface Registration {
    name: string;
    email: string;
    password: string;
    clientId: string;
    clientDescription: string;
    newRegistration: boolean;
    deleteRemoteData: boolean;
}

export class RegistrationResult {
    constructor(public message: string,
        public user: Registration) { };
}