// Three.js is loaded globally via vendor/three.min.js (see index.html).

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();

// Sky: a small vertical-gradient canvas texture on a large inward-facing
// sphere, instead of a flat color — cheap (one draw at startup, one big
// basic-material mesh) but reads far better than a solid fill, and unlike
// a screen-locked backdrop it correctly shows more ground/sky as the
// camera pitches (important in FPV mode).
function makeSkyTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#1a4d8f");
  grad.addColorStop(0.5, "#6fb3e8");
  grad.addColorStop(0.78, "#bfe0ff");
  grad.addColorStop(1, "#eef7ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SKY_HORIZON_COLOR = 0xbfe0ff;
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(900, 24, 16),
  new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
);
scene.add(sky);

scene.background = new THREE.Color(SKY_HORIZON_COLOR);
scene.fog = new THREE.Fog(SKY_HORIZON_COLOR, 60, 420);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 6, -12);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setSize(window.innerWidth, window.innerHeight);

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a2e, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
sun.position.set(120, 180, -80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 500;
scene.add(sun);

// ---------------------------------------------------------------------------
// Ground + world dressing
// ---------------------------------------------------------------------------

const GROUND_SIZE = 1000;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Reused scratch vectors so per-frame collision checks against power-line
// segments don't allocate.
const _segAB = new THREE.Vector3();
const _segAP = new THREE.Vector3();
const _segClosest = new THREE.Vector3();
function distPointToSegment(p, a, b) {
  _segAB.subVectors(b, a);
  _segAP.subVectors(p, a);
  const t = THREE.MathUtils.clamp(_segAP.dot(_segAB) / _segAB.lengthSq(), 0, 1);
  _segClosest.copy(a).addScaledVector(_segAB, t);
  return p.distanceTo(_segClosest);
}

// Procedural tileable grass-variation texture — a mottled fill instead of a
// flat color, generated once on a small canvas (no external image assets).
function makeGroundTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#4c8a3c";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const dark = Math.random() < 0.5;
    ctx.fillStyle = dark ? `rgba(20,45,10,${0.05 + Math.random() * 0.1})` : `rgba(150,205,95,${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GROUND_SIZE / 8, GROUND_SIZE / 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Helipad marker — a white disc with a yellow ring and a bold "H", used for
// the home landing spot and every tower rooftop.
function makeHelipadTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(r, r, r - 4, 0, Math.PI * 2);
  ctx.fillStyle = "#eef3f6";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#ffcc33";
  ctx.stroke();
  ctx.fillStyle = "#0a1830";
  ctx.font = "bold 140px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("H", r, r + 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const helipadTexture = makeHelipadTexture();
const helipadMat = new THREE.MeshBasicMaterial({
  map: helipadTexture,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
});

function addHelipad(x, y, z, size) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(size, 24), helipadMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, y + 0.02, z);
  scene.add(pad);
  return pad;
}

const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(GROUND_SIZE, 100, 0x2a5522, 0x2a5522);
grid.material.opacity = 0.12;
grid.material.transparent = true;
scene.add(grid);

// Scattered low-poly trees/pillars for a sense of scale & obstacles.
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
const leavesMats = [];
for (let i = 0; i < 6; i++) {
  const leafColor = new THREE.Color(0x2f7a34);
  leafColor.offsetHSL(randRange(-0.04, 0.04), randRange(-0.1, 0.05), randRange(-0.08, 0.06));
  leavesMats.push(new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9 }));
}
const obstacles = []; // { position: Vector3, radius, height, landable }

// Home helipad — the game's position zero. The RPA spawns parked here and
// crashes always send it back to this exact spot.
const HOME_POSITION = new THREE.Vector3(0, 0, 0);
addHelipad(HOME_POSITION.x, HOME_POSITION.y, HOME_POSITION.z, 5);

function addTree(x, z) {
  const group = new THREE.Group();
  const trunkH = randRange(3, 5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, trunkH, 6), trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const leavesMat = leavesMats[Math.floor(Math.random() * leavesMats.length)];
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(randRange(2, 3.2), randRange(4, 6), 8), leavesMat);
  leaves.position.y = trunkH + 2;
  leaves.castShadow = true;
  group.add(leaves);

  group.position.set(x, 0, z);
  scene.add(group);
  obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: 1.6, height: trunkH + 5, landable: false });
}

// Trees are grouped into forest zones of varying size/density rather than
// scattered uniformly — each zone keeps a central glade clear (a natural
// clearing/path) instead of packing trees edge-to-edge.
const FOREST_ZONE_COUNT = 7;
for (let i = 0; i < FOREST_ZONE_COUNT; i++) {
  let cx, cz;
  do {
    cx = randRange(-430, 430);
    cz = randRange(-430, 430);
  } while (Math.hypot(cx, cz) < 65);
  const radius = randRange(40, 100);
  const density = randRange(0.35, 1);
  const clearingRadius = radius * randRange(0.15, 0.3);
  const count = Math.round(45 * density);
  for (let t = 0; t < count; t++) {
    const angle = randRange(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * radius; // uniform disk sampling
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    if (Math.hypot(x, z) < 25) continue; // keep spawn area clear
    if (r < clearingRadius) continue; // leave the zone's glade open
    addTree(x, z);
  }
}

// Towers cluster into a handful of small urban zones instead of standing
// alone — each zone places 3-6 towers with a minimum spacing so they read
// as a rooftop cluster to fly between, not isolated pillars.
const towerMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b0, roughness: 0.7 });
const URBAN_ZONE_COUNT = 4;
for (let u = 0; u < URBAN_ZONE_COUNT; u++) {
  let cx, cz;
  do {
    cx = randRange(-370, 370);
    cz = randRange(-370, 370);
  } while (Math.hypot(cx, cz) < 90);

  const clusterSize = 3 + Math.floor(Math.random() * 4); // 3-6 towers
  const placed = [];
  for (let i = 0; i < clusterSize; i++) {
    const w = randRange(6, 12);
    let x, z, tries = 0;
    do {
      const angle = randRange(0, Math.PI * 2);
      const r = randRange(0, 32);
      x = cx + Math.cos(angle) * r;
      z = cz + Math.sin(angle) * r;
      tries++;
    } while (placed.some((p) => Math.hypot(p.x - x, p.z - z) < (p.w + w) * 0.55 + 4) && tries < 12);
    placed.push({ x, z, w });

    const h = randRange(20, 55);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
    tower.position.set(x, h / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    scene.add(tower);
    obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: w * 0.75, height: h, landable: true });
    addHelipad(x, h, z, w * 0.4);
  }
}

// ---------------------------------------------------------------------------
// High-tension power lines — corridors of poles linked by sagging cables.
// Real collision: any contact with a cable span ends the flight exactly
// like a tree (no landable surface), tracked as sampled polyline segments
// rather than the cylinder-obstacle model used for trees/towers.
// ---------------------------------------------------------------------------

const POLE_HEIGHT = 20;
const POWERLINE_HIT_RADIUS = 0.55;
const poleMat = new THREE.MeshStandardMaterial({ color: 0x6e7176, roughness: 0.55, metalness: 0.35 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.6 });
const powerLineSpans = []; // arrays of sampled Vector3 points along each cable span

function addPole(x, z) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, POLE_HEIGHT, 8), poleMat);
  pole.position.set(x, POLE_HEIGHT / 2, z);
  pole.castShadow = true;
  scene.add(pole);

  const crossarm = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 0.3), poleMat);
  crossarm.position.set(x, POLE_HEIGHT - 1.2, z);
  crossarm.castShadow = true;
  scene.add(crossarm);

  obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: 0.6, height: POLE_HEIGHT, landable: false });
  return [
    new THREE.Vector3(x - 2.6, POLE_HEIGHT - 1.2, z),
    new THREE.Vector3(x + 2.6, POLE_HEIGHT - 1.2, z),
  ];
}

// Keeps the home helipad guaranteed clear — poles are already excluded
// within this radius, but a *span* between two farther-out poles can still
// cut across a chord closer to the origin than either endpoint, so spans
// get their own check before being built.
const SPAWN_SAFE_RADIUS = 55;
function segmentNearOriginXZ(ax, az, bx, bz, safeR) {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  const t = lenSq > 1e-6 ? THREE.MathUtils.clamp((-ax * abx - az * abz) / lenSq, 0, 1) : 0;
  const cx = ax + abx * t;
  const cz = az + abz * t;
  return Math.hypot(cx, cz) < safeR;
}

function addCableSpan(pA, pB) {
  if (segmentNearOriginXZ(pA.x, pA.z, pB.x, pB.z, SPAWN_SAFE_RADIUS)) return;
  const mid = pA.clone().add(pB).multiplyScalar(0.5);
  mid.y -= Math.min(2.8, pA.distanceTo(pB) * 0.08);
  const curve = new THREE.CatmullRomCurve3([pA, mid, pB]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 6, false), cableMat);
  tube.castShadow = true;
  scene.add(tube);
  powerLineSpans.push(curve.getPoints(16));
}

const POWERLINE_CORRIDORS = 3;
for (let c = 0; c < POWERLINE_CORRIDORS; c++) {
  const startAngle = randRange(0, Math.PI * 2);
  let x = Math.cos(startAngle) * randRange(180, 430);
  let z = Math.sin(startAngle) * randRange(180, 430);
  const dirAngle = startAngle + Math.PI + randRange(-0.5, 0.5);
  const spanLen = randRange(45, 62);
  const poleCount = 5 + Math.floor(Math.random() * 3);

  let prevArm = null;
  for (let i = 0; i < poleCount; i++) {
    if (Math.hypot(x, z) < SPAWN_SAFE_RADIUS || Math.abs(x) > GROUND_SIZE / 2 - 10 || Math.abs(z) > GROUND_SIZE / 2 - 10) {
      x += Math.cos(dirAngle) * spanLen;
      z += Math.sin(dirAngle) * spanLen;
      prevArm = null; // don't bridge a cable across the skipped gap
      continue;
    }
    const arm = addPole(x, z);
    if (prevArm) {
      addCableSpan(prevArm[0], arm[0]);
      addCableSpan(prevArm[1], arm[1]);
    }
    prevArm = arm;
    x += Math.cos(dirAngle) * spanLen + randRange(-6, 6);
    z += Math.sin(dirAngle) * spanLen + randRange(-6, 6);
  }
}

// ---------------------------------------------------------------------------
// Gates (rings to fly through) — simple gamification
// ---------------------------------------------------------------------------

const gateGeo = new THREE.TorusGeometry(4, 0.35, 12, 32);
const gateMat = new THREE.MeshStandardMaterial({
  color: 0xffcc33,
  emissive: 0x664400,
  roughness: 0.4,
  metalness: 0.2,
});
const gates = [];
const GATE_COUNT = 10;

function placeGate(gate) {
  const angle = randRange(0, Math.PI * 2);
  const dist = randRange(40, 220);
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const y = randRange(6, 40);
  gate.mesh.position.set(x, y, z);
  gate.mesh.rotation.set(randRange(-0.3, 0.3), randRange(0, Math.PI * 2), Math.PI / 2 + randRange(-0.3, 0.3));
  gate.passed = false;
  gate.mesh.material.emissive.setHex(0x664400);
}

for (let i = 0; i < GATE_COUNT; i++) {
  const mesh = new THREE.Mesh(gateGeo, gateMat.clone());
  mesh.castShadow = true;
  scene.add(mesh);
  const gate = { mesh };
  placeGate(gate);
  gates.push(gate);
}

let gatesPassed = 0;

// ---------------------------------------------------------------------------
// Drone models — a few selectable presets, each with its own look and
// flight feel (top speed, agility, stability).
// ---------------------------------------------------------------------------

const DRONE_TYPES = {
  exp_play: {
    flightMinutes: 40,
    rangeKm: 12,
    bodyColor: 0x8fd400,
    armColor: 0x1a1e14,
    accentColor: 0x9dff33,
    scale: 1.0,
    maxTiltDeg: 28,
    maxYawRate: 2.2,
    maxClimbRate: 5,
    maxHorizSpeed: 15,
    velocityResponse: 8.5,
    rateResponse: 7.5,
  },
  inspector_pro: {
    flightMinutes: 50,
    rangeKm: 15,
    bodyColor: 0x2b2f36,
    armColor: 0x1c1f24,
    accentColor: 0xff4433,
    scale: 1.15,
    maxTiltDeg: 20,
    maxYawRate: 1.6,
    maxClimbRate: 6,
    maxHorizSpeed: 12,
    velocityResponse: 10.0,
    rateResponse: 9.0,
  },
  agri_spray: {
    flightMinutes: 25,
    rangeKm: 5,
    bodyColor: 0xe8ebee,
    armColor: 0x24272c,
    accentColor: 0x6dd66d,
    scale: 1.5,
    maxTiltDeg: 14,
    maxYawRate: 1.0,
    maxClimbRate: 3,
    maxHorizSpeed: 7,
    velocityResponse: 3.5,
    rateResponse: 4.0,
  },
};

function buildDrone(config) {
  const group = new THREE.Group();

  // Painted-plastic body with a subtle clearcoat, like an injection-molded
  // consumer airframe rather than a flat-shaded placeholder.
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: config.bodyColor,
    roughness: 0.35,
    metalness: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });
  const armMat = new THREE.MeshStandardMaterial({ color: config.armColor, roughness: 0.5, metalness: 0.35 });
  const motorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.3, metalness: 0.8 });
  const propMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.3, metalness: 0.2 });
  const discMat = new THREE.MeshBasicMaterial({ color: 0x9aa4ad, transparent: true, opacity: 0, side: THREE.DoubleSide });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, roughness: 0.08, metalness: 0.9, clearcoat: 1 });
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.5 });
  const ledFrontMat = new THREE.MeshStandardMaterial({
    color: config.accentColor,
    emissive: config.accentColor,
    emissiveIntensity: 1.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.1), bodyMat);
  body.castShadow = true;
  group.add(body);

  // Nose gimbal: a small rotary housing (rounded body) plus a distinct
  // forward-facing lens barrel — reads as a real 3-axis camera mount
  // instead of a plain sphere.
  const gimbalHousing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyMat);
  gimbalHousing.position.set(0, 0.1, 0.42);
  gimbalHousing.castShadow = true;
  group.add(gimbalHousing);

  const lensBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.16, 12), motorMat);
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, 0.1, 0.56);
  group.add(lensBarrel);

  const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), lensMat);
  lensGlass.position.set(0, 0.1, 0.645);
  group.add(lensGlass);

  const armOffsets = [
    { x: 0.7, z: 0.7, front: true },
    { x: -0.7, z: 0.7, front: true },
    { x: 0.7, z: -0.7, front: false },
    { x: -0.7, z: -0.7, front: false },
  ];

  const propellers = [];

  armOffsets.forEach(({ x, z, front }) => {
    const armLen = Math.hypot(x, z);
    // Tapered arm (wide at the body, narrow at the motor) reads as a
    // manufactured part instead of a uniform box extrusion. The cylinder's
    // default axis is Y, so its quaternion is set directly from that axis
    // to the horizontal (x,0,z) direction rather than juggling Euler order.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, armLen, 6), armMat);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, 0, z).normalize());
    arm.position.set(x / 2, 0, z / 2);
    arm.castShadow = true;
    group.add(arm);

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 12), motorMat);
    motor.position.set(x, 0.06, z);
    motor.castShadow = true;
    group.add(motor);

    const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), front ? ledFrontMat : ledMat);
    led.position.set(x, 0.05, z + (front ? 0.12 : -0.12));
    group.add(led);

    const propGroup = new THREE.Group();
    propGroup.position.set(x, 0.17, z);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.08), propMat);
    blade.castShadow = true;
    const blade2 = blade.clone();
    blade2.rotation.y = Math.PI / 2;
    propGroup.add(blade, blade2);

    // Faint spin-blur disc, hidden at rest and faded in at high RPM by
    // updatePhysics — cheap (one extra basic-material draw per rotor) and
    // avoids a plain naked-blade look once the propellers are spinning fast.
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), discMat);
    disc.rotation.x = -Math.PI / 2;
    propGroup.add(disc);
    propGroup.userData.disc = disc;

    group.add(propGroup);
    propellers.push(propGroup);
  });

  group.scale.setScalar(config.scale);

  // A tiny light attached to the drone so it's visible at night / in shadow.
  const droneLight = new THREE.PointLight(config.accentColor, 0.6, 8);
  droneLight.position.set(0, 0.3, 0);
  group.add(droneLight);

  return { group, propellers };
}

let selectedDroneKey = "exp_play";
let droneConfig = DRONE_TYPES[selectedDroneKey];
let { group: drone, propellers } = buildDrone(droneConfig);
drone.position.set(0, 6, 0);
scene.add(drone);

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

const keys = new Set();
let cameraMode = 0; // 0 = geográfica (chase), 1 = fpv, 2 = cinemático (follow), 3 = panorámica (tight follow)
const cameraModes = ["Geográfica", "FPV", "Cinemático", "Panorámica"];
let started = false;
let crashing = false; // true while falling after a collision, before the retry overlay shows
let gameOver = false; // true while the "Intenta nuevamente" overlay is up

const gimbalWrapEl = document.getElementById("gimbal-wrap");

function updateGimbalVisibility() {
  gimbalWrapEl.classList.toggle("hidden", cameraMode !== 1);
}

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyC" && started) cycleCamera();
  if (e.code === "KeyR" && started) resetDrone();
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));

function cycleCamera() {
  cameraMode = (cameraMode + 1) % cameraModes.length;
  document.getElementById("hud-camera").textContent = cameraModes[cameraMode];
  updateGimbalVisibility();
  beginCameraTransition();
}

// Touch controls: virtual joysticks (left = throttle/yaw, right = pitch/roll)
// plus buttons for camera and reset. Shown automatically on touch-capable
// devices (see isTouchDevice below).
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  document.body.classList.add("touch-device");
}

const touch = { throttle: 0, yaw: 0, pitch: 0, roll: 0, boost: false, level: false };

function setupJoystick(baseEl, knobEl, onChange) {
  const jState = { active: false, pointerId: null };

  function setKnob(x, y) {
    knobEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  const DEADZONE = 0.06; // fraction of radius ignored near center, to absorb thumb jitter

  function handleMove(clientX, clientY) {
    const rect = baseEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r) {
      dx = (dx / dist) * r;
      dy = (dy / dist) * r;
    }
    setKnob(dx, dy);

    // Radial deadzone: ignore the innermost DEADZONE fraction, then rescale
    // so the stick still reaches full deflection (±1) right at the edge.
    let nx = dx / r;
    let ny = -dy / r; // invert Y so "up" is positive
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) {
      nx = 0;
      ny = 0;
    } else {
      const scale = (mag - DEADZONE) / (1 - DEADZONE) / mag;
      nx *= scale;
      ny *= scale;
    }
    onChange(nx, ny);
  }

  function reset() {
    jState.active = false;
    jState.pointerId = null;
    baseEl.classList.remove("active");
    setKnob(0, 0);
    onChange(0, 0);
  }

  baseEl.addEventListener("pointerdown", (e) => {
    jState.active = true;
    jState.pointerId = e.pointerId;
    baseEl.classList.add("active");
    baseEl.setPointerCapture(e.pointerId);
    handleMove(e.clientX, e.clientY);
  });
  baseEl.addEventListener("pointermove", (e) => {
    if (!jState.active || e.pointerId !== jState.pointerId) return;
    handleMove(e.clientX, e.clientY);
  });
  const onUp = (e) => {
    if (e.pointerId !== jState.pointerId) return;
    reset();
  };
  baseEl.addEventListener("pointerup", onUp);
  baseEl.addEventListener("pointercancel", onUp);
}

setupJoystick(document.getElementById("joystick-left"), document.querySelector("#joystick-left .joystick-knob"), (x, y) => {
  touch.yaw = -x;
  touch.throttle = y;
});
setupJoystick(document.getElementById("joystick-right"), document.querySelector("#joystick-right .joystick-knob"), (x, y) => {
  touch.roll = x;
  touch.pitch = y;
});

document.getElementById("btn-camera").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) cycleCamera();
});
document.getElementById("btn-reset").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) resetDrone();
});

// Toast — brief informational message, reused for the locked-aircraft notice.
const LOCK_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>';
let toastTimer = null;
function showToast(message, { icon = false } = {}) {
  const el = document.getElementById("toast");
  el.innerHTML = icon ? `${LOCK_ICON_SVG}<span>${message}</span>` : message;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2500);
}

// Aircraft picker on the preflight "Selecciona tu aeronave" step — trial
// version only unlocks EXP PLAY; Inspector Pro / Agri Spray X8 are locked
// hit-zones that show an informational toast instead of changing the
// selection (selectedDroneKey defaults to exp_play and is the only one
// that can ever launch in this build).
document.querySelectorAll(".aircraft-hit-zone").forEach((el) => {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (el.classList.contains("aircraft-locked")) {
      showToast("Disponible en la versión completa", { icon: true });
      return;
    }
    selectedDroneKey = el.dataset.drone;
    droneConfig = DRONE_TYPES[selectedDroneKey];
    applyDroneType();
  });
});

// Preflight flow — 3 steps shown before the simulator starts: bienvenida →
// selecciona tu aeronave → consejos de seguridad. Only one step panel is
// visible at a time; "Atrás" buttons carry a data-back-to pointing at the
// step to return to.
const preflightStepIds = ["step-welcome", "step-aircraft", "step-safety"];

function showPreflightStep(id) {
  preflightStepIds.forEach((key) => {
    document.getElementById(key).classList.toggle("hidden", key !== id);
  });
}

// Each preflight screen is the official 2D artwork shown at its native
// aspect ratio ("contain" letterboxing), computed here in px rather than
// pure CSS: a non-replaced box can't resolve `aspect-ratio` against both
// axes of available space at once, and every overlay button below is
// positioned in percentages that must line up with the artwork's own
// drawn buttons, so the frame's rendered box has to exactly match the
// image's ratio — not just its visible background content.
const screenFrames = document.querySelectorAll(".screen-frame");
function sizeScreenFrames() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  screenFrames.forEach((el) => {
    const ratio = Number(el.dataset.ratio);
    if (!ratio) return;
    let w = vw;
    let h = w / ratio;
    if (h > vh) {
      h = vh;
      w = h * ratio;
    }
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  });
}
sizeScreenFrames();
window.addEventListener("resize", sizeScreenFrames);
window.addEventListener("orientationchange", sizeScreenFrames);

document.getElementById("welcome-next-btn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  showPreflightStep("step-aircraft");
});
document.getElementById("aircraft-next-btn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  showPreflightStep("step-safety");
});
document.querySelectorAll("[data-back-to]").forEach((el) => {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    showPreflightStep(el.dataset.backTo);
  });
});

// The simulator always launches in fullscreen — on touch devices this also
// tries a real landscape lock (only Android Chrome supports
// screen.orientation.lock(), and only while fullscreen; iOS Safari supports
// neither API at all). Both calls are feature-detected and swallowed on
// failure; the CSS #rotate-overlay is what actually guarantees landscape
// everywhere else, so the lock is pure progressive enhancement and must
// never delay or block the existing start-up lines below.
function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen()
      .then(() => {
        if (isTouchDevice && screen.orientation && screen.orientation.lock) {
          screen.orientation.lock("landscape").catch(() => {});
        }
      })
      .catch(() => {});
  } else if (isTouchDevice && screen.orientation && screen.orientation.lock) {
    screen.orientation.lock("landscape").catch(() => {});
  }
}

const exitFullscreenBtn = document.getElementById("exit-fullscreen-btn");
document.addEventListener("fullscreenchange", () => {
  exitFullscreenBtn.classList.toggle("hidden", !document.fullscreenElement);
});
exitFullscreenBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (document.fullscreenElement) document.exitFullscreen();
});

// Browsers only allow requestFullscreen() inside a user gesture, so it
// can't fire on page load — instead it fires on the very first tap/click
// of any kind, whichever button that happens to be, rather than waiting
// for the last preflight screen.
function enterFullscreenOnce() {
  document.removeEventListener("pointerdown", enterFullscreenOnce);
  enterFullscreen();
}
document.addEventListener("pointerdown", enterFullscreenOnce, { once: true });

document.getElementById("start-btn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  enterFullscreen();
  document.getElementById("preflight").classList.add("hidden");
  started = true;
  clock.getDelta(); // discard the idle time spent on the preflight screens
});

document.getElementById("crash-retry-btn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  document.getElementById("crash-overlay").classList.add("hidden");
  resetDrone();
  crashing = false;
  gameOver = false;
  clock.getDelta(); // discard the idle time spent on the crash overlay
});

// ---------------------------------------------------------------------------
// Flight model
// ---------------------------------------------------------------------------

const DRONE_RADIUS = 0.75;

// The RPA always starts parked on the home helipad (position zero), not
// hovering in the air — takeoff happens via the throttle stick, like a
// real drone sitting on the ground until you lift off.
const state = {
  position: new THREE.Vector3(HOME_POSITION.x, DRONE_RADIUS, HOME_POSITION.z),
  velocity: new THREE.Vector3(0, 0, 0),
  yaw: 0, // heading, radians — free rotation, like turning a car
  pitch: 0, // nose up/down lean, radians — bounded, like a real drone
  roll: 0, // bank left/right lean, radians — bounded, like a real drone
  yawRate: 0, // current yaw angular velocity, for smoothing
  quaternion: new THREE.Quaternion(),
};

// Per-drone flight tuning, applied by applyDroneType() from DRONE_TYPES.
let MAX_TILT = THREE.MathUtils.degToRad(droneConfig.maxTiltDeg); // max lean angle
let MAX_YAW_RATE = droneConfig.maxYawRate; // rad/s
let MAX_CLIMB_RATE = droneConfig.maxClimbRate; // m/s, vertical speed at full stick
let MAX_HORIZ_SPEED = droneConfig.maxHorizSpeed; // m/s, ground speed at max lean
let VELOCITY_RESPONSE = droneConfig.velocityResponse; // how fast velocity tracks its target
let RATE_RESPONSE = droneConfig.rateResponse; // how fast pitch/roll/yaw track input

// Performance readout (Task: "ver el desempeño y performance de la
// aeronave") — battery counts down in real time from the aircraft's rated
// flight time, and range counts down from its rated distance as it
// actually flies, using each aircraft's real spec sheet numbers.
let batterySecondsLeft = droneConfig.flightMinutes * 60;
let rangeKmLeft = droneConfig.rangeKm;

function resetPerformance() {
  batterySecondsLeft = droneConfig.flightMinutes * 60;
  rangeKmLeft = droneConfig.rangeKm;
}

function applyDroneType() {
  scene.remove(drone);
  const built = buildDrone(droneConfig);
  drone = built.group;
  propellers = built.propellers;
  drone.position.copy(state.position);
  drone.quaternion.copy(state.quaternion);
  scene.add(drone);

  MAX_TILT = THREE.MathUtils.degToRad(droneConfig.maxTiltDeg);
  MAX_YAW_RATE = droneConfig.maxYawRate;
  MAX_CLIMB_RATE = droneConfig.maxClimbRate;
  MAX_HORIZ_SPEED = droneConfig.maxHorizSpeed;
  VELOCITY_RESPONSE = droneConfig.velocityResponse;
  RATE_RESPONSE = droneConfig.rateResponse;
  resetPerformance();
}

function resetDrone() {
  state.position.set(HOME_POSITION.x, DRONE_RADIUS, HOME_POSITION.z);
  state.velocity.set(0, 0, 0);
  state.yaw = 0;
  state.pitch = 0;
  state.roll = 0;
  state.yawRate = 0;
  state.quaternion.identity();
  resetPerformance();
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();

// Crash sequence: colliding with a building or a tree cuts off normal
// control entirely and drops the RPA by real gravity (unlike the velocity-
// target hover model used everywhere else) until it hits the ground, then
// hands off to the "Intenta nuevamente" overlay.
const CRASH_GRAVITY = 18; // m/s^2
const CRASH_SPIN = 2.6; // rad/s, purely visual tumble while falling

function triggerCrash() {
  if (crashing || gameOver) return;
  crashing = true;
  state.velocity.multiplyScalar(0.3);
}

function applyCrashFall(dt) {
  state.velocity.y -= CRASH_GRAVITY * dt;
  state.position.addScaledVector(state.velocity, dt);
  state.roll += CRASH_SPIN * dt;
  state.pitch += CRASH_SPIN * 0.6 * dt;
  state.quaternion.setFromEuler(new THREE.Euler(state.pitch, state.yaw, state.roll, "YXZ"));
  drone.position.copy(state.position);
  drone.quaternion.copy(state.quaternion);

  if (state.position.y <= DRONE_RADIUS) {
    state.position.y = DRONE_RADIUS;
    state.velocity.set(0, 0, 0);
    drone.position.copy(state.position);
    crashing = false;
    gameOver = true;
    document.getElementById("crash-overlay").classList.remove("hidden");
  }
}

function updatePhysics(dt) {
  if (dt <= 0) return;
  dt = Math.min(dt, 0.05);

  if (crashing) {
    applyCrashFall(dt);
    return;
  }

  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.boost ? 1.4 : 1.0;
  const levelHold = keys.has("Space") || touch.level;

  // Combine keyboard (digital) and touch joystick (analog) input into single
  // -1..1 stick values so both control schemes share the same flight code.
  const throttleInput = THREE.MathUtils.clamp(
    (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0) + touch.throttle,
    -1,
    1
  );
  let pitchInput = THREE.MathUtils.clamp(
    (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0) + touch.pitch,
    -1,
    1
  );
  let rollInput = THREE.MathUtils.clamp(
    (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0) + touch.roll,
    -1,
    1
  );

  // The touch joystick is already confined to a unit circle by handleMove(),
  // but keyboard input (e.g. ArrowUp+ArrowLeft together) can independently
  // hit ±1 on both axes at once. Clamp the *combined* lean so a diagonal
  // input can never exceed the single-axis max tilt.
  const leanMag = Math.hypot(pitchInput, rollInput);
  if (leanMag > 1) {
    pitchInput /= leanMag;
    rollInput /= leanMag;
  }

  const yawInput = THREE.MathUtils.clamp(
    (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0) + touch.yaw,
    -1,
    1
  );

  // Angle-mode flight controller: stick deflection maps to a *target lean
  // angle* (clamped to MAX_TILT), not a rotation rate — the same "angle
  // mode" a real consumer drone flies in. Centering the stick always
  // returns the drone to level, and it can never flip or tumble.
  let targetPitch = pitchInput * MAX_TILT;
  let targetRoll = rollInput * MAX_TILT;
  if (levelHold) {
    targetPitch = 0;
    targetRoll = 0;
  }

  const respo = 1 - Math.exp(-RATE_RESPONSE * dt);
  state.pitch += (targetPitch - state.pitch) * respo;
  state.roll += (targetRoll - state.roll) * respo;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -MAX_TILT, MAX_TILT);
  state.roll = THREE.MathUtils.clamp(state.roll, -MAX_TILT, MAX_TILT);

  // Yaw (turning left/right) is a free heading rotation — unlike pitch/roll
  // it isn't bounded, since spinning around its own vertical axis is normal.
  const targetYawRate = yawInput * MAX_YAW_RATE;
  state.yawRate += (targetYawRate - state.yawRate) * respo;
  state.yaw += state.yawRate * dt;

  state.quaternion.setFromEuler(new THREE.Euler(state.pitch, state.yaw, state.roll, "YXZ"));

  // Velocity-target controller (real DJI GPS/altitude-hold behavior): the
  // sticks command a *target velocity*, not a force to integrate. The
  // drone's actual velocity converges toward that target exponentially, so
  // centering a stick immediately drives the target to zero and the drone
  // brakes to a stop and holds position/altitude — no inertia, no manual
  // thrust-vs-gravity balancing.
  _up.set(0, 1, 0).applyQuaternion(state.quaternion);

  const targetClimbRate = throttleInput * MAX_CLIMB_RATE * boost;

  // Horizontal target velocity comes from the drone's current lean
  // direction (already smoothed by the angle-mode controller above), so
  // leveling out — via the right stick or the level-hold button — also
  // brings the horizontal target to zero and brakes/holds position.
  // The lean direction's horizontal magnitude naturally maxes out at
  // sin(MAX_TILT), so it's normalized against that ceiling — full stick
  // deflection reaches the drone's actual MAX_HORIZ_SPEED, independent of
  // MAX_TILT, per the requirement to raise top speed without touching the
  // max lean angle.
  const horizLean = Math.hypot(_up.x, _up.z);
  const leanCeiling = Math.sin(MAX_TILT) || 1;
  const leanFrac = THREE.MathUtils.clamp(horizLean / leanCeiling, 0, 1);
  const targetSpeed = leanFrac * MAX_HORIZ_SPEED * boost;
  const dirX = horizLean > 1e-5 ? _up.x / horizLean : 0;
  const dirZ = horizLean > 1e-5 ? _up.z / horizLean : 0;
  const targetVelX = dirX * targetSpeed;
  const targetVelZ = dirZ * targetSpeed;

  const velTrack = 1 - Math.exp(-VELOCITY_RESPONSE * dt);
  state.velocity.x += (targetVelX - state.velocity.x) * velTrack;
  state.velocity.y += (targetClimbRate - state.velocity.y) * velTrack;
  state.velocity.z += (targetVelZ - state.velocity.z) * velTrack;

  // Snap tiny residual velocity to exact zero when holding position, so the
  // drone doesn't creep instead of holding rock-still.
  if (Math.abs(targetVelX) < 1e-4 && Math.abs(state.velocity.x) < 0.01) state.velocity.x = 0;
  if (Math.abs(targetClimbRate) < 1e-4 && Math.abs(state.velocity.y) < 0.01) state.velocity.y = 0;
  if (Math.abs(targetVelZ) < 1e-4 && Math.abs(state.velocity.z) < 0.01) state.velocity.z = 0;

  state.position.addScaledVector(state.velocity, dt);

  // Performance readout: battery ticks down in real time, range ticks down
  // with distance actually flown (1 world unit = 1 meter).
  batterySecondsLeft = Math.max(0, batterySecondsLeft - dt);
  rangeKmLeft = Math.max(0, rangeKmLeft - (state.velocity.length() * dt) / 1000);

  // Ground collision
  if (state.position.y < DRONE_RADIUS) {
    state.position.y = DRONE_RADIUS;
    state.velocity.y = Math.max(0, -state.velocity.y * 0.15);
    state.velocity.x *= 0.9;
    state.velocity.z *= 0.9;
  }

  // World bounds — soft wall to keep the player near the play area.
  const bound = GROUND_SIZE / 2 - 5;
  state.position.x = THREE.MathUtils.clamp(state.position.x, -bound, bound);
  state.position.z = THREE.MathUtils.clamp(state.position.z, -bound, bound);

  // Obstacle collision: towers have a landable rooftop (same rest/support
  // behavior as the ground, just elevated), trees don't — any contact with
  // a tree, or with a tower's body below roof level, ends the flight.
  for (const obs of obstacles) {
    const dx = state.position.x - obs.position.x;
    const dz = state.position.z - obs.position.z;
    const distXZ = Math.hypot(dx, dz);
    if (distXZ >= obs.radius + DRONE_RADIUS) continue;

    if (obs.landable && state.position.y >= obs.height) {
      // Mirrors the ground check exactly (same thin threshold, same damping)
      // just elevated to roof height — only pushes back up while still
      // sinking *into* the roof, never while already resting on or climbing
      // away from it, so takeoff isn't fought by this every frame.
      const roofY = obs.height + DRONE_RADIUS;
      if (state.position.y < roofY) {
        state.position.y = roofY;
        state.velocity.y = Math.max(0, -state.velocity.y * 0.15);
        state.velocity.x *= 0.9;
        state.velocity.z *= 0.9;
      }
    } else if (state.position.y < obs.height + 0.5) {
      triggerCrash();
      break;
    }
  }

  // Power-line cable collision: each span is a sampled polyline, tested as
  // a chain of segments — any point closer than the hit radius crashes the
  // flight the same way a tree does (no landable surface).
  outer: for (const span of powerLineSpans) {
    for (let i = 0; i < span.length - 1; i++) {
      if (distPointToSegment(state.position, span[i], span[i + 1]) < POWERLINE_HIT_RADIUS + DRONE_RADIUS) {
        triggerCrash();
        break outer;
      }
    }
  }

  drone.position.copy(state.position);
  drone.quaternion.copy(state.quaternion);

  // Spin propellers proportional to commanded lift demand (throttle push or lean).
  const liftDemand = Math.max(Math.abs(throttleInput), leanMag);
  const spinSpeed = 4 + liftDemand * 40;
  propellers.forEach((p, i) => {
    p.rotation.y += spinSpeed * dt * (i % 2 === 0 ? 1 : -1);
    if (p.userData.disc) p.userData.disc.material.opacity = THREE.MathUtils.clamp((spinSpeed - 10) / 30, 0, 0.35);
  });
}

// ---------------------------------------------------------------------------
// Gate detection
// ---------------------------------------------------------------------------

function updateGates() {
  for (const gate of gates) {
    const dist = gate.mesh.position.distanceTo(state.position);
    if (!gate.passed && dist < 4.2) {
      gate.passed = true;
      gatesPassed++;
      document.getElementById("hud-gates").textContent = String(gatesPassed);
      gate.mesh.material.emissive.setHex(0x00ff66);
      setTimeout(() => placeGate(gate), 600);
    }
    gate.mesh.rotation.y += 0.12 * 0.016;
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const camOffset = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

// Cam 3 "Seguimiento Cinemático" keeps its own separately-damped look
// target (softer than the position damping), which is what gives it that
// springy, drone-mounted-camera lag instead of rigidly snapping to look
// straight at the drone every frame.
const cinematicLookTarget = new THREE.Vector3();
let cinematicLookInit = false;

// FPV gimbal tilt — purely a camera-look adjustment layered on top of the
// drone's own orientation; it never touches state.pitch/roll/yaw. Range
// matches a real DJI gimbal dial: 0° (horizonte) to 90° (cenital/nadir,
// straight down) — pushing the slider up moves toward the horizon,
// pushing it down moves toward nadir — and it holds wherever it's left,
// no spring-back.
const GIMBAL_MIN = THREE.MathUtils.degToRad(0);
const GIMBAL_MAX = THREE.MathUtils.degToRad(90);
const GIMBAL_KEY_RATE = THREE.MathUtils.degToRad(60); // deg/sec via [ and ]
let gimbalPitch = 0;

const gimbalTrackEl = document.getElementById("gimbal-track");
const gimbalKnobEl = document.getElementById("gimbal-knob");
const gimbalAngleEl = document.getElementById("gimbal-angle");

function setGimbalPitch(rad) {
  gimbalPitch = THREE.MathUtils.clamp(rad, GIMBAL_MIN, GIMBAL_MAX);
  const frac = (gimbalPitch - GIMBAL_MIN) / (GIMBAL_MAX - GIMBAL_MIN);
  gimbalKnobEl.style.top = `${frac * 100}%`;
  if (gimbalAngleEl) gimbalAngleEl.textContent = `${Math.round(THREE.MathUtils.radToDeg(gimbalPitch))}°`;
}
setGimbalPitch(gimbalPitch);

(function setupGimbalSlider() {
  let dragging = false;
  let pointerId = null;

  function fromClientY(clientY) {
    const rect = gimbalTrackEl.getBoundingClientRect();
    const frac = THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0, 1);
    setGimbalPitch(GIMBAL_MIN + frac * (GIMBAL_MAX - GIMBAL_MIN));
  }

  gimbalTrackEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    pointerId = e.pointerId;
    gimbalTrackEl.setPointerCapture(e.pointerId);
    fromClientY(e.clientY);
  });
  gimbalTrackEl.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    fromClientY(e.clientY);
  });
  const stopDrag = (e) => {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  };
  gimbalTrackEl.addEventListener("pointerup", stopDrag);
  gimbalTrackEl.addEventListener("pointercancel", stopDrag);
})();

// Camera-switch transition: capture the outgoing look orientation and
// slerp into the new mode's orientation over ~400ms, so switching cameras
// never cuts instantly — only the *direction the camera looks* needs this
// treatment, since position in every mode is already lerped
// continuously from wherever the camera currently sits.
// A real camera (unused for rendering) rather than a plain Object3D: Three.js's
// Object3D.lookAt() only aligns -Z with the target for cameras/lights — a plain
// Object3D gets the inverted (mesh-facing, +Z-toward-target) convention, which
// would point every camera mode 180° away from what it's supposed to look at.
const _camHelper = new THREE.PerspectiveCamera();
const _desiredQuat = new THREE.Quaternion();
const camTransition = { active: false, t: 0, duration: 0.4, fromQuat: new THREE.Quaternion() };

function beginCameraTransition() {
  camTransition.fromQuat.copy(camera.quaternion);
  camTransition.t = 0;
  camTransition.active = true;
}

function applyCameraLook(camPos, lookTarget, upVec, dt) {
  camera.up.copy(upVec);
  _camHelper.position.copy(camPos);
  _camHelper.up.copy(upVec);
  _camHelper.lookAt(lookTarget);
  _desiredQuat.copy(_camHelper.quaternion);

  if (camTransition.active) {
    camTransition.t += dt / camTransition.duration;
    if (camTransition.t >= 1) {
      camTransition.t = 1;
      camTransition.active = false;
    }
    const s = camTransition.t * camTransition.t * (3 - 2 * camTransition.t); // smoothstep
    camera.quaternion.slerpQuaternions(camTransition.fromQuat, _desiredQuat, s);
  } else {
    camera.quaternion.copy(_desiredQuat);
  }
}

function updateCamera(dt) {
  _fwd.set(0, 0, 1).applyQuaternion(state.quaternion);
  _up.set(0, 1, 0).applyQuaternion(state.quaternion);

  // FPV is mounted on the aircraft's own nose, so its own body/arms/props
  // would otherwise fill the frame — hide the drone mesh only in that mode,
  // never touching visibility for the 3rd-person camera modes.
  drone.visible = cameraMode !== 1;

  if (cameraMode === 1) {
    if (keys.has("BracketRight")) setGimbalPitch(gimbalPitch + GIMBAL_KEY_RATE * dt);
    if (keys.has("BracketLeft")) setGimbalPitch(gimbalPitch - GIMBAL_KEY_RATE * dt);
  }

  if (cameraMode === 0) {
    // Cam 1 — Geográfica: 3rd-person chase, behind & above, softly
    // following yaw only (keeps the horizon level).
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    camOffset.set(Math.sin(yaw) * -8, 3.2, Math.cos(yaw) * -8);
    desiredCamPos.copy(state.position).add(camOffset);
    camera.position.lerp(desiredCamPos, 1 - Math.exp(-5 * dt));
    camTarget.copy(state.position).add(new THREE.Vector3(0, 0.5, 0));
    applyCameraLook(camera.position, camTarget, worldUp, dt);
    cinematicLookInit = false;
  } else if (cameraMode === 1) {
    // Cam 2 — FPV: mounted on the drone's nose, following full drone
    // orientation, plus an independent gimbal tilt composited on top of
    // the look direction only — the drone's own attitude is untouched.
    const fpvOffset = new THREE.Vector3(0, 0.3, 0.85).applyQuaternion(state.quaternion);
    desiredCamPos.copy(state.position).add(fpvOffset);
    camera.position.lerp(desiredCamPos, 1 - Math.exp(-14 * dt));

    const gimbalQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), gimbalPitch);
    const lookDir = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(state.quaternion.clone().multiply(gimbalQuat))
      .multiplyScalar(10);
    camTarget.copy(camera.position).add(lookDir);
    applyCameraLook(camera.position, camTarget, _up, dt);
    cinematicLookInit = false;
  } else if (cameraMode === 2) {
    // Cam 3 — Seguimiento Cinemático: further & higher than Cam 1, with
    // two independently-damped smoothing layers (position + look target)
    // so it feels like a drone-mounted follow cam with soft, springy lag,
    // reacting to real drone motion rather than orbiting on its own.
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    camOffset.set(Math.sin(yaw) * -16, 7.5, Math.cos(yaw) * -16);
    desiredCamPos.copy(state.position).add(camOffset);
    camera.position.lerp(desiredCamPos, 1 - Math.exp(-1.8 * dt));

    if (!cinematicLookInit) {
      cinematicLookTarget.copy(state.position);
      cinematicLookInit = true;
    }
    cinematicLookTarget.lerp(state.position, 1 - Math.exp(-2.5 * dt));
    camTarget.copy(cinematicLookTarget).add(new THREE.Vector3(0, 0.5, 0));
    applyCameraLook(camera.position, camTarget, worldUp, dt);
  } else {
    // Cam 4 — Panorámica: a tighter, snappier 3rd-person follow than the
    // Cinemático — sits directly behind and a bit above, always keeping
    // the whole drone silhouette in frame with minimal lag, closer to how
    // a vehicle-follow camera in an open-world game tracks the player.
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    camOffset.set(Math.sin(yaw) * -13, 5.5, Math.cos(yaw) * -13);
    desiredCamPos.copy(state.position).add(camOffset);
    camera.position.lerp(desiredCamPos, 1 - Math.exp(-4 * dt));
    camTarget.copy(state.position).add(new THREE.Vector3(0, 0.8, 0));
    applyCameraLook(camera.position, camTarget, worldUp, dt);
    cinematicLookInit = false;
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const hudAlt = document.getElementById("hud-alt");
const hudSpeed = document.getElementById("hud-speed");
const hudBattery = document.getElementById("hud-battery");
const hudBatteryFill = document.getElementById("hud-battery-fill");
const hudRange = document.getElementById("hud-range");

// Attitude/heading instrument — a small flight-instrument-style readout
// (artificial horizon with a pitch ladder, plus a scrolling heading tape)
// drawn on a 2D canvas. Cheaper on mobile than animating many DOM nodes,
// and canvas trig makes the roll-rotated/pitch-shifted ladder simple.
const attitudeCanvas = document.getElementById("hud-attitude");
const attitudeCtx = attitudeCanvas.getContext("2d");
let attCssW = 260;
let attCssH = 180;

function resizeAttitudeCanvas() {
  const rect = attitudeCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  attCssW = rect.width;
  attCssH = rect.height;
  attitudeCanvas.width = Math.round(attCssW * dpr);
  attitudeCanvas.height = Math.round(attCssH * dpr);
  attitudeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resizeAttitudeCanvas);
resizeAttitudeCanvas();

const PITCH_PX_PER_DEG = 1.7;

function drawAttitude(heading) {
  const ctx = attitudeCtx;
  ctx.clearRect(0, 0, attCssW, attCssH);

  const cx = attCssW / 2;
  const dialCy = attCssH * 0.34;
  const radius = 54;

  // --- Horizon + pitch ladder, clipped to a circular dial ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, dialCy, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(cx, dialCy);
  ctx.rotate(state.roll);
  ctx.translate(0, THREE.MathUtils.radToDeg(state.pitch) * PITCH_PX_PER_DEG);

  const span = radius * 2.4;
  ctx.fillStyle = "#3f7fc4";
  ctx.fillRect(-span, -span, span * 2, span);
  ctx.fillStyle = "#5a4326";
  ctx.fillRect(-span, 0, span * 2, span);

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-span, 0);
  ctx.lineTo(span, 0);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 1.5;
  for (let d = -40; d <= 40; d += 10) {
    if (d === 0) continue;
    const y = -d * PITCH_PX_PER_DEG;
    const halfW = d % 20 === 0 ? 20 : 12;
    ctx.beginPath();
    ctx.moveTo(-halfW, y);
    ctx.lineTo(halfW, y);
    ctx.stroke();
    if (d % 20 === 0) {
      ctx.fillText(String(d), -halfW - 12, y + 3);
      ctx.fillText(String(d), halfW + 12, y + 3);
    }
  }

  ctx.restore();

  // Dial bezel + fixed drone-reference marker (stays level, doesn't rotate).
  ctx.beginPath();
  ctx.arc(cx, dialCy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(234,252,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.strokeStyle = "#33d1ff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx - 22, dialCy);
  ctx.lineTo(cx - 8, dialCy);
  ctx.moveTo(cx + 8, dialCy);
  ctx.lineTo(cx + 22, dialCy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, dialCy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "#33d1ff";
  ctx.fill();

  // --- Heading tape: scrolling compass ruler below the dial ---
  const tapeY = attCssH - 38;
  const tapeHalfWidth = attCssW / 2 - 10;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - tapeHalfWidth, tapeY - 14, tapeHalfWidth * 2, 30);
  ctx.clip();

  const pxPerDeg = 2.6;
  ctx.strokeStyle = "rgba(234,252,255,0.4)";
  ctx.fillStyle = "rgba(234,252,255,0.75)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 1;
  const cardinals = { 0: "N", 90: "E", 180: "S", 270: "O" };
  const start = Math.floor((heading - 70) / 15) * 15;
  for (let deg = start; deg <= heading + 70; deg += 15) {
    const norm = ((deg % 360) + 360) % 360;
    const x = cx + (deg - heading) * pxPerDeg;
    const isCardinal = norm % 90 === 0;
    ctx.beginPath();
    ctx.moveTo(x, tapeY);
    ctx.lineTo(x, tapeY - (isCardinal ? 10 : 5));
    ctx.stroke();
    if (isCardinal) {
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(cardinals[norm], x, tapeY + 12);
      ctx.font = "10px sans-serif";
    } else if (norm % 45 === 0) {
      ctx.fillText(String(norm), x, tapeY + 11);
    }
  }
  ctx.restore();

  ctx.fillStyle = "#33d1ff";
  ctx.beginPath();
  ctx.moveTo(cx, tapeY - 18);
  ctx.lineTo(cx - 5, tapeY - 10);
  ctx.lineTo(cx + 5, tapeY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#eafcff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(heading)}°`, cx, attCssH - 4);
}

