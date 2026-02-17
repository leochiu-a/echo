import { describe, expect, it } from "vitest";
import { buildShortcutFromKeydown } from "./keyboard-shortcut";

function keydownEvent(
  key: string,
  modifiers: Partial<{
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  }> = {},
) {
  return {
    key,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    altKey: modifiers.altKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
  };
}

describe("buildShortcutFromKeydown", () => {
  it("builds shortcut for command + letter", () => {
    expect(buildShortcutFromKeydown(keydownEvent("k", { metaKey: true }))).toBe("Command+K");
  });

  it("builds shortcut for command + shift + enter", () => {
    expect(buildShortcutFromKeydown(keydownEvent("Enter", { metaKey: true, shiftKey: true }))).toBe(
      "Command+Shift+Enter",
    );
  });

  it("normalizes arrow and option keys", () => {
    expect(buildShortcutFromKeydown(keydownEvent("ArrowUp", { ctrlKey: true, altKey: true }))).toBe(
      "Control+Option+Up",
    );
  });

  it("returns null for modifier-only keys", () => {
    expect(buildShortcutFromKeydown(keydownEvent("Meta", { metaKey: true }))).toBeNull();
  });

  it("clears shortcut on delete without modifiers", () => {
    expect(buildShortcutFromKeydown(keydownEvent("Backspace"))).toBe("");
  });
});
