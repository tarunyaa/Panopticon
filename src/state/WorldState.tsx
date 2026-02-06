import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
import type { WorldState, AppEvent, SceneType, FocusPoint, CameraState } from '../types';
import { parseOrgFromEmail, parseNameFromEmail, getDefaultRoom, mockLiveFeed } from '../data/mockData';

// Initial state
const initialState: WorldState = {
  scene: 'login',
  buildingId: null,
  roomId: null,
  // Legacy aliases
  orgId: null,
  podId: null,
  user: null,
  camera: { x: 0, y: 0, zoom: 1 },
  selectedCharacterId: null,
  selectedAgentId: null, // Legacy alias
  liveFeed: mockLiveFeed,
  transition: {
    isTransitioning: false,
    opacity: 1,
    targetScene: null,
    targetId: null,
    focusPoint: null,
  },
};

// Reducer
function reducer(state: WorldState, event: AppEvent): WorldState {
  switch (event.type) {
    case 'LOGIN': {
      const buildingId = parseOrgFromEmail(event.email);
      const roomId = getDefaultRoom(buildingId);
      return {
        ...state,
        user: {
          email: event.email,
          name: parseNameFromEmail(event.email),
          buildingId,
          roomId,
        },
        buildingId,
        roomId,
        // Legacy aliases
        orgId: buildingId,
        podId: roomId,
      };
    }

    case 'LOGOUT':
      return {
        ...initialState,
      };

    case 'NAVIGATE': {
      const newState = { ...state };

      // Handle both new and legacy scene types
      if (event.scene === 'building' || event.scene === 'org') {
        newState.scene = 'building';
        newState.buildingId = event.targetId ?? state.buildingId;
        newState.orgId = newState.buildingId; // Legacy alias
      } else if (event.scene === 'room' || event.scene === 'pod') {
        newState.scene = 'room';
        newState.roomId = event.targetId ?? state.roomId;
        newState.podId = newState.roomId; // Legacy alias
      } else {
        newState.scene = event.scene;
      }

      newState.selectedCharacterId = null;
      newState.selectedAgentId = null;

      return newState;
    }

    case 'CLICK_ENTITY':
      return state;

    case 'OPEN_CHARACTER_CARD':
      return {
        ...state,
        selectedCharacterId: event.characterId,
        selectedAgentId: event.characterId, // Legacy alias
      };

    case 'CLOSE_CHARACTER_CARD':
      return {
        ...state,
        selectedCharacterId: null,
        selectedAgentId: null,
      };

    // Legacy events
    case 'OPEN_AGENT_CARD':
      return {
        ...state,
        selectedCharacterId: event.agentId,
        selectedAgentId: event.agentId,
      };

    case 'CLOSE_AGENT_CARD':
      return {
        ...state,
        selectedCharacterId: null,
        selectedAgentId: null,
      };

    case 'SET_CAMERA':
      return {
        ...state,
        camera: {
          ...state.camera,
          ...event.camera,
        },
      };

    case 'START_TRANSITION':
      return {
        ...state,
        transition: {
          isTransitioning: true,
          opacity: 1,
          targetScene: event.targetScene,
          targetId: event.targetId ?? null,
          focusPoint: event.focusPoint ?? null,
        },
      };

    case 'COMPLETE_TRANSITION':
      return {
        ...state,
        transition: {
          isTransitioning: false,
          opacity: 1,
          targetScene: null,
          targetId: null,
          focusPoint: null,
        },
      };

    case 'SET_TRANSITION_OPACITY':
      return {
        ...state,
        transition: {
          ...state.transition,
          opacity: event.opacity,
        },
      };

    default:
      return state;
  }
}

// Context types
interface WorldContextType {
  state: WorldState;
  dispatch: (event: AppEvent) => void;
  transitionTo: (scene: SceneType, targetId?: string, focusPoint?: FocusPoint) => void;
}

const WorldContext = createContext<WorldContextType | null>(null);

// Transition timing constants
const ZOOM_DURATION = 150;
const FADE_DURATION = 100;

// Provider component
export function WorldStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const transitionRef = useRef<number | null>(null);

  // transitionTo helper with zoom + fade
  const transitionTo = useCallback((scene: SceneType, targetId?: string, focusPoint?: FocusPoint) => {
    // Clear any existing transition
    if (transitionRef.current) {
      clearTimeout(transitionRef.current);
    }

    // Start transition
    dispatch({ type: 'START_TRANSITION', targetScene: scene, targetId, focusPoint });

    // If we have a focus point, zoom toward it
    if (focusPoint) {
      dispatch({ type: 'SET_CAMERA', camera: { zoom: 1.5 } });
    }

    // Phase 1: Zoom toward target (150ms)
    transitionRef.current = window.setTimeout(() => {
      // Phase 2: Fade out (100ms)
      dispatch({ type: 'SET_TRANSITION_OPACITY', opacity: 0 });

      transitionRef.current = window.setTimeout(() => {
        // Phase 3: Swap scene
        dispatch({ type: 'NAVIGATE', scene, targetId });

        // Reset camera for new scene
        dispatch({ type: 'SET_CAMERA', camera: { x: 0, y: 0, zoom: 1 } });

        // Phase 4: Fade in (100ms)
        dispatch({ type: 'SET_TRANSITION_OPACITY', opacity: 1 });

        transitionRef.current = window.setTimeout(() => {
          // Phase 5: Complete transition
          dispatch({ type: 'COMPLETE_TRANSITION' });
        }, FADE_DURATION);
      }, FADE_DURATION);
    }, ZOOM_DURATION);
  }, []);

  return (
    <WorldContext.Provider value={{ state, dispatch, transitionTo }}>
      {children}
    </WorldContext.Provider>
  );
}

// Hook to use world state
export function useWorldState() {
  const context = useContext(WorldContext);
  if (!context) {
    throw new Error('useWorldState must be used within WorldStateProvider');
  }
  return context;
}

// Selector hooks for common data
export function useCamera(): CameraState {
  const { state } = useWorldState();
  return state.camera;
}

export function useScene(): SceneType {
  const { state } = useWorldState();
  return state.scene;
}

export function useTransition() {
  const { state } = useWorldState();
  return state.transition;
}
