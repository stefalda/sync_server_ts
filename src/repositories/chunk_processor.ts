
import { Request, Response } from 'express';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
//import * as lockfile from 'proper-lockfile'; // Avrai bisogno di questa dipendenza
import { logger } from '../helpers/logger';

import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';

const unlinkAsync = promisify(fs.unlink);
const rmAsync = promisify(fs.rm);

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
                // Usa un lock per evitare problemi di concorrenza durante l'assemblaggio
                //const release = await lockfile.lock(filePath, { retries: 5 });
                return await this.assembleFile(filePath, chunkDirPath + "_completed", chunkFiles);

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

    private async assembleFile2(filePath: string, chunkDirPath: string, chunkFiles: Array<string>): Promise<any> {
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

            // Read and return the final assembled file
            const fullJsonString = await fsPromises.readFile(filePath, 'utf-8');
            // Delete the uploaded file
            await fs.unlinkSync(filePath);
            // Return the json data
            return JSON.parse(fullJsonString);
        } catch (error) {
            logger.error("Error assembling file:", error);
            throw error;
        }

    }


    private async assembleFile(filePath: string, chunkDirPath: string, chunkFiles: string[]): Promise<any> {
        try {
            const fileStream = fs.createWriteStream(filePath);
    
            // Sort chunks numerically
            const sortedChunks = chunkFiles
                .filter(file => file.startsWith('chunk_'))
                .sort((a, b) => parseInt(a.replace('chunk_', '')) - parseInt(b.replace('chunk_', '')));
    
            // Stream chunks into the final file
            for (const chunkFile of sortedChunks) {
                const chunkPath = path.join(chunkDirPath, chunkFile);
                await pipeline(fs.createReadStream(chunkPath), fileStream);
            }
    
            // Close the file stream
            await new Promise<void>((resolve, reject) => {
                fileStream.end();
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });
    
            // Delete chunk files concurrently
            await Promise.all(chunkFiles.map(chunkFile => unlinkAsync(path.join(chunkDirPath, chunkFile))));
            await rmAsync(chunkDirPath, { recursive: true, force: true });
    
            // **Stream JSON parsing instead of loading it all into memory**
            return new Promise<any>((resolve, reject) => {
                const jsonStream = fs.createReadStream(filePath, 'utf-8').pipe(parser()).pipe(streamValues());
                const jsonArray: any[] = [];
    
                jsonStream.on('data', ({ value }) => {
                    jsonArray.push(value); // Add values to the array as they stream in
                });
    
                jsonStream.on('end', async () => {
                    await unlinkAsync(filePath); // Delete file after processing
                    resolve(jsonArray); // Resolve with the streamed JSON
                });
    
                jsonStream.on('error', reject);
            });
    
        } catch (error) {
            logger.error("Error assembling file:", error);
            throw error;
        }
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