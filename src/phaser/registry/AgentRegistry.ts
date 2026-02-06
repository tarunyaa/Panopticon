import Phaser from "phaser";
import type { ZoneId } from "../../types/events";
import zones from "../../data/zones.json";

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  color: number;
  spriteKey: string;
}

export interface AgentEntry {
  def: AgentDef;
  sprite: Phaser.Physics.Arcade.Sprite;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  barBg: Phaser.GameObjects.Rectangle;
  barFill: Phaser.GameObjects.Rectangle;
  progress: number;
  targetX: number;
  targetY: number;
}

const BAR_WIDTH = 50;
const BAR_HEIGHT = 8;

const AGENT_DEFS: AgentDef[] = [
  { id: "planner",    name: "Abigail Chen",        role: "Planner",    color: 0x7ba3c9, spriteKey: "char_abigail" },
  { id: "researcher", name: "Carlos Gomez",         role: "Researcher", color: 0x8fbc8f, spriteKey: "char_carlos" },
  { id: "writer",     name: "Isabella Rodriguez",   role: "Writer",     color: 0xe8a598, spriteKey: "char_isabella" },
  { id: "reviewer",   name: "Klaus Mueller",        role: "Reviewer",   color: 0xb8a9c9, spriteKey: "char_klaus" },
];

const ZONE_MAP = zones as Record<ZoneId, { x: number; y: number; label: string }>;

export class AgentRegistry {
  agents: AgentEntry[] = [];

  constructor(private scene: Phaser.Scene) {}

  /** Call in preload() to load all character spritesheets */
  static preload(scene: Phaser.Scene): void {
    const chars: Record<string, string> = {
      char_abigail:  "assets/sprites/characters/Abigail_Chen.png",
      char_carlos:   "assets/sprites/characters/Carlos_Gomez.png",
      char_isabella: "assets/sprites/characters/Isabella_Rodriguez.png",
      char_klaus:    "assets/sprites/characters/Klaus_Mueller.png",
    };
    for (const [key, path] of Object.entries(chars)) {
      scene.load.spritesheet(key, path, { frameWidth: 32, frameHeight: 32 });
    }
  }

  spawn(startZone: ZoneId = "PARK"): void {
    const zone = ZONE_MAP[startZone];
    const spacing = 160;

    AGENT_DEFS.forEach((def, i) => {
      const offsetX = (i - 1.5) * spacing;
      const x = zone.x + offsetX;
      const y = zone.y;
      const key = def.spriteKey;

      // Per-character walk animations (same 3x4 grid layout)
      if (!this.scene.anims.exists(`${key}-walk-down`)) {
        this.scene.anims.create({
          key: `${key}-walk-down`,
          frames: this.scene.anims.generateFrameNumbers(key, { frames: [0, 1, 2, 1] }),
          frameRate: 6,
          repeat: -1,
        });
        this.scene.anims.create({
          key: `${key}-walk-left`,
          frames: this.scene.anims.generateFrameNumbers(key, { frames: [3, 4, 5, 4] }),
          frameRate: 6,
          repeat: -1,
        });
        this.scene.anims.create({
          key: `${key}-walk-right`,
          frames: this.scene.anims.generateFrameNumbers(key, { frames: [6, 7, 8, 7] }),
          frameRate: 6,
          repeat: -1,
        });
        this.scene.anims.create({
          key: `${key}-walk-up`,
          frames: this.scene.anims.generateFrameNumbers(key, { frames: [9, 10, 11, 10] }),
          frameRate: 6,
          repeat: -1,
        });
      }

      const marker = this.scene.add.circle(x, y + 8, 14, def.color, 0.7).setDepth(9);

      const sprite = this.scene.physics.add
        .sprite(x, y, key, 1)
        .setSize(28, 28)
        .setOffset(2, 2)
        .setScale(2)
        .setDepth(10);

      const label = this.scene.add
        .text(x, y - 36, def.name, {
          fontSize: "12px",
          color: "#ffffff",
          backgroundColor: "#00000088",
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5, 1)
        .setDepth(11);

      // Progress bar below the sprite
      const barY = y + 36;
      const barBg = this.scene.add
        .rectangle(x, barY, BAR_WIDTH, BAR_HEIGHT, 0x222222, 0.85)
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(1, 0xffffff, 0.6)
        .setDepth(11);
      const barFill = this.scene.add
        .rectangle(x - BAR_WIDTH / 2, barY, 0, BAR_HEIGHT, def.color, 1)
        .setOrigin(0, 0.5)
        .setDepth(12);

      this.agents.push({
        def, sprite, marker, label, barBg, barFill,
        progress: 0, targetX: x, targetY: y,
      });
    });
  }

  setTarget(agentName: string, zone: ZoneId): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;
    const z = ZONE_MAP[zone];
    if (!z) return;

    const idx = this.agents.indexOf(agent);
    const offsetX = (idx - 1.5) * 160;
    agent.targetX = z.x + offsetX;
    agent.targetY = z.y;
  }

  setProgress(agentName: string, progress: number): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;
    agent.progress = Phaser.Math.Clamp(progress, 0, 1);
    agent.barFill.width = BAR_WIDTH * agent.progress;
  }

  /** Call each frame — slowly fills active agents' bars toward 90% */
  tickProgress(): void {
    for (const agent of this.agents) {
      if (agent.progress > 0 && agent.progress < 0.9) {
        agent.progress = Math.min(0.9, agent.progress + 0.0008);
        agent.barFill.width = BAR_WIDTH * agent.progress;
      }
    }
  }

  private findAgent(agentName: string): AgentEntry | undefined {
    return this.agents.find(
      (a) =>
        a.def.name.toLowerCase() === agentName.toLowerCase() ||
        a.def.role.toLowerCase() === agentName.toLowerCase()
    );
  }

  getAll(): AgentEntry[] {
    return this.agents;
  }
}
