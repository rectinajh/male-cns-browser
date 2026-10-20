import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { kimiApiPlugin } from "./plugins/kimiApiPlugin.ts";

const webRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), kimiApiPlugin(webRoot)],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "plugins/**/*.test.ts"],
  },
});
