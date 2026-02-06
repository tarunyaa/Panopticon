import { Application, Container } from 'pixi.js';
import { Camera } from './camera/Camera';
import { InputManager } from './input/InputManager';
import type { GameBridge } from './GameBridge';
import type { BaseScene } from './scenes/BaseScene';
import type { SceneType, FocusPoint, WorldState } from '../types';
import { WorldPixiScene } from './scenes/WorldPixiScene';
import { InteriorPixiScene } from './scenes/InteriorPixiScene';
import { loadAssets } from './assets/AssetManifest';

/**
 * Owns the Pixi Application, ticker loop, and scene orchestration.
 */
export class WorldRenderer {
  private app!: Application;
  private camera!: Camera;
  private input!: InputManager;
  private currentScene: BaseScene | null = null;
  private sceneContainer = new Container();
  private lastState: WorldState | null = null;
  private initialized = false;

  constructor(private bridge: GameBridge) {}

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: container,
      background: 0xE8DCC8,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(this.app.canvas);
    this.app.canvas.style.imageRendering = 'pixelated';

    // Create camera targeting the scene container
    this.camera = new Camera(this.sceneContainer);
    this.camera.setViewport(this.app.screen.width, this.app.screen.height);

    // Add scene container to stage
    this.app.stage.addChild(this.sceneContainer);

    // Input
    this.input = new InputManager(this.app, this.camera, this.bridge);

    // Load assets
    await loadAssets();

    // Listen to bridge commands
    this.bridge.on('navigate', (data) => {
      this.onNavigate(data.scene, data.targetId, data.focusPoint);
    });

    // Ticker update
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      this.camera.setViewport(this.app.screen.width, this.app.screen.height);
    });
    resizeObserver.observe(container);

    this.initialized = true;
  }

  private update(dt: number): void {
    this.camera.update(dt);
    this.currentScene?.update(dt);
  }

  async onNavigate(scene: SceneType, targetId?: string, focusPoint?: FocusPoint): Promise<void> {
    if (scene === 'login') {
      if (this.currentScene) {
        this.currentScene.teardown();
        this.sceneContainer.removeChildren();
        this.currentScene = null;
      }
      return;
    }

    // Zoom toward focus point if provided
    if (focusPoint && this.currentScene) {
      await this.camera.zoomTo(focusPoint.x, focusPoint.y, 1.5, 150);
    }

    // Request fade out
    this.bridge.emit('requestFade', { direction: 'out' });
    await this.delay(120);

    // Switch scene
    await this.switchScene(scene, targetId);

    // Request fade in
    this.bridge.emit('requestFade', { direction: 'in' });
  }

  private async switchScene(sceneType: SceneType, targetId?: string): Promise<void> {
    if (this.currentScene) {
      this.currentScene.teardown();
      this.sceneContainer.removeChildren();
    }

    let newScene: BaseScene;

    switch (sceneType) {
      case 'world':
        newScene = new WorldPixiScene(this.bridge);
        break;
      case 'building':
      case 'org':
        newScene = new InteriorPixiScene(this.bridge, 'building', targetId ?? null);
        break;
      case 'room':
      case 'pod':
        newScene = new InteriorPixiScene(this.bridge, 'room', targetId ?? null);
        break;
      default:
        return;
    }

    await newScene.setup();
    this.sceneContainer.addChild(newScene.container);
    this.currentScene = newScene;

    const size = newScene.getSceneSize();
    this.camera.setBounds(0, 0, size.width, size.height);
    this.camera.snapTo(size.width / 2, size.height / 2, 1);

    if (this.lastState) {
      newScene.syncState(this.lastState);
    }
  }

  syncState(state: WorldState): void {
    this.lastState = state;
    this.currentScene?.syncState(state);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  destroy(): void {
    this.input?.destroy();
    this.currentScene?.teardown();
    this.app?.destroy(true, { children: true, texture: true });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }
}
