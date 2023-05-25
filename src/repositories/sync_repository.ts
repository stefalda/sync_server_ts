import { SyncData, SyncDataPullResponse, SyncDataPushResponse, SyncDataRequest } from "../models/api/sync_data";
import { Tables, UserClient, UserToken } from "../models/db/models";
import { AuthenticationRepository } from "./authentication_repository";
import { DatabaseRepository } from "./database_repository";

export class SyncRepository {

    private static instance: SyncRepository;



    private constructor() {

    }



    public static getInstance(): SyncRepository {
        if (!SyncRepository.instance) {
            SyncRepository.instance = new SyncRepository();
        }

        return SyncRepository.instance;
    }

    // Instance methods

    private async getDB() {
        return await DatabaseRepository.getInstance();

    }

    async pull(realm: any, syncDataRequest: SyncDataRequest, userToken: UserToken): Promise<SyncDataPullResponse> {
        // Ottieni lo userClient
        const userClient =
            await AuthenticationRepository.getInstance().getUserClient(realm, syncDataRequest.clientId);
        if (!userClient) {
            throw Error("Client id not found!");
        }
        // Verifica che non ci sia un'altra sincronizzazione in corso per l'utente
        if (await this.isAlreadySyncing(realm, userClient)) {
            throw Error("The user is already syncing elsewhere");
        }
        // Segna la sincronizzazione come attiva
        userClient.syncing = new Date().getTime();
        await AuthenticationRepository.getInstance().setUserClient(realm, userClient);
        const syncDataPullResponse = new SyncDataPullResponse(userClient.clientid!);
        try {
            // Cicla sui cambiamenti presenti sul server
            const serverChanges = await this.getServerChanges(realm, userClient.userid!, userClient.lastsync!) || [];
            // Confronta i cambiamenti presenti sul client con quelli del server
            // per capire se alcuni sono sorpassati e non vanno acquisiti (e viceversa)
            for (let client of syncDataRequest.changes) {
                // Filter server data by rowguid and check the date
                const serverData =
                    serverChanges.filter((server) => server.rowguid == client.rowguid);
                if (serverData.length > 0) {
                    // Only the latest value is returned for the specific id
                    const server = serverData[0];
                    // Se il dato del server è più recente di quello sul client scarta la modifica proveniente dal client
                    if (server.clientdate >=
                        client.clientdate) {
                        syncDataPullResponse.outdatedRowsGuid.push(client.rowguid.toString());
                    } else {
                        // Rimuovi dai cambiamenti del server quello presente dal momento che andrà sovrascritto con
                        // quello del client (quindi non ha senso inviarlo al client)
                        serverChanges.splice(serverChanges.indexOf(server), 1);
                    }
                }
            }
            // Aggiungi ai serverChanges i dati da inviare al client per il suo aggiornamento
            // a meno che si tratti di una cancellazione
            for (let serverChange of serverChanges) {
                if (serverChange.operation != "D") {
                    serverChange.rowData = JSON.parse(await this.getRowDataValue(realm, serverChange.rowguid));
                }
            }
            // Aggiungi a syncDetails le modifiche presenti sul server e da applicare sul client
            syncDataPullResponse.data.concat(serverChanges);
            return syncDataPullResponse;
        }
        catch (ex) {
            // Reset syncing date
            if (userClient) {
                userClient.syncing = null;
                await AuthenticationRepository.getInstance().setUserClient(realm, userClient);
            }
            throw ex;
        }

    }

    async push(realm: any, syncDataRequest: SyncDataRequest, userToken: UserToken): Promise<SyncDataPushResponse> {
        // Ottieni lo userClient
        const userClient =
            await AuthenticationRepository.getInstance().getUserClient(realm, syncDataRequest.clientId);
        if (!userClient) {
            throw Error("Client id not found!");
        }
        // Verifica che non ci sia un'altra sincronizzazione in corso per l'utente
        if (userClient.syncing == null) {
            throw Error("You should pull before pushing...");
        }

        try {

            for (let clientChange of syncDataRequest.changes) {
                // Aggiorna i dati a partire da quanto contenuto nel campo data
                //print(
                //    "Table:${clientChange.tablename} Operation:${clientChange.operation} Key:${clientChange.rowguid}");
                await this.processData(realm, clientChange, userClient.userid!);
                // Inserisci la riga sulla tabella SyncData del server aggiungendo la data
                //it.rowguid = UUID.fromString(it.rowguid)
                clientChange.serverdate = new Date().getTime();
                await this.setSyncData(realm, userClient, clientChange);
            }

            // Update Client Last Sync Date and delete syncing date
            userClient.lastsync = new Date().getTime();
            userClient.syncing = null;
            await AuthenticationRepository.getInstance().setUserClient(realm, userClient);
            return new SyncDataPushResponse(userClient.lastsync!);
        }
        catch (ex) {
            // Reset syncing date
            if (userClient) {
                userClient.syncing = null;
                await AuthenticationRepository.getInstance().setUserClient(realm, userClient);
            }
            throw ex;
        }
    }

    /**
     * Save the data to the syncData table
     * @param realm 
     * @param userClient 
     * @param syncData 
     * @returns 
     */
    private async setSyncData(realm: any, userClient: UserClient, syncData: SyncData) {
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

    /// Verifica se è in corso una sincronizzazione per lo stesso utente da un altro client
    /// Se la sincronizzazione è troppo vecchia la rimuove...
    private async isAlreadySyncing(realm: string, userClient: UserClient): Promise<boolean> {
        if (userClient.syncing == null) return false;
        // Verifica se la sincronizzazione dura da più di 5', nel caso annullala
        const now = new Date();
        var differenceInMinutes = Math.abs(now.getTime() - userClient.syncing!) / 1000 / 60;
        if (differenceInMinutes > 5) {
            userClient.syncing = null;
            AuthenticationRepository.getInstance().setUserClient(realm, userClient);
            return false;
        }
        return true;
    }

    /// Get changes from DB (required clientid, ???)
    private async getServerChanges(realm: string, userId: number, lastSync: number): Promise<Array<SyncData>> {
        const sql = `
            SELECT userid, id,  rowguid, operation, tablename,  clientdate, serverdate , clientid
            FROM ${Tables.SyncData} WHERE ID IN (
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
    private async processData(realm: any, syncData: SyncData, userId: number): Promise<void> {
        // Read the current RowData
        const jsonData = await this.getRowDataValue(realm, syncData.rowguid);
        // Update/Insert the json data
        let sql;
        if (jsonData == null) {
            // Insert
            sql = `INSERT INTO ${Tables.Data} (rowguid, json) VALUES ($1, $2)`;
        } else {
            // Update
            // If it's an update do nothing, so keep the last valid data
            if (syncData.operation == "D") {
                return;
            }
            sql = `UPDATE ${Tables.Data} SET json = $2 WHERE rowguid = $1`;
        }
        // Persist the data
        return (await this.getDB()).query(sql, [syncData.rowguid, syncData.rowData], { realm });
    }

}





