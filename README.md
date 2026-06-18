# 🚌 BusRush – City Driver Simulator

A premium mobile-first 3D bus driving simulator built with Three.js. Drive a bus, pick up passengers, earn money, and build your career across a living city.

## 🎮 Play

**Live:** [busrush on Vercel](https://bus-rush-3d.vercel.app)

## Features

- 🏙️ Full 3D city with buildings, parks, traffic lights, bus stops
- 🚌 Realistic bus driving (acceleration, braking, steering physics)
- 👥 Passenger pickup & drop-off system
- 💰 Career progression with XP, levels, and earnings
- 🌤️ Dynamic day/night cycle and weather (rain)
- 🚗 AI traffic with collision avoidance
- 📱 Mobile-first touch controls (virtual steering wheel + pedals)
- 📷 4 camera modes: Chase, Driver, Cinematic, Free Orbit
- 💾 Auto-save with localStorage
- ⚙️ Graphics quality settings

## Controls

| Mobile | Action |
|--------|--------|
| Drag steering wheel | Steer |
| GAS button | Accelerate |
| BRAKE button | Brake |
| REV button | Toggle reverse |
| 📷 button | Cycle camera |
| ⏸ button | Pause |
| ☀️ button | Toggle weather |

| Keyboard | Action |
|----------|--------|
| W / ↑ | Accelerate |
| S / ↓ | Brake |
| A / ← | Steer left |
| D / → | Steer right |
| R | Toggle reverse |

## Tech Stack

- **Three.js r158** – 3D rendering via WebGL
- **Vanilla JavaScript (ES Modules)** – no build step
- **HTML5 + CSS3** – glassmorphism UI
- **localStorage** – persistent save system

## Deploy

This is a zero-build static site. Works on GitHub Pages, Vercel, Netlify, or any static host.

```bash
# Vercel
vercel --prod

# Or just drag the folder into Vercel dashboard
```

## License

MIT
