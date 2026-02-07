import type { WSEvent, AgentIntentEvent, GateRequestedEvent } from "../types/events";
import { WS_BASE } from "../config";

type EventHandler = (ev: WSEvent) => void;
type IntentHandler = (ev: AgentIntentEvent) => void;
type GateHandler = (ev: GateRequestedEvent) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private intentHandlers: Set<IntentHandler> = new Set();
  private gateHandlers: Set<GateHandler> = new Set();

  connect(runId: string): void {
    this.disconnect();
    this.ws = new WebSocket(`${WS_BASE}/runs/${runId}`);

    this.ws.onmessage = (msg) => {
      try {
        const ev: WSEvent = JSON.parse(msg.data);
        this.eventHandlers.forEach((h) => h(ev));

        if (ev.type === "AGENT_INTENT") {
          this.intentHandlers.forEach((h) => h(ev));
        }
        if (ev.type === "GATE_REQUESTED") {
          this.gateHandlers.forEach((h) => h(ev));
        }
      } catch {
        console.error("Failed to parse WS message:", msg.data);
      }
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    this.ws.onclose = () => {
      console.log("WebSocket closed");
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  on(type: "event", handler: EventHandler): void;
  on(type: "intent", handler: IntentHandler): void;
  on(type: "gate", handler: GateHandler): void;
  on(type: string, handler: EventHandler | IntentHandler | GateHandler): void {
    if (type === "event") this.eventHandlers.add(handler as EventHandler);
    if (type === "intent") this.intentHandlers.add(handler as IntentHandler);
    if (type === "gate") this.gateHandlers.add(handler as GateHandler);
  }

  off(type: "event", handler: EventHandler): void;
  off(type: "intent", handler: IntentHandler): void;
  off(type: "gate", handler: GateHandler): void;
  off(type: string, handler: EventHandler | IntentHandler | GateHandler): void {
    if (type === "event") this.eventHandlers.delete(handler as EventHandler);
    if (type === "intent") this.intentHandlers.delete(handler as IntentHandler);
    if (type === "gate") this.gateHandlers.delete(handler as GateHandler);
  }
}

export const wsClient = new WSClient();
