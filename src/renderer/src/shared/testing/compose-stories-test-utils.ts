import "../../../../../.storybook/vitest.setup";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface RenderedStory {
  root: Root;
  container: HTMLDivElement;
}

const renderedStories: RenderedStory[] = [];

export function renderComposedStory(Story: React.ComponentType) {
  const container = document.createElement("div");
  document.body.append(container);

  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Story));
  });

  const renderedStory: RenderedStory = { root, container };
  renderedStories.push(renderedStory);

  return {
    container,
    unmount() {
      const index = renderedStories.indexOf(renderedStory);
      if (index >= 0) {
        renderedStories.splice(index, 1);
      }

      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export function cleanupRenderedStories() {
  while (renderedStories.length > 0) {
    const renderedStory = renderedStories.pop();
    if (!renderedStory) {
      continue;
    }

    act(() => {
      renderedStory.root.unmount();
    });
    renderedStory.container.remove();
  }
}
