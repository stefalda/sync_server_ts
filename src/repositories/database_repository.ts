
//const { Pool } = require('pg')
import { Pool, types } from 'pg';
import * as configJson from '../../config.json';
import { logger } from '../helpers/logger';


export class DatabaseRepository {
    private pools = new Map<string, Pool>;

    /*private pool = new Pool({
        connectionString,
    });
    */
    private static instance: DatabaseRepository;

    // Made public for SyncRepository transaction support (needs a dedicated client connection)
    public getPool(realm: string): Pool {
        const pool = this.pools.get(realm.toLowerCase());
        // Previously fell back to "default" pool for unknown realms, bypassing isolation.
        // Now validates that the realm is configured and throws instead.
        if (!pool) {
            throw new Error(`Unknown realm: ${realm}`);
        }
        return pool;
    }


    private constructor() {
        types.setTypeParser(20, (val: string) =>
            parseInt(val, 10)
        );
        for (const realm in configJson.db.realms) {
            const realmConfig = (configJson.db.realms as any)[realm];
            let connectionString: string;
            const poolOptions: Record<string, unknown> = {};
            if (typeof realmConfig === 'string') {
                connectionString = realmConfig;
            } else {
                // Backward-compatible object format:
                // { "connectionString": "postgresql://...", "pool": { "max": 20, ... } }
                connectionString = realmConfig.connectionString;
                if (realmConfig.pool) {
                    Object.assign(poolOptions, realmConfig.pool);
                }
            }
            this.pools.set(realm, new Pool({ connectionString, ...poolOptions }));
        }
    }

    public static getInstance(): DatabaseRepository {
        if (!DatabaseRepository.instance) {
            DatabaseRepository.instance = new DatabaseRepository();
        }

        return DatabaseRepository.instance;
    }

    // Test support: resets singleton so tests get a fresh instance with clean pools
    public static reset(): void {
        if (DatabaseRepository.instance) {
            DatabaseRepository.instance.pools.forEach((pool) => {
                pool.end().catch(() => {});
            });
            DatabaseRepository.instance.pools.clear();
        }
        DatabaseRepository.instance = null as unknown as DatabaseRepository;
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
            // Previously errors were logged but swallowed (returned undefined),
            // making callers unable to distinguish "no results" from "database error".
            // Now rethrown so callers can handle errors properly.
            logger.error(err);
            console.error(`database_repository - query - sql:${sql} - err: ${err}`)
            console.error(err.stack)
            throw err;
        } finally {
            client.release()
        }
    }
}