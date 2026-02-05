// Scene types
export type SceneType = 'login' | 'world' | 'org' | 'pod';

// Camera state - single source of truth
export interface CameraState {
  x: number;
  y: number;
  zoom: 1 | 1.5;
}

// Position for entities
export interface Position {
  x: number;
  y: number;
}

// Focus point for transitions
export interface FocusPoint {
  x: number;
  y: number;
}

// User info
export interface User {
  email: string;
  name: string;
  orgId: string;
  podId: string;
}

// Agent status
export type AgentStatus = 'working' | 'idle' | 'blocked' | 'away';

// Agent data
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  type: 'human' | 'manager' | 'agent';
}

// Pod data
export interface Pod {
  id: string;
  name: string;
  agents: Agent[];
  position: Position;
}

// Organization data
export interface Organization {
  id: string;
  name: string;
  pods: Pod[];
  position: Position;
  color: string;
}

// Live feed counts
export interface LiveFeedData {
  running: number;
  blocked: number;
  approvals: number;
  blockedReason?: string;
}

// Transition state
export interface TransitionState {
  isTransitioning: boolean;
  opacity: number;
  targetScene: SceneType | null;
  targetId: string | null;
  focusPoint: FocusPoint | null;
}

// World state
export interface WorldState {
  scene: SceneType;
  orgId: string | null;
  podId: string | null;
  user: User | null;
  camera: CameraState;
  selectedAgentId: string | null;
  liveFeed: LiveFeedData;
  transition: TransitionState;
}

// Event types for future-proof architecture
export type AppEvent =
  | { type: 'LOGIN'; email: string }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; scene: SceneType; targetId?: string; focusPoint?: FocusPoint }
  | { type: 'CLICK_ENTITY'; entityId: string; position: Position }
  | { type: 'OPEN_AGENT_CARD'; agentId: string }
  | { type: 'CLOSE_AGENT_CARD' }
  | { type: 'SET_CAMERA'; camera: Partial<CameraState> }
  | { type: 'START_TRANSITION'; targetScene: SceneType; targetId?: string; focusPoint?: FocusPoint }
  | { type: 'COMPLETE_TRANSITION' }
  | { type: 'SET_TRANSITION_OPACITY'; opacity: number };

// Character types for sprites
export type CharacterType = 'human' | 'manager' | 'agent';

// Sprite props
export interface SpriteProps {
  src: string;
  width: number;
  height: number;
  scale?: number;
  className?: string;
}
