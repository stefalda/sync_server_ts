import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveTemplatePath } from '../../src/helpers/email_client';

/**
 * Regressione: in produzione il percorso del template puntava a
 * `dist/src/email-template`, che non esiste → ogni email (incluso il PIN di reset
 * password) falliva con ENOENT.
 */
describe('resolveTemplatePath', () => {
    it('trova i template esistenti (it e default)', () => {
        for (const file of ['change_password.html', 'change_password_it.html']) {
            const resolved = resolveTemplatePath(file);
            expect(fs.existsSync(resolved), `template mancante: ${resolved}`).toBe(true);
        }
    });

    it('rispetta EMAIL_TEMPLATE_DIR quando configurata', () => {
        const previous = process.env.EMAIL_TEMPLATE_DIR;
        process.env.EMAIL_TEMPLATE_DIR = `${process.cwd()}/src/email-template`;
        try {
            const resolved = resolveTemplatePath('change_password.html');
            expect(resolved).toContain('src/email-template/change_password.html');
            expect(fs.existsSync(resolved)).toBe(true);
        } finally {
            if (previous === undefined) delete process.env.EMAIL_TEMPLATE_DIR;
            else process.env.EMAIL_TEMPLATE_DIR = previous;
        }
    });
});
