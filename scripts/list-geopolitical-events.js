const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const dbName = process.env.PG_WORLD_EVENTS_DATABASE || 'world_events';

async function listGeopoliticalEvents() {
  console.log(`--- Fetching Geopolitical Events from "${dbName}" ---`);
  
  const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST,
    database: dbName,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT || 5432,
  });

  let client;
  try {
    client = await pool.connect();
    console.log(`✅ Connected to "${dbName}" database.`);

    const query = `
      SELECT 
        event_start_date as date, 
        event_name as name, 
        description 
      FROM events 
      WHERE event_category = 'Geopolitical' 
      ORDER BY event_start_date ASC;
    `;
    
    const result = await client.query(query);

    if (result.rows.length > 0) {
      console.log(`📋 Found ${result.rows.length} geopolitical events:`);
      console.table(result.rows);
    } else {
      console.log('No geopolitical events found in the database.');
    }

  } catch (err) {
    console.error('❌ Script failed:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
    console.log('--- Query Complete ---');
  }
}

listGeopoliticalEvents(); 