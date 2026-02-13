import { BrowserWindow, screen, type Rectangle } from "electron";
import type { OverlayContextSnapshot } from "@main/platform/macos/ax-context-bridge";
import { ipcChannels } from "@shared/contracts/ipc";
import { WindowStateService } from "./window-state-service";
import { loadRendererView } from "./window-url";

const DEFAULT_OVERLAY_WIDTH = 620;
const DEFAULT_OVERLAY_HEIGHT = 176;
const OVERLAY_PADDING = 12;
const SCREEN_PADDING = 8;
const MIN_OVERLAY_WIDTH = 460;
const MIN_OVERLAY_HEIGHT = 128;
const MAX_OVERLAY_HEIGHT = 520;

export class OverlayWindowService {
  private window: BrowserWindow | null = null;
  private isProgrammaticMove = false;

  constructor(
    private readonly windowStateService: WindowStateService,
    private readonly preloadPath: string,
  ) {}

  async createWindow(): Promise<BrowserWindow> {
    if (this.window) {
      return this.window;
    }

    const window = new BrowserWindow({
      width: DEFAULT_OVERLAY_WIDTH,
      height: DEFAULT_OVERLAY_HEIGHT,
      frame: false,
      transparent: true,
      hasShadow: true,
      show: false,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      vibrancy: "under-window",
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });

    window.on("move", () => {
      if (this.isProgrammaticMove || !window.isVisible()) {
        return;
      }

      const next = this.clampBounds(this.compactBounds(window.getBounds()));
      this.windowStateService.overlayBounds = next;
    });

    window.on("closed", () => {
      this.window = null;
    });

    await loadRendererView(window, "overlay");
    this.window = window;
    return window;
  }

  async toggleNearCursor(context: OverlayContextSnapshot): Promise<void> {
    const window = await this.createWindow();
    if (window.isVisible()) {
      this.hide();
      return;
    }

    const preferredBounds = this.windowStateService.overlayBounds;
    const nextBounds = preferredBounds
      ? this.clampBounds(this.compactBounds(preferredBounds))
      : this.computeBoundsNearCursor(window);

    this.isProgrammaticMove = true;
    window.setBounds(nextBounds, false);
    this.isProgrammaticMove = false;
    this.windowStateService.overlayBounds = nextBounds;

    window.show();
    window.focus();
    window.webContents.send(ipcChannels.overlayContextReady, context);
  }

  resizeToContent(height: number): void {
    const window = this.window;
    if (!window || window.isDestroyed()) {
      return;
    }

    const current = window.getBounds();
    const targetHeight = Math.round(height);
    if (!Number.isFinite(targetHeight)) {
      return;
    }

    const nextBounds = this.clampBounds({
      x: current.x,
      y: current.y,
      width: DEFAULT_OVERLAY_WIDTH,
      height: targetHeight,
    });

    if (
      current.x === nextBounds.x &&
      current.y === nextBounds.y &&
      current.width === nextBounds.width &&
      current.height === nextBounds.height
    ) {
      return;
    }

    this.isProgrammaticMove = true;
    window.setBounds(nextBounds, false);
    this.isProgrammaticMove = false;
    this.windowStateService.overlayBounds = nextBounds;
  }

  hide(): void {
    this.window?.hide();
  }

  async close(): Promise<void> {
    if (!this.window) {
      return;
    }

    this.window.close();
    this.window = null;
  }

  get webContents() {
    return this.window?.webContents ?? null;
  }

  private computeBoundsNearCursor(window: BrowserWindow): Rectangle {
    const cursor = screen.getCursorScreenPoint();
    const rawBounds: Rectangle = {
      x: cursor.x + OVERLAY_PADDING,
      y: cursor.y - DEFAULT_OVERLAY_HEIGHT - OVERLAY_PADDING,
      width: DEFAULT_OVERLAY_WIDTH,
      height: DEFAULT_OVERLAY_HEIGHT,
    };

    const clamped = this.clampBounds(rawBounds);
    this.windowStateService.overlayBounds = clamped;
    return clamped;
  }

  private compactBounds(bounds: Rectangle): Rectangle {
    return {
      x: bounds.x,
      y: bounds.y,
      width: DEFAULT_OVERLAY_WIDTH,
      height: DEFAULT_OVERLAY_HEIGHT,
    };
  }

  private clampBounds(bounds: Rectangle): Rectangle {
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const workArea = display.workArea;

    const width = Math.max(
      MIN_OVERLAY_WIDTH,
      Math.min(bounds.width, workArea.width - SCREEN_PADDING * 2),
    );
    const height = Math.max(
      MIN_OVERLAY_HEIGHT,
      Math.min(bounds.height, Math.min(MAX_OVERLAY_HEIGHT, workArea.height - SCREEN_PADDING * 2)),
    );

    const minX = workArea.x + SCREEN_PADDING;
    const maxX = workArea.x + workArea.width - width - SCREEN_PADDING;
    const minY = workArea.y + SCREEN_PADDING;
    const maxY = workArea.y + workArea.height - height - SCREEN_PADDING;

    return {
      x: clamp(bounds.x, minX, maxX),
      y: clamp(bounds.y, minY, maxY),
      width,
      height,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
