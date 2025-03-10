import { Request, Response } from "express";
import * as fs from 'fs';
const path = require("path");

const TEMP_DIR = process.env.TEMP_UPLOADS || path.join(__dirname, '../..', "temp_uploads"); // Directory for temp files

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);



export class JSONUploadingRepository {
    /*
     private async getDB() {
         return await DatabaseRepository.getInstance();
     }
  
     // Function to get last saved chunk for a client
     private async getLastSavedChunk(clientId: string, realm: string) {
         const db = await this.getDB();
         const result = await db.query("SELECT last_chunk FROM upload_sessions WHERE clientid = $1", [clientId], { realm: realm, singleResult: true });
         return result.rowCount ? result.rows[0].last_chunk : 0;
     };
 
     // Function to update progress
     private async saveChunkProgress(clientId, chunkIndex, realm: string) {
         const db = await this.getDB();
         await db.query("UPDATE upload_sessions SET last_chunk = $1, updated_at = NOW() WHERE clientid = $2", [chunkIndex, clientId], { realm: realm });
     };
 
     // Function to mark upload as completed
     private async markUploadCompleted(clientId: string, realm: string) {
         const db = await this.getDB();
         await db.query("UPDATE upload_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE clientid = $1", [clientId], { realm: realm });
     };
     */




    async processChunk(args: { clientId: string, realm: string, req: Request, res: Response }): Promise<any> {
        try {
            // const db = await this.getDB();
            const filePath = path.join(TEMP_DIR, `${args.clientId}.json`);
            const { chunkIndex, data, start, end, chunks } = args.req.body;
            console.log(`Receiving: ${chunkIndex + 1}/${chunks} - start ${start} - end  ${end}`);
            if (chunkIndex == 0) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                // await db.query("DELETE FROM upload_sessions WHERER clientid = $1", [args.clientId], { realm: args.realm });
            }
            // Ensure there's only one active session per client
            /*await db.query(
                `INSERT INTO upload_sessions (clientid, file_path)
                VALUES ($1, $2) ON CONFLICT (clientid) DO NOTHING`,
                [args.clientId, filePath], { realm: args.realm }
            );
            */
            fs.appendFileSync(filePath, data, "utf-8");


            // If it's last chunk return the full json...
            if (chunkIndex == chunks - 1) {
                //await db.query("UPDATE upload_sessions SET status = 'COMPLETED', last_chunk=$2 WHERE clientid = $1", [args.clientId, chunkIndex], { realm: args.realm });
                const fullJsonString = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(fullJsonString);
            }
            // else {
            // await db.query("UPDATE upload_sessions SET status = 'IN_PROGRESS', last_chunk=$2 WHERE clientid = $1", [args.clientId, chunkIndex], { realm: args.realm });
            // }

        } catch (err) {

            console.error("❌ Unexpected error:", err);
            // const db = await this.getDB();
            // await db.query("UPDATE upload_sessions SET status = 'FAILED' WHERE clientid = $1", [args.clientId], { realm: args.realm });
            throw err;
        }

    }



    /*
    async delete(clientId: string, realm: string) {
        try {
            const filePath = path.join(TEMP_DIR, `${clientId}.json`);
            const db = await this.getDB();

            // Remove tracking entry from PostgreSQL
            await db.query("DELETE FROM upload_sessions WHERE clientid = $1", [clientId], { realm: realm });

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            console.log(`🗑️ Cleanup requested for client ${clientId}`);

        } catch (err) {
            console.error("❌ Error during cleanup:", err);
        }
    }

    async getLastChuck(clientId: string, realm: string) {
        try {
            const db = await this.getDB();
            // Remove tracking entry from PostgreSQL
            const lastChunk = await db.query("SELECT last_chunk, status FROM upload_sessions WHERE clientid = $1", [clientId], { realm: realm, singleResult: true });
            return { lastChunk };
        } catch (err) {
            console.error("❌ Error getting lastChunck:", err);
        }
        return { lastChunk: 0 };
    }
        

    // Function to read and parse JSON file
    async parseUploadedJson(clientId: string, realm: string) {
        try {
            const filePath = path.join(TEMP_DIR, `${clientId}.json`);

            if (!fs.existsSync(filePath)) {
                console.log(`❌ No JSON file found for client ${clientId}`);
                return null;
            }

            // Read file and parse JSON
            const rawData = fs.readFileSync(filePath, "utf8");
            const jsonData = JSON.parse(rawData);

            console.log(`✅ JSON Parsed for client ${clientId}:`, jsonData);
            // Delete
            this.delete(clientId, realm);
            return jsonData;

        } catch (err) {
            console.error("❌ Error parsing JSON file:", err);
            return null;
        }
    };
*/
}


