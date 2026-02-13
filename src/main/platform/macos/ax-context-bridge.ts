import { systemPreferences } from "electron";
import { runAppleScript } from "./apple-script";

const APPLE_SCRIPT_DELIMITER = "<<<ECHO_AX_DELIM_6A68A6F5>>>";

export interface OverlaySelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayContextSnapshot {
  selectedText: string | null;
  hasEditableSelection: boolean;
  accessibilityTrusted: boolean;
  selectionBounds: OverlaySelectionBounds | null;
}

export class MacOSAXContextBridge {
  private readonly maxSelectedTextLength = 12_000;

  async captureSnapshot(): Promise<OverlayContextSnapshot> {
    const accessibilityTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!accessibilityTrusted) {
      return {
        selectedText: null,
        hasEditableSelection: false,
        accessibilityTrusted,
        selectionBounds: null,
      };
    }

    try {
      const output = await runAppleScript(`
        set selectedText to ""
        set editableFlag to false
        set selectionPosX to ""
        set selectionPosY to ""
        set selectionWidth to ""
        set selectionHeight to ""

        tell application "System Events"
          set frontApp to first process whose frontmost is true
          try
            set focusedElement to value of attribute "AXFocusedUIElement" of frontApp
            try
              set selectedText to value of attribute "AXSelectedText" of focusedElement
            end try
            try
              set editableFlag to value of attribute "AXEditable" of focusedElement
            end try
            try
              -- System Events AppleScript does not reliably expose AXBoundsForRange
              -- with a range parameter, so we use focused element bounds as anchor.
              set focusedPosition to value of attribute "AXPosition" of focusedElement
              set focusedSize to value of attribute "AXSize" of focusedElement
              set selectionPosX to item 1 of focusedPosition as string
              set selectionPosY to item 2 of focusedPosition as string
              set selectionWidth to item 1 of focusedSize as string
              set selectionHeight to item 2 of focusedSize as string
            end try
          end try
        end tell

        return selectedText & "${APPLE_SCRIPT_DELIMITER}" & (editableFlag as string) & "${APPLE_SCRIPT_DELIMITER}" & selectionPosX & "${APPLE_SCRIPT_DELIMITER}" & selectionPosY & "${APPLE_SCRIPT_DELIMITER}" & selectionWidth & "${APPLE_SCRIPT_DELIMITER}" & selectionHeight
      `);

      const parsedOutput = splitByDelimiterFromEnd(output, APPLE_SCRIPT_DELIMITER, 5);
      if (!parsedOutput) {
        return {
          selectedText: null,
          hasEditableSelection: false,
          accessibilityTrusted,
          selectionBounds: null,
        };
      }

      const rawSelectedText = parsedOutput.leading;
      const [rawEditableFlag, rawPosX, rawPosY, rawWidth, rawHeight] = parsedOutput.trailing;
      const normalizedEditableFlag = rawEditableFlag.trim().toLowerCase();

      const selectedText = this.normalizedSelectedText(rawSelectedText);
      const selectionBounds =
        selectedText === null
          ? null
          : this.normalizedSelectionBounds({
              rawPosX,
              rawPosY,
              rawWidth,
              rawHeight,
            });
      return {
        selectedText,
        hasEditableSelection: selectedText !== null && normalizedEditableFlag === "true",
        accessibilityTrusted,
        selectionBounds,
      };
    } catch {
      return {
        selectedText: null,
        hasEditableSelection: false,
        accessibilityTrusted,
        selectionBounds: null,
      };
    }
  }

  private normalizedSelectedText(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) {
      return null;
    }

    const withRecoveredLineBreaks = recoverLineBreaksIfNeeded(trimmed);
    return withRecoveredLineBreaks.slice(0, this.maxSelectedTextLength);
  }

  private normalizedSelectionBounds(params: {
    rawPosX: string;
    rawPosY: string;
    rawWidth: string;
    rawHeight: string;
  }): OverlaySelectionBounds | null {
    const x = parseFiniteNumber(params.rawPosX);
    const y = parseFiniteNumber(params.rawPosY);
    const width = parseFiniteNumber(params.rawWidth);
    const height = parseFiniteNumber(params.rawHeight);

    if (x === null || y === null || width === null || height === null) {
      return null;
    }

    if (width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  }
}

function recoverLineBreaksIfNeeded(text: string): string {
  if (text.length < 100 || /\n/.test(text)) {
    return text;
  }

  return text
    .replace(/([。！？；])/g, "$1\n")
    .replace(/([.!?;])\s+/g, "$1\n")
    .replace(/\s*\n\s*/g, "\n");
}

function splitByDelimiterFromEnd(
  input: string,
  delimiter: string,
  trailingParts: number,
): { leading: string; trailing: string[] } | null {
  const trailing = new Array<string>(trailingParts);
  let cursor = input.length;
  for (let index = trailingParts - 1; index >= 0; index -= 1) {
    const delimiterIndex = input.lastIndexOf(delimiter, cursor - 1);
    if (delimiterIndex < 0) {
      return null;
    }

    trailing[index] = input.slice(delimiterIndex + delimiter.length, cursor);
    cursor = delimiterIndex;
  }

  return {
    leading: input.slice(0, cursor),
    trailing,
  };
}

function parseFiniteNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
