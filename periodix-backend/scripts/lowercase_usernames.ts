
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgresa@localhost:5432/untis_pro?schema=public",
});

async function main() {
    console.log('Connecting to database...');
    const client = await pool.connect();
    try {
        console.log('Finding mixed-case usernames...');
        const res = await client.query('SELECT id, username FROM "User"');
        const users = res.rows;
        
        let updatedCount = 0;
        let collisions = [];

        for (const user of users) {
            const lower = user.username.toLowerCase();
            if (user.username !== lower) {
                // Check for collision
                const collision = users.find(u => u.username === lower && u.id !== user.id);
                if (collision) {
                    collisions.push({ original: user.username, lower, id: user.id, collisionId: collision.id });
                } else {
                    console.log(`Lowercasing "${user.username}" for user ${user.id}`);
                    await client.query('UPDATE "User" SET username = $1 WHERE id = $2', [lower, user.id]);
                    updatedCount++;
                }
            }
        }

        console.log(`Successfully updated ${updatedCount} usernames.`);
        if (collisions.length > 0) {
            console.warn(`WARNING: Found ${collisions.length} collisions that cannot be automatically merged:`);
            for (const c of collisions) {
                console.warn(` - "${c.original}" (id: ${c.id}) would collide with already existing lowercase "${c.lower}" (id: ${c.collisionId})`);
            }
        }
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(console.error);
