import { useRef, useEffect, useState, useCallback } from "react";
import { createGame, getGame } from "./phaser/game";
import { Sidebar } from "./components/Sidebar";
import { LoginScreen } from "./components/onboarding/LoginScreen";
import { AvatarSelectScreen } from "./components/onboarding/AvatarSelectScreen";
import { TeamSetupScreen } from "./components/onboarding/TeamSetupScreen";
import type { OnboardingAgent } from "./types/onboarding";
import type { CreateAgentPayload } from "./types/agents";
import { ALL_SPRITES, PHASER_COLORS } from "./types/agents";
import { API_BASE } from "./config";

type Step = "login" | "avatars" | "team" | "main";

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  // Onboarding state
  const [step, setStep] = useState<Step>("login");
  const [userAvatar, setUserAvatar] = useState<{ spriteKey: string; name: string } | null>(null);
  const [leaderAvatar, setLeaderAvatar] = useState<{ spriteKey: string; name: string } | null>(null);
  const [crewName, setCrewName] = useState("");
  const [task, setTask] = useState("");
  const [agents, setAgents] = useState<OnboardingAgent[]>([]);
  const [entering, setEntering] = useState(false);
  const [enterError, setEnterError] = useState<string | null>(null);

  useEffect(() => {
    if (gameRef.current && !gameInstance.current) {
      gameInstance.current = createGame(gameRef.current, {
        skipAgentSpawn: true,
      });
    }
    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  const handleEnterVillage = useCallback(async () => {
    if (!leaderAvatar) return;
    setEntering(true);
    setEnterError(null);

    try {
      // Build all agent payloads: leader (slot 0) + team agents
      const allAgents: OnboardingAgent[] = [
        {
          name: leaderAvatar.name,
          role: "Leader",
          goal: "Lead and coordinate the team",
          backstory: "The team leader who oversees all operations.",
          task_description: "Coordinate team members and ensure objectives are met.",
          expected_output: "Successful team coordination and project completion.",
          spriteKey: leaderAvatar.spriteKey,
        },
        ...agents,
      ];

      const payloads: CreateAgentPayload[] = allAgents.map((a) => ({
        agent_id: a.name.toLowerCase().replace(/\s+/g, "_"),
        role: a.role,
        goal: a.goal,
        backstory: a.backstory,
        task_description: a.task_description,
        expected_output: a.expected_output,
      }));

      // Replace all agents atomically via PUT /agents/setup
      const API = API_BASE;
      const res = await fetch(`${API}/agents/setup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents: payloads }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Server returned ${res.status}`);
      }
      const { agents: createdAgents } = await res.json();
      const assignedZones: string[] = createdAgents.map(
        (a: { zone: string }) => a.zone,
      );

      // Build AgentDef[] for Phaser and emit spawn event
      const game = getGame();
      if (game) {
        const agentDefs = allAgents.map((a, i) => {
          const spriteEntry = ALL_SPRITES.find((s) =>
            s.path.includes(a.spriteKey),
          );
          return {
            id: a.name.toLowerCase().replace(/\s+/g, "_"),
            name: a.name,
            role: a.role,
            color: PHASER_COLORS[i % PHASER_COLORS.length],
            spriteKey: spriteEntry?.key ?? ALL_SPRITES[i % ALL_SPRITES.length].key,
            zone: assignedZones[i] || "PARK",
          };
        });
        game.events.emit("spawn-agents", agentDefs);
      }

      setStep("main");
    } catch (err) {
      console.error("Error entering village:", err);
      setEnterError(err instanceof Error ? err.message : "Failed to connect to server");
    } finally {
      setEntering(false);
    }
  }, [leaderAvatar, agents]);

  return (
    <div className="h-screen w-screen relative bg-floor overflow-hidden">
      {/* Game area — always full screen behind overlays */}
      <div ref={gameRef} className="absolute inset-0 pixelated" />

      {/* Onboarding overlays */}
      {step === "login" && (
        <LoginScreen onEnter={() => setStep("avatars")} />
      )}

      {step === "avatars" && (
        <AvatarSelectScreen
          userAvatar={userAvatar}
          leaderAvatar={leaderAvatar}
          onUserAvatar={setUserAvatar}
          onLeaderAvatar={setLeaderAvatar}
          onNext={() => setStep("team")}
        />
      )}

      {step === "team" && leaderAvatar && (
        <TeamSetupScreen
          leaderAvatar={leaderAvatar}
          crewName={crewName}
          task={task}
          agents={agents}
          onCrewName={setCrewName}
          onTask={setTask}
          onAgents={setAgents}
          onEnterVillage={handleEnterVillage}
          entering={entering}
          error={enterError}
        />
      )}

      {/* Main view — sidebar slides in */}
      {step === "main" && (
        <div className="absolute right-0 top-0 h-full">
          <Sidebar />
        </div>
      )}
    </div>
  );
}
