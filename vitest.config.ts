import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@shared": resolve("src/shared"),
      "@main": resolve("src/main"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["Tests/unit/**/*.test.ts", "src/renderer/src/**/*.test.ts"],
          exclude: [
            "src/renderer/src/**/*.stories.test.ts",
            "src/renderer/src/features/overlay/hooks/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "src/renderer/src/**/*.stories.test.ts",
            "src/renderer/src/features/overlay/hooks/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
