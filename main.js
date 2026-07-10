// Three.js is loaded globally via vendor/three.min.js (see index.html).

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 60, 420);

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

const groundMat = new THREE.MeshStandardMaterial({ color: 0x4c8a3c, roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 1, 1), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(GROUND_SIZE, 100, 0x2a5522, 0x2a5522);
grid.material.opacity = 0.25;
grid.material.transparent = true;
scene.add(grid);

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// Scattered low-poly trees/pillars for a sense of scale & obstacles.
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: 0.9 });
const obstacles = []; // { position: Vector3, radius }

function addTree(x, z) {
  const group = new THREE.Group();
  const trunkH = randRange(3, 5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, trunkH, 6), trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const leaves = new THREE.Mesh(new THREE.ConeGeometry(randRange(2, 3.2), randRange(4, 6), 8), leavesMat);
  leaves.position.y = trunkH + 2;
  leaves.castShadow = true;
  group.add(leaves);

  group.position.set(x, 0, z);
  scene.add(group);
  obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: 1.6, height: trunkH + 5 });
}

for (let i = 0; i < 140; i++) {
  const x = randRange(-450, 450);
  const z = randRange(-450, 450);
  if (Math.hypot(x, z) < 25) continue; // keep spawn area clear
  addTree(x, z);
}

// A handful of tower blocks to fly around / near.
const towerMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b0, roughness: 0.7 });
for (let i = 0; i < 8; i++) {
  const w = randRange(6, 12);
  const h = randRange(20, 55);
  const x = randRange(-350, 350);
  const z = randRange(-350, 350);
  if (Math.hypot(x, z) < 60) continue;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
  tower.position.set(x, h / 2, z);
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);
  obstacles.push({ position: new THREE.Vector3(x, 0, z), radius: w * 0.75, height: h });
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
// Drone model
// ---------------------------------------------------------------------------

const drone = new THREE.Group();

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4, metalness: 0.4 });
const armMat = new THREE.MeshStandardMaterial({ color: 0x3d4756, roughness: 0.5, metalness: 0.3 });
const propMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.3, metalness: 0.2 });
const ledMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 1.5 });
const ledFrontMat = new THREE.MeshStandardMaterial({ color: 0x33ff77, emissive: 0x22ff55, emissiveIntensity: 1.5 });

const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 1.1), bodyMat);
body.castShadow = true;
drone.add(body);

const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), bodyMat);
dome.position.set(0, 0.16, 0.35);
drone.add(dome);

const armOffsets = [
  { x: 0.7, z: 0.7, front: true },
  { x: -0.7, z: 0.7, front: true },
  { x: 0.7, z: -0.7, front: false },
  { x: -0.7, z: -0.7, front: false },
];

const propellers = [];

armOffsets.forEach(({ x, z, front }) => {
  const armLen = Math.hypot(x, z);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, armLen), armMat);
  arm.position.set(x / 2, 0, z / 2);
  arm.rotation.y = Math.atan2(x, z);
  arm.castShadow = true;
  drone.add(arm);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10), bodyMat);
  motor.position.set(x, 0.05, z);
  drone.add(motor);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), front ? ledFrontMat : ledMat);
  led.position.set(x, 0.05, z + (front ? 0.12 : -0.12));
  drone.add(led);

  const propGroup = new THREE.Group();
  propGroup.position.set(x, 0.15, z);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.08), propMat);
  blade.castShadow = true;
  const blade2 = blade.clone();
  blade2.rotation.y = Math.PI / 2;
  propGroup.add(blade, blade2);
  drone.add(propGroup);
  propellers.push(propGroup);
});

drone.position.set(0, 6, 0);
scene.add(drone);

// A tiny light attached to the drone so it's visible at night / in shadow.
const droneLight = new THREE.PointLight(0xffffff, 0.6, 8);
droneLight.position.set(0, 0.3, 0);
drone.add(droneLight);

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

const keys = new Set();
let cameraMode = 0; // 0 = chase, 1 = fpv, 2 = orbit
const cameraModes = ["Persecución", "FPV", "Orbital"];
let started = false;

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
}

// Touch controls: virtual joysticks (left = throttle/yaw, right = pitch/roll)
// plus buttons for camera, auto-level, boost and reset. Shown automatically
// on touch-capable devices (see isTouchDevice below).
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  document.body.classList.add("touch-device");
  document.getElementById("start-keyboard-list").classList.add("hidden");
  document.getElementById("start-touch-list").classList.remove("hidden");
}

const touch = { throttle: 0, yaw: 0, pitch: 0, roll: 0, boost: false, level: false };

function setupJoystick(baseEl, knobEl, onChange) {
  const jState = { active: false, pointerId: null };

  function setKnob(x, y) {
    knobEl.style.transform = `translate(${x}px, ${y}px)`;
  }

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
    onChange(dx / r, -dy / r); // invert Y so "up" is positive
  }

  function reset() {
    jState.active = false;
    jState.pointerId = null;
    setKnob(0, 0);
    onChange(0, 0);
  }

  baseEl.addEventListener("pointerdown", (e) => {
    jState.active = true;
    jState.pointerId = e.pointerId;
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
  touch.roll = -x;
  touch.pitch = y;
});

