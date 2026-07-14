import * as configJson from '../config.json';
import { logger } from './helpers/logger';
import { useJWT } from './middleware/authorization';
import base from './routes/base';
import login from './routes/login';
import sync from './routes/sync';

const express = require('express');
const cors = require('cors');
const compression = require('compression')
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Wraps async route handlers so rejected promises reach the Express error handler
// instead of causing unhandled rejections (Node 15+ crashes on unhandled rejections).
function wrapAsync(fn: Function) {
    return (req: any, res: any, next: any) => {
        fn(req, res, next).catch(next);
    };
}

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const syncLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Factory function for testability: returns the configured Express app without starting it.
// Tests import createApp() and use supertest to make HTTP assertions without a real port.
// Previously app.listen() was at module top-level, so importing main.ts in tests would
// start a server on port 3000 as a side effect.
export function createApp() {
    const app = express();
    app.use(cors());

    // Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
    app.use(helmet());

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    app.use(compression());
    app.use("/", base);

    // Apply rate limiters
    app.use("/login", authLimiter);
    app.use("/register", authLimiter);
    app.use("/password", authLimiter);
    app.use("/pull", syncLimiter);
    app.use("/push", syncLimiter);
    app.use("/cancelSync", syncLimiter);

    app.use("/", login);
    app.use("/", sync);

    // Global error handler: catches errors from async route handlers
    app.use((err: any, _req: any, res: any, _next: any) => {
        logger.error(err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    });

    return app;
}

const app = createApp();

// Guard: only start the server when run directly (node src/main.ts), not when imported by tests
if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, function () {
        logger.info(`Sync Server listening on port ${port}!`);
        logger.info('Realm configured:');
        const realms = configJson.db.realms as any;
        for (const realm of Object.keys(configJson.db.realms)) {
            logger.info(` -  ${realm} : ${realms[realm]}`);
        }
        logger.info("Authentication type: " + (useJWT ? 'JWT' : 'Token'));
    });
}

// Required by client connections (Dart VM, etc.) — masks MaxListenersExceededWarning
// for legitimate concurrent connections. Not indicative of a leak in this context.
process.setMaxListeners(50);

