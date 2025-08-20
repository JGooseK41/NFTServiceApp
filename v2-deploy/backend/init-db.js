const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read the schema file
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('Database initialized successfully!');
    
    // Add some sample approved process servers (optional)
    if (process.env.NODE_ENV === 'development') {
      console.log('Adding sample data...');
      
      const sampleServers = [
        {
          wallet: 'TGdD34RR3rZfUozoQLze9d4tzFbigL4JAY',
          agency: 'Demo Process Service LLC',
          email: 'demo@processservice.com',
          jurisdictions: ['California', 'Nevada', 'Arizona']
        },
        {
          wallet: 'TNaps6xxSCuCvjxDyM2M5rhutuwq93xaLh',
          agency: 'Blockchain Legal Services',
          email: 'info@blockchainlegal.com',
          jurisdictions: ['New York', 'New Jersey', 'Connecticut']
        }
      ];
      
      for (const server of sampleServers) {
        await pool.query(`
          INSERT INTO process_servers 
          (wallet_address, agency_name, contact_email, jurisdictions, status)
          VALUES ($1, $2, $3, $4, 'approved')
          ON CONFLICT (wallet_address) DO NOTHING
        `, [
          server.wallet.toLowerCase(),
          server.agency,
          server.email,
          JSON.stringify(server.jurisdictions)
        ]);
      }
      
      console.log('Sample data added.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();