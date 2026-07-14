const winston = require('winston');
require('winston-daily-rotate-file');
import * as path from 'path';

// Create a single transport for all log levels
const transport = new winston.transports.DailyRotateFile({
    filename: path.join(__dirname, '../..', 'logs') + '/application-%DATE%.log',  // Single file for all logs
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',          // Rotate file when it reaches 20MB
    maxFiles: '14d',         // Keep log files for 14 days
    level: 'debug'           // Log all levels (debug and higher)
});

// Create the logger
export const logger = winston.createLogger({
    level: 'debug',  // Minimum log level to log
    transports: [
        transport
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            // Previously also called console.log(msg), which caused every message
            // to appear twice — once via console.log, once via the file transport.
            // The file transport alone is sufficient.
            const msg = `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
            return msg;
        })
    )
});

