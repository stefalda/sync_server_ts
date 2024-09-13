
//const { Pool } = require('pg')
import { Pool, types } from 'pg';
import * as configJson from '../../config.json';


export class DatabaseRepository {
    private pools = new Map<string, Pool>;

    /*private pool = new Pool({
        connectionString,
    });
    */
    private static instance: DatabaseRepository;

    private getPool(realm: string): Pool {
        const pool = this.pools.get(realm.toLowerCase());
        if (!pool) {
            return this.pools.get("default")!;
        }
        return pool;
    }


    private constructor() {
        // Number as treated as string, so force int8 to be parsed with parseInt
        // https://github.com/brianc/node-pg-types
        //const types = require('pg').types
        types.setTypeParser(20, (val: string) =>
            parseInt(val, 10)
        );
        // Start pools
        for (const realm in configJson.db.realms) {
            const connectionString = (configJson.db.realms as any)[realm];
            this.pools.set(realm, new Pool({ connectionString }));
        }
    }

    public static getInstance(): DatabaseRepository {
        if (!DatabaseRepository.instance) {
            DatabaseRepository.instance = new DatabaseRepository();
        }

        return DatabaseRepository.instance;
    }

    /// Instance method

    /**
     * Return an array if singleResult is not set otherwise returns the first row
     * Return null if no result are found
     * 
     * @param sql 
     * @param params 
     * @param options: {singleResult} 
     * @returns 
     */
    async query(sql: string, params: Array<any>, options: { realm: string, singleResult?: boolean }): Promise<any> {
        const client = await this.getPool(options.realm).connect();

        try {
            const res = await client.query(sql, params);
            if (res.rowCount == 0) return null;
            if (options?.singleResult == true) {
                // console.log(JSON.stringify(res.rows[0]));
                return res.rows[0];
            }

            return res.rows;
        } catch (err: any) {
            console.error(`database_repository - query - sql:${sql} - err: ${err}`)
            console.error(err.stack)
        } finally {
            client.release()
        }
    }
}