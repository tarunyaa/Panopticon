import { Container } from 'pixi.js';
import type { WorldState } from '../../types';
import type { GameBridge } from '../GameBridge';

/**
 * Abstract base for all Pixi scenes.
 */
export abstract class BaseScene {
  readonly container = new Container();

  constructor(protected bridge: GameBridge) {}

  /** Create layers, place sprites */
  abstract setup(): Promise<void>;

  /** Per-frame animation (dt in ticker delta units) */
  abstract update(dt: number): void;

  /** Receive WorldState updates from React */
  abstract syncState(state: WorldState): void;

  /** Clean up on scene switch */
  teardown(): void {
    this.container.destroy({ children: true });
  }

  /** Logical scene size for camera bounds */
  abstract getSceneSize(): { width: number; height: number };
}
