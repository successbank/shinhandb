import { pool } from './index';
import bcrypt from 'bcrypt';

export async function seedDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if data already exists
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('Database already seeded. Skipping...');
      await client.query('ROLLBACK');
      return;
    }

    console.log('Seeding database...');

    // Create admin user
    const hashedPassword = await bcrypt.hash('1234!@#$', 10);
    await client.query(`
      INSERT INTO users (username, name, password, role)
      VALUES ($1, $2, $3, $4)
    `, ['admin', '최고관리자', hashedPassword, 'ADMIN']);

    // Create categories for HOLDING
    const holdingCategories = [
      { name: 'CSR', order: 1 },
      { name: '브랜드', order: 2 },
      { name: '스포츠', order: 3 },
      { name: '기타', order: 4 },
    ];

    for (const cat of holdingCategories) {
      await client.query(`
        INSERT INTO categories (name, user_role, "order")
        VALUES ($1, $2, $3)
      `, [cat.name, 'HOLDING', cat.order]);
    }

    // Create categories for BANK
    const bankCategories = [
      { name: '브랜드 PR', order: 1 },
      { name: '상품&서비스', order: 2 },
      { name: '땡겨요', order: 3 },
      { name: '기타', order: 4 },
    ];

    for (const cat of bankCategories) {
      await client.query(`
        INSERT INTO categories (name, user_role, "order")
        VALUES ($1, $2, $3)
      `, [cat.name, 'BANK', cat.order]);
    }

    await client.query('COMMIT');
    console.log('✓ Database seeded successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
}
