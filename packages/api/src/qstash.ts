import { Client } from "@upstash/qstash";

// Only initialize if token is present to avoid crashing if not fully configured yet
export const qstash = process.env.QSTASH_TOKEN 
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;
