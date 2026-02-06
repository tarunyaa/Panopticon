# Panopticon - Technical Specification

## Project Overview

**Panopticon** is a bird's-eye avatar world where users can supervise AI coworkers in a virtual office environment. Think Habitica meets a virtual company — some characters are AI, but you don't immediately know which ones.

**Current Status:** UI Prototype (Phase 2 Complete)
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS

---

## Architecture

### State Management

Single source of truth via React Context (`WorldState`):

```typescript
interface WorldState {
  scene: SceneType;           // 'login' | 'world' | 'building' | 'room'
  buildingId: string | null;
  roomId: string | null;
  user: User | null;
  camera: CameraState;        // { x, y, zoom: 1 | 1.5 }
  selectedCharacterId: string | null;
  liveFeed: LiveFeedData;
  transition: TransitionState;
}
```

### Event Model

Dispatch-based with typed events:

```typescript
type AppEvent =
  | { type: 'LOGIN'; email: string }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; scene: SceneType; targetId?: string }
  | { type: 'OPEN_CHARACTER_CARD'; characterId: string }
  | { type: 'CLOSE_CHARACTER_CARD' }
  | { type: 'SET_CAMERA'; camera: Partial<CameraState> }
  | { type: 'START_TRANSITION'; ... }
  | { type: 'COMPLETE_TRANSITION' }
```

---

## Scene Hierarchy

```
Login
  ↓
World (6 buildings)
  ↓
Building Interior (room doors)
  ↓
Room (desks + characters)
```

### WorldScene
- 6 SVG buildings with distinct silhouettes
- Curved paths connecting buildings
- Ambient NPCs (some AI with subtle hints)
- Parallax clouds layer

### BuildingScene
- Interior walls with building-type theme
- Room doors showing character counts
- Building icon indicator (no text)

### RoomScene
- Desk layout with characters
- AI coworkers with sparkle/pulse effects
- Status emoji bubbles

---

## Character System

### Deterministic Style Generation

Characters get consistent appearances from their ID:

```typescript
function makeCharacterStyle(characterId: string): CharacterStyle {
  const seed = hashString(characterId);  // DJB2 hash
  const rng = seededRandom(seed);        // LCG generator
  return {
    bodyType: pick(rng, ['round', 'tall', 'bigHead', 'hoodie', 'coat', 'robot']),
    palette: pick(rng, ['warm', 'cool', 'neutral', 'bright']),
    hair: pick(rng, ['short', 'bun', 'curly', 'none']),
    accessory: pick(rng, ['glassesRound', 'glassesSquare', 'headphones', 'beanie', 'cap', 'none']),
    prop: pick(rng, ['coffee', 'book', 'laptop', 'clipboard', 'wrench', 'plant', 'none']),
    aiHint: 'none',
    idleVariant: pick(rng, [0, 1, 2]),
  };
}
```

### Layered Composition

CharacterComposer renders layers:
1. Body SVG (6 types)
2. Hair SVG (4 types)
3. Eyes (with JS-driven blink)
4. Accessory SVG (6 types)
5. Prop SVG (7 types)
6. AI hint effects (sparkle/pulse)
7. Status emoji bubble

### AI Coworker Tells

Subtle visual cues (no labels):
- **Sparkle:** Occasional ✨ particles popping near character
- **Pulse:** Gentle luminance glow animation

---

## Building Types

| ID | Type | SVG Silhouette | Color Theme |
|----|------|----------------|-------------|
| hub-main | hub | House + chimney | Warm orange |
| workshop-1 | workshop | Garage + gear | Cool blue |
| library-1 | library | Dome + books | Purple |
| cafe-1 | cafe | Awning + tables | Coral |
| greenhouse-1 | greenhouse | Glass roof | Green |
| postoffice-1 | postoffice | Box + flag | Teal |

---

## Animation System

### CSS Animations (Tailwind)

```css
animate-idle-bob-0    /* 2.0s, squash/stretch */
animate-idle-bob-1    /* 1.8s variant */
animate-idle-bob-2    /* 2.4s variant */
animate-tree-sway     /* 4s rotation */
animate-cloud-drift   /* 60s horizontal */
animate-sparkle-pop   /* 3s scale/opacity */
animate-pulse-glow    /* 2s brightness */
```

### JS-Driven Blink

