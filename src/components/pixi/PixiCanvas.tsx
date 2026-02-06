import { useRef, useEffect, useCallback, useState } from 'react';
import { useWorldState } from '../../state/WorldState';
import { GameBridge } from '../../engine/GameBridge';
import { WorldRenderer } from '../../engine/WorldRenderer';
import type { BridgeEvents } from '../../engine/GameBridge';

/**
 * React wrapper that mounts the Pixi canvas and bridges state to the engine.
 * Only initializes Pixi when visible (scene !== 'login').
 */
export function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const bridgeRef = useRef<GameBridge | null>(null);
  const { state, dispatch, transitionTo } = useWorldState();
  const [initialized, setInitialized] = useState(false);

  const visible = state.scene !== 'login';

  // Handle entity clicks from Pixi
  const handleEntityClick = useCallback((data: BridgeEvents['entityClicked']) => {
    if (data.entityType === 'building') {
      transitionTo('building', data.id);
    } else if (data.entityType === 'door') {
      transitionTo('room', data.id);
    } else if (data.entityType === 'character') {
      dispatch({ type: 'OPEN_CHARACTER_CARD', characterId: data.id });
    }
  }, [transitionTo, dispatch]);

  // Handle fade requests from Pixi
  const handleFade = useCallback((data: BridgeEvents['requestFade']) => {
    dispatch({
      type: 'SET_TRANSITION_OPACITY',
      opacity: data.direction === 'in' ? 1 : 0,
    });
  }, [dispatch]);

  // Initialize Pixi ONLY when container becomes visible
  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    if (!container) return;
    if (rendererRef.current) return; // already initialized

    const bridge = new GameBridge();
    bridgeRef.current = bridge;

    const unsubs = [
      bridge.on('entityClicked', handleEntityClick),
      bridge.on('requestFade', handleFade),
    ];

    const renderer = new WorldRenderer(bridge);
    rendererRef.current = renderer;

    renderer.init(container).then(() => {
      setInitialized(true);
      // Navigate to the current scene after init
      bridge.emit('navigate', {
        scene: state.scene,
        targetId: state.scene === 'building' ? (state.buildingId ?? undefined) :
                  state.scene === 'room' ? (state.roomId ?? undefined) : undefined,
      });
    }).catch((err) => {
      console.error('Pixi init failed:', err);
    });

    return () => {
      unsubs.forEach(u => u());
      renderer.destroy();
      rendererRef.current = null;
      bridgeRef.current = null;
      setInitialized(false);
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync state to Pixi on change
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !initialized) return;
    renderer.syncState(state);
  }, [state, initialized]);

  // Navigate Pixi scene when React scene changes (after initial init)
  const prevSceneRef = useRef(state.scene);
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge || !initialized) return;

    if (state.scene !== prevSceneRef.current) {
      prevSceneRef.current = state.scene;

      if (state.scene !== 'login') {
        bridge.emit('navigate', {
          scene: state.scene,
          targetId: state.scene === 'building' ? (state.buildingId ?? undefined) :
                    state.scene === 'room' ? (state.roomId ?? undefined) : undefined,
        });
      } else {
        bridge.emit('navigate', { scene: 'login' });
      }
    }
  }, [state.scene, state.buildingId, state.roomId, initialized]);

  return (
    <div
      ref={containerRef}
      id="pixi-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        top: 48,
        zIndex: 0,
        visibility: visible ? 'visible' : 'hidden',
      }}
    />
  );
}
