import { Client } from 'pg';

const connectionString = "postgresql://upbeatafrica:upbeatafrica@srv1822912.hstgr.cloud:5432/upbeatafrica";
const client = new Client({ connectionString });

async function inspectDb() {
  await client.connect();
  try {
    const res = await client.query('SELECT id, tenant_id, gateway, is_active FROM tenant_payment_accounts ORDER BY created_at DESC LIMIT 10');
    console.log("--- TENANT PAYMENT ACCOUNTS ---");
    console.table(res.rows);
  } finally {
    await client.end();
  }
}

inspectDb().catch(console.error);
