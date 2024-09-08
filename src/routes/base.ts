import { Router } from 'express';
const router = Router();

router.get('/', (request, response) => {
    response.send("Hello from Sync Server!");
});

export default router;