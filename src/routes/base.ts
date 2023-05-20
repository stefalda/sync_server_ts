import { Router } from 'express';
// import ReadabilityHelper from './../helpers/readability_helper';
// import ScraperHelper from './../helpers/scraper_helper';

const router = Router();

router.get('/', (request, response) => {
    response.send("Hello from Sync Server!");
});

/*
router.post('/scrape', async (request, response, next) => {
    try {
        // console.log("Incoming request: " + JSON.stringify(request.body));
        const result = await ScraperHelper.scrape(request.body);
        // console.log(result);
        response.send(result);
    }
    catch (ex) {
        console.error(ex);
        response.status(500).send({ error: "" + ex });;
    }
});

router.post('/read', async (request, response, next) => {
    try {
        console.log("Parse " + request.body.url);
        const result = await ReadabilityHelper.parse(request.body.url);
        response.json(result);
    }
    catch (ex) {
        console.error(ex);
        response.status(500).send({ error: "" + ex });;
    }
});
*/

export default router;