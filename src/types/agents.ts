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
