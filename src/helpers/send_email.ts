import { sendMail, resolveTemplatePath } from "./email_client";

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
        templatePath: resolveTemplatePath(`${template}.html`),
        to: email,
    });
}

