import type {
  Organization,
  LiveFeedData,
  Agent,
  Building,
  Room,
  Character,
} from '../types';

// ============================================
// NEW BUILDING/CHARACTER DATA
// ============================================

/**
 * Buildings in the world (unlabeled, identified by silhouette)
 */
export const buildings: Building[] = [
  {
    id: 'hub-main',
    type: 'hub',
    position: { x: 170, y: 170 },
    rooms: [
      {
        id: 'hub-lobby',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-001', name: 'Alex', isAI: false, status: 'idle', position: { x: 100, y: 200 } },
          { id: 'char-002', name: 'Jordan', isAI: true, aiHint: 'sparkle', status: 'working', position: { x: 200, y: 180 } },
        ],
      },
      {
        id: 'hub-lounge',
        position: { x: 350, y: 150 },
        characters: [
          { id: 'char-003', name: 'Sam', isAI: true, aiHint: 'pulse', status: 'done', position: { x: 150, y: 220 } },
        ],
      },
    ],
  },
  {
    id: 'workshop-1',
    type: 'workshop',
    position: { x: 470, y: 175 },
    rooms: [
      {
        id: 'workshop-floor',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-004', name: 'Riley', isAI: false, status: 'working', position: { x: 120, y: 200 } },
          { id: 'char-005', name: 'Casey', isAI: true, aiHint: 'sparkle', status: 'working', position: { x: 280, y: 180 } },
          { id: 'char-006', name: 'Morgan', isAI: false, status: 'waiting', position: { x: 200, y: 250 } },
        ],
      },
    ],
  },
  {
    id: 'library-1',
    type: 'library',
    position: { x: 720, y: 190 },
    rooms: [
      {
        id: 'library-reading',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-007', name: 'Quinn', isAI: true, aiHint: 'pulse', status: 'idle', position: { x: 150, y: 200 } },
        ],
      },
    ],
  },
  {
    id: 'cafe-1',
    type: 'cafe',
    position: { x: 220, y: 420 },
    rooms: [
      {
        id: 'cafe-floor',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-008', name: 'Taylor', isAI: false, status: 'idle', position: { x: 100, y: 200 } },
          { id: 'char-009', name: 'Avery', isAI: true, aiHint: 'sparkle', status: 'done', position: { x: 250, y: 180 } },
        ],
      },
    ],
  },
  {
    id: 'greenhouse-1',
    type: 'greenhouse',
    position: { x: 480, y: 420 },
    rooms: [
      {
        id: 'greenhouse-floor',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-010', name: 'Drew', isAI: false, status: 'working', position: { x: 180, y: 200 } },
          { id: 'char-011', name: 'Blake', isAI: true, aiHint: 'pulse', status: 'working', position: { x: 280, y: 220 } },
        ],
      },
    ],
  },
  {
    id: 'postoffice-1',
    type: 'postoffice',
    position: { x: 740, y: 420 },
    rooms: [
      {
        id: 'postoffice-counter',
        position: { x: 200, y: 150 },
        characters: [
          { id: 'char-012', name: 'Reese', isAI: true, aiHint: 'sparkle', status: 'waiting', position: { x: 200, y: 200 } },
        ],
      },
    ],
  },
];

/**
 * All characters (for lookup)
 */
export const allCharacters: Character[] = buildings.flatMap(b =>
  b.rooms.flatMap(r => r.characters)
);

/**
 * Get building by ID
 */
export function getBuilding(buildingId: string): Building | undefined {
  return buildings.find(b => b.id === buildingId);
}

/**
 * Get room by ID
 */
export function getRoom(roomId: string): { building: Building; room: Room } | undefined {
  for (const building of buildings) {
    const room = building.rooms.find(r => r.id === roomId);
    if (room) return { building, room };
  }
  return undefined;
}

/**
 * Get character by ID
 */
export function getCharacter(characterId: string): Character | undefined {
  return allCharacters.find(c => c.id === characterId);
}

/**
 * Ambient NPCs for world scene (not in any building)
 */
export const worldNPCs: Character[] = [
  { id: 'npc-001', name: '', isAI: false, status: 'idle', position: { x: 300, y: 280 } },
  { id: 'npc-002', name: '', isAI: true, aiHint: 'pulse', status: 'working', position: { x: 520, y: 320 } },
  { id: 'npc-003', name: '', isAI: false, status: 'idle', position: { x: 280, y: 500 } },
];