function updateHud() {
  hudAlt.textContent = `${state.position.y.toFixed(1)} m`;
  hudSpeed.textContent = `${state.velocity.length().toFixed(1)} m/s`;

  const batteryMin = Math.floor(batterySecondsLeft / 60);
  const batterySec = Math.floor(batterySecondsLeft % 60);
  const batteryPct = Math.round((batterySecondsLeft / (droneConfig.flightMinutes * 60)) * 100);
  hudBattery.textContent = `${batteryPct}% · ${String(batteryMin).padStart(2, "0")}:${String(batterySec).padStart(2, "0")}`;
  hudBatteryFill.setAttribute("height", (6 * batteryPct) / 100);
  hudBatteryFill.setAttribute("y", 9 + 6 * (1 - batteryPct / 100));
  hudRange.textContent = `${rangeKmLeft.toFixed(1)} km`;

  _fwd.set(0, 0, 1).applyQuaternion(state.quaternion);
  let heading = (Math.atan2(_fwd.x, _fwd.z) * 180) / Math.PI;
  if (heading < 0) heading += 360;

  drawAttitude(heading);
}

// ---------------------------------------------------------------------------
// Stick tutorial — interactive DJI Mode-2 explainer, opened from the start
// screen. Pure DOM/CSS/SVG: every "animation" is a CSS class toggle, driven
// on demand by taps (or by the idle auto-demo loop below), never by the
// render loop — there is no continuous state to draw here, unlike the live
// attitude instrument above.
// ---------------------------------------------------------------------------

