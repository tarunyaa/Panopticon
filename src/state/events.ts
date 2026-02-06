import type { AppEvent, SceneType, Position, FocusPoint } from '../types';

// Event creators for cleaner dispatch calls
export const events = {
  login: (email: string): AppEvent => ({
    type: 'LOGIN',
    email,
  }),

  logout: (): AppEvent => ({
    type: 'LOGOUT',
  }),

  navigate: (scene: SceneType, targetId?: string, focusPoint?: FocusPoint): AppEvent => ({
    type: 'NAVIGATE',
    scene,
    targetId,
    focusPoint,
  }),

  clickEntity: (entityId: string, position: Position): AppEvent => ({
    type: 'CLICK_ENTITY',
    entityId,
    position,
  }),

  // New character card events
  openCharacterCard: (characterId: string): AppEvent => ({
    type: 'OPEN_CHARACTER_CARD',
    characterId,
  }),

  closeCharacterCard: (): AppEvent => ({
    type: 'CLOSE_CHARACTER_CARD',
  }),

  // Legacy agent card events (alias to character)
  openAgentCard: (agentId: string): AppEvent => ({
    type: 'OPEN_AGENT_CARD',
    agentId,
  }),

  closeAgentCard: (): AppEvent => ({
    type: 'CLOSE_AGENT_CARD',
  }),

  setCamera: (camera: Partial<{ x: number; y: number; zoom: number }>): AppEvent => ({
    type: 'SET_CAMERA',
    camera,
  }),

  startTransition: (targetScene: SceneType, targetId?: string, focusPoint?: FocusPoint): AppEvent => ({
    type: 'START_TRANSITION',
    targetScene,
    targetId,
    focusPoint,
  }),

  completeTransition: (): AppEvent => ({
    type: 'COMPLETE_TRANSITION',
  }),

  setTransitionOpacity: (opacity: number): AppEvent => ({
    type: 'SET_TRANSITION_OPACITY',
    opacity,
  }),
};
