import * as express from 'express';
import * as configJson from '../config.json';



/*import { DatabaseRepository } from './helpers/database_repository';
import admin from './routes/admin';
import api_scraper from './routes/api_scraper';
*/
import * as cors from 'cors';
import { logger } from './helpers/logger';
import base from './routes/base';
import login from './routes/login';
import sync from './routes/sync';
import morgan = require('morgan');
const app = express();
app.use(cors());
// Log calls
// app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms - :remote-addr - :remote-user', { stream: accessLogStream }));
// Stream option for morgan to log using winston
const morganStream = {
    write: (message) => logger.info(message.trim())  // Use 'info' log level
};

// Use morgan middleware with winston stream
app.use(morgan('combined', { stream: morganStream }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// add router in the Express app.
app.use("/", base);

// Register & Login
app.use("/", login);

// Sync
app.use("/", sync);


// Default to port 3000 but allow a PORT variable to be set
// es. PORT=8000 npm run serve
const port = process.env.PORT || 3000;


app.listen(port, function () {
    logger.info(`Sync Server listening on port ${port}!`);
    logger.info('Realm configured:');
    const realms = configJson.db.realms as any;
    for (let realm in configJson.db.realms) {
        logger.info(` -  ${realm} : ${realms[realm]}`);
    }
});

process.setMaxListeners(50);
//DatabaseRepository.checkDB();

