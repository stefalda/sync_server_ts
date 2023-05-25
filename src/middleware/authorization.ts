//{message: Missing bearer token}

import { Request, Response } from 'express';
import { ApiResult } from '../models/api/api_result';
import { AuthenticationRepository } from '../repositories/authentication_repository';
import { UserRepository } from '../repositories/user_repository';

/**
 * Check Bearer Token after logging in 
 * 
 * At the end it injects a userToken in the request object
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const checkToken = async (req: Request, res: Response, next: any) => {
    // console.log("BODY: " + JSON.stringify(req.body));
    try {

        let token = req.headers['authorization'] as string;
        if (!token) {
            return res.status(401).json(new ApiResult(401, "Missing bearer token"));
        }
        // Extract the authentication token
        token = token.substring(7);
        if (!token) {
            return res.status(401).json(new ApiResult(401, "Missing bearer token"));
        }
        const userToken =
            await AuthenticationRepository.getInstance().getToken(req.params.realm, token);
        // Unknown token
        if (userToken == null) {
            return res.status(403).json(new ApiResult(403, "Wrong token"));
        }
        // Token expired
        const now = new Date();
        var differenceInHours = Math.abs(now.getTime() - userToken.lastrefresh!) / 36e5; //60*60*1000
        if (differenceInHours > 24) {
            return res.status(400).json(new ApiResult(400, "Token has expired"));
        }
        // Add the userToken to the request
        (req as any).userToken = userToken;
        // Can access...
        next();
    } catch (error) {
        return res.status(401).json({ error: `Authentication error ${error}` });
    }
};

/**
 * Check the Simple Authentication when performing Login
 * 
 * At the end it injects a user in the request object
 * 
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const checkBasicAuthentication =
    async (req: Request, res: Response, next: any) => {
        try {
            let authorization = req.headers['authorization'] as string;
            if (!authorization) {
                return res.status(403).json(new ApiResult(403, "Missing basic authentication"));
            }
            // Extract the simple authentication data
            var encoded = authorization.split(' ')[1];
            // decode it using base64
            const decoded = Buffer.from(encoded, 'base64').toString();
            const [username, password] = decoded.split(':');
            if (!username || !password) {
                return res.status(403).json(new ApiResult(403, "Missing username or password"));
            }
            // Get the user from username and password
            const user = await UserRepository.getInstance().getUser(req.params.realm, username, password);
            if (!user) {
                return res.status(403).json(new ApiResult(403, "Wrong username or password"));
            }
            (req as any).user = user;
            // Can access...
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Missing bearer token' });
        }
    }

