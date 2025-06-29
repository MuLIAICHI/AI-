import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
dotenv.config({path: "./.env.local"});
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});


// ok when the user start a new chat is it gonna be appeared as the chat ID within the url, 

// can u check if we have this implemented ?


// npx drizzle-kit push --config ./drizzle.config.ts