export interface KeyboardShortcutKeydownLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const ignoredKeys = new Set([
  "Meta",
  "Control",
  "Alt",
  "Shift",
  "CapsLock",
  "NumLock",
  "ScrollLock",
  "Fn",
  "Dead",
  "Process",
  "Unidentified",
  "ContextMenu",
]);

const specialKeys: Record<string, string> = {
  " ": "Space",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  Backspace: "Backspace",
  Delete: "Delete",
  End: "End",
  Enter: "Enter",
  Esc: "Escape",
  Escape: "Escape",
  Home: "Home",
  Insert: "Insert",
  PageDown: "PageDown",
  PageUp: "PageUp",
  Tab: "Tab",
};

export function shouldClearShortcut(event: KeyboardShortcutKeydownLike): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return false;
  }

  return event.key === "Backspace" || event.key === "Delete";
}

export function buildShortcutFromKeydown(event: KeyboardShortcutKeydownLike): string | null {
  if (shouldClearShortcut(event)) {
    return "";
  }

  const primaryKey = normalizePrimaryKey(event.key);
  if (!primaryKey) {
    return null;
  }

  const tokens: string[] = [];
  if (event.metaKey) tokens.push("Command");
  if (event.ctrlKey) tokens.push("Control");
  if (event.altKey) tokens.push("Option");
  if (event.shiftKey) tokens.push("Shift");
  tokens.push(primaryKey);

  return tokens.join("+");
}

function normalizePrimaryKey(key: string): string | null {
  if (!key || ignoredKeys.has(key)) {
    return null;
  }

  const special = specialKeys[key];
  if (special) {
    return special;
  }

  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return key.toUpperCase();
  }

  if (key === "+") {
    return "Plus";
  }

  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase();
  }

  if (/^[0-9]$/.test(key)) {
    return key;
  }

  if (key.length === 1) {
    return key;
  }

  return `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;
}
