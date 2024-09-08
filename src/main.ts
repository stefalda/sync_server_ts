import express from 'express';
import morgan from 'morgan';
import path from 'path';
import * as rfs from 'rotating-file-stream';

// create a rotating write stream
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // rotate daily
    path: path.join(__dirname, '..', 'log')
});


/*import { DatabaseRepository } from './helpers/database_repository';
import admin from './routes/admin';
import api_scraper from './routes/api_scraper';
*/
import cors from 'cors';
import base from './routes/base';
import login from './routes/login';
import sync from './routes/sync';
const app = express();
app.use(cors());
// Log calls
app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms - :remote-addr - :remote-user', { stream: accessLogStream }));

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
    console.log(`Sync Server listening on port ${port}!`);

});

process.setMaxListeners(50);
//DatabaseRepository.checkDB();

