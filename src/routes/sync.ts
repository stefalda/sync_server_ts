import { Request, Response, Router } from 'express';
import { logger } from '../helpers/logger';
import { checkToken } from '../middleware/authorization';
import { SyncDataRequest } from '../models/api/sync_data';
import chunk_processor from '../repositories/chunk_processor';
import { JSONUploadingRepository } from '../repositories/json_uploading_repository';
import { SyncRepository } from '../repositories/sync_repository';
const router = Router();
const jsonRepo = new JSONUploadingRepository();
/**
 * Pull the changes stored in the sync server
 */
router.post('/pull/:realm/:clientid', checkToken, async (req: Request, res: Response) => {
    try {
        const { realm, clientid } = req.params;

        logger.info(`🔄 PULL - Receiving data from client: ${clientid} in realm: ${realm}`);
        ////////////////////////
        /// CONCURRENT UPLOADS//
        ////////////////////////
        const resultChunk = await chunk_processor.processChunk({
            clientId: clientid,
            realm: realm,
            req,
            res
        });
        if (resultChunk.status === 'IN_PROGRESS') {
            // Se è in progress, invia lo stato di avanzamento
            res.status(206).send({
                message: "Please send next chunk",
                progress: resultChunk.progress,
                percentage: resultChunk.percentage
            });
            return;
        }
        // It's completed... the complete chunk is here
        const data = resultChunk as unknown;
        /*
        // Process in chunks incoming data
        // ✅ Ensure Express waits for the JSON processing to finish
        const data = await jsonRepo.processChunk({ clientId: clientid, realm: realm, req, res });

        if (!data) {
            // We are not yet finished receiving the  data
            res.status(200).send({ message: "Please send next chunk" });
            return;
        }
        */


        const syncData = data as SyncDataRequest;

        const result = await SyncRepository.getInstance().pull(req.params.realm, syncData);
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
        logger.info(`🔄 PUSH - Receiving data from client: ${clientid} in realm: ${realm}`);



        const resultChunk = await chunk_processor.processChunk({
            clientId: clientid,
            realm: realm,
            req,
            res
        });

        if (resultChunk.status === 'IN_PROGRESS') {
            // Se è in progress, invia lo stato di avanzamento
            res.status(200).send({
                message: "Please send next chunk",
                progress: resultChunk.progress,
                percentage: resultChunk.percentage
            });
            return;
        }
        // It's completed... the complete chunk is here
        const data = resultChunk as unknown;


        //const data =  req.body;
        // const data = await jsonRepo.processChunk({ clientId: clientid, realm: realm, req, res });
        // if (!data) {
        //     res.status(200).send({ message: "Please send next chunk" });
        //     return;
        // }
        const syncData = data as SyncDataRequest;
        const result = await SyncRepository.getInstance().push(req.params.realm, syncData);
        res.json(result);
    } catch (err) {
        logger.error(err);
        res.status(500).send({ message: (err as Error).message });
    }
});

// To simplify things at the moment we don't let resume uploads
/*
router.get("/pull/:realm/:clientId", async (req, res) => {
    try {
        const { realm, clientId } = req.params;
        const lastChunck = await jsonRepo.getLastChuck(clientId, realm);
        if (lastChunck == null) {
            logger.info(`No active upload session found for clientId ${clientId} and realm ${realm}`);
            return res.status(200).json(0);//{ message: "No active upload session found." });
        }
        res.json(lastChunck);
    } catch (err) {
        console.error("❌ Error retrieving upload progress:", err);
        res.status(500).send({ message: err.message });
    }
});

router.get("/push/:realm/:clientId", async (req, res) => {
    try {
        const { realm, clientId } = req.params;
        const lastChunck = await jsonRepo.getLastChuck(clientId, realm);
        if (lastChunck == null) {
            return res.status(404).json({ message: "No active upload session found." });
        }
        res.json(lastChunck);
    } catch (err) {
        console.error("❌ Error retrieving upload progress:", err);
        res.status(500).send({ message: err.message });
    }
});
*/

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