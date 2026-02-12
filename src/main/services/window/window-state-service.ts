import type { Rectangle } from 'electron'
import type ElectronStore from 'electron-store'
import { ElectronStoreCompat } from '@main/services/store/electron-store-interop'

interface WindowStateStoreSchema {
  overlayBounds: Rectangle | null
  dashboardBounds: Rectangle | null
}

const defaults: WindowStateStoreSchema = {
  overlayBounds: null,
  dashboardBounds: null
}

export class WindowStateService {
  private readonly store: ElectronStore<WindowStateStoreSchema> = new ElectronStoreCompat<WindowStateStoreSchema>({
    name: 'window-state',
    defaults
  })

  get overlayBounds(): Rectangle | null {
    return this.store.get('overlayBounds')
  }

  set overlayBounds(bounds: Rectangle | null) {
    this.store.set('overlayBounds', bounds)
  }

  get dashboardBounds(): Rectangle | null {
    return this.store.get('dashboardBounds')
  }

  set dashboardBounds(bounds: Rectangle | null) {
    this.store.set('dashboardBounds', bounds)
  }
}
