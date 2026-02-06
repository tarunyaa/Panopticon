export type ZoneId = "HOUSE" | "WORKSHOP" | "CAFE" | "PARK";

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
  | WorldSnapshotEvent;