function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.classList.add("active");
    onDown();
  });
  const release = () => {
    el.classList.remove("active");
    onUp();
  };
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
}

bindHoldButton(
  "btn-boost",
  () => (touch.boost = true),
  () => (touch.boost = false)
);
bindHoldButton(
  "btn-level",
  () => (touch.level = true),
  () => (touch.level = false)
);
document.getElementById("btn-camera").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) cycleCamera();
});
document.getElementById("btn-reset").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (started) resetDrone();
});

document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").classList.add("hidden");
  started = true;
  clock.getDelta(); // discard the idle time spent on the start screen
});

// ---------------------------------------------------------------------------
// Flight model
// ---------------------------------------------------------------------------

const state = {
  position: new THREE.Vector3(0, 6, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  quaternion: new THREE.Quaternion(),
  angVel: { pitch: 0, roll: 0, yaw: 0 }, // local rad/s
  throttle: 0.55, // 0..1, 0.5 roughly hovers
};

const DRONE_RADIUS = 0.75;
const GRAVITY = 9.81;
const MAX_THRUST_ACCEL = 22; // m/s^2 at full throttle
const LINEAR_DRAG = 0.55;
const ANGULAR_DAMPING = 6.0;
const MAX_RATE = 2.6; // rad/s max pitch/roll/yaw rate
const RATE_RESPONSE = 7.0; // how fast rates track input

function resetDrone() {
  state.position.set(0, 6, 0);
  state.velocity.set(0, 0, 0);
  state.quaternion.identity();
  state.angVel.pitch = 0;
  state.angVel.roll = 0;
  state.angVel.yaw = 0;
  state.throttle = 0.55;
}

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _thrust = new THREE.Vector3();
const _dragForce = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _euler = new THREE.Euler();

function updatePhysics(dt) {
  if (dt <= 0) return;
  dt = Math.min(dt, 0.05);

  const boost = keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.boost ? 1.4 : 1.0;
  const levelHold = keys.has("Space") || touch.level;

  // Combine keyboard (digital) and touch joystick (analog) input into single
  // -1..1 stick values so both control schemes share the same flight code.
  const throttleInput = THREE.MathUtils.clamp(
    (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0) + touch.throttle,
    -1,
    1
  );
  const pitchInput = THREE.MathUtils.clamp(
    (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0) + touch.pitch,
    -1,
    1
  );
  const rollInput = THREE.MathUtils.clamp(
    (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0) + touch.roll,
    -1,
    1
  );
  const yawInput = THREE.MathUtils.clamp(
    (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0) + touch.yaw,
    -1,
    1
  );

  // Throttle
  const throttleRate = 0.6; // per second
  state.throttle += throttleInput * throttleRate * dt;
  state.throttle = THREE.MathUtils.clamp(state.throttle, 0, 1);

  // Desired body rates from input
  let targetPitch = pitchInput * MAX_RATE;
  let targetRoll = rollInput * MAX_RATE;
  let targetYaw = yawInput * MAX_RATE * 0.6;

  if (levelHold) {
    // Auto-level: bleed off pitch/roll rates and let stabilization pull us flat.
    targetPitch = 0;
    targetRoll = 0;
  }

  // Smoothly chase the target rates (simulates flight-controller response).
  const respo = 1 - Math.exp(-RATE_RESPONSE * dt);
  state.angVel.pitch += (targetPitch - state.angVel.pitch) * respo;
  state.angVel.roll += (targetRoll - state.angVel.roll) * respo;
  state.angVel.yaw += (targetYaw - state.angVel.yaw) * respo;

  // Extra self-leveling torque toward flat orientation when level-hold is active.
  if (levelHold) {
    _euler.setFromQuaternion(state.quaternion, "YXZ");
    state.angVel.pitch += -_euler.x * 4 * dt;
    state.angVel.roll += -_euler.z * 4 * dt;
  }

  // Integrate orientation using local angular velocity (pitch=X, yaw=Y, roll=Z).
  _deltaQuat.setFromEuler(
    new THREE.Euler(state.angVel.pitch * dt, state.angVel.yaw * dt, state.angVel.roll * dt, "YXZ")
  );
  state.quaternion.multiply(_deltaQuat);
  state.quaternion.normalize();

  // Thrust along the drone's local up axis.
  _up.set(0, 1, 0).applyQuaternion(state.quaternion);
  const thrustAccel = MAX_THRUST_ACCEL * state.throttle * boost;
  _thrust.copy(_up).multiplyScalar(thrustAccel);

  // Gravity
  const gravityAccel = -GRAVITY;

  // Aerodynamic drag opposing velocity (simple quadratic-ish drag).
  _dragForce.copy(state.velocity).multiplyScalar(-LINEAR_DRAG * state.velocity.length());

  state.velocity.x += (_thrust.x + _dragForce.x) * dt;
  state.velocity.y += (_thrust.y + gravityAccel + _dragForce.y) * dt;
  state.velocity.z += (_thrust.z + _dragForce.z) * dt;

  // Angular damping keeps things from spinning forever once input stops.
  state.angVel.pitch *= 1 - Math.min(1, ANGULAR_DAMPING * dt * 0.15);
  state.angVel.roll *= 1 - Math.min(1, ANGULAR_DAMPING * dt * 0.15);

  state.position.addScaledVector(state.velocity, dt);

  // Ground collision
  if (state.position.y < DRONE_RADIUS) {
    state.position.y = DRONE_RADIUS;
    state.velocity.y = Math.max(0, -state.velocity.y * 0.15);
    state.velocity.x *= 0.9;
    state.velocity.z *= 0.9;
    state.angVel.pitch *= 0.5;
    state.angVel.roll *= 0.5;
  }

  // World bounds — soft wall to keep the player near the play area.
  const bound = GROUND_SIZE / 2 - 5;
  state.position.x = THREE.MathUtils.clamp(state.position.x, -bound, bound);
  state.position.z = THREE.MathUtils.clamp(state.position.z, -bound, bound);

  // Simple obstacle collision (cylinders): push the drone out & kill velocity into it.
  for (const obs of obstacles) {
    const dx = state.position.x - obs.position.x;
    const dz = state.position.z - obs.position.z;
    const distXZ = Math.hypot(dx, dz);
    const minDist = obs.radius + DRONE_RADIUS;
    if (distXZ < minDist && state.position.y < obs.height + 1) {
      const push = (minDist - distXZ) || 0.001;
      const nx = dx / (distXZ || 1);
      const nz = dz / (distXZ || 1);
      state.position.x += nx * push;
      state.position.z += nz * push;
      state.velocity.x *= 0.3;
      state.velocity.z *= 0.3;
    }
  }

  drone.position.copy(state.position);
  drone.quaternion.copy(state.quaternion);

  // Spin propellers proportional to throttle.
  const spinSpeed = 4 + state.throttle * 40;
  propellers.forEach((p, i) => {
    p.rotation.y += spinSpeed * dt * (i % 2 === 0 ? 1 : -1);
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
    gate.mesh.rotation.y += 0.4 * 0.016;
  }
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const camOffset = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desiredCamPos = new THREE.Vector3();
let orbitAngle = 0;

function updateCamera(dt) {
  _fwd.set(0, 0, 1).applyQuaternion(state.quaternion);
  _up.set(0, 1, 0).applyQuaternion(state.quaternion);

  if (cameraMode === 0) {
    // Chase camera: behind & above, softly following yaw only (keeps horizon level).
    const yaw = Math.atan2(_fwd.x, _fwd.z);
    camOffset.set(Math.sin(yaw) * -8, 3.2, Math.cos(yaw) * -8);
    desiredCamPos.copy(state.position).add(camOffset);
    const lerpAmt = 1 - Math.exp(-5 * dt);
    camera.position.lerp(desiredCamPos, lerpAmt);
    camTarget.copy(state.position).add(new THREE.Vector3(0, 0.5, 0));
    camera.lookAt(camTarget);
  } else if (cameraMode === 1) {
    // FPV: mounted on the drone's nose, following full orientation.
    const fpvOffset = new THREE.Vector3(0, 0.3, 0.85).applyQuaternion(state.quaternion);
    camera.position.copy(state.position).add(fpvOffset);
    camTarget.copy(state.position).add(_fwd.clone().multiplyScalar(10)).add(new THREE.Vector3(0, 0.1, 0));
    camera.up.copy(_up);
    camera.lookAt(camTarget);
  } else {
    // Orbital: slow rotating camera around the drone for a cinematic view.
    orbitAngle += dt * 0.25;
    const r = 14;
    desiredCamPos.set(
      state.position.x + Math.sin(orbitAngle) * r,
      state.position.y + 5,
      state.position.z + Math.cos(orbitAngle) * r
    );
    camera.position.lerp(desiredCamPos, 1 - Math.exp(-3 * dt));
    camera.up.set(0, 1, 0);
    camera.lookAt(state.position);
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

const hudAlt = document.getElementById("hud-alt");
const hudSpeed = document.getElementById("hud-speed");
const hudHeading = document.getElementById("hud-heading");
const throttleFill = document.getElementById("throttle-bar-fill");
const throttleValue = document.getElementById("throttle-value");

function updateHud() {
  hudAlt.textContent = `${state.position.y.toFixed(1)} m`;
  hudSpeed.textContent = `${state.velocity.length().toFixed(1)} m/s`;

  _fwd.set(0, 0, 1).applyQuaternion(state.quaternion);
  let heading = (Math.atan2(_fwd.x, _fwd.z) * 180) / Math.PI;
  if (heading < 0) heading += 360;
  hudHeading.textContent = `${heading.toFixed(0)}°`;

  const pct = Math.round(state.throttle * 100);
  throttleFill.style.height = `${pct}%`;
  throttleValue.textContent = `${pct}%`;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (started) {
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
