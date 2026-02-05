import type { Organization, LiveFeedData, Agent } from '../types';

// Known organizations mapped by email domain
export const orgsByDomain: Record<string, string> = {
  'acme.com': 'acme',
  'techcorp.io': 'techcorp',
  'startup.dev': 'startup',
};

// Default org for unknown domains
export const DEFAULT_ORG_ID = 'acme';

// Mock organizations with their pods
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

// Get user's default pod (first pod in their org)
export function getDefaultPod(orgId: string): string {
  const org = organizations.find(o => o.id === orgId);
  return org?.pods[0]?.id ?? 'acme-pod-1';
}

// Get organization by ID
export function getOrganization(orgId: string): Organization | undefined {
  return organizations.find(o => o.id === orgId);
}

// Get pod by ID
export function getPod(podId: string): { org: Organization; pod: typeof organizations[0]['pods'][0] } | undefined {
  for (const org of organizations) {
    const pod = org.pods.find(p => p.id === podId);
    if (pod) return { org, pod };
  }
  return undefined;
}

// Get agent by ID
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

// Manager agent (appears in every pod)
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
