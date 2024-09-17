import * as path from 'node:path';
import { sendMail } from "./email_client";

type ConfirmEmailPayload = {
    name: string;
    app: string;
    pin: string;
};

export async function sendPin(name: string, email: string, app: string, pin: string, language: string) {
    const templateData: ConfirmEmailPayload = {
        name,
        app,
        pin
    };
    const template = (language.toLowerCase()) == "it" ? "change_password_it" : "change_password";
    await sendMail<ConfirmEmailPayload>({
        subject: 'Change password',
        templateData,
        templatePath: path.join(__dirname, `./../email-template/${template}.html`),
        to: email,
    });
}

