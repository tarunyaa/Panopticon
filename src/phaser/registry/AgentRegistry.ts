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

interface ZoneBounds { x1: number; y1: number; x2: number; y2: number }
interface ZoneSpot { x: number; y: number }
interface ZoneData {
  label: string;
  bounds?: ZoneBounds;
  spots?: ZoneSpot[];
  overflow?: ZoneBounds;
  options?: ZoneSpot[];
}
const ZONE_MAP = zones as Record<ZoneId, ZoneData>;
const ZONE_SPACING = 64; // 2 tiles

/** Emoji for each activity state */
const ACTIVITY_EMOJI: Record<string, string> = {
  idle: "\ud83d\udca4",           // sleeping zzz
  tool_call: "\ud83d\udd28",     // hammer
  llm_generating: "\ud83e\udde0", // brain
  planning: "\ud83d\udccb",       // clipboard (whiteboard) — leader planning/delegating
  done: "\u2705",                 // checkmark — task complete, walking back
};

/** Serializable payload emitted to React via game events */
export interface AgentInspectData {
  id: string;
  name: string;
  role: string;
  spriteKey: string;
  activity: string;
  activityDetails: string;
  log: AgentLogEntry[];
}

export class AgentRegistry {
  agents: AgentEntry[] = [];

  // --- Inspect state (id only — panel lives in React) ---
  private inspectedAgentId: string | null = null;

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

