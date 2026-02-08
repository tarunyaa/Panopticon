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

/** A single log entry for the agent inspect panel */
export interface AgentLogEntry {
  text: string;
  time: number; // Date.now()
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
  speechBg?: Phaser.GameObjects.Graphics;
  speechText?: Phaser.GameObjects.Text;
  speechTimer: number;
  activity: string;           // "idle" | "tool_call" | "llm_generating"
  activityDetails: string;    // e.g. "Using web_search"
  activityEmoji?: Phaser.GameObjects.Text;
  log: AgentLogEntry[];       // per-agent event history
}

const BAR_WIDTH = 50;
const BAR_HEIGHT = 8;
const MAX_LOG_ENTRIES = 30;

const ZONE_MAP = zones as Record<ZoneId, { x: number; y: number; label: string }>;

/** Emoji for each activity state */
const ACTIVITY_EMOJI: Record<string, string> = {
  idle: "\ud83d\udca4",           // sleeping zzz
  tool_call: "\ud83d\udd28",     // hammer
  llm_generating: "\ud83e\udde0", // brain
  planning: "\ud83d\udccb",       // clipboard (whiteboard) — leader planning/delegating
};

export class AgentRegistry {
  agents: AgentEntry[] = [];

  // --- Inspect panel state ---
  private inspectedAgent: AgentEntry | null = null;
  private inspectBg?: Phaser.GameObjects.Graphics;
  private inspectTexts: Phaser.GameObjects.Text[] = [];
  private inspectTitle?: Phaser.GameObjects.Text;

  // --- Handoff line state ---
  private handoffLines: Array<{
    gfx: Phaser.GameObjects.Graphics;
    timer: number; // frames remaining
    sourceNames: string[];
    receiverName: string;
  }> = [];

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
        color: "#3A2820",
        backgroundColor: "#E8DCC8dd",
        padding: { x: 4, y: 2 },
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(11)
      .setVisible(false);

    // Show name/role on hover
    sprite.setInteractive({ useHandCursor: true });
    sprite.on("pointerover", () => label.setVisible(true));
    sprite.on("pointerout", () => {
      // Don't hide if this agent is inspected
      if (this.inspectedAgent?.def.id !== def.id) {
        label.setVisible(false);
      }
    });

    // Click to inspect
    sprite.on("pointerdown", () => {
      this.toggleInspect(def.id);
    });

