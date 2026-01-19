
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for username collisions...');
    const users = await prisma.user.findMany({
        select: { id: true, username: true }
    });

    const counts = new Map();
    for (const user of users) {
        const lower = user.username.toLowerCase();
        if (!counts.has(lower)) {
            counts.set(lower, []);
        }
        counts.get(lower).push(user.username);
    }

    let collisions = 0;
    for (const [lower, names] of counts.entries()) {
        if (names.length > 1) {
            console.log(`Collision for "${lower}": ${names.join(', ')}`);
            collisions++;
        }
    }

    if (collisions === 0) {
        console.log('No username collisions found.');
    } else {
        console.log(`${collisions} collisions found.`);
    }

    // Also check for users that are not lowercased
    const nonLower = users.filter(u => u.username !== u.username.toLowerCase());
    console.log(`${nonLower.length} users have non-lowercase usernames.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
