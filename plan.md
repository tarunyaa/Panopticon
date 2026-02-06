# Panopticon - Implementation Plan

## Overview
A bird's-eye avatar world (Habitica/Fantage/Poptropica vibes) where some characters are AI coworkers — but you don't immediately know which ones. UI prototype only—no real agents or backend.

## Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + CSS animations
- **State**: React Context (`WorldState`)
- **Rendering**: HTML/CSS transforms on a single pan/zoom container with parallax

---

# Phase 1 - Core Foundation ✅ COMPLETE

## Visual Style (Phase 1)
- Pastel corporate palette: soft grays, muted blues, soft greens, cream
- Pixel art aesthetic using CSS `image-rendering: pixelated`
- Bird's-eye view with depth hints
- Minimal animated sprites on mostly-static backgrounds

## Scene Flow (Phase 1)
```
Login → World → Org → Pod
```

## Status: COMPLETE ✓
All Phase 1 files created and build passes.

---

# Phase 2 - Unified World Design ✅ COMPLETE

## Core Design Principles

1. **One unified world** — no explicit "enterprise" vs "consumer" split
2. **No text labels** on map — buildings identified by silhouette + iconography
3. **Smooth cartoon style** — rounded shapes, soft shadows, thicker outlines, NOT blocky pixels
4. **Bird's-eye view everywhere** — no perspective shifts
5. **Characters feel collectible** — distinct silhouettes + accessories, not just recolors
6. **AI coworkers blend in** — subtle cues (sparkle, pulse), no explicit labels

## Visual Style (Phase 2)

### Colors
- **More saturated** pastel + accent palette (less corporate gray)
- Warm, inviting tones for buildings
- Character palettes: warm / cool / neutral / bright

### Rendering
- **SVG-based buildings** (crisp at any zoom)
- **Layered character sprites** (body + hair + accessory + prop)
- Soft drop shadows, rounded corners, 2px outlines
- NO `image-rendering: pixelated`

## Scene Flow (Phase 2)

```
Login → World → Building Interior → Room/Desk Area
```

- Removed "org/pod" language entirely
- Use visual cues: door highlights, path lighting, hover rings
- Minimal UI: small icon bar (home/back/settings)

---

## Character System

### A) Layered Composition

Each character = **body + head/hair + accessory + prop**

```
┌─────────────────┐
│   [hat layer]   │
│   [hair layer]  │
│   [face layer]  │  ← glasses, freckles
│   [body layer]  │  ← base template
│   [prop layer]  │  ← held item
└─────────────────┘
```

### B) Body Templates (6 types)

| Type | Description |
|------|-------------|
| `round` | Compact, friendly |
| `tall` | Elongated, elegant |
| `bigHead` | Chibi-style cute |
| `hoodie` | Casual, cozy |
| `coat` | Professional |
| `robot` | Subtle mechanical hints |

### C) Accessory Library

**Hats:** beanie, cap, none
**Face:** glassesRound, glassesSquare, headphones, none
**Hair:** short, bun, curly, none
**Props:** coffee, book, laptop, clipboard, wrench, plant, none

### D) CharacterStyle Type

```typescript
interface CharacterStyle {
  bodyType: 'round' | 'tall' | 'bigHead' | 'hoodie' | 'coat' | 'robot';
  palette: 'warm' | 'cool' | 'neutral' | 'bright';
  hair: 'short' | 'bun' | 'curly' | 'none';
  accessory: 'glassesRound' | 'glassesSquare' | 'headphones' | 'beanie' | 'cap' | 'none';
  prop: 'coffee' | 'book' | 'laptop' | 'clipboard' | 'wrench' | 'plant' | 'none';
  aiHint: 'none' | 'sparkle' | 'pulse';
  idleVariant: 0 | 1 | 2;
}
```

### E) Deterministic Style Generation

```typescript
function makeCharacterStyle(characterId: string): CharacterStyle {
  const seed = hashString(characterId);
  const rng = seededRandom(seed);
  // Same ID always produces the same style
  return { bodyType, palette, hair, accessory, prop, aiHint, idleVariant };
}
```

---

## World Layout (6 Unlabeled Buildings)

| Building | Silhouette | Icon Cue | Interior |
|----------|------------|----------|----------|
| Cozy Hub | House with chimney | Warm glow in windows | Main lobby |
| Workshop | Garage with tools | Wrench/gear shape | Team workspace |
| Library | Tall with dome | Book stack silhouette | Archive/docs |
| Café | Awning + tables | Coffee cup steam | Social space |
| Greenhouse | Glass roof | Leaf shapes | Creative space |
| Post Office | Box shape + flag | Envelope icon | Messages |

