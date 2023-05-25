import { createHash } from "crypto";

/**
     * Encrypt the password
     * @param password 
     * @param salt 
     * @returns 
     */
export function encryptPassword(password: string, salt: string) {
    return createHash("sha512").update(password + salt).digest("hex");
} 