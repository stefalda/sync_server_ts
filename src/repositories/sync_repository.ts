import { logger } from "../helpers/logger";
import { SyncData, SyncDataPullResponse, SyncDataPushResponse, SyncDataRequest } from "../models/api/sync_data";
import { Tables, UserClient } from "../models/db/models";
import { DatabaseRepository } from "./database_repository";
import { UserRepository } from "./user_repository";

export class SyncRepository {

    private static instance: SyncRepository;

    public static getInstance(): SyncRepository {
        if (!SyncRepository.instance) {
            SyncRepository.instance = new SyncRepository();
        }

        return SyncRepository.instance;
    }

    public static reset(): void {
        SyncRepository.instance = null as unknown as SyncRepository;
    }

    // Instance methods

    private async getDB() {
        return await DatabaseRepository.getInstance();

    }

    async pull(realm: string, syncDataRequest: SyncDataRequest): Promise<SyncDataPullResponse> {
        const db = await this.getDB();
        // Ottieni lo userClient
        const userClient: UserClient =
            await UserRepository.getInstance().getUserClient(realm, syncDataRequest.clientId);
        if (!userClient) {
            throw Error("Client id not found!");
        }
        // Atomic lock acquisition with stale-lock recovery (2 min timeout).
        // Previously used check-then-act: SELECT userClient, check syncing==null, then UPDATE.
        // Two concurrent requests could both see syncing==null and both proceed.
        // This single UPDATE atomically acquires the lock only when:
        // - syncing IS NULL (no sync in progress), OR
        // - syncing < staleThreshold (previous sync crashed and is older than 2 minutes)
        // If rowCount === 0, the lock is held by another active sync.
        const staleThreshold = new Date().getTime() - 120000;
        const lockResult = await db.query(
            `UPDATE ${Tables.UserClient} SET syncing = $1 WHERE clientid = $2 AND (syncing IS NULL OR syncing < $3)`,
            [new Date().getTime(), syncDataRequest.clientId, staleThreshold],
            { realm }
        );
        if (!lockResult || lockResult.rowCount === 0) {
            throw Error("The user is already syncing from this client");
        }

        const clientid: string = userClient.clientid!;
        const userid: string = userClient.userid!;
        const syncDataPullResponse = new SyncDataPullResponse(clientid);
        try {
            const serverChanges = await this.getServerChanges(realm, userid, syncDataRequest.lastSync) || [];
            for (const client of syncDataRequest.changes) {
                const serverData =
                    serverChanges.filter((server) => server.rowguid == client.rowguid);
                if (serverData.length > 0) {
                    const server = serverData[0];
                    if (server.clientdate >= client.clientdate) {
                        syncDataPullResponse.outdatedRowsGuid.push(client.rowguid.toString());
                    } else {
                        serverChanges.splice(serverChanges.indexOf(server), 1);
                    }
                }
            }
            // Batch N+1 optimization: previously each server change called getRowDataValue()
            // individually (N queries for N changes). Now pre-load all data rows in a single
            // query using ANY($1), then look up from an in-memory Map.
            const finalServerChanges = [];
            const nonDeleteChanges = serverChanges.filter(c => c.operation !== "D");
            const dataByRowguid = new Map<string, string>();
            if (nonDeleteChanges.length > 0) {
                const guids = nonDeleteChanges.map(c => c.rowguid);
                const dataRows = await db.query(
                    `SELECT rowguid, json FROM ${Tables.Data} WHERE rowguid = ANY($1)`,
                    [guids],
                    { realm }
                );
                for (const row of dataRows || []) {
                    dataByRowguid.set(row.rowguid, row.json);
                }
            }
            for (const serverChange of serverChanges) {
                if (serverChange.operation !== "D") {
                    const rowData = dataByRowguid.get(serverChange.rowguid);
                    if (rowData) {
                        serverChange.rowData = rowData;
                    }
                }
                finalServerChanges.push(serverChange);
            }
            logger.debug(`serverChanges to be pulled: ${finalServerChanges.length} skipped ${(serverChanges.length - finalServerChanges.length)}`);
            // Aggiungi a syncDetails le modifiche presenti sul server e da applicare sul client
            syncDataPullResponse.data = finalServerChanges;
            return syncDataPullResponse;
        }
        catch (ex) {
            logger.error(ex);
            // Reset syncing date
            if (userClient) {
                userClient.syncing = null;
                await UserRepository.getInstance().setUserClient(realm, userClient);
            }
            throw ex;
        }

    }

    async push(realm: string, syncDataRequest: SyncDataRequest): Promise<SyncDataPushResponse> {
        const db = await this.getDB();
        const userClient =
            await UserRepository.getInstance().getUserClient(realm, syncDataRequest.clientId);
        if (!userClient) {
            throw Error("Client id not found!");
        }
        if (userClient.syncing == null) {
            throw Error("You should pull before pushing...");
        }

        // Use a dedicated client for the push transaction.
        // The standard DatabaseRepository.query() releases the client to the pool after each call,
        // which would break BEGIN/COMMIT isolation. By getting a client directly from the pool,
        // all processData and setSyncData operations run on the same connection,
        // ensuring atomicity: either all changes commit or none do.
        const pool = db.getPool(realm);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const clientChange of syncDataRequest.changes) {
                await this.processDataWithClient(client, realm, clientChange);
                clientChange.serverdate = new Date().getTime();
                await this.setSyncDataWithClient(client, realm, userClient, clientChange);
            }

