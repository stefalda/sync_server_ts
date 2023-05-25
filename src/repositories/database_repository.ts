
//const { Pool } = require('pg')
import { Pool } from 'pg';

const connectionString = 'postgresql://stefano:VtS4JGVf_1yB8CJ9V6lvHg@bare-mantis-6973.7tc.cockroachlabs.cloud:26257/sync_server?sslmode=verify-full'

export class DatabaseRepository {
    private pool = new Pool({
        connectionString,
    });

    private static instance: DatabaseRepository;

    private constructor() { }

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
        const client = await this.pool.connect();

        try {
            const res = await client.query(sql, params);
            if (res.rowCount == 0) return null;
            if (options?.singleResult == true) {
                return res.rows[0];
            }
            return res.rows;
        } catch (err: any) {
            console.log(err.stack)
        } finally {
            client.release()
        }
    }
}