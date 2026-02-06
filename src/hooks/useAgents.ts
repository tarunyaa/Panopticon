import { useCallback, useEffect, useState } from "react";
import type { AgentInfo, CreateAgentPayload } from "../types/agents";

const API = "http://localhost:8000";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [maxAgents, setMaxAgents] = useState(6);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAgents(data.agents);
      setMaxAgents(data.maxAgents);
    } catch {
      // Keep existing state on error
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
        const data = await res.json();
        throw new Error(data.detail || `Server returned ${res.status}`);
      }
      await fetchAgents();
    },
    [fetchAgents],
  );

  return { agents, maxAgents, loading, createAgent };
}
