import { pool } from './index';

export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');

    const client = await pool.connect();

    // Test basic query
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connection successful');
    console.log('  Current time:', result.rows[0].now);

    // Check all tables exist
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n✓ Tables in database:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    // Verify indexes
    const indexes = await client.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    console.log(`\n✓ Total indexes: ${indexes.rowCount}`);

    client.release();

    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    return false;
  }
}

if (require.main === module) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    });
}
