import type { Preview } from "@storybook/react-vite";
import "../src/renderer/src/styles/app.css";

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const view = context.parameters.echoView as "dashboard" | "overlay" | undefined;
      if (typeof document !== "undefined") {
        if (view) {
          document.body.setAttribute("data-echo-view", view);
        } else {
          document.body.removeAttribute("data-echo-view");
        }
      }

      return Story();
    },
  ],
  parameters: {
    backgrounds: {
      default: "dashboard",
      values: [
        { name: "dashboard", value: "#d8e8ee" },
        { name: "overlay", value: "#121416" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
