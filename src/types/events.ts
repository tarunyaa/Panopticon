export type ZoneId = "HOUSE" | "WORKSHOP" | "CAFE" | "PARK" | "DORM";

export interface RunStartedEvent {
  type: "RUN_STARTED";
  runId: string;
  prompt: string;
}

export interface AgentIntentEvent {
  type: "AGENT_INTENT";
  agentName: string;
  zone: ZoneId;
  message: string;
}

export interface AgentOutputEvent {
  type: "AGENT_OUTPUT";
  agentName: string;
  output: string;
}

export interface RunFinishedEvent {
  type: "RUN_FINISHED";
  runId: string;
}

export interface TaskSummaryEvent {
  type: "TASK_SUMMARY";
  agentName: string;
  summary: string;
  fullOutput: string;
}

export interface ErrorEvent {
  type: "ERROR";
  message: string;
}

export interface GateRequestedEvent {
  type: "GATE_REQUESTED";
  gateId: string;
  runId: string;
  agentName: string;
  question: string;
  context: string;
  reason: string;
  gateSource: "task_complete" | "file_operation" | "terminal_command" | "leader_request";
}

export interface GateRecommendedEvent {
  type: "GATE_RECOMMENDED";
  agentName: string;
  reason: string;
  context: string;
  question: string;
  options: string;
  recommendation: string;
}

export interface AgentActivityEvent {
  type: "AGENT_ACTIVITY";
  agentName: string;
  activity: "idle" | "tool_call" | "llm_generating";
  details: string;
}

export interface TaskHandoffEvent {
  type: "TASK_HANDOFF";
  receivingAgent: string;
  sourceAgents: string[];
  summary: string;
}

export interface WorldSnapshotEvent {
  type: "WORLD_SNAPSHOT";
  agents: Array<{ name: string; zone: ZoneId }>;
}

export type WSEvent =
  | RunStartedEvent
  | AgentIntentEvent
  | AgentOutputEvent
  | TaskSummaryEvent
  | RunFinishedEvent
  | ErrorEvent
  | GateRequestedEvent
  | GateRecommendedEvent
  | AgentActivityEvent
  | TaskHandoffEvent
  | WorldSnapshotEvent;
