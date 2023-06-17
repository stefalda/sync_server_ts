import { randomUUID } from "crypto";
import * as configJson from '../../config.json';
import { sendPin } from "../helpers/send_email";
import { encryptPassword } from "../helpers/utils";
import { ApiResult } from "../models/api/api_result";
import { PasswordChangeData, RegistrationData, RegistrationResult } from "../models/api/registration";
import { ClientDetails, Tables, User, UserClient, UserPin } from "../models/db/models";
import { DatabaseRepository } from "./database_repository";

export class UserRepository {


    private static instance: UserRepository;

    private constructor() {

    }

    public static getInstance(): UserRepository {
        if (!UserRepository.instance) {
            UserRepository.instance = new UserRepository();
        }

        return UserRepository.instance;
    }

    // Instance methods

    private async getDB() {
        return await DatabaseRepository.getInstance();
    }

    /**
     * Register the user and return the inserted user id
     * @param realm 
     * @param user 
     * @returns 
     */
    async registerUser(realm: string, user: User): Promise<string> {
        const db = await this.getDB();
        user.id = randomUUID();//.replaceAll("-", "");
        const sql = `INSERT INTO ${Tables.User}
                    (id, name, email, password, salt, language)
                    VALUES( $1, $2, $3, $4, $5, $6)`;
        await db.query(sql,
            [user.id, user.name, user.email, user.password, user.salt, user.language], { realm });
        return user.id;
    }

    /**
     * Return the user checking email and password
     * @param realm 
     * @param email 
     * @param password 
     * @returns 
     */
    async getUser(realm: string, email: string, password: string): Promise<User | null> {
        const user = await this.getUserFromDB(realm, email);
        if (!user) return null;
        if (user.password === encryptPassword(password, user.salt!)) {
            return user as User;
        }
        return null;
    }

    /**
     * Return the user from the DB by email
     * @param realm 
     * @param email 
     * @returns 
     */
    private async getUserFromDB(realm: string, email: string): Promise<User | null> {
        const db = await this.getDB();
        const sql = `SELECT id, name, email, password, salt, language FROM ${Tables.User} WHERE 
                        email = $1`;
        return await db.query(sql, [email], { realm, singleResult: true });
    }

    /**
    * Register a new user and client (or just client if the user already exists)
  
    * @param realm 
    * @param registrationData 
    * @returns 
    */
    async register(realm: string, registrationData: RegistrationData): Promise<ApiResult | RegistrationResult> {
        const emailAlreadyRegistered = await this.isEmailAlreadyRegistered(realm, registrationData.email);
        // New registration but email is already registered
        if (emailAlreadyRegistered && registrationData.newRegistration) {
            return new ApiResult(500, "The email is already registered, try to register the client instead...");
        }
        // Client registration but email is not registered
        if (!emailAlreadyRegistered && !registrationData.newRegistration) {
            return new ApiResult(500, "The email is not registered, try to Register as a new user...");
        }
        // Check if the clientId is already registered
        if (await this.getUserClient(realm, registrationData.clientId) != null) {
            return new ApiResult(500, "The clentid is already registered, please use another one.");
        }

        let user;
        if (!registrationData.newRegistration) {
            // Register just the client
            user = await this.getUser(realm, registrationData.email, registrationData.password);
            if (!user) {
                return new ApiResult(500, "Wrong username or password");
            }
            // Assing the name
            registrationData.name = user.name!;
        } else {
            // Register a new user
            user = new User()
            user.name = registrationData.name;
            user.email = registrationData.email;
            user.salt = randomUUID();
            user.password = encryptPassword(registrationData.password, user.salt);
            user.language = registrationData.language;
            user.id = await UserRepository.getInstance().registerUser(realm, user);
        }


        // Register Client
        await this.registerClient(realm, registrationData, user.id!);
        return new RegistrationResult("User and Client registered successfully!", registrationData);
    }

    /**
    * Unregister client
    * @param realm 
    * @param registrationData 
    * @returns 
    */
    async unregister(realm: string, registrationData: RegistrationData): Promise<ApiResult> {
        // Check username and password
        const user = await this.getUser(realm, registrationData.email, registrationData.password);
        if (!user) {
            return new ApiResult(500, "Wrong username or password");
        }

        // Check if should delete remote data
        if (registrationData.deleteRemoteData) {
            await this.deleteUserData(realm, user.id!);
        } else {
            // Delete only the client
            await this.unregisterClient(realm, user.id!, registrationData.clientId!);
        }

        return new ApiResult(200, "User and Client unregistered successfully!");
    }

    /**
     * Check if the registration email is already being used
     * @param email 
     * @returns 
     */
    private async isEmailAlreadyRegistered(realm: string, email: string): Promise<boolean> {
        const db = await this.getDB();
        const res = await db.query("SELECT 1 FROM users WHERE email = $1", [email], { realm, singleResult: true });
        if (res !== null) return true;
        return false;
    }



