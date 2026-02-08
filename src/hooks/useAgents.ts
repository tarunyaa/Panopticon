import { useCallback, useEffect, useState } from "react";
import type { AgentInfo, CreateAgentPayload } from "../types/agents";
import { getGame } from "../phaser/game";
import { API_BASE } from "../config";

const API = API_BASE;

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [maxAgents, setMaxAgents] = useState(9);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAgents(data.agents);
      setMaxAgents(data.maxAgents);
      return data.agents as AgentInfo[];
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const createAgent = useCallback(
    async (payload: CreateAgentPayload) => {
      const res = await fetch(`${API}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = `Server returned ${res.status}`;
        try {
          const data = await res.json();
          if (data.detail) detail = data.detail;
        } catch { /* response wasn't JSON */ }
        throw new Error(detail);
      }
      const updatedAgents = await fetchAgents();
      // Emit Phaser event so the new agent sprite appears on the map
      if (updatedAgents) {
        const game = getGame();
        if (game) {
          const newAgent = updatedAgents.find(
            (a: AgentInfo) => a.id === payload.agent_id
          );
          if (newAgent) {
            const index = updatedAgents.indexOf(newAgent);
            game.events.emit("agent-created", newAgent, index);
          }
        }
      }
    },
    [fetchAgents],
  );

  const batchCreateAgents = useCallback(
    async (payloads: CreateAgentPayload[]): Promise<{ id: string; zone: string }[]> => {
      const res = await fetch(`${API}/agents/setup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: payloads }),
      });
      if (!res.ok) {
        let detail = `Server returned ${res.status}`;
        try {
          const data = await res.json();
          if (data.detail) detail = data.detail;
        } catch { /* response wasn't JSON */ }
        throw new Error(detail);
      }
      const data = await res.json();
      await fetchAgents();
      return data.agents as { id: string; zone: string }[];
    },
    [fetchAgents],
  );

  return { agents, maxAgents, loading, createAgent, batchCreateAgents };
}
