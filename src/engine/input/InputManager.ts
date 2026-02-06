import { Application, FederatedPointerEvent } from 'pixi.js';
import type { Camera } from '../camera/Camera';
import type { GameBridge } from '../GameBridge';

const DRAG_THRESHOLD = 5;

/**
 * Handles pointer and wheel input on the Pixi canvas.
 * Distinguishes drag (pan) from click.
 */
export class InputManager {
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private hasDragged = false;

  constructor(
    private app: Application,
    private camera: Camera,
    private bridge: GameBridge,
  ) {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;

    stage.on('pointerdown', this.onPointerDown);
    stage.on('pointermove', this.onPointerMove);
    stage.on('pointerup', this.onPointerUp);
    stage.on('pointerupoutside', this.onPointerUp);

    // Wheel zoom on the canvas element
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onPointerDown = (e: FederatedPointerEvent): void => {
    this.dragging = true;
    this.hasDragged = false;
    this.dragStartX = e.globalX;
    this.dragStartY = e.globalY;
  };

  private onPointerMove = (e: FederatedPointerEvent): void => {
    if (!this.dragging) return;

    const dx = e.globalX - this.dragStartX;
    const dy = e.globalY - this.dragStartY;

    if (!this.hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      this.hasDragged = true;
    }

    if (this.hasDragged) {
      this.camera.move(
        e.globalX - this.dragStartX,
        e.globalY - this.dragStartY,
      );
      this.dragStartX = e.globalX;
      this.dragStartY = e.globalY;
    }
  };

  private onPointerUp = (e: FederatedPointerEvent): void => {
    if (!this.hasDragged && this.dragging) {
      // Click on background -> player teleport
      const worldX = (e.globalX - this.app.stage.position.x) / this.app.stage.scale.x;
      const worldY = (e.globalY - this.app.stage.position.y) / this.app.stage.scale.y;
      this.bridge.emit('playerMoved', { x: worldX, y: worldY });
    }
    this.dragging = false;
    this.hasDragged = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    this.camera.adjustZoom(e.deltaY, pointerX, pointerY);
  };

  destroy(): void {
    const stage = this.app.stage;
    stage.off('pointerdown', this.onPointerDown);
    stage.off('pointermove', this.onPointerMove);
    stage.off('pointerup', this.onPointerUp);
    stage.off('pointerupoutside', this.onPointerUp);
    this.app.canvas.removeEventListener('wheel', this.onWheel);
  }
}
