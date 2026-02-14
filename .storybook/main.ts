import type { StorybookConfig } from "@storybook/react-vite";
import { resolve } from "node:path";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/renderer/src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
  ],
  framework: "@storybook/react-vite",
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@renderer": resolve(process.cwd(), "src/renderer/src"),
          "@shared": resolve(process.cwd(), "src/shared"),
        },
      },
    });
  },
};
export default config;
