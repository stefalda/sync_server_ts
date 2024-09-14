import { Request, Router } from 'express';
import { checkToken } from '../middleware/authorization';
import { SyncDataRequest } from '../models/api/sync_data';
import { SyncRepository } from '../repositories/sync_repository';

const router = Router();

/**
 * Pull the changes stored in the sync server
 */
router.post('/pull/:realm', checkToken, async (req: any, res) => {
    try {
        const userToken = req.userToken;
        const syncData = req.body as SyncDataRequest;
        const result = await SyncRepository.getInstance().pull(req.params.realm, syncData, userToken);
        res.json(result);
    } catch (err) {
        res.status(500).send({ message: (err as Error).message });
    }
});

/**
 * Push the changes to store in the sync server
 */
router.post('/push/:realm', checkToken, async (req: Request, res) => {
    try {
        const userToken = (req as any).userToken;
        const syncData = req.body as SyncDataRequest;
        const result = await SyncRepository.getInstance().push(req.params.realm, syncData, userToken);
        res.json(result);
    } catch (err) {
        res.status(500).send({ message: (err as Error).message });
    }
});

/**
 * Push the changes to store in the sync server
 */
router.post('/cancelSync/:realm', checkToken, async (req: Request, res) => {
    try {
        const data = req.body as { clientId: string };
        const result = await SyncRepository.getInstance().cancelSync(req.params.realm, data.clientId);
        res.json(result);
    } catch (err) {
        res.status(500).send({ message: (err as Error).message });
    }
});

export default router;