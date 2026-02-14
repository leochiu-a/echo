import { composeStories } from "@storybook/react-vite";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupRenderedStories,
  renderComposedStory,
} from "@renderer/shared/testing/compose-stories-test-utils";
import * as stories from "./HistorySection.stories";

const composedStories = composeStories(stories);

describe("HistorySection stories", () => {
  afterEach(() => {
    cleanupRenderedStories();
  });

  it.each(Object.entries(composedStories))("%s renders", (_storyName, Story) => {
    const { container } = renderComposedStory(Story);
    expect(container.firstElementChild).not.toBeNull();
  });
});
