import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import * as Mail from 'nodemailer/lib/mailer';
import * as configJson from '../../config.json';

type EmailClientArgs<TemplateData> = {
    to: string;
    subject: string;
    templatePath: string;
    templateData: TemplateData;
};

// Module-level SMTP transport singleton: created once, reused across calls.
// Previously a new transport (TCP + TLS handshake) was created per email,
// adding 100-500ms overhead each time.
const fromName = configJson.email.from;
const fromEmailAddress = configJson.email.fromEmail;
const smtpHost = configJson.email.smtp ?? '';
const smtpPort = parseInt(configJson.email.port ?? '587', 10);
const smtpUser = configJson.email.username ?? '';
const smtpPassword = configJson.email.password ?? '';

let transport: Mail | null = null;

function getTransport(): Mail {
    if (!transport) {
        transport = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            auth: {
                user: smtpUser,
                pass: smtpPassword,
            },
        });
    }
    return transport;
}

/**
 * Risolve il percorso di un template.
 *
 * In sviluppo i file stanno in `src/email-template`; nella build finiscono in `dist/src/...`
 * ma **la cartella dei template non viene copiata sotto dist**, quindi il vecchio
 * `path.join(__dirname, '../email-template/...')` puntava a `dist/src/email-template`
 * e ogni invio falliva con ENOENT (PIN di reset mai recapitato in produzione).
 *
 * Ordine: `EMAIL_TEMPLATE_DIR`, poi i percorsi noti (build e sorgente), infine `cwd`.
 */
function resolveTemplatePath(fileName: string): string {
    const candidates = [
        process.env.EMAIL_TEMPLATE_DIR
            ? path.join(process.env.EMAIL_TEMPLATE_DIR, fileName)
            : null,
        path.join(__dirname, '../../../src/email-template', fileName), // dist/src/helpers → /app/src/email-template
        path.join(__dirname, '../../email-template', fileName),
        path.join(process.cwd(), 'src/email-template', fileName),
    ].filter((c): c is string => !!c);
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return candidates[0];
}

// Template cache: compiled Handlebars templates keyed by file path.
// Prevents repeated readFileSync + compile calls for the same template.
const templateCache = new Map<string, HandlebarsTemplateDelegate<unknown>>();

function getTemplate<TemplateData>(templatePath: string): HandlebarsTemplateDelegate<TemplateData> {
    let template = templateCache.get(templatePath);
    if (!template) {
        const source = fs.readFileSync(templatePath, { encoding: 'utf-8' });
        template = handlebars.compile(source);
        templateCache.set(templatePath, template);
    }
    return template as HandlebarsTemplateDelegate<TemplateData>;
}

const sendMail = async <TemplateData>(data: EmailClientArgs<TemplateData>) => {
    // Outer try/catch removed — let errors propagate to caller
    const smtpTransport = getTransport();
    const template = getTemplate<TemplateData>(data.templatePath);
    const html: string = template(data.templateData);

    const updatedData: Mail.Options = {
        to: data.to,
        html,
        from: `${fromName} <${fromEmailAddress}>`,
        subject: data.subject,
    };

    // Previously fire-and-forget with .then(). Now awaited so errors propagate.
    await smtpTransport.sendMail(updatedData);
};

function closeTransport(): void {
    if (transport) {
        transport.close();
        transport = null;
    }
}

export { sendMail, closeTransport, resolveTemplatePath };