const STICK_DEMOS = {
  throttle_up: {
    stick: "left",
    dir: "up",
    name: "Gas (Throttle)",
    desc: "Aumenta el empuje total de los motores: el dron asciende y gana altitud.",
  },
  throttle_down: {
    stick: "left",
    dir: "down",
    name: "Gas (Throttle)",
    desc: "Reduce el empuje total: el dron desciende de forma controlada. Mantenido, puede aterrizar.",
  },
  yaw_left: {
    stick: "left",
    dir: "left",
    name: "Guiñada (Yaw)",
    desc: "El dron gira sobre su propio eje vertical en sentido antihorario, sin desplazarse lateralmente.",
  },
  yaw_right: {
    stick: "left",
    dir: "right",
    name: "Guiñada (Yaw)",
    desc: "El dron gira sobre su propio eje vertical en sentido horario, sin desplazarse lateralmente.",
  },
  pitch_up: {
    stick: "right",
    dir: "up",
    name: "Cabeceo (Pitch)",
    desc: "El morro se inclina hacia adelante: el dron avanza sobre su eje longitudinal.",
  },
  pitch_down: {
    stick: "right",
    dir: "down",
    name: "Cabeceo (Pitch)",
    desc: "El morro se inclina hacia atrás: el dron retrocede de forma controlada.",
  },
  roll_left: {
    stick: "right",
    dir: "left",
    name: "Alabeo (Roll)",
    desc: "El dron se inclina y se desplaza hacia la izquierda, manteniendo su orientación si no hay otra entrada.",
  },
  roll_right: {
    stick: "right",
    dir: "right",
    name: "Alabeo (Roll)",
    desc: "El dron se inclina y se desplaza hacia la derecha, manteniendo su orientación si no hay otra entrada.",
  },
};