            userClient.lastsync = new Date().getTime();
            if (syncDataRequest.isPartial === 0) {
                userClient.syncing = null;
            }
            await UserRepository.getInstance().setUserClient(realm, userClient);

            await client.query('COMMIT');
            return new SyncDataPushResponse(userClient.lastsync!);
        }
        catch (ex) {
            await client.query('ROLLBACK').catch(() => {});
            logger.error(ex);
            if (userClient) {
                userClient.syncing = null;
                await UserRepository.getInstance().setUserClient(realm, userClient);
            }
            throw ex;
        } finally {
            client.release();
        }
    }

    private async processDataWithClient(client: any, realm: string, syncData: SyncData): Promise<void> {
        const jsonData = await client.query(
            `SELECT json FROM ${Tables.Data} WHERE rowguid = $1`, [syncData.rowguid]
        );
        let sql: string;
        if (jsonData.rowCount === 0) {
            sql = `INSERT INTO ${Tables.Data} (rowguid, json) VALUES ($1, $2)`;
        } else {
            if (syncData.operation === "D") {
                sql = `DELETE FROM ${Tables.Data} WHERE rowguid = $1`;
                await client.query(sql, [syncData.rowguid]);
                return;
            }
            sql = `UPDATE ${Tables.Data} SET json = $2 WHERE rowguid = $1`;
        }
        await client.query(sql, [syncData.rowguid, syncData.rowData]);
    }

    private async setSyncDataWithClient(client: any, realm: string, userClient: UserClient, syncData: SyncData) {
        const sql = `INSERT INTO ${Tables.SyncData}
            (userid, clientid, tablename, rowguid, operation, clientdate, serverdate)
            VALUES($1, $2, $3, $4, $5, $6, $7)`;
        await client.query(sql, [
            userClient.userid, userClient.clientid, syncData.tablename,
            syncData.rowguid, syncData.operation, syncData.clientdate, syncData.serverdate
        ]);
    }

    /**
     * Save the data to the syncData table
     * @param realm 
     * @param userClient 
     * @param syncData 
     * @returns 
     */
    private async setSyncData(realm: string, userClient: UserClient, syncData: SyncData) {
        const sql = `INSERT INTO ${Tables.SyncData}
            (userid, clientid, tablename, rowguid, operation, clientdate, serverdate)
            VALUES( $1, $2, $3, $4, $5, $6, $7);`;
        return (await this.getDB()).query(sql,
            [
                userClient.userid,
                userClient.clientid,
                syncData.tablename,
                syncData.rowguid,
                syncData.operation,
                syncData.clientdate,
                syncData.serverdate
            ], { realm });
    }

    /**
     * Cancel current sync because some error occurred client side
     * @param realm 
     * @param clientid 
     * @param userToken 
     * @returns 
     */
    public async cancelSync(realm: string, clientId: string): Promise<boolean> {
        const userClient: UserClient =
            await UserRepository.getInstance().getUserClient(realm, clientId);
        if (!userClient) {
            throw Error("Client id not found, cannot cancel sync!");
        }
        userClient.syncing = null;
        await UserRepository.getInstance().setUserClient(realm, userClient);
        return true;
    }

    /// Get changes from DB (required clientid, ???)
    private async getServerChanges(realm: string, userId: string, lastSync: number): Promise<Array<SyncData>> {
        const sql = `
            SELECT userid, id,  rowguid, operation, tablename,  clientdate, serverdate, clientid
            FROM ${Tables.SyncData} WHERE id IN (
            SELECT MAX(id) FROM ${Tables.SyncData} WHERE userid=$1 AND serverdate > $2  GROUP BY rowguid
            )`;
        return (await this.getDB()).query(sql, [userId, lastSync], { realm });
    }

    /// Return only the json data for the passed rowguid
    private async getRowDataValue(realm: string, rowguid: string) {
        const sql = `SELECT json FROM ${Tables.Data} WHERE rowguid = $1`;
        return (await this.getDB()).query(sql, [rowguid], { realm, singleResult: true });
    }


    /// Provvedi alle operazioni di inserimento, aggiornamento e cancellazione sulla tabella indicata
    private async processData(realm: string, syncData: SyncData): Promise<void> {
        const jsonData = await this.getRowDataValue(realm, syncData.rowguid);
        let sql;
        if (jsonData == null) {
            sql = `INSERT INTO ${Tables.Data} (rowguid, json) VALUES ($1, $2)`;
        } else {
            // Previously operation "D" (delete) just returned without deleting,
            // so removed rows persisted in the data table forever.
            if (syncData.operation === "D") {
                sql = `DELETE FROM ${Tables.Data} WHERE rowguid = $1`;
                await (await this.getDB()).query(sql, [syncData.rowguid], { realm });
                return;
            }
            sql = `UPDATE ${Tables.Data} SET json = $2 WHERE rowguid = $1`;
        }
        await (await this.getDB()).query(sql, [syncData.rowguid, syncData.rowData], { realm });
    }

}





