import { scryptSync } from "crypto";

/**
     * Encrypt the password using scrypt key-stretching
     * (replaced SHA-512 which is hardware-accelerated and attackable at billions of attempts/second)
     * 
     * scrypt parameters: N=16384 (CPU/memory cost), r=8 (block size), p=1 (parallelization)
     * These are OWASP-recommended minimums for interactive logins as of 2024.
     * Key length 64 bytes = 512 bits, matching previous SHA-512 output format.
     * 
     * @param password 
     * @param salt 
     * @returns hex string (128 chars, 64 bytes)
     */
export function encryptPassword(password: string, salt: string) {
    return scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
} 