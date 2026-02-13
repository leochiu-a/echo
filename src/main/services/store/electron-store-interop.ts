import ElectronStore from "electron-store";

type ElectronStoreConstructor = typeof ElectronStore;

// electron-store v11 is ESM-only; when bundled as CJS in Electron main process,
// the constructor may live on `.default`. This keeps both shapes compatible.
const ElectronStoreCompat =
  (
    ElectronStore as unknown as {
      default?: ElectronStoreConstructor;
    }
  ).default ?? ElectronStore;

export { ElectronStoreCompat };
