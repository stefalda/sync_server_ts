//import bcrypt from 'bcrypt';
import { Router } from 'express';
import { checkToken } from '../middleware/authorization';
import { ApiResult } from '../models/api/api_result';
import { Registration } from '../models/api/registration';
import { UserRepository } from '../repositories/user_repository';
//import jwt from 'jsonwebtoken';
//import { DatabaseRepository } from '../helpers/database_repository';
//import { databaseMiddleware } from './../middleware/db_middleware';
//import { secret } from './../middleware/verifyToken';


const router = Router();

//router.use(databaseMiddleware);

router.post('/pull/:realm', checkToken, async (req: any, res) => {
    try {
        const registrationData = req.body as Registration;
        // Register the user & the client
        const result = await UserRepository.getInstance().register(req.params.realm, registrationData);
        if ((result as any).code) {
            res.status((result as ApiResult).code).json(result);
        } else {
            res.json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

router.post('/push/:realm', checkToken, async (req: any, res) => {
    try {
        const registrationData = req.body as Registration;
        const result = await UserRepository.getInstance().unregister(req.params.realm, registrationData, req.userToken);
        res.status(result.code).json(result);
        //res.json(new ApiResult(200, "User and Client unregistered successfully!"));
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

export default router;