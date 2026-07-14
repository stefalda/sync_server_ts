//import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';
import * as configJson from '../../config.json';
import { logger } from '../helpers/logger';
import { checkBasicAuthentication, checkToken, generateJWTToken, generateRefreshJWTToken, useJWT } from '../middleware/authorization';
import { ApiResult } from '../models/api/api_result';
import { LoginData, PasswordChangeData, RegistrationData } from '../models/api/registration';
import { User, UserToken } from '../models/db/models';
import { AuthenticationRepository } from '../repositories/authentication_repository';
import { UserRepository } from '../repositories/user_repository';

const router = Router();

/**
 * The register endpoint can be called to register a new user or just a new client
 */
router.post('/register/:realm', async (req: Request, res: Response) => {
    try {
        const registrationData = req.body as RegistrationData;
        // Register the user & the client
        const result = await UserRepository.getInstance().register(req.params.realm, registrationData);
        if ((result as any).code) {
            res.status((result as ApiResult).code).json(result);
        } else {
            res.json(result);
        }
    } catch (err) {
        logger.error(err);
        console.error(`/register/${req.params.realm}`, err);
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

/**
 * Unregister the client and optionally remove all the user data
 */
router.post('/unregister/:realm', checkToken, async (req: Request, res: Response) => {
    try {
        const registrationData = req.body as RegistrationData;
        const result = await UserRepository.getInstance().unregister(req.params.realm, registrationData);
        res.status(result.code).json(result);
        //res.json(new ApiResult(200, "User and Client unregistered successfully!"));
    } catch (err) {
        logger.error(err);
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});



/**
 * Login the user and register the client (use Basic Authentication)
 */
router.post('/login/:realm', checkBasicAuthentication, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const realm = req.params.realm;
        const { clientId } = req.body as LoginData;
        // Check that the clientId
        const userClient = await UserRepository.getInstance().getUserClient(realm, clientId);
        if (!userClient || userClient.userid !== user.id) {
            res.status(403).send(new ApiResult(403, "Invalid clientid for current username and password"));
            return;
        }
        // Register a new Token
        if (!useJWT) {
            // SIMPLE TOKEN
            const userToken = await AuthenticationRepository.getInstance().generateToken(realm, clientId);
            res.json(tokenFromUserToken(userToken));
        } else {
            // JWT
            createNewJWTToken(user, res);
        }
    } catch (err) {
        logger.error(err);
        res.status(500).send({ error: 'Error registering user: ' + err });
    }
});

/**
 * Perform a refresh token
 */
router.post('/login/:realm/refreshToken', async (req: Request, res: Response) => {
    try {
        const realm = req.params.realm;
        const { refreshToken } = req.body;
        if (!useJWT) {
            // Get the UserToken from refreshToken
            let userToken = await AuthenticationRepository.getInstance().getTokenFromRefreshToken(realm, refreshToken);
            if (userToken == null) {
                res.status(403).send(new ApiResult(403, "Invalid refresh token, please relogin"));
                return;
            }
            // Update the userToken
            userToken = await AuthenticationRepository.getInstance().generateToken(realm, userToken.clientid!);
            res.json(tokenFromUserToken(userToken));
        } else {
            // JWT refresh token verification:
            // 1) Uses secret_key_refresh (previously used secret_key — the wrong key,
            //    so verification always failed and no refresh token ever worked).
            // 2) Uses synchronous try/catch instead of callback (previously the callback
            //    race allowed the code to proceed even when the token was invalid).
            const jwt = require('jsonwebtoken');
            let decoded: { userid: string; email: string } | null = null;
            try {
                decoded = jwt.verify(refreshToken, configJson.server.secret_key_refresh) as { userid: string; email: string };
            } catch {
                return res.status(403).json(new ApiResult(403, "Invalid or expired token"));
            }
            if (!decoded) {
                return res.status(403).json(new ApiResult(403, "Invalid or expired token"));
            }
            const user = await UserRepository.getInstance().getUserFromDB(realm, decoded.email);
            if (!user) {
                return res.status(403).json(new ApiResult(403, "User not found, please relogin"));
            }
            createNewJWTToken(user, res);
        }
    } catch (err) {
        logger.error(err);
        try {
            res.status(500).send({ error: 'Error registering user: ' + err });
        } catch (error) {
            logger.error(error);
        }
    }
});

function createNewJWTToken(user: User, res: Response) {
    const token = generateJWTToken(user.id, user.email);
    const refreshToken = generateRefreshJWTToken(user.id, user.email);
    res.json({ accessToken: token, refreshToken });
}

function tokenFromUserToken(userToken: UserToken) {
    return {
        token_type: "Bearer",
        access_token: userToken.token,
        refresh_token: userToken.refreshtoken,
        expires_in: 86400, // 24h
        // Null-safe: falls back to 0 if lastrefresh is undefined (non-null assertion removed)
        expires_on: new Date((userToken.lastrefresh ?? 0) + 60 * 60 * 24 * 1000).getTime()
    };
}

/**
 * Password refresh - generate a PIN that is stored in a table
 * and sent to the registered email address
 * The pin is checked in the /password/change POST call
 * that change the password
 */
router.post('/password/:realm/forgotten', async (req: Request, res: Response) => {
    try {
        const { email } = req.body as { email: string };
        await UserRepository.getInstance().generatePin(req.params.realm, email);
        // Always return 200 with a generic message regardless of whether the email exists.
        // Previously threw "User not found!" → returned 500, allowing email enumeration
        // by observing 200 (registered) vs 500 (unregistered).
        res.json(new ApiResult(200, "If the email is registered, a PIN has been sent"));
    } catch (err) {
        logger.error(err);
        res.json(new ApiResult(200, "If the email is registered, a PIN has been sent"));
    }
});

/**
 * Password change - check if the PIN is the same that  has been sent to the email address
 */
router.post('/password/:realm/change', async (req: Request, res: Response) => {
    try {
        const registrationData = req.body as PasswordChangeData;
        const result = await UserRepository.getInstance().changePassword(req.params.realm, registrationData);
        if (!result) {
            res.status(403).json(new ApiResult(403, "PIN expired or incorrect"));
            return;
        }
        res.json(new ApiResult(200, "Password changed successfully!"));
    } catch (err) {
        logger.error(err);
        res.status(500).send({ error: 'Error changing user password: ' + err });
    }
});

export default router;