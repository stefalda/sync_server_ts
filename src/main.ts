import express from 'express';
import * as configJson from '../config.json';
const morgan = require('morgan');
const path = require('path');
const rfs = require('rotating-file-stream');

// create a rotating write stream
var accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // rotate daily
    path: path.join(__dirname, '..', 'log')
});

/*import { DatabaseRepository } from './helpers/database_repository';
import admin from './routes/admin';
import api_scraper from './routes/api_scraper';
*/
import base from './routes/base';
import login from './routes/login';
import sync from './routes/sync';
const cors = require('cors');
const bodyParser = require("body-parser");
const app = express();
app.use(cors());
// Log calls
app.use(morgan('[:date[iso]] :method :url :status :res[content-length] - :response-time ms - :remote-addr - :remote-user', { stream: accessLogStream }));

// Accept big payload
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// add router in the Express app.
app.use("/", base);

// Register & Login
app.use("/", login);

// Sync
app.use("/", sync);


// Default to port 3000 but allow a PORT variable to be set
// es. PORT=8000 npm run serve
var port = configJson.server.port || process.env.PORT || 3000;


app.listen(port, function () {
    console.log(`Sync Server listening on port ${port}!`);

});

process.setMaxListeners(50);
//DatabaseRepository.checkDB();