```typescript
function useBlink() {
  // Random interval 2-5s
  // Toggle blink state for 150ms
  // Proper cleanup on unmount
}
```

### Animation Budget

Target: < 15 simultaneous animated elements
- 3 clouds
- 3 trees
- 5 characters
- 2 AI sparkles
- 2 window flickers

---

## Parallax System

PanZoomCanvas renders two layers:

```typescript
const PARALLAX = {
  clouds: 0.3,     // Slowest - distant
  sprites: 1.0,    // Main content
};
```

Transform calculation:
```typescript
const getParallaxTransform = (factor: number) => {
  const parallaxX = camera.x * factor;
  const parallaxY = camera.y * factor;
  return `translate(-50%, -50%) translate(${-parallaxX}px, ${-parallaxY}px) scale(${camera.zoom})`;
};
```

---

## Data Model

### Building

```typescript
interface Building {
  id: string;
  type: BuildingType;
  position: Position;
  rooms: Room[];
}
```

### Room

```typescript
interface Room {
  id: string;
  position: Position;
  characters: Character[];
}
```

### Character

```typescript
interface Character {
  id: string;
  name: string;
  isAI: boolean;
  aiHint?: AIHintType;
  status: CharacterStatus;  // 'working' | 'done' | 'waiting' | 'idle'
  position: Position;
}
```

---

## File Structure

```
src/
├── App.tsx                     # Root + scene router
├── main.tsx                    # Entry point
├── index.css                   # Global styles + CSS vars
├── types/index.ts              # TypeScript interfaces
├── state/
│   ├── WorldState.tsx          # Context + reducer
│   └── events.ts               # Event creators
├── data/
│   └── mockData.ts             # Buildings + characters
├── utils/
│   ├── seed.ts                 # Deterministic RNG
│   └── styleGen.ts             # Character style generator
├── hooks/
│   └── useBlink.ts             # JS blink animation
└── components/
    ├── ui/
    │   ├── TopBar.tsx
    │   ├── LiveFeed.tsx
    │   └── AgentCard.tsx
    ├── sprites/
    │   ├── CharacterComposer.tsx   # Layered renderer
    │   ├── BodyTemplates.tsx       # 6 SVG bodies
    │   ├── Accessories.tsx         # Hair/glasses/props
    │   ├── AIHintEffects.tsx       # Sparkle/pulse
    │   ├── StatusEmoji.tsx         # Emoji bubbles
    │   └── (legacy: Character.tsx, Sprite.tsx)
    ├── environment/
    │   ├── buildings/              # 6 building SVGs
    │   ├── RoomDoor.tsx
    │   ├── Desk.tsx
    │   └── Tree.tsx
    ├── canvas/
    │   ├── PanZoomCanvas.tsx       # Camera + parallax
    │   ├── CloudsLayer.tsx         # Ambient clouds
    │   └── TransitionOverlay.tsx
    └── scenes/
        ├── LoginScene.tsx
        ├── WorldScene.tsx
        ├── BuildingScene.tsx
        ├── RoomScene.tsx
        └── (legacy: OrgScene.tsx, PodScene.tsx)
```

---

## Performance Guidelines

1. **DOM-light scenes:** < 50 elements per scene
2. **GPU acceleration:** `will-change: transform` on canvas
3. **Avoid layout thrash:** transforms only, no width/height
4. **JS blink, not CSS:** prevents sync issues
5. **Animation budget:** < 15 simultaneous animations

---

## Color Palette

```css
:root {
  /* Backgrounds */
  --bg-floor: #F5F0E6;
  --bg-floor-warm: #FDF8F0;
  --bg-wall: #E8E2D6;

  /* Accents */
  --accent-blue: #5B9BD5;
  --accent-green: #7BC47F;
  --accent-coral: #FF8C75;
  --accent-purple: #A78BCD;
  --accent-yellow: #FFD966;
  --accent-teal: #5BBDBD;

  /* Text */
  --text-dark: #3D3D3D;
  --text-light: #6B6B6B;
  --highlight: #FFE4B5;
}
```

---

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features
- CSS Grid/Flexbox
- SVG rendering

---

## Future Considerations

- Real agent backend integration
- WebSocket for live updates
- Sprite sheet optimization
- Sound effects
- Mobile touch support
- Accessibility improvements

---

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build
npm run preview  # Preview production build
npx tsc --noEmit # Type check
```
