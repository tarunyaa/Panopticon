import Phaser from "phaser";
import type { ZoneId } from "../../types/events";
import { ALL_SPRITES } from "../../types/agents";
import zones from "../../data/zones.json";

export interface AgentDef {
  id: string;
  name: string;
  role: string;
  color: number;
  spriteKey: string;
  zone?: string;
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

const ZONE_MAP = zones as Record<ZoneId, { x: number; y: number; label: string }>;

export class AgentRegistry {
  agents: AgentEntry[] = [];

  constructor(private scene: Phaser.Scene) {}

  /** Call in preload() to load all 6 character spritesheets */
  static preload(scene: Phaser.Scene): void {
    for (const { key, path } of ALL_SPRITES) {
      scene.load.spritesheet(key, path, { frameWidth: 32, frameHeight: 32 });
    }
  }

  /** Create walk animations for a sprite key if they don't exist yet */
  private ensureAnims(key: string): void {
    if (this.scene.anims.exists(`${key}-walk-down`)) return;
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

  /** Create sprite + UI elements for a single agent def at a given position */
  private createAgentAt(def: AgentDef, x: number, y: number): AgentEntry {
    const key = def.spriteKey;
    this.ensureAnims(key);

    const marker = this.scene.add.circle(x, y + 8, 14, def.color, 0.7).setDepth(9);

    const sprite = this.scene.physics.add
      .sprite(x, y, key, 1)
      .setSize(28, 28)
      .setOffset(2, 2)
      .setScale(2)
      .setDepth(10);

    const label = this.scene.add
      .text(x, y - 36, `${def.name}\n${def.role}`, {
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(11);

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

    return {
      def, sprite, marker, label, barBg, barFill,
      progress: 0, targetX: x, targetY: y,
    };
  }

  /** Spawn multiple agents at PARK, spaced 10 tiles apart */
  spawn(defs: AgentDef[]): void {
    const park = ZONE_MAP["PARK"];

    defs.forEach((def, i) => {
      const offset = (i - (defs.length - 1) / 2) * 320;
      const entry = this.createAgentAt(def, park.x + offset, park.y);
      this.agents.push(entry);
    });
  }

  /** Spawn a single agent at runtime at PARK, offset from existing agents */
  spawnOne(def: AgentDef): void {
    const park = ZONE_MAP["PARK"];
    const total = this.agents.length + 1;
    const offset = (this.agents.length - (total - 1) / 2) * 320;
    const entry = this.createAgentAt(def, park.x + offset, park.y);
    this.agents.push(entry);
  }

  setTarget(agentName: string, zone: ZoneId): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;
    const z = ZONE_MAP[zone];
    if (!z) return;

    const i = this.agents.indexOf(agent);
    const offset = (i - (this.agents.length - 1) / 2) * 64;
    agent.targetX = z.x + offset;
    agent.targetY = z.y;
  }

  /** Move all agents to a zone, spaced 2 tiles apart so they don't overlap */
  moveAllToZone(zone: ZoneId): void {
    const z = ZONE_MAP[zone];
    if (!z) return;

    this.agents.forEach((agent, i) => {
      const offset = (i - (this.agents.length - 1) / 2) * 64;
      agent.targetX = z.x + offset;
      agent.targetY = z.y;
    });
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
    const needle = agentName.toLowerCase();
    return this.agents.find(
      (a) =>
        a.def.id.toLowerCase() === needle ||
        a.def.name.toLowerCase() === needle ||
        a.def.role.toLowerCase() === needle
    );
  }

  getAll(): AgentEntry[] {
    return this.agents;
  }
}
