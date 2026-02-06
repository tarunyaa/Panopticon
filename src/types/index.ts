// Scene types - includes legacy 'org' and 'pod' for backwards compatibility
export type SceneType = 'login' | 'world' | 'building' | 'room' | 'org' | 'pod';

// Camera state - single source of truth
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
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
  buildingId: string;
  roomId: string;
  // Legacy aliases
  orgId?: string;
  podId?: string;
}

// ============================================
// CHARACTER STYLE SYSTEM
// ============================================

// Body types for character silhouettes
export type BodyType = 'round' | 'tall' | 'bigHead' | 'hoodie' | 'coat' | 'robot';

// Color palettes for characters
export type PaletteType = 'warm' | 'cool' | 'neutral' | 'bright';

// Hair styles
export type HairType = 'short' | 'bun' | 'curly' | 'none';

// Accessories
export type AccessoryType = 'glassesRound' | 'glassesSquare' | 'headphones' | 'beanie' | 'cap' | 'none';

// Props characters can hold
export type PropType = 'coffee' | 'book' | 'laptop' | 'clipboard' | 'wrench' | 'plant' | 'none';

// AI hint types (subtle cues)
export type AIHintType = 'none' | 'sparkle' | 'pulse';

// Idle animation variant
export type IdleVariant = 0 | 1 | 2;

// Complete character style (deterministically generated from ID)
export interface CharacterStyle {
  bodyType: BodyType;
  palette: PaletteType;
  hair: HairType;
  accessory: AccessoryType;
  prop: PropType;
  aiHint: AIHintType;
  idleVariant: IdleVariant;
}

// Character status (emoji-only display)
export type CharacterStatus = 'working' | 'done' | 'waiting' | 'idle';

// Character data
export interface Character {
  id: string;
  name: string;
  isAI: boolean;
  aiHint?: AIHintType;
  status: CharacterStatus;
  position: Position;
}

// ============================================
// BUILDING SYSTEM
// ============================================

// Building types (unlabeled, identified by silhouette)
export type BuildingType = 'hub' | 'workshop' | 'library' | 'cafe' | 'greenhouse' | 'postoffice';

// Room data (inside a building)
export interface Room {
  id: string;
  position: Position;
  characters: Character[];
}

// Building data
export interface Building {
  id: string;
  type: BuildingType;
  position: Position;
  rooms: Room[];
}

// ============================================
// LEGACY TYPES (keeping for compatibility)
// ============================================

// Agent status (legacy, use CharacterStatus)
export type AgentStatus = 'working' | 'idle' | 'blocked' | 'away';

// Agent data (legacy)
export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  type: 'human' | 'manager' | 'agent';
}

// Pod data (legacy, use Room)
export interface Pod {
  id: string;
  name: string;
  agents: Agent[];
  position: Position;
}

// Organization data (legacy, use Building)
export interface Organization {
  id: string;
  name: string;
  pods: Pod[];
  position: Position;
  color: string;
}

// ============================================
// UI STATE
// ============================================

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
  buildingId: string | null;
  roomId: string | null;
  // Legacy aliases
  orgId: string | null;
  podId: string | null;
  user: User | null;
  camera: CameraState;
  selectedCharacterId: string | null;
  selectedAgentId: string | null; // Legacy alias
  liveFeed: LiveFeedData;
  transition: TransitionState;
}

// ============================================
// EVENTS
// ============================================

export type AppEvent =
  | { type: 'LOGIN'; email: string }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; scene: SceneType; targetId?: string; focusPoint?: FocusPoint }
  | { type: 'CLICK_ENTITY'; entityId: string; position: Position }
  | { type: 'OPEN_CHARACTER_CARD'; characterId: string }
  | { type: 'CLOSE_CHARACTER_CARD' }
  | { type: 'OPEN_AGENT_CARD'; agentId: string } // Legacy alias
  | { type: 'CLOSE_AGENT_CARD' } // Legacy alias
  | { type: 'SET_CAMERA'; camera: Partial<CameraState> }
  | { type: 'START_TRANSITION'; targetScene: SceneType; targetId?: string; focusPoint?: FocusPoint }
  | { type: 'COMPLETE_TRANSITION' }
  | { type: 'SET_TRANSITION_OPACITY'; opacity: number };

// ============================================
// SPRITE SYSTEM
// ============================================

// Character types for sprites (legacy)
export type CharacterType = 'human' | 'manager' | 'agent';

// Sprite props
export interface SpriteProps {
  src: string;
  width: number;
  height: number;
  scale?: number;
  className?: string;
}

// ============================================
// PIXEL ART TYPES
// ============================================

// Walk direction for future walk cycles
export type WalkDirection = 'up' | 'down' | 'left' | 'right' | 'idle';

// Animation state for pixel sprites
export type AnimationState = 'idle' | 'walking' | 'talking' | 'working';

// Furniture types for interior scenes
export type FurnitureType = 'couch' | 'whiteboard' | 'bookshelf' | 'coffeeCounter' | 'plant' | 'waterCooler';
