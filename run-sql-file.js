import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pkg from "pg";

const { Client } = pkg;

dotenv.config();

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error("Usage: node run-sql-file.js <sql-file>");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing SUPABASE_DB_URL or DATABASE_URL");
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), sqlFile);
const sql = fs.readFileSync(resolvedPath, "utf8");

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied SQL file: ${sqlFile}`);
} finally {
  await client.end().catch(() => {});
}
