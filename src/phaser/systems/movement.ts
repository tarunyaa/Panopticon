import type { AgentRegistry, AgentEntry } from "../registry/AgentRegistry";

const SPEED = 360;
const ARRIVE_THRESHOLD = 4;
const BAR_WIDTH = 50;

export function updateMovement(registry: AgentRegistry): void {
  for (const agent of registry.getAll()) {
    moveAgent(agent);
  }
}

function moveAgent(agent: AgentEntry): void {
  const { def, sprite, marker, label, barBg, barFill, targetX, targetY } = agent;
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  if (!body) return;

  const key = def.spriteKey;

  // Use body position as source of truth (not sprite.x/y which tweens could override)
  const bx = body.position.x + body.halfWidth;
  const by = body.position.y + body.halfHeight;

  const dx = targetX - bx;
  const dy = targetY - by;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < ARRIVE_THRESHOLD) {
    body.setVelocity(0);
    sprite.anims.stop();
    sprite.setFrame(1);
  } else {
    const vx = (dx / dist) * SPEED;
    const vy = (dy / dist) * SPEED;
    body.setVelocity(vx, vy);

    if (Math.abs(dx) > Math.abs(dy)) {
      sprite.anims.play(dx < 0 ? `${key}-walk-left` : `${key}-walk-right`, true);
    } else {
      sprite.anims.play(dy < 0 ? `${key}-walk-up` : `${key}-walk-down`, true);
    }
  }

  // Idle bob — small sine offset only when stationary
  const idle = dist < ARRIVE_THRESHOLD;
  const bob = idle ? Math.sin(Date.now() * 0.003) * 2 : 0;

  // Keep label, marker, and progress bar tracking the sprite
  label.setPosition(sprite.x, sprite.y - 36 + bob);
  marker.setPosition(sprite.x, sprite.y + 8 + bob);
  barBg.setPosition(sprite.x, sprite.y + 36 + bob);
  barFill.setPosition(sprite.x - BAR_WIDTH / 2, sprite.y + 36 + bob);

  // Track speech bubble position
  if (agent.speechText && agent.speechBg) {
    const bubbleY = sprite.y - 70 + bob;
    agent.speechText.setPosition(sprite.x, bubbleY);
    const bounds = agent.speechText.getBounds();
    const pad = 6;
    agent.speechBg.clear();
    agent.speechBg.fillStyle(0xE8DCC8, 0.92);
    agent.speechBg.lineStyle(1, 0xC4B898, 1);
    agent.speechBg.fillRoundedRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
      6
    );
    agent.speechBg.strokeRoundedRect(
      bounds.x - pad,
      bounds.y - pad,
      bounds.width + pad * 2,
      bounds.height + pad * 2,
      6
    );
  }
}
