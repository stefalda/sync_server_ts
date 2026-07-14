
import { Request, Response } from 'express';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { parse } from 'jsonstream';
import { logger } from '../helpers/logger';

type ChunkProcessorResult = {
    status: string;
    progress: string;
    percentage: number;
}

// In-memory counter tracking received bytes per syncId.
// Replaces the O(n²) computeTotalSize loop that called readdir + per-file stat
// on every chunk. Keyed by syncId, cleaned up on completion or failure.
const receivedBytesBySyncId = new Map<string, number>();

function isValidId(id: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(id);
}

class ChunkProcessor {
    private readonly TEMP_DIR = process.env.TEMP_UPLOADS || path.join(__dirname, '../..', "temp_uploads");
    constructor() {

        // Assicura che la directory esista
        if (!fs.existsSync(this.TEMP_DIR)) {
            fs.mkdirSync(this.TEMP_DIR, { recursive: true });
        }
    }

    // Test support: reset internal state
    public reset(): void {
        receivedBytesBySyncId.clear();
    }

    async processChunk(args: { clientId: string, realm: string, req: Request, res: Response }): Promise<ChunkProcessorResult> {
        const { chunkIndex, data, start, end, chunks, syncId, totalSize } = args.req.body;

        // Path traversal protection: validate identifiers against strict pattern
        if (!isValidId(args.clientId)) {
            throw new Error(`Invalid clientId: ${args.clientId}`);
        }
        if (!isValidId(syncId)) {
            throw new Error(`Invalid syncId: ${syncId}`);
        }

        // Path containment: resolve to absolute path and verify it's within TEMP_DIR
        const resolvedTempDir = path.resolve(this.TEMP_DIR);
        const clientPath = path.resolve(path.join(resolvedTempDir, args.clientId));
        if (!clientPath.startsWith(resolvedTempDir)) {
            throw new Error(`Path traversal detected for clientId: ${args.clientId}`);
        }
        const filePath = path.join(clientPath, `${args.clientId}_${syncId}.json`);
        const chunkDirPath = path.join(clientPath, `${syncId}_chunks`);

        logger.info(`Receiving: ${chunkIndex + 1}/${chunks} - TotalSize: ${totalSize}`);

        try {
            if (!fs.existsSync(chunkDirPath)) {
                logger.info(`Initializing upload for client ${args.clientId}`);
                if (await fsPromises.stat(clientPath).catch(() => false)) {
                    await fsPromises.rm(clientPath, { recursive: true, force: true });
                }

                await fsPromises.mkdir(chunkDirPath, { recursive: true });

                if (fs.existsSync(filePath)) {
                    await fsPromises.unlink(filePath);
                }

                // Initialize byte counter when starting a new upload
                receivedBytesBySyncId.set(syncId, 0);
            }

            const chunkTempFilePath = path.join(chunkDirPath, `_chunk_${chunkIndex}.json`);
            const chunkFilePath = path.join(chunkDirPath, `chunk_${chunkIndex}.json`);
            await this.writeFileSafely(chunkTempFilePath, data);

            // Async rename instead of blocking fs.renameSync
            await fsPromises.rename(chunkTempFilePath, chunkFilePath);

            // Track received bytes in-memory instead of reading all files every chunk
            const chunkSize = Buffer.byteLength(data, 'utf-8');
            const currentTotal = (receivedBytesBySyncId.get(syncId) || 0) + chunkSize;
            receivedBytesBySyncId.set(syncId, currentTotal);

            const chunkFiles = await fsPromises.readdir(chunkDirPath);
            const receivedChunks = chunkFiles.filter(file => file.startsWith('chunk_')).length;

            if (receivedChunks === chunks && fs.existsSync(chunkDirPath) && currentTotal === totalSize) {
                logger.info(`All chunks received - assembling file`);
                // Atomic lock: try to create a lock directory. Only one request succeeds;
                // the rest get EEXIST and return IN_PROGRESS so the client retries.
                const lockDir = chunkDirPath + "_lock";
                try {
                    await fsPromises.mkdir(lockDir);
                } catch {
                    // Another request already holds the lock and is assembling
                    return {
                        status: 'IN_PROGRESS',
                        progress: `${receivedChunks}/${chunks}`,
                        percentage: Math.round((receivedChunks / chunks) * 100)
                    };
                }

                try {
                    await fsPromises.rename(chunkDirPath, chunkDirPath + "_completed");
                    const assembledData = await this.assembleFile(filePath, chunkDirPath + "_completed", chunkFiles);
                    return assembledData as any;
                } finally {
                    // Clean up lock and byte counter regardless of success or failure
                    await fsPromises.rm(lockDir, { recursive: true, force: true }).catch(() => {});
                    receivedBytesBySyncId.delete(syncId);
                }
            }

            return {
                status: 'IN_PROGRESS',
                progress: `${receivedChunks}/${chunks}`,
                percentage: Math.round((receivedChunks / chunks) * 100)
            };
        } catch (err) {
            logger.error(`Error processing chunk ${chunkIndex} for client ${args.clientId}:`, err);
            throw err;
        }
    }

    private async assembleFile(filePath: string, chunkDirPath: string, chunkFiles: Array<string>): Promise<any> {
        try {
            const fileStream = fs.createWriteStream(filePath);

            const sortedChunks = chunkFiles
                .filter(file => file.startsWith('chunk_'))
                .sort((a, b) => {
                    const indexA = parseInt(a.replace('chunk_', ''));
                    const indexB = parseInt(b.replace('chunk_', ''));
                    return indexA - indexB;
                });

            for (const chunkFile of sortedChunks) {
                const chunkPath = path.join(chunkDirPath, chunkFile);
                const chunkContent = await fsPromises.readFile(chunkPath);
                fileStream.write(chunkContent);
            }

            await new Promise<void>((resolve, reject) => {
                fileStream.end();
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            });

            await Promise.all(chunkFiles.map(chunkFile => fsPromises.unlink(path.join(chunkDirPath, chunkFile))));
            await fsPromises.rm(chunkDirPath, { recursive: true, force: true });

            logger.info("Completed file written to disk");

            const parsedObj = await this.streamJsonFile(filePath);
            logger.info("JSON Object parsed and loaded in memory");

            return parsedObj;
        } catch (error) {
            logger.error("Error assembling file:", error);
            throw error;
        }

    }

    private async streamJsonFile(filePath: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const fs = require('fs');

            let result = {};
            const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
                .pipe(parse({}))

            stream.on('data', (obj) => {
                result = obj;
            });

            stream.on('end', async () => {
                try {
                    await fs.promises.unlink(filePath);
                    resolve(result);
                } catch (err) {
                    console.warn('Failed to delete file:', err);
                    resolve(result);
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });
    }

    async writeFileSafely(filePath: string, data: string) {
        const fileHandle = await fsPromises.open(filePath, 'w');
        try {
            await fileHandle.writeFile(data, 'utf-8');
            await fileHandle.sync();
        } finally {
            await fileHandle.close();
        }
    }

}

export default new ChunkProcessor();
