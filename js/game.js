import * as THREE from 'three';

/* ============================================================
   CONSTANTS
   ============================================================ */
const CITY_GRID = 5;
const BLOCK_SIZE = 70;
const ROAD_WIDTH = 22;
const CELL_SIZE = BLOCK_SIZE + ROAD_WIDTH;
const CITY_HALF = (CITY_GRID * CELL_SIZE) / 2;

const BUS_STOPS = [
  { id: 0, name: 'City Hall',    pos: new THREE.Vector3(0,             0, -(CITY_HALF - 25)) },
  { id: 1, name: 'Central Park', pos: new THREE.Vector3( CITY_HALF - 25, 0,  0) },
  { id: 2, name: 'Market Square',pos: new THREE.Vector3(0,             0,  CITY_HALF - 25) },
  { id: 3, name: 'Tech District',pos: new THREE.Vector3(-(CITY_HALF-25),0,  0) },
  { id: 4, name: 'Harbor View',  pos: new THREE.Vector3( CITY_HALF*0.5, 0,  CITY_HALF*0.5) },
];

/* ============================================================
   SAVE SYSTEM
   ============================================================ */
class SaveSystem {
  constructor() {
    this.KEY = 'busrush_v2';
    this.data = this._load();
  }
  _load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { money: 500, xp: 0, level: 1, totalPassengers: 0, settings: { quality: 'medium', sound: true, music: true, sensitivity: 1 } };
  }
  save(patch) {
    Object.assign(this.data, patch);
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (_) {}
  }
}

/* ============================================================
   CAREER SYSTEM
   ============================================================ */
class CareerSystem {
  constructor(save) {
    this.save = save;
    this.money = save.data.money;
    this.xp    = save.data.xp;
    this.level = save.data.level;
    this.totalPassengers = save.data.totalPassengers;
    this.sessionEarnings = 0;
    this.sessionPassengers = 0;
  }
  xpNeeded(level) { return level * 500; }
  deliver(count) {
    const fare = 60 * count;
    const xpGain = 40 * count;
    this.money += fare;
    this.xp    += xpGain;
    this.totalPassengers += count;
    this.sessionEarnings += fare;
    this.sessionPassengers += count;
    // Level up
    while (this.xp >= this.xpNeeded(this.level)) {
      this.xp -= this.xpNeeded(this.level);
      this.level++;
    }
    this.save.save({ money: this.money, xp: this.xp, level: this.level, totalPassengers: this.totalPassengers });
    return { fare, xpGain };
  }
}

/* ============================================================
   WORLD
   ============================================================ */
class World {
  constructor(scene) {
    this.scene = scene;
    this.streetLamps  = [];
    this.trafficLights= [];
    this._build();
  }
  _build() {
    this._ground();
    this._roads();
    this._blocks();
    this._busStops();
    this._lamps();
    this._trafficLights();
    this._sky();
  }

  _ground() {
    const size = CITY_HALF * 2 + 200;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a5218 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    this.scene.add(m);
  }

  _roads() {
    const roadMat  = new THREE.MeshLambertMaterial({ color: 0x383838 });
    const dashMat  = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const sideMat  = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
    const extent   = CITY_HALF * 2 + ROAD_WIDTH;

    for (let i = 0; i <= CITY_GRID; i++) {
      const pos = -CITY_HALF + i * CELL_SIZE;

      // Horizontal road
      const hr = new THREE.Mesh(new THREE.PlaneGeometry(extent, ROAD_WIDTH), roadMat);
      hr.rotation.x = -Math.PI / 2;
      hr.position.set(0, 0.02, pos);
      hr.receiveShadow = true;
      this.scene.add(hr);

      // Vertical road
      const vr = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, extent), roadMat);
      vr.rotation.x = -Math.PI / 2;
      vr.position.set(pos, 0.02, 0);
      vr.receiveShadow = true;
      this.scene.add(vr);