const AUTO_DEMO_ORDER = [
  "throttle_up",
  "throttle_down",
  "yaw_left",
  "yaw_right",
  "pitch_up",
  "pitch_down",
  "roll_left",
  "roll_right",
];

const tutorialMoveName = document.getElementById("tutorial-move-name");
const tutorialMoveDesc = document.getElementById("tutorial-move-desc");
const droneTopdown = document.getElementById("drone-topdown");
const droneTopdownGroup = document.getElementById("drone-topdown-group");
const capLeft = document.getElementById("cap-left");
const capRight = document.getElementById("cap-right");
const arrowBtnEls = document.querySelectorAll(".arrow-btn");

let autoDemoTimer = null;

function playStickDemo(key) {
  const demo = STICK_DEMOS[key];
  if (!demo) return;

  const cap = demo.stick === "left" ? capLeft : capRight;
  const otherCap = demo.stick === "left" ? capRight : capLeft;

  cap.classList.remove("pos-up", "pos-down", "pos-left", "pos-right");
  cap.classList.add(`pos-${demo.dir}`, "highlight");
  otherCap.classList.remove("pos-up", "pos-down", "pos-left", "pos-right", "highlight");

  arrowBtnEls.forEach((el) => {
    const active = el.dataset.stick === demo.stick && el.dataset.dir === demo.dir;
    el.classList.toggle("active", active);
  });

  droneTopdown.classList.remove("demo-throttle-up", "demo-throttle-down");
  if (key === "throttle_up") droneTopdown.classList.add("demo-throttle-up");
  if (key === "throttle_down") droneTopdown.classList.add("demo-throttle-down");

  droneTopdownGroup.classList.remove(
    "demo-yaw-left",
    "demo-yaw-right",
    "demo-pitch-up",
    "demo-pitch-down",
    "demo-roll-left",
    "demo-roll-right"
  );
  if (key === "yaw_left") droneTopdownGroup.classList.add("demo-yaw-left");
  if (key === "yaw_right") droneTopdownGroup.classList.add("demo-yaw-right");
  if (key === "pitch_up") droneTopdownGroup.classList.add("demo-pitch-up");
  if (key === "pitch_down") droneTopdownGroup.classList.add("demo-pitch-down");
  if (key === "roll_left") droneTopdownGroup.classList.add("demo-roll-left");
  if (key === "roll_right") droneTopdownGroup.classList.add("demo-roll-right");

  tutorialMoveName.textContent = demo.name;
  tutorialMoveDesc.textContent = demo.desc;
}

