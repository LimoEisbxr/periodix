import { prisma } from '../store/prisma.js';
import {
    encryptSecret,
    hashPassword,
    verifyPassword,
} from '../server/crypto.js';

// Service now separates local authentication (hashedPassword) from encrypted Untis credential.

export async function createUserIfNotExists(input: {
    username: string;
    password: string;
    displayName?: string | undefined;
}) {
    const normalizedUsername = input.username.toLowerCase();
    const existing: any = await (prisma as any).user.findFirst({
        where: { username: normalizedUsername },
        select: { id: true },
    });
    if (existing) return existing;
    const hashed = await hashPassword(input.password);
    const enc = encryptSecret(input.password);
    return (prisma as any).user.create({
        data: {
            username: normalizedUsername,
            hashedPassword: hashed,
            untisSecretCiphertext: enc.ciphertext,
            untisSecretNonce: enc.nonce,
            untisSecretKeyVersion: enc.keyVersion,
            displayName: input.displayName ?? input.username,
        },
    });
}

export async function findUserByCredentials(input: {
    username: string;
    password: string;
}) {
    const user: any = await (prisma as any).user.findFirst({
        where: { username: input.username.toLowerCase() },
    });
    if (!user) return null;
    if (!user.hashedPassword) return null; // user must have been created after migration
    const ok = await verifyPassword(user.hashedPassword, input.password);
    return ok ? user : null;
}