      // Centre dashes horizontal
      for (let j = -2; j <= 2; j++) {
        const dashH = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.6), dashMat);
        dashH.rotation.x = -Math.PI / 2;
        dashH.position.set(j * CELL_SIZE, 0.04, pos);
        this.scene.add(dashH);
      }
      // Centre dashes vertical
      for (let j = -2; j <= 2; j++) {
        const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 14), dashMat);
        dashV.rotation.x = -Math.PI / 2;
        dashV.position.set(pos, 0.04, j * CELL_SIZE);
        this.scene.add(dashV);
      }

      // Kerb strips
      [-ROAD_WIDTH / 2 - 0.3, ROAD_WIDTH / 2 + 0.3].forEach(offset => {
        const k = new THREE.Mesh(new THREE.PlaneGeometry(extent, 0.6), sideMat);
        k.rotation.x = -Math.PI / 2;
        k.position.set(0, 0.03, pos + offset);
        this.scene.add(k);
        const k2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, extent), sideMat);
        k2.rotation.x = -Math.PI / 2;
        k2.position.set(pos + offset, 0.03, 0);
        this.scene.add(k2);
      });
    }
  }

  _blocks() {
    const palette = [0x8B6914, 0x5b6977, 0x2e3f56, 0x92400e, 0x1E3A5F, 0x4B2D6B, 0x1a3d2b, 0x4a2222];
    const winMat  = new THREE.MeshBasicMaterial({ color: 0xaadeff, transparent: true, opacity: 0.75 });

    for (let bx = 0; bx < CITY_GRID; bx++) {
      for (let bz = 0; bz < CITY_GRID; bz++) {
        const cx = -CITY_HALF + ROAD_WIDTH / 2 + bx * CELL_SIZE + BLOCK_SIZE / 2;
        const cz = -CITY_HALF + ROAD_WIDTH / 2 + bz * CELL_SIZE + BLOCK_SIZE / 2;

        const midX = Math.floor(CITY_GRID / 2);
        const midZ = Math.floor(CITY_GRID / 2);
        if (Math.abs(bx - midX) <= 1 && Math.abs(bz - midZ) <= 1) {
          this._park(cx, cz);
          continue;
        }

        const n = 2 + Math.floor(Math.random() * 3);
        const placed = [];
        for (let i = 0; i < n; i++) {
          let px, pz, tries = 0;
          do {
            px = (Math.random() - 0.5) * (BLOCK_SIZE - 20);
            pz = (Math.random() - 0.5) * (BLOCK_SIZE - 20);
            tries++;
          } while (tries < 40 && placed.some(p => Math.abs(p[0]-px)<14 && Math.abs(p[1]-pz)<14));
          placed.push([px, pz]);

          const h  = 18 + Math.random() * 65;
          const bw = 10 + Math.random() * 16;
          const bd = 10 + Math.random() * 16;
          const col = palette[Math.floor(Math.random() * palette.length)];

          const body = new THREE.Mesh(
            new THREE.BoxGeometry(bw, h, bd),
            new THREE.MeshLambertMaterial({ color: col })
          );
          body.position.set(cx + px, h / 2, cz + pz);
          body.castShadow = true;
          body.receiveShadow = true;
          this.scene.add(body);

          // Windows (both long faces)
          const floors = Math.floor(h / 5);
          for (let f = 1; f < floors; f++) {
            const wy = f * 5 - h / 2 + 1.5;
            [-bd / 2 - 0.05, bd / 2 + 0.05].forEach((wz, s) => {
              const wn = Math.floor(bw / 4);
              for (let w = 0; w < wn; w++) {
                if (Math.random() < 0.65) {
                  const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), winMat.clone());
                  win.position.set(cx + px - bw / 2 + 2 + w * 4, h / 2 + wy, cz + pz + wz);
                  if (s === 0) win.rotation.y = Math.PI;
                  this.scene.add(win);
                }
              }
            });
          }
        }

        // Trees at block edges
        [[BLOCK_SIZE/2-3, BLOCK_SIZE/2-3], [-BLOCK_SIZE/2+3, BLOCK_SIZE/2-3],
         [BLOCK_SIZE/2-3,-BLOCK_SIZE/2+3], [-BLOCK_SIZE/2+3,-BLOCK_SIZE/2+3]].forEach(([dx,dz]) => {
          if (Math.random() > 0.4) this._tree(cx+dx, cz+dz);
        });
      }
    }
  }

  _park(cx, cz) {
    const gs = BLOCK_SIZE - 4;
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(gs, gs),
      new THREE.MeshLambertMaterial({ color: 0x3a8a2a }));
    gr.rotation.x = -Math.PI / 2;
    gr.position.set(cx, 0.03, cz);
    this.scene.add(gr);
    // Fountain
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 1.5, 16),
      new THREE.MeshLambertMaterial({ color: 0x8899aa }));
    fb.position.set(cx, 0.75, cz);
    this.scene.add(fb);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x4488cc }));
    fw.position.set(cx, 1.6, cz);
    this.scene.add(fw);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this._tree(cx + Math.cos(a) * 18, cz + Math.sin(a) * 18);
    }
  }

  _tree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 6),
      new THREE.MeshLambertMaterial({ color: 0x5c3811 }));
    trunk.position.set(x, 2, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(2.8 + Math.random(), 7, 7),
      new THREE.MeshLambertMaterial({ color: 0x228b22 }));
    foliage.position.set(x, 7, z);
    foliage.castShadow = true;
    this.scene.add(foliage);
  }

  _busStops() {
    const poleMat   = new THREE.MeshLambertMaterial({ color: 0xddaa00 });
    const signMat   = new THREE.MeshLambertMaterial({ color: 0x1155cc });
    const shelterMat= new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.5 });
    const platMat   = new THREE.MeshLambertMaterial({ color: 0xcccccc });

    BUS_STOPS.forEach(stop => {
      const g = new THREE.Group();
      // Pole
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), poleMat);
      pole.position.y = 3.5;
      g.add(pole);
      // Sign
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.4, 0.2), signMat);
      sign.position.set(0, 7.4, 0);
      g.add(sign);
      // Platform
      const plat = new THREE.Mesh(new THREE.BoxGeometry(9, 0.35, 3), platMat);
      plat.position.set(3.5, 0.18, 0);
      g.add(plat);
      // Shelter
      const shelt = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 3), shelterMat);
      shelt.position.set(3.5, 3, 0);
      g.add(shelt);
      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.3, 3.5),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      roof.position.set(3.5, 5.3, 0);
      g.add(roof);

      g.position.copy(stop.pos);
      this.scene.add(g);
    });
  }

  _lamps() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    for (let i = 0; i <= CITY_GRID; i++) {
      for (let j = 0; j <= CITY_GRID; j++) {
        const x = -CITY_HALF + i * CELL_SIZE + ROAD_WIDTH * 0.3;
        const z = -CITY_HALF + j * CELL_SIZE + ROAD_WIDTH * 0.3;
        const lamp = this._makeLamp(x, z, mat);
        this.streetLamps.push(lamp);
      }
    }
  }

  _makeLamp(x, z, mat) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9, 6), mat);
    pole.position.y = 4.5;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 0.18), mat);
    arm.position.set(1.25, 9.1, 0);
    g.add(arm);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffaa }));
    globe.position.set(2.5, 9.1, 0);
    g.add(globe);
    const light = new THREE.PointLight(0xffee88, 0, 24);
    light.position.set(2.5, 9.1, 0);
    g.add(light);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return { g, light };
  }

  _trafficLights() {
    for (let i = 1; i < CITY_GRID; i++) {
      for (let j = 1; j < CITY_GRID; j++) {
        const wx = -CITY_HALF + i * CELL_SIZE;
        const wz = -CITY_HALF + j * CELL_SIZE;
        const phase = Math.random() * Math.PI * 4;
        const group = this._makeTL(wx + ROAD_WIDTH * 0.6, wz + ROAD_WIDTH * 0.6);
        this.trafficLights.push({ group, wx, wz, phase, green: phase < Math.PI * 2 });
      }
    }
  }

  _makeTL(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.y = 4;
    g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    box.position.y = 8.5;
    g.add(box);
    const redM  = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const greenM= new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    const redL  = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), redM);
    redL.position.set(0, 9.2, 0.28);
    g.add(redL);
    const greenL= new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), greenM);
    greenL.position.set(0, 8.2, 0.28);
    g.add(greenL);
    g.position.set(x, 0, z);
    this.scene.add(g);
    return g;
  }

  _sky() {
    const geo = new THREE.SphereGeometry(480, 16, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
    this.skyMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyMesh);
  }

  update(dayTime, isNight) {
    this.streetLamps.forEach(l => { l.light.intensity = isNight ? 1.8 : 0; });
    this.trafficLights.forEach(tl => {
      tl.phase += 0.016;
      tl.green = (tl.phase % (Math.PI * 4)) < Math.PI * 2;
      const children = tl.group.children;
      // children[2]=red, children[3]=green sphere
      if (children[2] && children[3]) {
        children[2].material.color.setHex(tl.green ? 0x551111 : 0xff2222);
        children[3].material.color.setHex(tl.green ? 0x22ff44 : 0x115511);
      }
    });
    const SKY_DAY    = new THREE.Color(0x87ceeb);
    const SKY_DUSK   = new THREE.Color(0xff7733);
    const SKY_NIGHT  = new THREE.Color(0x080820);
    if (isNight) this.skyMesh.material.color.lerp(SKY_NIGHT, 0.03);
    else if (dayTime < 0.28 || dayTime > 0.72) this.skyMesh.material.color.lerp(SKY_DUSK, 0.03);
    else this.skyMesh.material.color.lerp(SKY_DAY, 0.03);
  }

  isGreen(pos) {
    for (const tl of this.trafficLights) {
      const dx = Math.abs(tl.wx - pos.x), dz = Math.abs(tl.wz - pos.z);
      if (dx < ROAD_WIDTH && dz < ROAD_WIDTH) return tl.green;
    }
    return true;
  }
}

