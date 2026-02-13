import { app } from "electron";
import { join } from "node:path";
import { AppCoordinator } from "./app/app-coordinator";
import { registerIpcHandlers } from "./ipc/register-ipc";

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

const preloadPath = join(__dirname, "../preload/index.js");
process.env.ECHO_RENDERER_DIST = join(__dirname, "../renderer");
const coordinator = new AppCoordinator(preloadPath);

app.on("second-instance", () => {
  void coordinator.openDashboard();
});

app.whenReady().then(async () => {
  registerIpcHandlers(coordinator);
  await coordinator.start();

  // On non-macOS, explicitly open an entry window on launch.
  // macOS launch/rehydrate is handled via the `activate` event below.
  if (process.platform !== "darwin") {
    await coordinator.openDashboard();
  }
});

app.on("activate", () => {
  void coordinator.openDashboard();
});

app.on("before-quit", () => {
  void coordinator.stop();
});
