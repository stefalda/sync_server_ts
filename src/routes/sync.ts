//import bcrypt from 'bcrypt';
import { Router } from 'express';
import { checkToken } from '../middleware/authorization';
import { SyncDataRequest } from '../models/api/sync_data';
import { SyncRepository } from '../repositories/sync_repository';
//import jwt from 'jsonwebtoken';
//import { DatabaseRepository } from '../helpers/database_repository';
//import { databaseMiddleware } from './../middleware/db_middleware';
//import { secret } from './../middleware/verifyToken';


const router = Router();

//router.use(databaseMiddleware);

router.post('/pull/:realm', checkToken, async (req: any, res) => {
    try {
        const userToken = req.userToken;
        const syncData = req.body as SyncDataRequest;
        const result = await SyncRepository.getInstance().pull(req.params.realm, syncData, userToken);
        res.json(result);
    } catch (err) {
        res.status(500).send({ error: 'Error pulling data: ' + err });
    }
});

router.post('/push/:realm', checkToken, async (req: any, res) => {
    try {
        const userToken = req.userToken;
        const syncData = req.body as SyncDataRequest;
        const result = await SyncRepository.getInstance().push(req.params.realm, syncData, userToken);
        res.json(result);
    } catch (err) {
        res.status(500).send({ error: 'Error pushing data: ' + err });
    }
});

export default router;