/* ============================================================
   BUS
   ============================================================ */
class Bus {
  constructor(scene) {
    this.scene    = scene;
    this.group    = new THREE.Group();
    this.vel      = 0;
    this.angVel   = 0;
    this.dist     = 0;
    this._lastPos = new THREE.Vector3();
    this._build();
    this.group.position.set(0, 0, -(CITY_HALF - 35));
    this._lastPos.copy(this.group.position);
    scene.add(this.group);
  }

  _build() {
    const BODY   = new THREE.MeshLambertMaterial({ color: 0xff6600 });
    const WHITE  = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const WIN    = new THREE.MeshLambertMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.7 });
    const DARK   = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const CHROME = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const HEAD   = new THREE.MeshBasicMaterial({ color: 0xffffee });
    const TAIL   = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.5, 17), BODY);
    body.position.y = 2.3; body.castShadow = true; body.receiveShadow = true;
    this.group.add(body);

    // White stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(7.22, 0.6, 17.02), WHITE);
    stripe.position.y = 3.3;
    this.group.add(stripe);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.45, 16.5), WHITE);
    roof.position.y = 4.25;
    this.group.add(roof);

    // Front windshield
    const fw = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 0.1), WIN);
    fw.position.set(0, 3.1, -8.55);
    this.group.add(fw);

    // Side windows L
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2), WIN);
      w.position.set(-3.65, 3.1, -5.5 + i * 2.6);
      this.group.add(w);
    }
    // Side windows R
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2), WIN);
      w.position.set(3.65, 3.1, -5.5 + i * 2.6);
      this.group.add(w);
    }

    // Rear window
    const rw = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 0.1), WIN);
    rw.position.set(0, 3.1, 8.55);
    this.group.add(rw);

    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 2.6), WIN);
    door.position.set(-3.66, 1.5, -4.5);
    this.group.add(door);

    // Bumpers
    const fb = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.9, 0.55), CHROME);
    fb.position.set(0, 1, -8.8);
    this.group.add(fb);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.9, 0.55), CHROME);
    rb.position.set(0, 1, 8.8);
    this.group.add(rb);

    // Front grille
    const gr = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.15), DARK);
    gr.position.set(0, 1.5, -8.7);
    this.group.add(gr);

    // Headlights
    [-2.2, 2.2].forEach(x => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.1), HEAD);
      hl.position.set(x, 2.3, -8.7);
      this.group.add(hl);
    });
    // Taillights
    [-2.2, 2.2].forEach(x => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.1), TAIL);
      tl.position.set(x, 2.3, 8.7);
      this.group.add(tl);
    });

    // Destination sign
    const ds = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.85, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
    ds.position.set(0, 4.2, -8.7);
    this.group.add(ds);

    // Undercarriage
    const under = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 16.5), DARK);
    under.position.y = 0.4;
    this.group.add(under);

    // Wheels
    this.wheels = [];
    [[-3.4, 0.85, -5.5], [3.4, 0.85, -5.5],
     [-3.4, 0.85, 5.5],  [3.4, 0.85, 5.5]].forEach(([wx,wy,wz]) => {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.95, 16), DARK);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.set(wx, wy, wz);
      const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 8), CHROME);
      hubcap.rotation.z = Math.PI / 2;
      hubcap.position.set(wx < 0 ? wx - 0.5 : wx + 0.5, wy, wz);
      this.group.add(tyre);
      this.group.add(hubcap);
      this.wheels.push(tyre);
    });

    // Exhaust pipe
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8), CHROME);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(3.2, 0.55, 8.5);
    this.group.add(ex);
  }

  update(dt, throttle, brake, steer, reverse) {
    const MAX_SPEED = reverse ? 8 : 26;
    const ACCEL     = 9;
    const BRAKE_F   = 16;
    const DRAG      = 0.975;
    const dir       = reverse ? -1 : 1;

    if (throttle) this.vel += dir * ACCEL * dt;
    else          this.vel *= DRAG;

    if (brake) {
      const b = BRAKE_F * dt;
      if (Math.abs(this.vel) < b) this.vel = 0;
      else this.vel -= Math.sign(this.vel) * b;
    }

    this.vel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, this.vel));

    // Steering — tighter at low speed
    const steerFactor = Math.min(Math.abs(this.vel) / 8, 1) * 0.042;
    if (Math.abs(this.vel) > 0.1) {
      const steerDir = this.vel > 0 ? 1 : -1;
      this.angVel = -steer * steerFactor * steerDir;
    } else {
      this.angVel *= 0.85;
    }

    this.group.rotation.y += this.angVel;

    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.group.quaternion);
    const prev = this.group.position.clone();
    this.group.position.addScaledVector(fwd, this.vel * dt);
    this.group.position.y = 0;

    // World bounds
    const BOUND = CITY_HALF + 8;
    this.group.position.x = Math.max(-BOUND, Math.min(BOUND, this.group.position.x));
    this.group.position.z = Math.max(-BOUND, Math.min(BOUND, this.group.position.z));

    this.dist += this.group.position.distanceTo(prev);

    // Wheel spin
    const spin = this.vel * dt * 0.65;
    this.wheels.forEach(w => { w.rotation.x += spin; });
  }

  get pos()   { return this.group.position; }
  get fwd()   { return new THREE.Vector3(0,0,-1).applyQuaternion(this.group.quaternion); }
  get speed() { return Math.abs(this.vel) * 3.6; }
}

