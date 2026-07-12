import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(__dirname, "../../.env") });

async function run() {
  const url = process.env.DATABASE_URL!.replace(":6543", ":5432");
  const sql = postgres(url);
  
  try {
    // Try to run the migration manually to see the exact error
    await sql`
      CREATE TABLE "travel_policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider" text NOT NULL,
        "category" text NOT NULL,
        "content" text NOT NULL,
        "embedding" vector(1536),
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    console.log("Migration successful");
  } catch (err: any) {
    console.error("MIGRATION ERROR:");
    console.error(err.message);
    console.error(err);
  } finally {
    await sql.end();
  }
}

run();
