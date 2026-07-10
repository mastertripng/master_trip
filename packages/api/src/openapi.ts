import { OpenAPIGenerator } from "@orpc/openapi";
import { appRouter } from "./router";

const generator = new OpenAPIGenerator();

// Fallback to localhost for local development if NEXT_PUBLIC_SITE_URL is not set
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return `${process.env.NEXT_PUBLIC_SITE_URL}/api`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api`;
  
  // If another dev runs it locally, they might use a different port (e.g., 3000)
  const port = process.env.PORT || 3011;
  return `http://localhost:${port}/api`;
};

export const openAPI = generator.generate(appRouter, {
  info: {
    title: "Master-Trip API",
    version: "1.0.0",
    description: "Internal APIs for Flights, Hotels, Tours, and Master-Trip Ops.",
  },
  servers: [{ url: getBaseUrl() }],
});