    const barY = y + 36;
    const barBg = this.scene.add
      .rectangle(x, barY, BAR_WIDTH, BAR_HEIGHT, 0xC4B898, 0.85)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0x6B5040, 0.5)
      .setDepth(11);
    const barFill = this.scene.add
      .rectangle(x - BAR_WIDTH / 2, barY, 0, BAR_HEIGHT, def.color, 1)
      .setOrigin(0, 0.5)
      .setDepth(12);

    return {
      def, sprite, marker, label, barBg, barFill,
      progress: 0, targetX: x, targetY: y,
      speechTimer: 0, activity: "idle", activityDetails: "",
      log: [],
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

  /** No-op — tooltips are set up in createAgentAt via pointer events */
  setupTooltips(): void {}

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
      const chosen = options[i % options.length];
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
          color: "#3A2820",
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
    bg.fillStyle(0xE8DCC8, 0.92);
    bg.lineStyle(1, 0xC4B898, 1);
    bg.fillRoundedRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
      6
    );
    bg.strokeRoundedRect(
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

  // =========================================================================
  // Feature 1: Activity emoji indicators
  // =========================================================================

  setActivity(agentName: string, activity: string, details: string): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;

    const prev = agent.activity;
    agent.activity = activity;
    agent.activityDetails = details;

    // Log activity changes (skip duplicate idle→idle)
    if (activity !== prev || activity === "tool_call") {
      const emoji = ACTIVITY_EMOJI[activity] || "";
      let logText = "";
      if (activity === "tool_call") {
        logText = `${emoji} ${details || "Using tool"}`;
      } else if (activity === "llm_generating") {
        logText = `${emoji} Thinking...`;
      } else if (activity === "planning") {
        logText = `${emoji} ${details || "Planning..."}`;
      } else if (activity === "idle" && prev !== "idle") {
        logText = `${emoji} Idle`;
      }
      if (logText) {
        this.addLog(agent, logText);
      }
    }
  }

  /** Update emoji activity icon positions and visibility each frame */
  tickActivityIcons(): void {
    for (const agent of this.agents) {
      const emoji = ACTIVITY_EMOJI[agent.activity];
      const ix = agent.sprite.x + 26;
      const iy = agent.sprite.y - 32;

      if (agent.activity !== "idle" && emoji) {
        if (!agent.activityEmoji) {
          agent.activityEmoji = this.scene.add
            .text(ix, iy, emoji, { fontSize: "18px" })
            .setOrigin(0.5, 0.5)
            .setDepth(15);
          // Bounce animation
          this.scene.tweens.add({
            targets: agent.activityEmoji,
            y: iy - 6,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        } else {
          agent.activityEmoji
            .setPosition(ix, agent.activityEmoji.y) // keep y from tween
            .setText(emoji)
            .setVisible(true);
        }
      } else if (agent.activityEmoji) {
        agent.activityEmoji.setVisible(false);
      }
    }
  }

  // =========================================================================
  // Feature 2: Click-to-inspect agent log panel
  // =========================================================================

  /** Add a log entry for an agent */
  addLog(agent: AgentEntry, text: string): void {
    agent.log.push({ text, time: Date.now() });
    if (agent.log.length > MAX_LOG_ENTRIES) {
      agent.log.shift();
    }
    // If this agent is being inspected, refresh the panel
    if (this.inspectedAgent?.def.id === agent.def.id) {
      this.renderInspectPanel();
    }
  }

  /** Add a log entry by agent name (called from VillageScene) */
  logEvent(agentName: string, text: string): void {
    const agent = this.findAgent(agentName);
    if (agent) this.addLog(agent, text);
  }

  /** Toggle the inspect panel for an agent */
  private toggleInspect(agentId: string): void {
    if (this.inspectedAgent?.def.id === agentId) {
      // Close
      this.closeInspect();
      return;
    }

    // Close previous
    this.closeInspect();

    const agent = this.agents.find((a) => a.def.id === agentId);
    if (!agent) return;

    this.inspectedAgent = agent;
    agent.label.setVisible(true);
    this.renderInspectPanel();
  }

  private closeInspect(): void {
    if (this.inspectedAgent) {
      this.inspectedAgent.label.setVisible(false);
    }
    this.inspectedAgent = null;
    this.inspectBg?.destroy();
    this.inspectBg = undefined;
    this.inspectTitle?.destroy();
    this.inspectTitle = undefined;
    for (const t of this.inspectTexts) t.destroy();
    this.inspectTexts = [];
  }

  private renderInspectPanel(): void {
    // Clean old renders
    this.inspectBg?.destroy();
    this.inspectTitle?.destroy();
    for (const t of this.inspectTexts) t.destroy();
    this.inspectTexts = [];

    const agent = this.inspectedAgent;
    if (!agent) return;

    const panelW = 220;
    const lineH = 16;
    const padX = 8;
    const padY = 6;
    const maxVisible = 8;

    const entries = agent.log.slice(-maxVisible);
    const titleH = 22;
    const panelH = titleH + padY + entries.length * lineH + padY;

    // Position panel to the right of the sprite
    const px = agent.sprite.x + 40;
    const py = agent.sprite.y - panelH / 2;

    // Background
    const bg = this.scene.add.graphics().setDepth(20);
    bg.fillStyle(0xE8DCC8, 0.94);
    bg.fillRoundedRect(px, py, panelW, panelH, 8);
    bg.lineStyle(2, 0x6B5040, 0.8);
    bg.strokeRoundedRect(px, py, panelW, panelH, 8);
    this.inspectBg = bg;

    // Title
    const emoji = ACTIVITY_EMOJI[agent.activity] || "\ud83d\udca4";
    this.inspectTitle = this.scene.add
      .text(px + padX, py + padY, `${emoji} ${agent.def.name}`, {
        fontSize: "12px",
        color: "#3A2820",
        fontStyle: "bold",
      })
      .setDepth(21);

    // Log entries
    const startY = py + titleH + padY;
    entries.forEach((entry, i) => {
      const elapsed = this.formatElapsed(entry.time);
      const t = this.scene.add
        .text(px + padX, startY + i * lineH, `${elapsed} ${entry.text}`, {
          fontSize: "9px",
          color: "#6B5040",
          wordWrap: { width: panelW - padX * 2 },
        })
        .setDepth(21);
      this.inspectTexts.push(t);
    });

    if (entries.length === 0) {
      const t = this.scene.add
        .text(px + padX, startY, "No activity yet", {
          fontSize: "9px",
          color: "#9B8B78",
          fontStyle: "italic",
        })
        .setDepth(21);
      this.inspectTexts.push(t);
    }
  }

  /** Update inspect panel position to follow the agent each frame */
  tickInspectPanel(): void {
    if (!this.inspectedAgent || !this.inspectBg) return;
    // Re-render at new position (panels are small, this is fine per-frame)
    this.renderInspectPanel();
  }

  private formatElapsed(time: number): string {
    const secs = Math.floor((Date.now() - time) / 1000);
    if (secs < 5) return "now";
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m`;
  }

  // =========================================================================
  // Feature 3: Handoff connection lines between agents
  // =========================================================================

  /** Show glowing connection lines + pulse markers for a handoff */
  showHandoffLink(sourceAgents: string[], receivingAgent: string): void {
    const receiver = this.findAgent(receivingAgent);
    if (!receiver) return;

    // Pulse the receiver's marker
    this.pulseMarker(receiver);

    for (const sourceName of sourceAgents) {
      const source = this.findAgent(sourceName);
      if (!source) continue;

      // Pulse source marker too
      this.pulseMarker(source);

      // Draw a glowing line between them
      const gfx = this.scene.add.graphics().setDepth(8);
      this.handoffLines.push({
        gfx,
        timer: 180, // ~3 seconds at 60fps
        sourceNames: [sourceName],
        receiverName: receivingAgent,
      });
    }
  }

  /** Pulse an agent's marker circle */
  private pulseMarker(agent: AgentEntry): void {
    this.scene.tweens.add({
      targets: agent.marker,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 1,
      duration: 300,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => {
        agent.marker.setScale(1).setAlpha(0.7);
      },
    });
  }

  /** Update handoff lines each frame — redraw between current positions, fade out */
  tickHandoffLines(): void {
    for (let i = this.handoffLines.length - 1; i >= 0; i--) {
      const link = this.handoffLines[i];
      link.timer--;

      if (link.timer <= 0) {
        link.gfx.destroy();
        this.handoffLines.splice(i, 1);
        continue;
      }

      const receiver = this.findAgent(link.receiverName);
      if (!receiver) {
        link.gfx.destroy();
        this.handoffLines.splice(i, 1);
        continue;
      }

      // Fade alpha over last 60 frames
      const alpha = link.timer < 60 ? link.timer / 60 : 1;

      link.gfx.clear();
      for (const srcName of link.sourceNames) {
        const source = this.findAgent(srcName);
        if (!source) continue;

        // Outer glow
        link.gfx.lineStyle(6, receiver.def.color, alpha * 0.3);
        link.gfx.lineBetween(
          source.sprite.x, source.sprite.y,
          receiver.sprite.x, receiver.sprite.y,
        );
        // Inner bright line
        link.gfx.lineStyle(2, 0xffffff, alpha * 0.8);
        link.gfx.lineBetween(
          source.sprite.x, source.sprite.y,
          receiver.sprite.x, receiver.sprite.y,
        );
      }
    }
  }

  // =========================================================================
  // Utilities
  // =========================================================================

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