/* ============================================================
   TRAFFIC
   ============================================================ */
class TrafficSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars  = [];
    this._init();
  }

  _init() {
    const COLORS = [0xcc0000, 0x0044cc, 0x009900, 0xcc6600, 0x660099, 0x00aaaa, 0xcccc00, 0x888888];
    for (let i = 0; i < 14; i++) {
      const c = this._makeCar(COLORS[i % COLORS.length]);
      c.group.position.copy(this._randomRoadPos());
      c.group.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      this.cars.push(c);
    }
  }

  _randomRoadPos() {
    const isH  = Math.random() > 0.5;
    const ri   = Math.floor(Math.random() * (CITY_GRID + 1));
    const rp   = -CITY_HALF + ri * CELL_SIZE;
    const off  = (Math.random() - 0.5) * CITY_GRID * CELL_SIZE;
    return isH ? new THREE.Vector3(off, 0, rp) : new THREE.Vector3(rp, 0, off);
  }

  _makeCar(color) {
    const g    = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5),
      new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.9; body.castShadow = true;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 2.6),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.75) }));
    roof.position.set(0, 1.95, -0.4);
    g.add(roof);
    const wMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[-1.1,0.45,-1.5],[1.1,0.45,-1.5],[-1.1,0.45,1.5],[1.1,0.45,1.5]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.35,12), wMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x,y,z);
      g.add(w);
    });
    const hlM = new THREE.MeshBasicMaterial({ color: 0xffffee });
    [-0.65,0.65].forEach(x => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.25,0.1), hlM);
      hl.position.set(x, 0.9, -2.3);
      g.add(hl);
    });
    this.scene.add(g);
    const speed = 5 + Math.random() * 6;
    return { group: g, speed, maxSpeed: speed, stuck: 0, last: new THREE.Vector3() };
  }

  update(dt, busPos) {
    this.cars.forEach(car => {
      const moved = car.group.position.distanceTo(car.last);
      car.stuck = moved < 0.02 ? car.stuck + dt : 0;
      car.last.copy(car.group.position);

      if (car.stuck > 4) {
        car.group.position.copy(this._randomRoadPos());
        car.group.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
        car.stuck = 0;
        return;
      }

      const nearBus = car.group.position.distanceTo(busPos) < 14;
      const redLight= !this.world.isGreen(car.group.position);

      if (nearBus || redLight) car.speed = Math.max(0, car.speed - 12 * dt);
      else                     car.speed = Math.min(car.maxSpeed, car.speed + 6 * dt);

      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(car.group.quaternion);
      car.group.position.addScaledVector(fwd, car.speed * dt);
      car.group.position.y = 0;
      car.group.rotation.y += (Math.random() - 0.5) * 0.002;

      const B = CITY_HALF - 10;
      const p = car.group.position;
      if (Math.abs(p.x) > B || Math.abs(p.z) > B) {
        car.group.position.copy(this._randomRoadPos());
        car.group.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      }
    });
  }
}

/* ============================================================
   PASSENGER SYSTEM
   ============================================================ */
class PassengerSystem {
  constructor(career) {
    this.career = career;
    this.waiting  = [];   // { stopId, destId, waited }
    this.onBus    = [];   // { destId }
    this.capacity = 30;
    this._fill();
    this._respawnT = 0;
  }