function stopAutoDemo() {
  if (autoDemoTimer) {
    clearInterval(autoDemoTimer);
    autoDemoTimer = null;
  }
}

function startAutoDemo() {
  stopAutoDemo();
  let i = 0;
  playStickDemo(AUTO_DEMO_ORDER[0]);
  autoDemoTimer = setInterval(() => {
    i = (i + 1) % AUTO_DEMO_ORDER.length;
    playStickDemo(AUTO_DEMO_ORDER[i]);
  }, 1800);
}

function openTutorial() {
  document.getElementById("tutorial-screen").classList.remove("hidden");
  startAutoDemo();
}

function closeTutorial() {
  document.getElementById("tutorial-screen").classList.add("hidden");
  stopAutoDemo();
}

arrowBtnEls.forEach((el) => {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    stopAutoDemo();
    playStickDemo(el.dataset.key);
  });
});

document.getElementById("tutorial-btn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  openTutorial();
});
document.getElementById("tutorial-close").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  closeTutorial();
});
document.getElementById("tutorial-screen").addEventListener("pointerdown", (e) => {
  if (e.target.id === "tutorial-screen") closeTutorial();
});

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (started && !gameOver) {
    updatePhysics(dt);
    updateGates();
  }
  updateCamera(started ? dt : 0);
  updateHud();

  renderer.render(scene, camera);
}

// Idle camera before start
camera.position.set(0, 10, -22);
camera.lookAt(0, 4, 0);

animate();
