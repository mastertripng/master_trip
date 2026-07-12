import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(__dirname, "../../.env") });

async function run() {
  const url = process.env.DATABASE_URL!.replace(":6543", ":5432");
  const sql = postgres(url);
  
  try {
    const exts = await sql`SELECT extname FROM pg_extension;`;
    console.log("Installed extensions:", exts.map(e => e.extname).join(", "));
  } catch (err: any) {
    console.error("ERROR:");
    console.error(err.message);
  } finally {
    await sql.end();
  }
}

run();
