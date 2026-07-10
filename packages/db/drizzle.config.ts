import { config } from "dotenv";
import { resolve } from "path";

// Load the root .env file so drizzle-kit can pick up DATABASE_URL
// regardless of the CWD from which it is invoked.
config({ path: resolve(__dirname, "../../.env") });

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Drizzle Kit requires a direct session connection (5432) for migrations. 
    // The pooler (6543) strips advisory locks and causes silent failures.
    url: process.env.DATABASE_URL!.replace(":6543", ":5432"),
  },
};
