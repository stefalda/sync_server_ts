//import bcrypt from 'bcrypt';
import { Router } from 'express';
import { checkBasicAuthentication, checkToken } from '../middleware/authorization';
import { ApiResult } from '../models/api/api_result';
import { Registration } from '../models/api/registration';
import { User, UserToken } from '../models/db/models';
import { AuthenticationRepository } from '../repositories/authentication_repository';
import { UserRepository } from '../repositories/user_repository';
//import jwt from 'jsonwebtoken';
//import { DatabaseRepository } from '../helpers/database_repository';
//import { databaseMiddleware } from './../middleware/db_middleware';
//import { secret } from './../middleware/verifyToken';


const router = Router();

//router.use(databaseMiddleware);

/**
 * The register endpoint can be called to register a new user or just a new client
 */
router.post('/register/:realm', async (req: any, res) => {
    try {
        const registrationData = req.body as Registration;
        // Register the user & the client
        const result = await UserRepository.getInstance().register(req.params.realm, registrationData);
        if ((result as any).code) {
            res.status((result as ApiResult).code).json(result);
        } else {
            res.json(result);
        }
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

router.post('/unregister/:realm', checkToken, async (req: any, res) => {
    try {
        const registrationData = req.body as Registration;
        const result = await UserRepository.getInstance().unregister(req.params.realm, registrationData, req.userToken);
        res.status(result.code).json(result);
        //res.json(new ApiResult(200, "User and Client unregistered successfully!"));
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

router.post('/login/:realm', checkBasicAuthentication, async (req, res) => {
    try {
        const user: User = (req as any).user;
        const realm = req.params.realm;
        const { clientId } = req.body;
        // Check that the clientId
        const userClient = await AuthenticationRepository.getInstance().getUserClient(realm, clientId);
        if (!userClient || userClient.userid !== user.id) {
            res.status(403).send(new ApiResult(403, "Invalid clientid for current username and password"));
            return;
        }
        // Register a new Token
        const userToken = await AuthenticationRepository.getInstance().generateToken(realm, clientId);
        res.json(tokenFromUserToken(userToken));
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

router.post('/login/:realm/refreshToken', async (req, res) => {
    try {
        const realm = req.params.realm;
        const { refreshToken } = req.body;
        // Get the UserToken from refreshToken
        let userToken = await AuthenticationRepository.getInstance().getTokenFromRefreshToken(realm, refreshToken);
        if (userToken == null) {
            res.status(403).send(new ApiResult(403, "Invalid refresh token, please relogin"));
            return;
        }
        // Update the userToken
        userToken = await AuthenticationRepository.getInstance().generateToken(realm, userToken.clientid!);
        res.json(tokenFromUserToken(userToken));
    } catch (err) {
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

function tokenFromUserToken(userToken: UserToken) {
    return {
        token_type: "Bearer",
        access_token: userToken.token,
        refresh_token: userToken.refreshtoken,
        expires_in: 86400, // 24h
        expires_on: new Date(userToken.lastrefresh! + 60 * 60 * 24 * 1000)
    };
}

export default router;