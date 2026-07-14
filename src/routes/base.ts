import { Router } from 'express';
const router = Router();

router.get('/', (request, response) => {
    response.send("Hello from Sync Server!");
});

router.get('/healthz', (_request, response) => {
    response.json({ status: "ok" });
});

export default router;