export interface AgentInfo {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  zone: string;
  task_description: string;
  expected_output: string;
}

// Character avatar sprites — assigned round-robin to agent slots
export const AVATARS = [
  { key: "Abigail_Chen", label: "Abigail" },
  { key: "Carlos_Gomez", label: "Carlos" },
  { key: "Isabella_Rodriguez", label: "Isabella" },
  { key: "Klaus_Mueller", label: "Klaus" },
  { key: "Ayesha_Khan", label: "Ayesha" },
  { key: "Eddy_Lin", label: "Eddy" },
  { key: "Adam_Smith", label: "Adam" },
  { key: "Carmen_Ortiz", label: "Carmen" },
];

export interface CreateAgentPayload {
  agent_id: string;
  role: string;
  goal: string;
  backstory: string;
  task_description: string;
  expected_output: string;
}

export const SLOT_COLORS = [
  { bg: "bg-accent-blue", text: "text-accent-blue", border: "border-accent-blue" },
  { bg: "bg-accent-green", text: "text-accent-green", border: "border-accent-green" },
  { bg: "bg-accent-coral", text: "text-accent-coral", border: "border-accent-coral" },
  { bg: "bg-accent-purple", text: "text-accent-purple", border: "border-accent-purple" },
  { bg: "bg-accent-amber", text: "text-accent-amber", border: "border-accent-amber" },
  { bg: "bg-accent-teal", text: "text-accent-teal", border: "border-accent-teal" },
];

// Hex colors for Phaser sprites — matches SLOT_COLORS order
export const PHASER_COLORS: number[] = [
  0x7ba3c9, // blue
  0x8fbc8f, // green
  0xe8a598, // coral
  0xb8a9c9, // purple
  0xd4a843, // amber
  0x5fb8a0, // teal
];

// Sprite keys + asset paths — single source of truth for preload and def mapping
export const ALL_SPRITES = [
  { key: "char_abigail",  path: "assets/sprites/characters/Abigail_Chen.png" },
  { key: "char_carlos",   path: "assets/sprites/characters/Carlos_Gomez.png" },
  { key: "char_isabella", path: "assets/sprites/characters/Isabella_Rodriguez.png" },
  { key: "char_klaus",    path: "assets/sprites/characters/Klaus_Mueller.png" },
  { key: "char_ayesha",   path: "assets/sprites/characters/Ayesha_Khan.png" },
  { key: "char_eddy",     path: "assets/sprites/characters/Eddy_Lin.png" },
  { key: "char_adam",     path: "assets/sprites/characters/Adam_Smith.png" },
  { key: "char_carmen",   path: "assets/sprites/characters/Carmen_Ortiz.png" },
];
