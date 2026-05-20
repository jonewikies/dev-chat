import { getDatabase, saveDatabase } from './src/database/connection';

async function addMilestone() {
  const db = await getDatabase();
  try {
    db.exec('ALTER TABLE projects ADD COLUMN milestone TEXT');
    console.log("Added milestone column.");
    saveDatabase();
  } catch(e: any) {
    if (e.message.includes('duplicate column name')) {
      console.log('Column already exists');
    } else {
      console.error(e);
    }
  }
}

addMilestone();
