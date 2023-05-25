import { randomUUID } from "crypto";
import { encryptPassword } from "../helpers/utils";
import { ApiResult } from "../models/api/api_result";
import { Registration, RegistrationResult } from "../models/api/registration";
import { ClientDetails, Tables, User, UserClient, UserToken } from "../models/db/models";
import { AuthenticationRepository } from "./authentication_repository";
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
    async registerUser(realm: string, user: User): Promise<number> {
        const db = await this.getDB();
        const sql = `INSERT INTO ${Tables.User}
                    ("name", email, "password", salt)
                    VALUES( $1, $2, $3, $4) RETURNING id;`;
        const rows = await db.query(sql,
            [user.name, user.email, user.password, user.salt], { realm });
        return rows[0].id;
    }

    /**
     * Return the user checking email and password
     * @param realm 
     * @param email 
     * @param password 
     * @returns 
     */
    async getUser(realm: string, email: string, password: string): Promise<User | null> {
        const db = await this.getDB();
        const sql = `SELECT id, name, email, password, salt FROM ${Tables.User} WHERE 
                    email = $1`;
        const user = await db.query(sql, [email], { realm, singleResult: true });
        if (!user) return null;
        if (user.password === encryptPassword(password, user.salt)) {
            return user as User;
        }
        return null;
    }

    /**
    * Register a new user and client (or just client if the user already exists)
  
    * @param realm 
    * @param registrationData 
    * @returns 
    */
    async register(realm: string, registrationData: Registration): Promise<ApiResult | RegistrationResult> {
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
        if (await AuthenticationRepository.getInstance().getUserClient(realm, registrationData.clientId) != null) {
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
    async unregister(realm: string, registrationData: Registration, userToken: UserToken): Promise<ApiResult> {
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
    private async registerClient(realm: string, registrationData: Registration, userid: number): Promise<ApiResult> {
        try {
            const uc: UserClient = new UserClient();
            uc.clientid = registrationData.clientId;
            uc.clientdetails = JSON.parse(registrationData.clientDescription) as ClientDetails;
            uc.userid = userid;
            await AuthenticationRepository.getInstance().setUserClient(realm, uc);
            return new ApiResult(200, "OK");
        } catch (error) {
            throw (error);
        }
    }


    /**
   * Register a new user and client
   * @param realm 
   * @param registrationData 
   * @returns 
   */
    private async unregisterClient(realm: string, userid: number, clientId: string): Promise<void> {
        try {
            const db = await this.getDB();
            const sql = `DELETE FROM ${Tables.UserClient} WHERE userid = $1 AND clientid = $2`;
            await db.query(sql, [userid, clientId], { realm });
        } catch (error) {
            throw (error);
        }
    }

    /**
 * Register a new user and client
 * @param realm 
 * @param registrationData 
 * @returns 
 */
    private async deleteUserData(realm: string, userid: number): Promise<void> {
        try {
            const db = await this.getDB();
            const sql = [`DELETE FROM ${Tables.Data} WHERE rowguid in 
                    (SELECT DISTINCT rowguid FROM  ${Tables.SyncData}  WHERE userid=$1);`,
            `DELETE FROM  ${Tables.SyncData}  WHERE userid=$1;`,
            `DELETE FROM ${Tables.UserClient} WHERE userid = $1;`,
            `DELETE FROM ${Tables.User} WHERE id =$1;`];
            for (let s of sql) {
                await db.query(s, [userid], { realm });
            }
        } catch (error) {
            throw (error);
        }
    }
}