### Building Interactions
- Hover: subtle glow ring + tiny bounce (2px)
- Click: zoom smoothly into building → fade → interior scene
- No text labels — visual identity only

---

## AI Coworker Subtle Tells

AI characters blend in but have discoverable cues:

1. **Sparkle particle** — occasional pop near character
2. **Pulse glow** — subtle idle luminance
3. **Floating icon** — brief ✨/⚡/🧠 that fades quickly

**No explicit labels** — users discover who's AI through observation.

---

## Status Indicators (No Text)

Emoji-only status bubbles:

| Status | Emoji | Meaning |
|--------|-------|---------|
| working | 💬 | Active/busy |
| done | ✅ | Completed |
| waiting | ⏳ | Pending |
| idle | 💤 | Resting |

---

## Animation Budget (< 15 moving elements)

| Element | Count | Animation |
|---------|-------|-----------|
| Clouds | 3 | CSS drift |
| Trees swaying | 3 | CSS rotate |
| Characters bobbing | 5 | CSS transform (varied) |
| AI sparkles | 2 | CSS pop |
| Window flicker | 2 | CSS opacity |
| **Total** | **15** | |

---

## Files Created/Modified in Phase 2

### New Files
```
src/
  utils/
    seed.ts                      # Deterministic RNG
    styleGen.ts                  # makeCharacterStyle(characterId)

  components/
    sprites/
      CharacterComposer.tsx      # Layered character renderer
      BodyTemplates.tsx          # 6 SVG body shapes
      Accessories.tsx            # SVG overlays (hats, glasses, props)
      AIHintEffects.tsx          # Sparkle/pulse effects
      StatusEmoji.tsx            # Emoji-only status bubble

    environment/
      buildings/
        index.tsx                # Building exports + lookup
        CozyHub.tsx              # House building SVG
        Workshop.tsx             # Garage building SVG
        Library.tsx              # Library building SVG
        Cafe.tsx                 # Café building SVG
        Greenhouse.tsx           # Greenhouse building SVG
        PostOffice.tsx           # Post office building SVG
      RoomDoor.tsx               # Room entrance (no text)

    canvas/
      CloudsLayer.tsx            # Ambient drifting clouds

    scenes/
      BuildingScene.tsx          # Interior view (renamed from OrgScene)
      RoomScene.tsx              # Desk area (renamed from PodScene)
```

### Modified Files
```
tailwind.config.js               # New animations, colors
src/index.css                    # Remove pixelation, add soft styles
src/types/index.ts               # CharacterStyle, Building types
src/data/mockData.ts             # 12 characters across 6 buildings
src/state/WorldState.tsx         # buildingId/roomId, legacy aliases
src/state/events.ts              # Character card events
src/components/canvas/PanZoomCanvas.tsx  # Parallax layers + clouds
src/components/scenes/WorldScene.tsx     # New SVG buildings
src/App.tsx                      # New scene routing
```

---

## Verification (Phase 2)

1. `npm run dev` — no errors ✅
2. World shows 6 distinct building silhouettes (no text labels) ✅
3. Hover on building → glow ring + bounce ✅
4. Click building → smooth zoom + fade → interior ✅
5. Characters have varied silhouettes (not just recolors) ✅
6. AI characters have subtle sparkle/pulse (not obvious) ✅
7. Status shown as emoji only (💬/✅/⏳/💤) ✅
8. No pixelated edges anywhere ✅
9. Ambient motion: clouds drift, trees sway ✅
10. Smooth 60fps on pan/zoom ✅

---

## Key Principles Maintained

- ✅ Single camera state (x, y, zoom)
- ✅ DOM-light scenes
- ✅ Sprite wrapper for future swaps
- ✅ Transition helper (transitionTo)
- ✅ UI-only, mock data
- ✅ Hackathon-simple scope
- ✅ Legacy backwards compatibility (org/pod aliases)

---

## To Run
```bash
cd panopticon
npm install
npm run dev    # Development server at localhost:5173
npm run build  # Production build
```

---

## Status: PHASE 2 COMPLETE ✓

All Phase 2 features implemented:
- 6 SVG building types with distinct silhouettes
- Layered character system with 6 body types + accessories
- Deterministic character appearance from ID
- AI coworker subtle tells (sparkle/pulse)
- Emoji-only status indicators
- Parallax clouds layer
- Smooth cartoon style (no pixelation)
