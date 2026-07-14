import { Request, Response, Router } from 'express';
import { logger } from '../helpers/logger';
import { checkToken } from '../middleware/authorization';
import { SyncDataRequest } from '../models/api/sync_data';
import chunk_processor from '../repositories/chunk_processor';
import { SyncRepository } from '../repositories/sync_repository';
const router = Router();

// Extracted from push/pull handlers: processes chunk upload for both endpoints.
// The only difference between push and pull is the HTTP status code for IN_PROGRESS:
// pull → 206, push → 200.
async function processSyncChunk(
    req: Request,
    res: Response,
    clientid: string,
    realm: string,
    inProgressStatus: number
): Promise<SyncDataRequest | null> {
    const resultChunk = await chunk_processor.processChunk({
        clientId: clientid,
        realm,
        req,
        res
    });
    if (resultChunk.status === 'IN_PROGRESS') {
        res.status(inProgressStatus).send({
            message: "Please send next chunk",
            progress: resultChunk.progress,
            percentage: resultChunk.percentage
        });
        return null;
    }
    return resultChunk as unknown as SyncDataRequest;
}

/**
 * Pull the changes stored in the sync server
 */
router.post('/pull/:realm/:clientid', checkToken, async (req: Request, res: Response) => {
    try {
        const { realm, clientid } = req.params;
        logger.info(`PULL - Receiving data from client: ${clientid} in realm: ${realm}`);
        let data: SyncDataRequest | null = null;
        if (req.body.multiple) {
            data = await processSyncChunk(req, res, clientid, realm, 206);
            if (data === null) return;
        }
        else {
            data = req.body as SyncDataRequest;
        }

        const result = await SyncRepository.getInstance().pull(realm, data);
        res.json(result);
    } catch (err) {
        logger.error(err);
        res.status(500).send({ message: (err as Error).message });
    }
});

/**
 * Push the changes to store in the sync server
 */
router.post('/push/:realm/:clientid', checkToken, async (req: Request, res) => {
    try {
        const { realm, clientid } = req.params;
        logger.info(`PUSH - Receiving data from client: ${clientid} in realm: ${realm}`);
        let data: SyncDataRequest | null = null;
        if (req.body.multiple) {
            data = await processSyncChunk(req, res, clientid, realm, 200);
            if (data === null) return;
        }
        else {
            data = req.body as SyncDataRequest;
        }
        const result = await SyncRepository.getInstance().push(realm, data);
        res.json(result);
    } catch (err) {
        logger.error(err);
        res.status(500).send({ message: (err as Error).message });
    }
});

// Resume-upload endpoints are not yet implemented.

/**
 * Push the changes to store in the sync server
 */
router.post('/cancelSync/:realm', checkToken, async (req: Request, res) => {
    try {
        const data = req.body as { clientId: string };
        const result = await SyncRepository.getInstance().cancelSync(req.params.realm, data.clientId);
        res.json(result);
    } catch (err) {
        logger.error(err);
        res.status(500).send({ message: (err as Error).message });

    }
});

export default router;