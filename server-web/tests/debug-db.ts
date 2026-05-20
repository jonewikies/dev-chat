import { getDatabase, initializeSchema, execQuery, execStatement } from '../src/database/connection';

async function testDatabase() {
  console.log('Initializing database...');
  const db = await getDatabase();
  await initializeSchema();
  console.log('Database initialized');

  // Test INSERT
  console.log('\n--- Testing INSERT ---');
  execStatement(
    db,
    `INSERT INTO users (username, password_hash, email, display_name)
     VALUES (?, ?, ?, ?)`,
    ['testuser', 'hashedpass123', 'test@example.com', 'Test User']
  );
  console.log('INSERT completed');

  // Test last_insert_rowid
  console.log('\n--- Testing last_insert_rowid ---');
  const idResult = db.exec('SELECT last_insert_rowid() as id');
  console.log('ID result:', JSON.stringify(idResult, null, 2));
  const userId = idResult[0].values[0][0] as number;
  console.log('User ID:', userId);

  // Test SELECT with execQuery
  console.log('\n--- Testing SELECT with execQuery ---');
  const results = execQuery(db, `SELECT * FROM users WHERE id = ?`, [userId]);
  console.log('Query results:', JSON.stringify(results, null, 2));

  // Test direct SELECT
  console.log('\n--- Testing direct SELECT ---');
  const stmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
  stmt.bind([userId]);
  if (stmt.step()) {
    const row = stmt.get();
    console.log('Direct query row:', JSON.stringify(row, null, 2));
  } else {
    console.log('No rows found');
  }
  stmt.free();

  // Test all users
  console.log('\n--- Testing all users ---');
  const allUsers = execQuery(db, `SELECT * FROM users`, []);
  console.log('All users:', JSON.stringify(allUsers, null, 2));
}

testDatabase().catch(console.error);
