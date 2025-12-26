import { pool } from './index';
import * as fs from 'fs';
import * as path from 'path';

export async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // 001_, 002_, 003_ 순서대로 정렬

    for (const file of files) {
      console.log(`  Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log(`  ✓ ${file} completed`);
    }

    console.log('✓ All migrations completed successfully');
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
