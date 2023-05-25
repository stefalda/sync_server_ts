import { randomUUID } from "crypto";
import { Tables, UserClient, UserToken } from "../models/db/models";
import { DatabaseRepository } from "./database_repository";

export class AuthenticationRepository {
    private static instance: AuthenticationRepository;



    private constructor() {

    }



    public static getInstance(): AuthenticationRepository {
        if (!AuthenticationRepository.instance) {
            AuthenticationRepository.instance = new AuthenticationRepository();
        }

        return AuthenticationRepository.instance;
    }

    // Instance methods
    private async getDB() {
        return await DatabaseRepository.getInstance();
    }

    async getToken(realm: string, token: string): Promise<UserToken> {
        const db = await this.getDB();
        return await db.query(`SELECT clientid, token, refreshtoken, lastrefresh FROM ${Tables.UserToken} WHERE token = $1`, [token], { realm: realm, singleResult: true });
    }


    async getTokenFromRefreshToken(realm: string, refreshToken: string): Promise<UserToken> {
        const db = await this.getDB();
        return await db.query(`SELECT clientid, token, refreshtoken, lastrefresh FROM ${Tables.UserToken} WHERE refreshtoken = $1`, [refreshToken], { realm: realm, singleResult: true });
    }

    async getUserIdFromToken(realm: string, token: string): Promise<number> {
        const db = await this.getDB();
        return await db.query(`SELECT uc.userid FROM ${Tables.UserClient} uc INNER JOIN ${Tables.UserToken} ut ON 
        uc.clientid = ut.clientid WHERE ut.token = ?`, [token], { realm: realm, singleResult: true });
    }

    async updateToken(realm: string, userToken: UserToken) {
        const db = await this.getDB();
        return await db.query(
            `INSERT INTO ${Tables.UserToken}
            (clientid, "token", refreshtoken, lastrefresh)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (clientid)
            DO UPDATE 
            SET "token"=$2, refreshtoken=$3, lastrefresh=$4;
            `
            , [userToken.clientid, userToken.token, userToken.refreshtoken, userToken.lastrefresh], { realm: realm, singleResult: true });

    }

    async getUserClient(realm: string, clientId: string): Promise<UserClient> {
        const db = await this.getDB();
        return await db.query(
            `SELECT  clientid, userid, clientdetails, lastsync, syncing FROM ${Tables.UserClient}
             WHERE clientid = $1`
            , [clientId], { realm: realm, singleResult: true });

    }

    async setUserClient(realm: string, userClient: UserClient) {
        const db = await this.getDB();
        return await db.query(
            `INSERT INTO ${Tables.UserClient}
            (clientid, userid, clientdetails, lastsync, syncing)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (clientid)
            DO UPDATE 
            SET lastsync=$4, syncing=$5;
            `
            , [userClient.clientid, userClient.userid, userClient.clientdetails, userClient.lastsync, userClient.syncing],
            { realm: realm, }
        );

    }

    async generateToken(realm: string, clientid: string): Promise<UserToken> {
        const userToken = new UserToken();
        userToken.token = randomUUID();;
        userToken.refreshtoken = randomUUID();;
        userToken.lastrefresh = new Date().getTime();
        userToken.clientid = clientid;
        await this.updateToken(realm, userToken);
        return userToken;
    }
    /*
        async checkClientId(realm: string, params: { realm: string, email: string, password: string, clientId: string }): Promise<boolean> {
            const db = await this.getDB();
            const data = await db.query(`SELECT u.password, u.salt FROM ${Tables.UserClient} uc INNER JOIN ${Tables.User} u on u.id = uc.userid WHERE 
            u.email = $1 and uc.clientid =$2`, [params.email, params.clientId], { realm: realm, singleResult: true });
            if (data == null) return false;
            return data.password == encryptPassword(params.password, data.salt);
        }
    */


}