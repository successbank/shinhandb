import { pool } from './index';
import * as fs from 'fs';
import * as path from 'path';

export async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    const migrationPath = path.join(__dirname, 'migrations', '001_init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.query(sql);

    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Database setup complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
