import express from 'express';
/*import { DatabaseRepository } from './helpers/database_repository';
import admin from './routes/admin';
import api_scraper from './routes/api_scraper';
import login from './routes/login';
import scripts from './routes/scripts';
*/
import base from './routes/base';
const cors = require('cors');
const bodyParser = require("body-parser");
const router = express.Router();
const app = express();
app.use(cors());


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


// add router in the Express app.
app.use("/", base);
//app.use("/api", api_scraper);

// Admin interface
//app.use("/admin", admin);

// Register & Login
//app.use("/", login);

// Scripts
//app.use("/", scripts);



// Default to port 3000 but allow a PORT variable to be set
// es. PORT=8000 npm run serve
var port = process.env.PORT || 3000;


app.listen(port, function () {
    console.log(`Sync Server listening on port ${port}!`);

});

process.setMaxListeners(50);
//DatabaseRepository.checkDB();

