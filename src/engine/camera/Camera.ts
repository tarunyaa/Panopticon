import { Container } from 'pixi.js';

/**
 * Smooth lerp camera for pan/zoom on a Pixi stage container.
 */
export class Camera {
  // Current state
  private x = 0;
  private y = 0;
  private zoom = 1;

  // Target state (lerp toward these)
  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;

  // Lerp factor (higher = snappier)
  private lerpFactor = 0.12;

  // Zoom limits
  private minZoom = 0.5;
  private maxZoom = 2.0;

  // Scene bounds for clamping
  private boundsX = 0;
  private boundsY = 0;
  private boundsW = 900;
  private boundsH = 550;

  // Viewport size
  private viewW = 0;
  private viewH = 0;

  // Animated zoom state
  private zoomAnimating = false;
  private zoomStart = 1;
  private zoomEnd = 1;
  private zoomPointX = 0;
  private zoomPointY = 0;
  private zoomElapsed = 0;
  private zoomDuration = 0;
  private zoomResolve: (() => void) | null = null;

  constructor(private stage: Container) {}

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  setBounds(x: number, y: number, w: number, h: number): void {
    this.boundsX = x;
    this.boundsY = y;
    this.boundsW = w;
    this.boundsH = h;
  }

  /** Snap instantly (no lerp) */
  snapTo(x: number, y: number, zoom?: number): void {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
    if (zoom !== undefined) {
      this.zoom = this.targetZoom = zoom;
    }
  }

  /** Set target for smooth pan */
  panTo(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  /** Drag-based panning */
  move(dx: number, dy: number): void {
    this.targetX -= dx / this.zoom;
    this.targetY -= dy / this.zoom;
  }

  /** Wheel zoom, centered on pointer */
  adjustZoom(delta: number, pointerX: number, pointerY: number): void {
    const factor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.targetZoom * factor));

    // Adjust target so zoom centers on pointer
    const worldX = (pointerX - this.viewW / 2) / this.zoom + this.x;
    const worldY = (pointerY - this.viewH / 2) / this.zoom + this.y;

    this.targetX = worldX - (pointerX - this.viewW / 2) / newZoom;
    this.targetY = worldY - (pointerY - this.viewH / 2) / newZoom;
    this.targetZoom = newZoom;
  }

  /** Animated zoom toward a point */
  zoomTo(pointX: number, pointY: number, zoom: number, durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.zoomAnimating = true;
      this.zoomStart = this.zoom;
      this.zoomEnd = zoom;
      this.zoomPointX = pointX;
      this.zoomPointY = pointY;
      this.zoomElapsed = 0;
      this.zoomDuration = durationMs;
      this.zoomResolve = resolve;
      this.targetX = pointX;
      this.targetY = pointY;
    });
  }

  /** Per-frame update */
  update(dt: number): void {
    if (this.zoomAnimating) {
      this.zoomElapsed += dt * 16.67; // dt is in frames (~16.67ms each)
      const t = Math.min(1, this.zoomElapsed / this.zoomDuration);
      this.zoom = this.zoomStart + (this.zoomEnd - this.zoomStart) * t;
      this.targetZoom = this.zoom;

      // Lerp position toward zoom point
      const factor = Math.min(1, this.lerpFactor * 2);
      this.x += (this.zoomPointX - this.x) * factor;
      this.y += (this.zoomPointY - this.y) * factor;
      this.targetX = this.x;
      this.targetY = this.y;

      if (t >= 1) {
        this.zoomAnimating = false;
        this.zoomResolve?.();
        this.zoomResolve = null;
      }
    } else {
      // Smooth lerp
      this.x += (this.targetX - this.x) * this.lerpFactor;
      this.y += (this.targetY - this.y) * this.lerpFactor;
      this.zoom += (this.targetZoom - this.zoom) * this.lerpFactor;
    }

    // Clamp to bounds
    this.clamp();

    // Apply transform to stage
    this.applyTransform();
  }

  private clamp(): void {
    const halfViewW = this.viewW / 2 / this.zoom;
    const halfViewH = this.viewH / 2 / this.zoom;

    const minX = this.boundsX + halfViewW;
    const maxX = this.boundsX + this.boundsW - halfViewW;
    const minY = this.boundsY + halfViewH;
    const maxY = this.boundsY + this.boundsH - halfViewH;

    if (maxX > minX) {
      this.x = Math.max(minX, Math.min(maxX, this.x));
      this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
    } else {
      // Scene fits in viewport, center it
      this.x = this.targetX = this.boundsX + this.boundsW / 2;
    }

    if (maxY > minY) {
      this.y = Math.max(minY, Math.min(maxY, this.y));
      this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
    } else {
      this.y = this.targetY = this.boundsY + this.boundsH / 2;
    }
  }

  private applyTransform(): void {
    this.stage.scale.set(this.zoom);
    this.stage.position.set(
      this.viewW / 2 - this.x * this.zoom,
      this.viewH / 2 - this.y * this.zoom,
    );
  }

  getState(): { x: number; y: number; zoom: number } {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }
}
