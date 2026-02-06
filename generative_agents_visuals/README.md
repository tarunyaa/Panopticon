# Generative Agents Visuals (MVP Starter)

This folder contains a minimal Phaser setup using the original repo's village
map and sprite atlas. It is intended as a clean base you can build on.

## How to Run

From `generative_agents_visuals/`, start a static server:

- `python -m http.server 8000`

Then open `http://localhost:8000/public/` in your browser.

## Contents

- `public/index.html` loads Phaser and the scene.
- `public/assets/maps/the_ville_jan7.json` is the Tiled map.
- `public/assets/maps/map_assets/` contains the minimal tilesets referenced by the map.
- `public/assets/sprites/atlas.png` + `atlas.json` are the avatar sprites.
- `src/` contains a minimal Phaser scene (`VillageScene`) and game config.

## Notes

- Tilesets are copied from the original repo so the map renders without edits.
- The sprite atlas uses frame names like `down-walk.000`, `left-walk.001`, etc.
- This is a standalone frontend; no backend or simulation loop is wired here.
