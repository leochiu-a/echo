import { EventEmitter } from 'node:events'

export class TypedEventBus<Events extends Record<string, unknown>> {
  private readonly emitter = new EventEmitter()

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    this.emitter.on(String(event), listener)
    return () => {
      this.emitter.off(String(event), listener)
    }
  }

  once<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    this.emitter.once(String(event), listener)
    return () => {
      this.emitter.off(String(event), listener)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.emitter.emit(String(event), payload)
  }
}
