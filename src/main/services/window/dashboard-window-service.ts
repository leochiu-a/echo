import { BrowserWindow } from "electron";
import { WindowStateService } from "./window-state-service";
import { loadRendererView } from "./window-url";

const DEFAULT_DASHBOARD_WIDTH = 1024;
const DEFAULT_DASHBOARD_HEIGHT = 720;

export class DashboardWindowService {
  private window: BrowserWindow | null = null;

  constructor(
    private readonly windowStateService: WindowStateService,
    private readonly preloadPath: string,
  ) {}

  async open(): Promise<void> {
    const window = await this.ensureWindow();
    window.show();
    window.focus();
  }

  async ensureWindow(): Promise<BrowserWindow> {
    if (this.window) {
      return this.window;
    }

    const bounds = this.windowStateService.dashboardBounds;
    const window = new BrowserWindow({
      width: bounds?.width ?? DEFAULT_DASHBOARD_WIDTH,
      height: bounds?.height ?? DEFAULT_DASHBOARD_HEIGHT,
      x: bounds?.x,
      y: bounds?.y,
      minWidth: 900,
      minHeight: 620,
      title: "Echo Dashboard",
      show: false,
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    window.on("resize", () => {
      this.windowStateService.dashboardBounds = window.getBounds();
    });

    window.on("move", () => {
      this.windowStateService.dashboardBounds = window.getBounds();
    });

    window.on("closed", () => {
      this.window = null;
    });

    await loadRendererView(window, "dashboard");
    this.window = window;
    return window;
  }

  close(): void {
    this.window?.close();
    this.window = null;
  }

  get webContents() {
    return this.window?.webContents ?? null;
  }
}