  _fill() {
    BUS_STOPS.forEach(s => {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        this.waiting.push({ stopId: s.id, destId: this._rnd(s.id), waited: 0 });
      }
    });
  }

  _rnd(from) {
    let d;
    do { d = Math.floor(Math.random() * BUS_STOPS.length); } while (d === from);
    return d;
  }

  update(dt, busPos, stopped) {
    this._respawnT += dt;
    if (this._respawnT > 18) { this._respawn(); this._respawnT = 0; }

    this.waiting.forEach(p => { p.waited += dt; });
    this.waiting = this.waiting.filter(p => p.waited < 150);

    let dropped = 0, boarded = 0, earned = 0;

    if (stopped) {
      for (const stop of BUS_STOPS) {
        if (busPos.distanceTo(stop.pos) < 14) {
          // Drop off
          const deliver = this.onBus.filter(p => p.destId === stop.id);
          if (deliver.length > 0) {
            this.onBus = this.onBus.filter(p => p.destId !== stop.id);
            const res = this.career.deliver(deliver.length);
            dropped += deliver.length;
            earned  += res.fare;
          }
          // Board
          const atStop = this.waiting.filter(p => p.stopId === stop.id);
          const seats  = this.capacity - this.onBus.length;
          const board  = atStop.slice(0, seats);
          board.forEach(p => {
            this.onBus.push({ destId: p.destId });
            this.waiting.splice(this.waiting.indexOf(p), 1);
            boarded++;
          });
        }
      }
    }

    return { dropped, boarded, earned };
  }

  _respawn() {
    BUS_STOPS.forEach(s => {
      const cur = this.waiting.filter(p => p.stopId === s.id).length;
      if (cur < 4) {
        this.waiting.push({ stopId: s.id, destId: this._rnd(s.id), waited: 0 });
      }
    });
  }

  get busCount() { return this.onBus.length; }
  get nextDest() {
    if (!this.onBus.length) return null;
    return BUS_STOPS.find(s => s.id === this.onBus[0].destId) || null;
  }
  waitingAt(stopId) { return this.waiting.filter(p => p.stopId === stopId).length; }
}

/* ============================================================
   WEATHER & DAY/NIGHT
   ============================================================ */
class WeatherSystem {
  constructor(scene, sun, ambient) {
    this.scene   = scene;
    this.sun     = sun;
    this.ambient = ambient;
    this.dayT    = 0.35;
    this.daySpd  = 1 / 600;
    this.raining = false;
    this.rainAmt = 0;
    this._mkRain();
  }

