import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve("src/shared"),
      "@main": resolve("src/main"),
    },
  },
  test: {
    environment: "node",
    include: ["Tests/unit/**/*.test.ts"],
  },
});
