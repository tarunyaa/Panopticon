import { useEffect } from 'react';
import type { GameBridge, BridgeEvents } from '../engine/GameBridge';

/**
 * Hook for React components to listen to Pixi bridge events.
 */
export function useGameBridge<K extends keyof BridgeEvents>(
  bridge: GameBridge | null,
  event: K,
  handler: (data: BridgeEvents[K]) => void,
): void {
  useEffect(() => {
    if (!bridge) return;
    const unsub = bridge.on(event, handler);
    return unsub;
  }, [bridge, event, handler]);
}