  _mkRain() {
    const N = 4000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 500;
      pos[i*3+1] = Math.random() * 90;
      pos[i*3+2] = (Math.random() - 0.5) * 500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaaaacc, size: 0.28, transparent: true, opacity: 0, sizeAttenuation: true });
    this.rain = new THREE.Points(geo, mat);
    this.scene.add(this.rain);
  }

  update(dt) {
    this.dayT = (this.dayT + this.daySpd * dt) % 1;
    const angle  = this.dayT * Math.PI * 2;
    const isNight= this.dayT < 0.22 || this.dayT > 0.78;

    // Sun orbit
    this.sun.position.set(Math.cos(angle) * 220, Math.sin(angle) * 220, 80);

    if (isNight) {
      this.sun.intensity = Math.max(0, 0.2 - Math.abs(this.dayT - 0.5) * 4);
      this.ambient.intensity = 0.08;
    } else {
      const t = Math.sin(this.dayT * Math.PI);
      this.sun.intensity = 0.4 + t * 1.2;
      this.ambient.intensity = 0.25 + t * 0.55;
      if (this.dayT < 0.3 || this.dayT > 0.7) {
        this.sun.color.setHex(0xff8844);
        this.ambient.color.setHex(0xff9966);
      } else {
        this.sun.color.setHex(0xfffce8);
        this.ambient.color.setHex(0xffffff);
      }
    }

    // Rain
    this.rainAmt = this.raining
      ? Math.min(1, this.rainAmt + dt * 0.6)
      : Math.max(0, this.rainAmt - dt * 0.6);

    this.rain.material.opacity = this.rainAmt * 0.65;
    if (this.rainAmt > 0) {
      const a = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) {
        a[i+1] -= 32 * dt;
        a[i]   += (Math.random() - 0.5) * 0.4;
        if (a[i+1] < 0) a[i+1] = 90;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    return { isNight, dayT: this.dayT };
  }

  timeStr() {
    const h = Math.floor(this.dayT * 24);
    const m = Math.floor((this.dayT * 24 - h) * 60);
    const ap= h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}`;
  }
}

/* ============================================================
   TOUCH / KEYBOARD CONTROLS
   ============================================================ */
class Controls {
  constructor(sensitivity = 1) {
    this.throttle = false;
    this.brake    = false;
    this.steer    = 0;
    this.reverse  = false;
    this._active  = false;
    this._sx      = 0;
    this._sens    = sensitivity;
    this._bind();
  }

  _bind() {
    const wheel = document.getElementById('steering-wheel');
    const gas   = document.getElementById('btn-gas');
    const brk   = document.getElementById('btn-brake');
    const rev   = document.getElementById('btn-reverse');

    const onSteerMove = (cx) => {
      const delta = (cx - this._sx) / (80 / this._sens);
      this.steer  = Math.max(-1, Math.min(1, delta));
      wheel.style.transform = `rotate(${this.steer * 90}deg)`;
    };
    const endSteer = () => {
      this._active = false;
      this.steer = 0;
      wheel.style.transform = 'rotate(0deg)';
    };

    // Touch
    wheel.addEventListener('touchstart', e => { e.preventDefault(); this._active = true; this._sx = e.changedTouches[0].clientX; }, { passive:false });
    wheel.addEventListener('touchmove',  e => { e.preventDefault(); if (this._active) onSteerMove(e.changedTouches[0].clientX); }, { passive:false });
    wheel.addEventListener('touchend',   e => { e.preventDefault(); endSteer(); }, { passive:false });

    gas.addEventListener('touchstart', e => { e.preventDefault(); this.throttle = true; }, { passive:false });
    gas.addEventListener('touchend',   e => { e.preventDefault(); this.throttle = false; }, { passive:false });
    brk.addEventListener('touchstart', e => { e.preventDefault(); this.brake = true; }, { passive:false });
    brk.addEventListener('touchend',   e => { e.preventDefault(); this.brake = false; }, { passive:false });

    rev.addEventListener('touchstart', e => {
      e.preventDefault();
      this.reverse = !this.reverse;
      rev.classList.toggle('active', this.reverse);
    }, { passive:false });

    // Mouse fallback
    wheel.addEventListener('mousedown', e => { this._active = true; this._sx = e.clientX; });
    document.addEventListener('mousemove', e => { if (this._active) onSteerMove(e.clientX); });
    document.addEventListener('mouseup', () => { if (this._active) endSteer(); });
    gas.addEventListener('mousedown', () => this.throttle = true);
    gas.addEventListener('mouseup',   () => this.throttle = false);
    brk.addEventListener('mousedown', () => this.brake = true);
    brk.addEventListener('mouseup',   () => this.brake = false);
    rev.addEventListener('click', () => {
      this.reverse = !this.reverse;
      rev.classList.toggle('active', this.reverse);
    });

    // Keyboard
    const keyMap = { ArrowUp:'up', w:'up', ArrowDown:'down', s:'down', ArrowLeft:'left', a:'left', ArrowRight:'right', d:'right' };
    window.addEventListener('keydown', e => {
      const k = keyMap[e.key];
      if (k === 'up')    this.throttle = true;
      if (k === 'down')  this.brake    = true;
      if (k === 'left')  this.steer    = -1;
      if (k === 'right') this.steer    =  1;
      if (e.key === 'r' || e.key === 'R') { this.reverse = !this.reverse; rev.classList.toggle('active', this.reverse); }
    });
    window.addEventListener('keyup', e => {
      const k = keyMap[e.key];
      if (k === 'up')    this.throttle = false;
      if (k === 'down')  this.brake    = false;
      if (k === 'left' || k === 'right') this.steer = 0;
    });
  }
}

/* ============================================================
   CAMERA SYSTEM
   ============================================================ */
class CameraSystem {
  constructor(camera) {
    this.cam    = camera;
    this.mode   = 0;
    this.orbit  = 0;
    this._look  = new THREE.Vector3();

    const btn = document.getElementById('btn-camera');
    const cycle = () => {
      this.mode = (this.mode + 1) % 4;
      const labels = ['Chase','Driver','Cinematic','Free Orbit'];
      showHint(`📷 ${labels[this.mode]}`);
    };
    btn.addEventListener('click', cycle);
    btn.addEventListener('touchstart', e => { e.preventDefault(); cycle(); }, { passive:false });
  }

  update(bus, dt) {
    const bpos = bus.pos;
    const bfwd = bus.fwd;
    let tp, tl;

    switch (this.mode) {
      case 0: // Chase
        tp = bpos.clone().addScaledVector(bfwd, -24).add(new THREE.Vector3(0, 11, 0));
        tl = bpos.clone().add(new THREE.Vector3(0, 3, 0));
        break;
      case 1: // Driver
        tp = bpos.clone().addScaledVector(bfwd, 5).add(new THREE.Vector3(0, 4.8, 0));
        tl = bpos.clone().addScaledVector(bfwd, 28).add(new THREE.Vector3(0, 4.5, 0));
        break;
      case 2: // Cinematic
        const right = new THREE.Vector3(-bfwd.z, 0, bfwd.x);
        tp = bpos.clone().addScaledVector(bfwd, 16).addScaledVector(right, 10).add(new THREE.Vector3(0, 6, 0));
        tl = bpos.clone().add(new THREE.Vector3(0, 2.5, 0));
        break;
      case 3: // Orbit
        this.orbit += dt * 0.28;
        const r = 32;
        tp = new THREE.Vector3(bpos.x + Math.cos(this.orbit)*r, bpos.y+14, bpos.z + Math.sin(this.orbit)*r);
        tl = bpos.clone().add(new THREE.Vector3(0, 2, 0));
        break;
    }

    this.cam.position.lerp(tp, 0.07);
    this._look.lerp(tl, 0.07);
    this.cam.lookAt(this._look);
  }
}

/* ============================================================
   MINI MAP
   ============================================================ */
class MiniMap {
  constructor() {
    this.canvas  = document.getElementById('minimap');
    if (!this.canvas) return;
    this.SIZE    = 150;
    this.canvas.width  = this.SIZE;
    this.canvas.height = this.SIZE;
    this.ctx     = this.canvas.getContext('2d');
    // world half-extent (CITY_HALF + small margin)
    this.HALF    = CITY_HALF + 20;
    this._stopColors = ['#f6c90e','#3ec9a7','#ff6b6b','#a78bfa','#38bdf8'];
  }

  _w(v) { return (v / this.HALF) * (this.SIZE / 2) + this.SIZE / 2; }

  draw(busPos, busAngle, traffic, passengers) {
    if (!this.ctx) return;
    const ctx  = this.ctx;
    const S    = this.SIZE;

    ctx.clearRect(0, 0, S, S);

    // Background
    ctx.fillStyle = 'rgba(8,10,24,0.88)';
    ctx.beginPath();
    ctx.roundRect(0, 0, S, S, 10);
    ctx.fill();

    // City boundary
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    const b0 = this._w(-CITY_HALF), b1 = this._w(CITY_HALF);
    ctx.strokeRect(b0, b0, b1 - b0, b1 - b0);

    // Road grid — horizontal & vertical lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= CITY_GRID; i++) {
      const coord = -CITY_HALF + i * CELL_SIZE;
      const p = this._w(coord);
      ctx.beginPath(); ctx.moveTo(p, this._w(-CITY_HALF)); ctx.lineTo(p, this._w(CITY_HALF)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this._w(-CITY_HALF), p); ctx.lineTo(this._w(CITY_HALF), p); ctx.stroke();
    }

    // Traffic cars
    if (traffic) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (const car of traffic.cars) {
        const cx = this._w(car.group.position.x);
        const cy = this._w(car.group.position.z);
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bus stops
    BUS_STOPS.forEach((stop, i) => {
      const sx = this._w(stop.pos.x);
      const sy = this._w(stop.pos.z);
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = this._stopColors[i % this._stopColors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Player bus — orange arrow
    const bx = this._w(busPos.x);
    const by = this._w(busPos.z);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(busAngle);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fillStyle = '#FF6B00';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Compass "N" label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 12);
  }
}

/* ============================================================
   HUD UPDATER
   ============================================================ */
function showHint(msg) {
  let el = document.getElementById('cam-hint');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cam-hint';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-size:22px;font-weight:800;pointer-events:none;z-index:200;text-shadow:0 2px 8px #000;transition:opacity 0.5s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

function showNotif(msg, color = '#FFD700') {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.style.color = color;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

function el(id) { return document.getElementById(id); }

function updateHUD(bus, pax, career, weather, controls) {
  el('hud-speed')     && (el('hud-speed').textContent = Math.round(bus.speed));
  el('hud-passengers')&& (el('hud-passengers').textContent = pax.busCount);
  el('hud-money')     && (el('hud-money').textContent = `$${career.money.toLocaleString()}`);
  el('hud-level')     && (el('hud-level').textContent = career.level);
  el('hud-time')      && (el('hud-time').textContent = weather.timeStr());
  el('hud-weather')   && (el('hud-weather').textContent = weather.raining ? '🌧️' : '☀️');
  el('hud-gear')      && (el('hud-gear').textContent = controls.reverse ? 'R' : 'D');

  const dest = pax.nextDest;
  el('hud-destination') && (el('hud-destination').textContent = dest ? `→ ${dest.name}` : 'Pick up passengers');

  const pct = career.xpNeeded(career.level) > 0 ? (career.xp / career.xpNeeded(career.level)) * 100 : 0;
  el('hud-xp-bar') && (el('hud-xp-bar').style.width = pct + '%');

  // Near stop indicator
  // (handled in game loop)
}

/* ============================================================
   MAIN GAME
   ============================================================ */
class BusRushGame {
  constructor() {
    this.state   = 'loading';
    this.save    = new SaveSystem();
    this.career  = new CareerSystem(this.save);
    this.running = false;
    this.lastT   = 0;
    this._menuAngle = 0;
    this._autoSaveT = 0;
    this._initRenderer();
    this._initScene();
    this._loading();
  }

  _initRenderer() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcce8ff, 80, 380);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 60, 120);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfffce8, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.far = 550;
    this.sun.shadow.camera.near = 0.5;
    [-220, 220].forEach(v => {
      this.sun.shadow.camera.left = -v;
      this.sun.shadow.camera.right = v;
      this.sun.shadow.camera.top = v;
      this.sun.shadow.camera.bottom = -v;
    });
    this.sun.shadow.camera.left = -220; this.sun.shadow.camera.right = 220;
    this.sun.shadow.camera.top  =  220; this.sun.shadow.camera.bottom = -220;
    this.scene.add(this.sun);

    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a8a2a, 0.3);
    this.scene.add(this.hemi);
  }

  async _loading() {
    const bar  = el('loading-bar');
    const text = el('loading-text');
    const steps = [
      ['Building city...', () => { this.world = new World(this.scene); }],
      ['Spawning bus...',  () => { this.bus   = new Bus(this.scene); }],
      ['Adding traffic...', ()=> { this.traffic = new TrafficSystem(this.scene, this.world); }],
      ['Loading passengers...', () => { this.passengers = new PassengerSystem(this.career); }],
      ['Setting up weather...', ()=> { this.weather = new WeatherSystem(this.scene, this.sun, this.ambient); }],
      ['Preparing controls...', ()=> {
        this.controls = new Controls(this.save.data.settings.sensitivity);
        this.camSys   = new CameraSystem(this.camera);
        this.miniMap  = new MiniMap();
        this._setupUI();
        this._applyQuality(this.save.data.settings.quality);
      }],
    ];

    // Start render loop immediately for loading screen animation
    this._loop(performance.now());

    for (let i = 0; i < steps.length; i++) {
      const [msg, fn] = steps[i];
      if (text) text.textContent = msg;
      if (bar)  bar.style.width  = ((i / steps.length) * 85) + '%';
      await new Promise(r => setTimeout(r, 60));
      fn();
    }

    if (bar)  bar.style.width = '100%';
    await new Promise(r => setTimeout(r, 300));

    el('screen-loading').style.display = 'none';
    this._showMenu();
  }

  _setupUI() {
    const on = (id, ev, fn) => { const e = el(id); if (e) e.addEventListener(ev, fn); };

    on('btn-play',     'click', () => this._startGame());
    on('btn-continue', 'click', () => this._startGame());
    on('btn-garage',   'click', () => this._showGarage());
    on('btn-routes',   'click', () => this._showRoutes());
    on('btn-settings', 'click', () => this._showSettings());
    on('btn-resume',   'click', () => this._resume());
    on('btn-to-menu',  'click', () => this._showMenu());
    on('btn-weather',  'click', () => {
      this.weather.raining = !this.weather.raining;
      const b = el('btn-weather');
      if (b) b.textContent = this.weather.raining ? '☀️' : '🌧️';
    });

    document.querySelectorAll('.btn-back').forEach(b => b.addEventListener('click', () => this._showMenu()));
    on('btn-pause', 'click', () => this._pause());
    on('btn-pause', 'touchstart', e => { e.preventDefault(); this._pause(); });

    on('setting-quality', 'change', e => {
      this._applyQuality(e.target.value);
      this.save.save({ settings: { ...this.save.data.settings, quality: e.target.value } });
    });
    const sq = el('setting-quality');
    if (sq) sq.value = this.save.data.settings.quality;

    this._updateStatDisplays();
  }

  _show(id) { const e = el(id); if (e) e.style.display = 'flex'; }
  _hide(id) { const e = el(id); if (e) e.style.display = 'none'; }

  _showMenu() {
    this.state = 'menu'; this.running = false;
    this._hide('screen-hud'); this._hide('screen-pause');
    this._hide('screen-garage'); this._hide('screen-routes'); this._hide('screen-settings');
    this._show('screen-menu');
    this._updateStatDisplays();
  }

  _showGarage() {
    this.state = 'garage';
    this._hide('screen-menu'); this._show('screen-garage');
    this._updateStatDisplays();
  }

  _showRoutes() {
    this.state = 'routes';
    this._hide('screen-menu'); this._show('screen-routes');
    const routes = [
      { name: 'Route 1 – City Circuit',  stops: 'City Hall → Park → Market → City Hall',  req: 1, reward: '$60/pax', diff: '⭐' },
      { name: 'Route 2 – Harbor Express',stops: 'Harbor → Tech → Market → Harbor',         req: 3, reward: '$80/pax', diff: '⭐⭐' },
      { name: 'Route 3 – Grand Tour',    stops: 'All stops (full city loop)',               req: 5, reward: '$100/pax', diff: '⭐⭐⭐' },
    ];
    const list = el('routes-list');
    if (list) {
      list.innerHTML = routes.map(r => {
        const locked = this.career.level < r.req;
        return `<div class="route-card ${locked?'locked':''}">
          <div class="route-name">${r.name}</div>
          <div class="route-stops">${locked ? `🔒 Unlock at Level ${r.req}` : r.stops}</div>
          <div class="route-info"><span>${r.reward}</span><span>${r.diff}</span></div>
        </div>`;
      }).join('');
    }
  }

  _showSettings() {
    this.state = 'settings';
    this._hide('screen-menu'); this._show('screen-settings');
  }

  _updateStatDisplays() {
    const set = (id, val) => { const e = el(id); if (e) e.textContent = val; };
    set('menu-money',       `$${this.career.money.toLocaleString()}`);
    set('menu-level',       `Level ${this.career.level}`);
    set('garage-level',     this.career.level);
    set('garage-money',     `$${this.career.money.toLocaleString()}`);
    set('garage-passengers',this.career.totalPassengers);
    set('garage-xp',        `${this.career.xp} / ${this.career.xpNeeded(this.career.level)} XP`);
    const xpFill = el('xp-bar');
    if (xpFill) {
      const pct = (this.career.xp / this.career.xpNeeded(this.career.level)) * 100;
      xpFill.style.width = pct + '%';
    }
  }

  _startGame() {
    this.state = 'playing'; this.running = true;
    this._hide('screen-menu'); this._hide('screen-pause');
    this._show('screen-hud');
    this.lastT = performance.now();
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.running = false;
    this._show('screen-pause');
    const ee = el('pause-earnings');   if (ee) ee.textContent = `$${this.career.sessionEarnings.toLocaleString()}`;
    const ep = el('pause-passengers'); if (ep) ep.textContent = this.career.sessionPassengers;
    this._autosave();
  }

  _resume() {
    this.state = 'playing'; this.running = true;
    this._hide('screen-pause');
    this.lastT = performance.now();
  }

  _autosave() {
    this.save.save({ money: this.career.money, xp: this.career.xp, level: this.career.level, totalPassengers: this.career.totalPassengers });
  }

  _applyQuality(q) {
    const pr = q === 'low' ? 1 : q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1.5;
    this.renderer.setPixelRatio(pr);
    if (this.scene && this.scene.fog) {
      this.scene.fog.far = q === 'low' ? 180 : q === 'high' ? 400 : 280;
    }
  }

  _loop(ts) {
    requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((ts - this.lastT) / 1000, 0.05);
    this.lastT = ts;

    if (this.state === 'playing') {
      this.bus.update(dt, this.controls.throttle, this.controls.brake, this.controls.steer, this.controls.reverse);
      this.traffic.update(dt, this.bus.pos);
      const ws = this.weather.update(dt);
      this.world.update(ws.dayT, ws.isNight);

      const stopped = Math.abs(this.bus.vel) < 0.8;
      const inter   = this.passengers.update(dt, this.bus.pos, stopped);

      if (inter.dropped > 0) showNotif(`✅ ${inter.dropped} delivered! +$${inter.earned}`, '#00FF88');
      else if (inter.boarded > 0) showNotif(`👥 ${inter.boarded} boarded!`, '#FFD700');

      // Near-stop indicator
      let nearStop = false;
      for (const s of BUS_STOPS) {
        if (this.bus.pos.distanceTo(s.pos) < 14) { nearStop = true; break; }
      }
      const si = el('stop-indicator');
      if (si) si.style.display = nearStop ? 'flex' : 'none';

      this.camSys.update(this.bus, dt);
      updateHUD(this.bus, this.passengers, this.career, this.weather, this.controls);
      if (this.miniMap) this.miniMap.draw(this.bus.pos, this.bus.group.rotation.y, this.traffic, this.passengers);

      this.scene.fog.far = this.weather.raining ? 130 : (this.renderer.getPixelRatio() === 1 ? 180 : 320);

      this._autoSaveT += dt;
      if (this._autoSaveT > 30) { this._autosave(); this._autoSaveT = 0; }

    } else if (this.state === 'menu' || this.state === 'garage' || this.state === 'routes' || this.state === 'settings') {
      this._menuAngle += 0.0008;
      this.camera.position.set(
        Math.cos(this._menuAngle) * 130,
        55 + Math.sin(this._menuAngle * 0.4) * 8,
        Math.sin(this._menuAngle) * 130
      );
      this.camera.lookAt(0, 4, 0);
      if (this.weather) this.weather.update(dt);
      if (this.world)   this.world.update(this.weather ? this.weather.dayT : 0.5, false);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

/* Boot */
new BusRushGame();
