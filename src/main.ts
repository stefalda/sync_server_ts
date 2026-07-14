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

export function createApp() {
    const app = express();
    app.use(cors());

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));
    app.use(compression());
    app.use("/", base);
    app.use("/", login);
    app.use("/", sync);

    return app;
}

const app = createApp();

if (require.main === module) {
    const port = process.env.PORT || 3000;
    app.listen(port, function () {
        logger.info(`Sync Server listening on port ${port}!`);
        logger.info('Realm configured:');
        const realms = configJson.db.realms as any;
        for (let realm in configJson.db.realms) {
            logger.info(` -  ${realm} : ${realms[realm]}`);
        }
        logger.info("Authentication type: " + (useJWT ? 'JWT' : 'Token'));
    });
}

process.setMaxListeners(50);

