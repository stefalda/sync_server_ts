import * as fs from 'fs';
import handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import * as configJson from '../../config.json';
// https://blog.tericcabrel.com/send-email-nodejs-handlebars-amazon-ses/
type EmailClientArgs<TemplateData> = {
    to: string;
    subject: string;
    templatePath: string;
    templateData: TemplateData;
};

const sendMail = async <TemplateData>(data: EmailClientArgs<TemplateData>) => {
    const fromName = configJson.email.from;
    const fromEmailAddress = configJson.email.fromEmail;
    const smtpHost = configJson.email.smtp ?? '';
    const smtpPort = parseInt(configJson.email.port ?? '587', 10);
    const smtpUser = configJson.email.username ?? '';
    const smtpPassword = configJson.email.password ?? '';

    try {
        const smtpTransport: Mail = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            auth: {
                user: smtpUser,
                pass: smtpPassword,
            },
        });

        const source = fs.readFileSync(data.templatePath, { encoding: 'utf-8' });
        const template: HandlebarsTemplateDelegate<TemplateData> = handlebars.compile(source);
        const html: string = template(data.templateData);

        const updatedData: Mail.Options = {
            to: data.to,
            html,
            from: `${fromName} <${fromEmailAddress}>`,
            subject: data.subject,
        };

        smtpTransport.sendMail(updatedData).then((result: nodemailer.SentMessageInfo): void => {
            console.info(result);
        });
    } catch (e) {
        console.error(e);
    }
};

export { sendMail };