// ============================================
// LEGACY DATA (keeping for backwards compatibility)
// ============================================

// Known organizations mapped by email domain
export const orgsByDomain: Record<string, string> = {
  'acme.com': 'hub-main',
  'techcorp.io': 'workshop-1',
  'startup.dev': 'cafe-1',
};

// Default org for unknown domains
export const DEFAULT_ORG_ID = 'hub-main';

// Mock organizations with their pods (LEGACY - maps to buildings)
export const organizations: Organization[] = [
  {
    id: 'acme',
    name: 'Acme Corp',
    color: '#7BA3C9',
    position: { x: 200, y: 150 },
    pods: [
      {
        id: 'acme-pod-1',
        name: 'Engineering',
        position: { x: 100, y: 100 },
        agents: [
          { id: 'agent-1', name: 'Alice', role: 'Engineer', status: 'working', type: 'agent' },
          { id: 'agent-2', name: 'Bob', role: 'Engineer', status: 'idle', type: 'agent' },
        ],
      },
      {
        id: 'acme-pod-2',
        name: 'Design',
        position: { x: 300, y: 100 },
        agents: [
          { id: 'agent-3', name: 'Carol', role: 'Designer', status: 'working', type: 'agent' },
        ],
      },
      {
        id: 'acme-pod-3',
        name: 'Operations',
        position: { x: 200, y: 250 },
        agents: [
          { id: 'agent-4', name: 'Dave', role: 'Ops', status: 'blocked', type: 'agent' },
          { id: 'agent-5', name: 'Eve', role: 'Ops', status: 'working', type: 'agent' },
        ],
      },
    ],
  },
  {
    id: 'techcorp',
    name: 'TechCorp',
    color: '#8FBC8F',
    position: { x: 500, y: 150 },
    pods: [
      {
        id: 'techcorp-pod-1',
        name: 'Research',
        position: { x: 150, y: 150 },
        agents: [
          { id: 'agent-6', name: 'Frank', role: 'Researcher', status: 'working', type: 'agent' },
        ],
      },
    ],
  },
  {
    id: 'startup',
    name: 'Startup Inc',
    color: '#E8A598',
    position: { x: 350, y: 350 },
    pods: [
      {
        id: 'startup-pod-1',
        name: 'Product',
        position: { x: 200, y: 150 },
        agents: [
          { id: 'agent-7', name: 'Grace', role: 'PM', status: 'idle', type: 'agent' },
          { id: 'agent-8', name: 'Henry', role: 'Dev', status: 'working', type: 'agent' },
        ],
      },
    ],
  },
];

// Get user's default building (first room in first building)
export function getDefaultRoom(buildingId: string): string {
  const building = getBuilding(buildingId);
  return building?.rooms[0]?.id ?? 'hub-lobby';
}

// Get user's default pod (LEGACY)
export function getDefaultPod(orgId: string): string {
  const org = organizations.find(o => o.id === orgId);
  return org?.pods[0]?.id ?? 'acme-pod-1';
}

// Get organization by ID (LEGACY)
export function getOrganization(orgId: string): Organization | undefined {
  return organizations.find(o => o.id === orgId);
}

// Get pod by ID (LEGACY)
export function getPod(podId: string): { org: Organization; pod: typeof organizations[0]['pods'][0] } | undefined {
  for (const org of organizations) {
    const pod = org.pods.find(p => p.id === podId);
    if (pod) return { org, pod };
  }
  return undefined;
}

// Get agent by ID (LEGACY)
export function getAgent(agentId: string): Agent | undefined {
  for (const org of organizations) {
    for (const pod of org.pods) {
      const agent = pod.agents.find(a => a.id === agentId);
      if (agent) return agent;
    }
  }
  return undefined;
}

// Mock live feed data
export const mockLiveFeed: LiveFeedData = {
  running: 3,
  blocked: 1,
  approvals: 2,
  blockedReason: 'Waiting for API key',
};

// Manager agent (appears in every pod) - LEGACY
export const managerAgent: Agent = {
  id: 'manager-ai',
  name: 'AI Manager',
  role: 'Manager',
  status: 'working',
  type: 'manager',
};

// Parse org from email domain
export function parseOrgFromEmail(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  return orgsByDomain[domain] ?? DEFAULT_ORG_ID;
}

// Extract name from email
export function parseNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? 'User';
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}