  /** Create walk animations for a sprite key if they don't exist yet (public alias) */
  ensureAnimsFor(key: string): void { this.ensureAnims(key); }

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
        fontStyle: "bold",
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
      if (this.inspectedAgentId !== def.id) {
        label.setVisible(false);
      }
    });

    // Click to inspect — emit to React
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

  /** Spawn multiple agents at DORM (idle zone) */
  spawn(defs: AgentDef[]): void {
    defs.forEach((def, i) => {
      const pos = this.getZonePosition("DORM", i, defs.length);
      const entry = this.createAgentAt(def, pos.x, pos.y);
      this.agents.push(entry);
    });
  }

  /** Spawn a single agent at runtime at DORM */
  spawnOne(def: AgentDef): void {
    const total = this.agents.length + 1;
    const pos = this.getZonePosition("DORM", this.agents.length, total);
    const entry = this.createAgentAt(def, pos.x, pos.y);
    this.agents.push(entry);
  }

  /** No-op — tooltips are set up in createAgentAt via pointer events */
  setupTooltips(): void {}

  setTarget(agentName: string, zone: ZoneId): void {
    const agent = this.findAgent(agentName);
    if (!agent) return;
    const i = this.agents.indexOf(agent);
    const pos = this.getZonePosition(zone, i, this.agents.length);
    agent.targetX = pos.x;
    agent.targetY = pos.y;
  }

  /** Move all agents to a zone */
  moveAllToZone(zone: ZoneId): void {
    this.agents.forEach((agent, i) => {
      const pos = this.getZonePosition(zone, i, this.agents.length);
      agent.targetX = pos.x;
      agent.targetY = pos.y;
    });
  }

  // ---- Zone placement helpers ----

  /** Get the pixel position for agent `index` (of `total`) inside `zone` */
  private getZonePosition(zone: ZoneId, index: number, total: number): ZoneSpot {
    const z = ZONE_MAP[zone];

    // WORKSHOP — round-robin through fixed options
    if (zone === "WORKSHOP" && z.options) {
      return z.options[index % z.options.length];
    }

    // DORM — first N go to specific spots, rest overflow into a rect
    if (zone === "DORM" && z.spots) {
      if (index < z.spots.length) {
        return z.spots[index];
      }
      if (z.overflow) {
        return this.placeInBounds(z.overflow, index - z.spots.length, total - z.spots.length);
      }
    }

    // Rectangle zones (PARK, CAFE, HOUSE) — grid within bounds
    if (z.bounds) {
      return this.placeInBounds(z.bounds, index, total);
    }

    return { x: 0, y: 0 };
  }

  /** Distribute agent `index` (of `total`) evenly inside a rectangle */
  private placeInBounds(b: ZoneBounds, index: number, total: number): ZoneSpot {
    if (total <= 0) total = 1;
    const w = b.x2 - b.x1;
    const h = b.y2 - b.y1;
    const cols = Math.max(1, Math.floor(w / ZONE_SPACING) + 1);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const actualCols = Math.min(cols, total);
    const rows = Math.ceil(total / cols);
    const gridW = (actualCols - 1) * ZONE_SPACING;
    const gridH = (rows - 1) * ZONE_SPACING;
    return {
      x: b.x1 + (w - gridW) / 2 + col * ZONE_SPACING,
      y: b.y1 + (h - gridH) / 2 + row * ZONE_SPACING,
    };
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
      } else if (activity === "done") {
        logText = `${emoji} ${details || "Task complete"}`;
      } else if (activity === "idle" && prev !== "idle") {
        logText = `${emoji} Idle`;
      }
      if (logText) {
        this.addLog(agent, logText);
      }
    }

    // Always push activity change to React inspect panel
    if (this.inspectedAgentId === agent.def.id) {
      this.emitInspect(agent);
    }
  }

  /** Update emoji activity icon positions and visibility each frame */
  tickActivityIcons(): void {
    const bounce = Math.sin(Date.now() * 0.005) * 3; // gentle 3px bounce
    for (const agent of this.agents) {
      const emoji = ACTIVITY_EMOJI[agent.activity];
      const ix = agent.sprite.x + 20;
      const iy = agent.sprite.y - 30 + bounce;

      if (emoji) {
        if (!agent.activityEmoji) {
          agent.activityEmoji = this.scene.add
            .text(ix, iy, emoji, { fontSize: "16px" })
            .setOrigin(0.5, 0.5)
            .setDepth(15);
        }
        agent.activityEmoji
          .setPosition(ix, iy)
          .setText(emoji)
          .setVisible(true);
      }
    }
  }

  // =========================================================================
  // Feature 2: Click-to-inspect — data lives here, panel is in React
  // =========================================================================

  /** Add a log entry for an agent */
  addLog(agent: AgentEntry, text: string): void {
    agent.log.push({ text, time: Date.now() });
    if (agent.log.length > MAX_LOG_ENTRIES) {
      agent.log.shift();
    }
    // Push update to React if this agent is inspected
    if (this.inspectedAgentId === agent.def.id) {
      this.emitInspect(agent);
    }
  }

  /** Add a log entry by agent name (called from VillageScene) */
  logEvent(agentName: string, text: string): void {
    const agent = this.findAgent(agentName);
    if (agent) this.addLog(agent, text);
  }

  /** Toggle inspect and emit to React */
  private toggleInspect(agentId: string): void {
    if (this.inspectedAgentId === agentId) {
      // Close — unhide label, emit null
      const prev = this.agents.find((a) => a.def.id === agentId);
      if (prev) prev.label.setVisible(false);
      this.inspectedAgentId = null;
      this.scene.game.events.emit("agent-inspect", null);
      return;
    }

    // Close previous
    if (this.inspectedAgentId) {
      const prev = this.agents.find((a) => a.def.id === this.inspectedAgentId);
      if (prev) prev.label.setVisible(false);
    }

    const agent = this.agents.find((a) => a.def.id === agentId);
    if (!agent) return;

    this.inspectedAgentId = agentId;
    agent.label.setVisible(true);
    this.emitInspect(agent);
  }

  /** Emit serializable inspect data to React via game events */
  private emitInspect(agent: AgentEntry): void {
    const data: AgentInspectData = {
      id: agent.def.id,
      name: agent.def.name,
      role: agent.def.role,
      spriteKey: agent.def.spriteKey,
      activity: agent.activity,
      activityDetails: agent.activityDetails,
      log: [...agent.log],
    };
    this.scene.game.events.emit("agent-inspect", data);
  }

  /** No-op — inspect panel is now a React component */
  tickInspectPanel(): void {}

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
