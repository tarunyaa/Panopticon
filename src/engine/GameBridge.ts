import type { WorldState, SceneType, FocusPoint } from '../types';

// Pixi -> React events
export interface BridgeEvents {
  entityClicked: { id: string; entityType: 'building' | 'character' | 'door' };
  requestFade: { direction: 'in' | 'out' };
  cameraChanged: { x: number; y: number; zoom: number };
  playerMoved: { x: number; y: number };
}

// React -> Pixi events
export interface BridgeCommands {
  stateChanged: WorldState;
  navigate: { scene: SceneType; targetId?: string; focusPoint?: FocusPoint };
}

type AllEvents = BridgeEvents & BridgeCommands;

type Listener<T> = (data: T) => void;

/**
 * Typed EventEmitter bridge between React and Pixi.
 * Singleton shared via React context.
 */
export class GameBridge {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<K extends keyof AllEvents>(event: K, listener: Listener<AllEvents[K]>): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    const fn = listener as Listener<unknown>;
    set.add(fn);
    return () => { set.delete(fn); };
  }

  emit<K extends keyof AllEvents>(event: K, data: AllEvents[K]): void {
    const set = this.listeners.get(event as string);
    if (set) {
      for (const fn of set) {
        fn(data);
      }
    }
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