    /**
   * Register a new user and client
   * @param realm 
   * @param registrationData 
   * @returns 
   */
    private async registerClient(realm: string, registrationData: RegistrationData, userid: string): Promise<ApiResult> {
        try {
            const uc: UserClient = new UserClient();
            uc.clientid = registrationData.clientId;
            uc.clientdetails = JSON.parse(registrationData.clientDescription) as ClientDetails;
            uc.userid = userid;
            await this.setUserClient(realm, uc);
            return new ApiResult(200, "OK");
        } catch (error) {
            throw (error);
        }
    }


    /**
   * Unregister a user client
   * Delete from the userTokens and from the userClients tables
   * @param realm 
   * @param registrationData 
   * @returns 
   */
    private async unregisterClient(realm: string, userid: string, clientId: string): Promise<void> {
        try {
            const db = await this.getDB();
            const sqlToken = `DELETE FROM ${Tables.UserToken}  WHERE clientid = $1`;
            await db.query(sqlToken, [clientId], { realm });

            const sqlClient = `DELETE FROM ${Tables.UserClient} WHERE userid = $1 AND clientid = $2`;
            await db.query(sqlClient, [userid, clientId], { realm });
        } catch (error) {
            throw (error);
        }
    }

    /**
     * Delete ALL USER data
     * @param realm 
     * @param registrationData 
     * @returns 
     */
    private async deleteUserData(realm: string, userid: string): Promise<void> {
        try {
            const db = await this.getDB();
            const sql = [`DELETE FROM ${Tables.Data} WHERE rowguid in 
                    (SELECT DISTINCT rowguid FROM  ${Tables.SyncData}  WHERE userid=$1);`,
            `DELETE FROM  ${Tables.SyncData}  WHERE userid=$1;`,
            `DELETE FROM  ${Tables.UserToken}  WHERE clientid IN (SELECT clientid FROM ${Tables.UserClient} WHERE userid = $1);`,
            `DELETE FROM ${Tables.UserClient} WHERE userid = $1;`,
            `DELETE FROM ${Tables.User} WHERE id =$1;`];
            for (let s of sql) {
                await db.query(s, [userid], { realm });
            }
        } catch (error) {
            throw (error);
        }
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

    async changePassword(realm: any, registrationData: PasswordChangeData): Promise<boolean> {
        // Check if the PIN is correct
        const db = await this.getDB();
        if (!registrationData.password) {
            throw "New password is missing!";
        }
        const user = await this.getUserFromDB(realm, registrationData.email);
        if (user == null) {
            throw "User not found!";
        }
        // Get the PIN from the DB
        const sql1 = `SELECT pin, created FROM ${Tables.UserPin} WHERE userid = $1`;
        const userPin: UserPin = await db.query(sql1, [user.id], { realm, singleResult: true });

        if (!userPin || userPin.pin !== registrationData.pin) {
            return false;
        }
        const now = new Date();
        var differenceInMinutes = Math.abs(now.getTime() - userPin.created!) / 60000; //60*1000
        if (differenceInMinutes > 15) {
            // The PIN is expired, delete...
            await this.deletePin(realm, db, user.id!);
            return false;
        }

        // Update the password in the DB
        user.password = encryptPassword(registrationData.password, user.salt!);
        const sql3 = `UPDATE ${Tables.User} SET password = $1 WHERE id = $2`;
        await db.query(sql3, [user.password, user.id], { realm });

        // Delete the PIN
        await this.deletePin(realm, db, user.id!);

        // Revoke all the accessToken related to this user
        const sql4 = `DELETE from ${Tables.UserToken} WHERE 
            clientid in (select clientid  from ${Tables.UserClient} where  userid = $1)`;
        await db.query(sql4, [user.id], { realm });

        return true;
    }

    private async deletePin(realm: string, db: DatabaseRepository, userid: string): Promise<void> {
        // Delete the PIN from the DB
        const sql2 = `DELETE FROM ${Tables.UserPin} WHERE userid = $1`;
        await db.query(sql2, [userid], { realm });

    }

    async generatePin(realm: string, email: string): Promise<void> {
        const db = await this.getDB();
        // Get the userId
        const user: User | null = await this.getUserFromDB(realm, email);
        if (!user) {
            throw "User not found!";
        }
        // Delete the PIN
        const sql2 = `DELETE FROM ${Tables.UserPin} WHERE userid = $1`;
        await db.query(sql2, [user.id], { realm });

        // Insert the PIN
        const pin = this.randomFixInteger(6).toString();
        const create = (new Date()).getTime();
        const sql3 = `INSERT INTO ${Tables.UserPin} (userid, pin, created) VALUES ($1, $2, $3)`;
        await db.query(sql3, [user.id, pin, create], { realm });
        // Extract the App Name from the config json file
        const appName = (configJson.email.apps as any)[realm.toLowerCase()];
        // Send the email
        await sendPin(user.name || email, email, appName, pin, user.language || "en");
    }

    private randomFixInteger(length: number) {
        return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1));
    }
}