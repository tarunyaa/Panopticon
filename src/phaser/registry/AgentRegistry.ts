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

export type AgentActivity = "idle" | "tool_call" | "llm_generating";

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
  speechBg?: Phaser.GameObjects.Graphics;
  speechText?: Phaser.GameObjects.Text;
  speechTimer: number;
  activity: AgentActivity;
  activityDetails: string;
  activityIcon?: Phaser.GameObjects.Text;
  tooltip?: Phaser.GameObjects.Container;
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

    // Activity icon (rendered above sprite head) - starts with idle icon
    const activityIcon = this.scene.add
      .text(x, y - 70, "⏸️", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(13)
      .setVisible(true);

    // Make sprite interactive for hover tooltips
    sprite.setInteractive({ useHandCursor: true });

    return {
      def, sprite, marker, label, barBg, barFill,
      progress: 0, targetX: x, targetY: y,
      speechTimer: 0,
      activity: "idle",
      activityDetails: "",
      activityIcon,
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

    // Handle WORKSHOP with multiple coordinate options
    if (zone === "WORKSHOP" && (z as any).options) {
      const options = (z as any).options as Array<{ x: number; y: number }>;
      const chosen = options[Math.floor(Math.random() * options.length)];
      agent.targetX = chosen.x;
      agent.targetY = chosen.y;
    } else {
      agent.targetX = z.x + offset;
      agent.targetY = z.y;
    }
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

  showBubble(agentName: string, text: string, frames = 180): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;

    const truncated = text.length > 50 ? text.slice(0, 47) + "..." : text;
    const sx = agent.sprite.x;
    const sy = agent.sprite.y - 70;

    if (agent.speechText) {
      // Update existing bubble
      agent.speechText.setText(truncated).setPosition(sx, sy).setAlpha(1);
      agent.speechBg?.destroy();
    } else {
      agent.speechText = this.scene.add
        .text(sx, sy, truncated, {
          fontSize: "10px",
          color: "#ffffff",
          wordWrap: { width: 150 },
          align: "center",
        })
        .setOrigin(0.5, 1)
        .setDepth(14);
    }

    // Draw rounded-rect background behind text
    const bounds = agent.speechText.getBounds();
    const pad = 6;
    const bg = this.scene.add.graphics().setDepth(13);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
      6
    );
    agent.speechBg = bg;
    agent.speechTimer = frames;
  }

  clearBubble(agentName: string): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;
    agent.speechText?.destroy();
    agent.speechBg?.destroy();
    agent.speechText = undefined;
    agent.speechBg = undefined;
    agent.speechTimer = 0;
  }

  tickBubbles(): void {
    for (const agent of this.agents) {
      if (agent.speechTimer <= 0) continue;
      agent.speechTimer--;
      if (agent.speechTimer === 0) {
        // Fade out then destroy
        if (agent.speechText) {
          this.scene.tweens.add({
            targets: [agent.speechText, agent.speechBg],
            alpha: 0,
            duration: 400,
            onComplete: () => {
              agent.speechText?.destroy();
              agent.speechBg?.destroy();
              agent.speechText = undefined;
              agent.speechBg = undefined;
            },
          });
        }
      }
    }
  }

  setActivity(agentName: string, activity: AgentActivity, details: string): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;

    agent.activity = activity;
    agent.activityDetails = details;

    // Update activity icon - always visible
    if (!agent.activityIcon) return;

    let icon = "";
    if (activity === "tool_call") {
      icon = "🔧";
    } else if (activity === "llm_generating") {
      icon = "💭";
    } else {
      icon = "⏸️"; // Idle state
    }

    agent.activityIcon.setText(icon).setVisible(true);
    agent.activityIcon.setPosition(agent.sprite.x, agent.sprite.y - 70);
  }

  setupTooltips(): void {
    // Setup hover interactions for all agents
    this.agents.forEach((agent) => {
      if (!agent.sprite.input) return;

      agent.sprite.on("pointerover", () => {
        this.showTooltip(agent);
      });

      agent.sprite.on("pointerout", () => {
        this.hideTooltip(agent);
      });
    });
  }

  private showTooltip(agent: AgentEntry): void {
    // Remove existing tooltip if any
    this.hideTooltip(agent);

    const x = agent.sprite.x;
    const y = agent.sprite.y - 100;

    // Build tooltip text - show detailed status information
    let text = "";
    if (agent.activity === "tool_call" && agent.activityDetails) {
      // Show which tool is being used
      text = agent.activityDetails;
    } else if (agent.activity === "llm_generating" && agent.activityDetails) {
      // Show LLM output/thinking status
      text = agent.activityDetails;
    } else if (agent.activity === "idle") {
      text = "Idle";
    } else {
      // Fallback
      text = agent.activity === "tool_call" ? "Using tool" : "Thinking...";
    }

    const tooltipText = this.scene.add
      .text(0, 0, text, {
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "#000000cc",
        padding: { x: 8, y: 6 },
        align: "center",
        wordWrap: { width: 200 },
      })
      .setOrigin(0.5, 1)
      .setDepth(15);

    const container = this.scene.add.container(x, y, [tooltipText]);
    agent.tooltip = container;
  }

  private hideTooltip(agent: AgentEntry): void {
    if (agent.tooltip) {
      agent.tooltip.destroy();
      agent.tooltip = undefined;
    }
  }

  /** Update activity icon positions as agents move */
  tickActivityIcons(): void {
    for (const agent of this.agents) {
      if (agent.activityIcon && agent.activityIcon.visible) {
        agent.activityIcon.setPosition(agent.sprite.x, agent.sprite.y - 70);
      }
      // Update tooltip position if visible
      if (agent.tooltip) {
        const x = agent.sprite.x;
        const y = agent.sprite.y - 100;
        agent.tooltip.setPosition(x, y);
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
