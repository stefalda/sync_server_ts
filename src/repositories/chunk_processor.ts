
import { Request, Response } from 'express';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
//import * as lockfile from 'proper-lockfile'; // Avrai bisogno di questa dipendenza
import { parse } from 'jsonstream';
import { logger } from '../helpers/logger';
type ChunkProcessorResult = {
    status: string;
    progress: string;
    percentage: number;
}

class ChunkProcessor {
    private readonly TEMP_DIR = process.env.TEMP_UPLOADS || path.join(__dirname, '../..', "temp_uploads"); // Directory for temp files
    constructor() {

        // Assicura che la directory esista
        if (!fs.existsSync(this.TEMP_DIR)) {
            fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        }
    }

    async processChunk(args: { clientId: string, realm: string, req: Request, res: Response }): Promise<ChunkProcessorResult> {
        const { chunkIndex, data, start, end, chunks, syncId, totalSize } = args.req.body;
        const clientPath = path.join(this.TEMP_DIR, `${args.clientId}`);
        const filePath = path.join(clientPath, `${args.clientId}_${syncId}.json`);
        const chunkDirPath = path.join(clientPath, `${syncId}_chunks`);

        logger.info(`Receiving: ${chunkIndex + 1}/${chunks} - TotalSize: ${totalSize}`);

        try {
            // Crea la directory per i chunk se non esiste
            if (!fs.existsSync(chunkDirPath)) {
                logger.info(`Initializing upload for client ${args.clientId}`);
                // Delete all the files in the client path
                if (await fsPromises.stat(clientPath).catch(() => false)) {
                    await fsPromises.rm(clientPath, { recursive: true, force: true });
                }

                await fsPromises.mkdir(chunkDirPath, { recursive: true });

                // Cancella il file finale se esiste
                if (fs.existsSync(filePath)) {
                    await fsPromises.unlink(filePath);
                }
            }

            // Salva il chunk in un file temporaneo separato
            const chunkTempFilePath = path.join(chunkDirPath, `_chunk_${chunkIndex}.json`);
            const chunkFilePath = path.join(chunkDirPath, `chunk_${chunkIndex}.json`);
            //await fsPromises.writeFile(chunkFilePath, data, 'utf-8');
            await this.writeFileSafely(chunkTempFilePath, data);

            fs.renameSync(chunkTempFilePath, chunkFilePath);

            // Verifica se tutti i chunk sono stati ricevuti
            const chunkFiles = await fsPromises.readdir(chunkDirPath);
            const receivedChunks = chunkFiles.filter(file => file.startsWith('chunk_')).length;

            //logger.info(`Progress: ${receivedChunks}/${chunks} chunks received`);

            if (receivedChunks === chunks && fs.existsSync(chunkDirPath) && await this.computeTotalSize(chunkDirPath) === totalSize) {
                logger.info(`All chunks received - assembling file`);
                // Rename the folder
                fs.renameSync(chunkDirPath, chunkDirPath + "_completed");

                return (await this.assembleFile(filePath, chunkDirPath + "_completed", chunkFiles)) as any;

            }

            // Ritorna lo stato di avanzamento se non è l'ultimo chunk
            return {
                status: 'IN_PROGRESS',
                progress: `${receivedChunks}/${chunks}`,
                percentage: Math.round((receivedChunks / chunks) * 100)
            };
        } catch (err) {
            logger.error(`❌ Error processing chunk ${chunkIndex} for client ${args.clientId}:`, err);
            throw err;
        }
    }

    private async assembleFile(filePath: string, chunkDirPath: string, chunkFiles: Array<string>): Promise<any> {
        try {
            const fileStream = fs.createWriteStream(filePath);

            // Ordina i chunk numericamente
            const sortedChunks = chunkFiles
                .filter(file => file.startsWith('chunk_'))
                .sort((a, b) => {
                    const indexA = parseInt(a.replace('chunk_', ''));
                    const indexB = parseInt(b.replace('chunk_', ''));
                    return indexA - indexB;
                });

            // Write all chunks sequentially
            for (const chunkFile of sortedChunks) {
                const chunkPath = path.join(chunkDirPath, chunkFile);
                const chunkContent = await fsPromises.readFile(chunkPath);
                fileStream.write(chunkContent);
            }

            // Close the write stream properly
            await new Promise<void>((resolve, reject) => {
                fileStream.end();
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });

            // Clean up chunk files
            await Promise.all(chunkFiles.map(chunkFile => fsPromises.unlink(path.join(chunkDirPath, chunkFile))));
            await fsPromises.rm(chunkDirPath, { recursive: true, force: true });

            logger.info("Completed file written to disk");

            // Read and return the final assembled file
            //const fullJsonString = await fsPromises.readFile(filePath, 'utf-8');
            // Return the json data
            //logger.info("JSON String loaded in memory... now I'll parse it");

            // const parsedObj = JSON.parse(fullJsonString);
            const parsedObj = await this.streamJsonFile(filePath);
            logger.info("JSON Object parsed and loaded in memory");

            // Delete the uploaded file
            //await fs.unlinkSync(filePath);
            logger.info("Return parsed file data ");

            return parsedObj;
        } catch (error) {
            logger.error("Error assembling file:", error);
            throw error;
        }

    }

    private async streamJsonFile(filePath: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const fs = require('fs');

            let result = {}; // Inizializziamo un oggetto vuoto invece di un array
            const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
                .pipe(parse({})) // Senza '*' per ottenere l'intero oggetto

            stream.on('data', (obj) => {
                // Poiché stiamo leggendo l'oggetto completo, assegniamo direttamente
                result = obj;
            });

            stream.on('end', async () => {
                try {
                    await fs.promises.unlink(filePath); // Elimina il file dopo averlo processato
                    resolve(result);
                } catch (err) {
                    console.warn('Failed to delete file:', err);
                    resolve(result); // Risolvi comunque anche se la cancellazione fallisce
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });
    }



    private async computeTotalSize(directoryPath: string): Promise<number> {
        try {
            const files = await fsPromises.readdir(directoryPath);
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(directoryPath, file);
                const stats = await fsPromises.stat(filePath);

                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            }
            logger.info("Total size = " + totalSize);
            return totalSize;
        } catch (err) {
            logger.error(`Error reading directory: ${err}`);
            return 0;
        }
    }

    async writeFileSafely(filePath: string, data: string) {
        const fileHandle = await fsPromises.open(filePath, 'w'); // Open file for writing
        try {
            await fileHandle.writeFile(data, 'utf-8'); // Write data
            await fileHandle.sync(); // Ensure data is flushed to disk
        } finally {
            await fileHandle.close(); // Close the file
        }
    }

}



export default new ChunkProcessor();