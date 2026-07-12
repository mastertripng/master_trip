import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

config({ path: resolve(__dirname, "../../.env") });

async function run() {
  const url = process.env.DATABASE_URL!.replace(":6543", ":5432");
  
  console.log("Connecting to database for migration...");
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  
  try {
    console.log("Enabling vector extension...");
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log("Vector extension enabled successfully.");
    
    console.log("Applying Drizzle migrations...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully!");
    
  } catch (err: any) {
    console.error("MIGRATION FAILED:");
    console.error(err.message);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

run();
