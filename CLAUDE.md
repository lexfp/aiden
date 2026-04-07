# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. After making any changes, always remember to update the claude.md file

## Project Overview

A personal game portfolio hosted at **aiden.rivi.us** containing 7+ browser-based games. All games are vanilla JavaScript with no build step. The only server-side component is the Zone Drop multiplayer WebSocket server. Only ever make changes when you are 95% sure that it will work.

## Running the Project

```bash
# Install dependencies (from repo root — installs zone-drop/node_modules)
npm install

# Start the server (serves all games + Zone Drop WebSocket multiplayer)
npm start
# Runs zone-drop/server.js on http://localhost:3000
```

There is no build, lint, or test system. The Dockerfile uses Node.js 20 and runs `npm start` on port 3000.

## Architecture

### Serving Model
`zone-drop/server.js` is a Node.js HTTP + WebSocket server that:
- Serves **all** games as static files from the repo root (not just Zone Drop)
- Runs the Zone Drop multiplayer WebSocket game server on the same port
- Broadcasts player state at 20Hz

### Game Structure
Each game lives in its own top-level directory and is a self-contained HTML/CSS/JS app with no external bundler or framework. Entry point is always an `.html` file.

| Game | Path | Renderer | Key Feature |
|------|------|----------|-------------|
| JJK Fighter (featured) | `JJK-Grind/JJK-grind/jjkgrind.html` | Three.js 3D | Combat RPG with cursed techniques, domain expansion |
| Zone Drop | `zone-drop/ZoneDrop/zone-drop.html` | Three.js 3D | Multiplayer battle royale with building/looting/storm |
| Solo Level | `solo-level/Solo-Level/solo-leveling.html` | Canvas 2D | Dungeon crawler with rank progression |
| JJK Arena | `JJK-arena/JJK-Arena/jjk-fighter.html` | Canvas 2D | 1v1 fighting game |
| Hunters | `hunters/Hunters/hunters.html` | Three.js 3D | JJK-themed FPS with cursed energy combat, domain selection, cursed armory |
| Infinity Corp | `jjk-infinity-corp/infinitycorp/infinitycorp-game.html` | DOM | Idle empire builder (has PWA service worker) |
| Multiplication Game | `MultiplicationGames/MultiplicationGame/multiplication-game.html` | DOM | Educational math game |
| JJK Clicker | `JJK-Clicker/` | DOM | Chrome extension (Manifest V3) |

`index.html` at the repo root is the portfolio landing page linking to all games.

### Common Game Code Patterns
Games follow a consistent file organization:
- `game.js` / `main.js` — game loop using `requestAnimationFrame` with delta-time
- `player.js` — player state and movement
- `enemies.js` — spawning and AI
- `combat.js` — hit detection and damage
- `config.js` — all tuning constants (physics, balance, UI)
- `ui.js` — HUD rendering
- `save.js` — localStorage persistence (JSON serialize/deserialize)

### Tech Stack
- **Frontend**: Vanilla JS (ES6+), Three.js for 3D games, Canvas API for 2D games
- **Backend**: Node.js with `ws` library (only dependency)
- **Storage**: localStorage for saves, in-memory state for multiplayer
- **Deployment**: Docker (Node.js 20, port 3000)

### Zone Drop Multiplayer Protocol
WebSocket message types — Client sends: `join`, `state`, `shoot`, `hit`, `kill`, `respawn`. Server broadcasts: `states`, `shot`, `kill`, `damage`, `playerJoin`, `playerLeave`.

### Three.js Games (JJK-Grind, Zone Drop)
Use exp2 fog for distance culling, PCFSoftShadowMap, ACES filmic tone mapping, pixel ratio capped at 2, and throttled UI updates (every 3 frames in JJK-Grind).
