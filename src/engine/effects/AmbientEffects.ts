import { Container, Graphics } from 'pixi.js';

interface Cloud {
  graphic: Graphics;
  speed: number;
  startX: number;
  rangeX: number;
}

/**
 * Drifting clouds and ambient effects for the world scene.
 */
export class AmbientEffects {
  private clouds: Cloud[] = [];

  constructor(container: Container, sceneWidth: number, _sceneHeight: number) {
    // Create a few cloud shapes
    const cloudConfigs = [
      { x: 80, y: 30, w: 60, h: 12, speed: 0.15 },
      { x: 300, y: 50, w: 80, h: 16, speed: 0.1 },
      { x: 550, y: 20, w: 50, h: 10, speed: 0.2 },
      { x: 700, y: 60, w: 70, h: 14, speed: 0.12 },
    ];

    for (const cfg of cloudConfigs) {
      const g = new Graphics();
      // Main cloud body (rects for pixel look)
      g.rect(0, 0, cfg.w, cfg.h);
      g.fill({ color: 0xffffff, alpha: 0.35 });
      g.rect(cfg.w * 0.15, -cfg.h * 0.4, cfg.w * 0.5, cfg.h * 0.5);
      g.fill({ color: 0xffffff, alpha: 0.3 });
      g.rect(cfg.w * 0.4, -cfg.h * 0.2, cfg.w * 0.4, cfg.h * 0.4);
      g.fill({ color: 0xffffff, alpha: 0.25 });

      g.x = cfg.x;
      g.y = cfg.y;
      container.addChild(g);

      this.clouds.push({
        graphic: g,
        speed: cfg.speed,
        startX: cfg.x,
        rangeX: sceneWidth + 100,
      });
    }

  }

  update(dt: number): void {
    for (const cloud of this.clouds) {
      cloud.graphic.x += cloud.speed * dt;
      if (cloud.graphic.x > cloud.rangeX) {
        cloud.graphic.x = -100;
      }
    }
  }
}
