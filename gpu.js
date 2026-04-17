// ─────────────────────────────────────────────────────────
// RTX 5090 — procedural "exploded" GPU built from Three.js primitives.
// Drives off a global scroll value (window.__scroll, 0..1) set by app.js.
// ─────────────────────────────────────────────────────────
import * as THREE from "three";

const canvas = document.getElementById("gpu-canvas");

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050506, 8, 22);

// Theme hook — app.js calls this when user toggles theme
window.__gpuTheme = function (isLight) {
  scene.fog.color.setHex(isLight ? 0xe4e9dc : 0x050506);
  if (pMat) {
    pMat.opacity = isLight ? 0.55 : 0.6;
    pMat.color.setHex(isLight ? 0x2d8d00 : 0x76ff03);
  }
  if (ring && ring.material) ring.material.color.setHex(isLight ? 0x4fc200 : 0x76ff03);
  if (ring2 && ring2.material) ring2.material.color.setHex(isLight ? 0x008fa8 : 0x00e5ff);
  // Slightly lift ambient so parts aren't too dark on light bg
  scene.children.forEach(c => {
    if (c.isAmbientLight) c.intensity = isLight ? 0.9 : 0.55;
  });
};

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0.5, 8);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ═══ Lights ═══
scene.add(new THREE.AmbientLight(0x404858, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(4, 6, 6);
scene.add(key);

const rimNeon = new THREE.PointLight(0x76ff03, 5.5, 16, 2);
rimNeon.position.set(-3.5, 1.5, -2);
scene.add(rimNeon);

const rimCyan = new THREE.PointLight(0x00e5ff, 3.2, 14, 2);
rimCyan.position.set(3.5, -1.5, 2.5);
scene.add(rimCyan);

const fill = new THREE.PointLight(0xb14bff, 1.4, 12, 2);
fill.position.set(0, -3, 4);
scene.add(fill);

// ═══ Materials ═══
const matShroud = new THREE.MeshStandardMaterial({
  color: 0x0c0d0f, metalness: 0.92, roughness: 0.28,
});
const matAlu = new THREE.MeshStandardMaterial({
  color: 0x1a1c20, metalness: 0.95, roughness: 0.22,
});
const matFin = new THREE.MeshStandardMaterial({
  color: 0x222428, metalness: 0.9, roughness: 0.35,
});
const matPCB = new THREE.MeshStandardMaterial({
  color: 0x061a04, metalness: 0.2, roughness: 0.7,
});
const matChip = new THREE.MeshStandardMaterial({
  color: 0x0b0b0d, metalness: 0.7, roughness: 0.28,
});
const matDie = new THREE.MeshStandardMaterial({
  color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 1.4,
  metalness: 0.4, roughness: 0.3,
});
const matVRAM = new THREE.MeshStandardMaterial({
  color: 0x12140f, metalness: 0.6, roughness: 0.45,
});
const matFan = new THREE.MeshStandardMaterial({
  color: 0x18181a, metalness: 0.7, roughness: 0.35,
});
const matAccent = new THREE.MeshStandardMaterial({
  color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 1.8,
  metalness: 0.5, roughness: 0.4,
});
const matAccentCyan = new THREE.MeshStandardMaterial({
  color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4,
  metalness: 0.5, roughness: 0.4,
});

// ═══ Root group ═══
const gpu = new THREE.Group();
scene.add(gpu);

// ─── PCB (the green board) ───
const pcb = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 0.12, 1.4),
  matPCB
);
pcb.position.y = -0.55;
gpu.add(pcb);

// PCB traces accent
const trace = new THREE.Mesh(
  new THREE.BoxGeometry(3.8, 0.002, 1.2),
  new THREE.MeshStandardMaterial({ color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 0.4, metalness: 0.3, roughness: 0.6 })
);
trace.position.y = -0.488;
pcb.add(trace);

// ─── GPU die (center chip) ───
const chipBase = new THREE.Mesh(
  new THREE.BoxGeometry(1.4, 0.1, 1.4),
  matChip
);
chipBase.position.y = -0.42;
gpu.add(chipBase);

const die = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.08, 0.9),
  matDie
);
die.position.y = -0.36;
gpu.add(die);

// Glowing CUDA grid on the die top
const gridTex = makeGridTexture();
const dieTop = new THREE.Mesh(
  new THREE.PlaneGeometry(0.9, 0.9),
  new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, opacity: 0.9 })
);
dieTop.rotation.x = -Math.PI / 2;
dieTop.position.y = -0.315;
gpu.add(dieTop);

// ─── VRAM modules around the die (12 chips — GDDR7) ───
const vramGroup = new THREE.Group();
const vramPositions = [
  [-1.35, 0, -0.45], [-1.35, 0,  0.45],
  [-1.1,  0, -0.45], [-1.1,  0,  0.45],
  [ 1.1,  0, -0.45], [ 1.1,  0,  0.45],
  [ 1.35, 0, -0.45], [ 1.35, 0,  0.45],
  [ 0,    0, -0.6 ], [ 0,    0,  0.6 ],
  [-0.6,  0, -0.6 ], [ 0.6,  0,  0.6 ],
];
vramPositions.forEach(([x, y, z]) => {
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.22), matVRAM);
  v.position.set(x, -0.4, z);
  // tiny pin-pad underneath
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.01, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x2a2a22, metalness: 0.6, roughness: 0.5 })
  );
  pad.position.y = -0.045;
  v.add(pad);
  vramGroup.add(v);
});
gpu.add(vramGroup);

// ─── PCIe gold fingers (connector) ───
const goldMat = new THREE.MeshStandardMaterial({
  color: 0xc59b3a, metalness: 0.95, roughness: 0.35,
  emissive: 0x2a1d00, emissiveIntensity: 0.2,
});
const fingersHolder = new THREE.Group();
for (let i = 0; i < 36; i++) {
  const finger = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.005, 0.2),
    goldMat
  );
  finger.position.set(-1.6 + i * 0.09, -0.612, 0);
  fingersHolder.add(finger);
}
gpu.add(fingersHolder);

// ─── Solder-trace pattern on PCB (decorative curves) ───
const traceMat = new THREE.MeshBasicMaterial({ color: 0x5ce000, transparent: true, opacity: 0.55 });
for (let i = 0; i < 14; i++) {
  const t = new THREE.Mesh(
    new THREE.BoxGeometry(1.8 + Math.random()*0.8, 0.002, 0.014),
    traceMat
  );
  t.position.set(-0.3 + (Math.random()-0.5)*0.8, -0.488, -0.55 + i*0.08);
  pcb.add(t);
}

// ─── RGB LED strip along the shroud edge ───
const ledStrip = new THREE.Mesh(
  new THREE.BoxGeometry(3.8, 0.03, 0.04),
  new THREE.MeshStandardMaterial({
    color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 2.4,
    metalness: 0.2, roughness: 0.3,
  })
);
ledStrip.position.set(0, 0.76, 0.78);
gpu.add(ledStrip);

const ledStripBack = ledStrip.clone();
ledStripBack.position.z = -0.78;
gpu.add(ledStripBack);

// ─── GeForce RTX nameplate glow (side) ───
const nameplate = new THREE.Mesh(
  new THREE.PlaneGeometry(0.9, 0.12),
  new THREE.MeshBasicMaterial({
    map: makeTextTexture("GEFORCE RTX"),
    transparent: true,
  })
);
nameplate.position.set(0, 0.82, 0.76);
nameplate.rotation.x = -0.02;
gpu.add(nameplate);

// ─── Screws at 4 corners of backplate ───
const screwMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.95, roughness: 0.25 });
[[-2.0,-0.6],[2.0,-0.6],[-2.0,0.6],[2.0,0.6]].forEach(([x,z]) => {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.02,16), screwMat);
  s.position.set(x, -0.615, z);
  pcb.add(s);
});

// ─── Heatsink fin stack ───
const finGroup = new THREE.Group();
const FIN_COUNT = 22;
for (let i = 0; i < FIN_COUNT; i++) {
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.9, 0.02),
    matFin
  );
  fin.position.set(0, 0.25, -0.55 + (i / (FIN_COUNT - 1)) * 1.1);
  finGroup.add(fin);
}
gpu.add(finGroup);

// heat pipes (copper tubes)
const heatPipeMat = new THREE.MeshStandardMaterial({
  color: 0x9e5a2a, metalness: 0.9, roughness: 0.35,
});
for (let i = -1; i <= 1; i++) {
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 3.4, 24),
    heatPipeMat
  );
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0, 0.08 + i * 0.12, 0);
  finGroup.add(pipe);
}

// ─── Shroud (top cover shell) ───
const shroud = new THREE.Group();

const shell = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 0.18, 1.5),
  matShroud
);
shell.position.y = 0.82;
shroud.add(shell);

// angled cutouts along the shroud
for (let i = -1; i <= 1; i++) {
  const cut = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.01, 0.04),
    matAccent
  );
  cut.position.set(i * 1.1, 0.92, -0.5);
  cut.rotation.y = 0.2;
  shroud.add(cut);
}

// RTX nameplate strip
const plate = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.02, 0.14),
  matAccent
);
plate.position.set(-1.3, 0.93, 0.55);
shroud.add(plate);

gpu.add(shroud);

// ─── Twin fans ───
const fans = new THREE.Group();
function makeFan(x) {
  const g = new THREE.Group();
  // ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.035, 16, 48),
    matAlu
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  // hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.1, 32),
    matFan
  );
  g.add(hub);

  // hub accent
  const hubAccent = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.105, 32),
    matAccentCyan
  );
  hubAccent.scale.set(0.6, 0.2, 0.6);
  hubAccent.position.y = 0.05;
  g.add(hubAccent);

  // 9 blades
  const blades = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.015, 0.11),
      matFan
    );
    blade.position.x = 0.28;
    blade.rotation.y = 0.35;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.y = (i / 9) * Math.PI * 2;
    blades.add(arm);
  }
  g.add(blades);
  g.userData.blades = blades;

  g.position.set(x, 0.6, 0);
  return g;
}
const fanL = makeFan(-1.15);
const fanR = makeFan(1.15);
fans.add(fanL, fanR);
gpu.add(fans);

// ─── Backplate ───
const backplate = new THREE.Mesh(
  new THREE.BoxGeometry(4.2, 1.4, 0.04),
  matAlu
);
backplate.position.set(0, 0.2, -0.78);
backplate.rotation.x = -Math.PI / 2;
backplate.position.set(0, -0.7, 0);
gpu.add(backplate);

// ─── IO bracket ───
const bracket = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 1.6, 1.5),
  matAlu
);
bracket.position.set(-2.15, 0.1, 0);
gpu.add(bracket);

// DisplayPorts on bracket
for (let i = 0; i < 4; i++) {
  const port = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.12, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.5, roughness: 0.8 })
  );
  port.position.set(-2.12, 0.5 - i * 0.3, 0);
  gpu.add(port);
}

// ─── Power connector ───
const power = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.18, 0.28),
  matChip
);
power.position.set(1.5, 0.8, 0);
gpu.add(power);

// ═══ Ambient particle field (floating tech specks) ═══
const particleCount = 380;
const pGeom = new THREE.BufferGeometry();
const pPos = new Float32Array(particleCount * 3);
const pSpeed = new Float32Array(particleCount);
for (let i = 0; i < particleCount; i++) {
  pPos[i*3    ] = (Math.random() - 0.5) * 14;
  pPos[i*3 + 1] = (Math.random() - 0.5) * 8;
  pPos[i*3 + 2] = (Math.random() - 0.5) * 8 - 2;
  pSpeed[i] = 0.3 + Math.random() * 0.7;
}
pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({
  color: 0x76ff03, size: 0.025, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const particles = new THREE.Points(pGeom, pMat);
scene.add(particles);

// ═══ Energy ring around GPU (rotating torus) ═══
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.2, 0.008, 8, 128),
  new THREE.MeshBasicMaterial({
    color: 0x76ff03, transparent: true, opacity: 0.35,
  })
);
ring.rotation.x = Math.PI / 2;
scene.add(ring);

const ring2 = new THREE.Mesh(
  new THREE.TorusGeometry(3.6, 0.005, 6, 96),
  new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.22,
  })
);
scene.add(ring2);

// ═══ Wireframe overlay (reveals in later steps) ═══
const wireMat = new THREE.LineBasicMaterial({
  color: 0x76ff03, transparent: true, opacity: 0
});
const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(4.4, 1.9, 1.8));
const wire = new THREE.LineSegments(wireGeo, wireMat);
gpu.add(wire);

// ═══ Origin offsets — remember starting positions for "assemble/explode" ═══
const assembly = [
  { node: shroud,      out: new THREE.Vector3(0, 2.4, 0) },
  { node: finGroup,    out: new THREE.Vector3(0, 1.2, 0) },
  { node: fans,        out: new THREE.Vector3(0, 3.0, 0) },
  { node: pcb,         out: new THREE.Vector3(0, -1.8, 0) },
  { node: chipBase,    out: new THREE.Vector3(0, -0.6, 0) },
  { node: die,         out: new THREE.Vector3(0, 0.3, 0) },
  { node: dieTop,      out: new THREE.Vector3(0, 0.55, 0) },
  { node: vramGroup,   out: new THREE.Vector3(0, -1.2, 0) },
  { node: backplate,   out: new THREE.Vector3(0, -2.6, 0) },
  { node: bracket,     out: new THREE.Vector3(-1.8, 0, 0) },
];
assembly.forEach(a => {
  a.origin = a.node.position.clone();
  a.target = a.origin.clone();
});

// Store VRAM individual origins for fancier explode
vramGroup.children.forEach(v => {
  v.userData.origin = v.position.clone();
});
finGroup.children.forEach(f => {
  f.userData.origin = f.position.clone();
});

// Helper — easing
function easeInOut(t){ return t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// ═══ Scroll-linked animation ═══
// Hero: assembled and idle · scroll explodes the parts outward ·
// final reassembly for the buy card.
function updateFromScroll(p) {
  const t = clamp01(p);
  const now = performance.now();

  // — Rotation — always spinning, ramping with scroll
  const idleRot = t * Math.PI * 1.4 + now * 0.00015;
  gpu.rotation.y = idleRot;
  gpu.rotation.x = Math.sin(t * Math.PI) * 0.25;

  // — Explode factor — piecewise
  let explode = 0;
  if (t < 0.20)      explode = 0;
  else if (t < 0.45) explode = easeInOut((t - 0.20) / 0.25);
  else if (t < 0.70) explode = 1;
  else if (t < 0.85) explode = 1 - easeInOut((t - 0.70) / 0.15) * 0.4;
  else               explode = (1 - easeInOut((t - 0.85) / 0.15)) * 0.6;

  // Apply intro multiplier so the detonation uses the same offsets for its burst
  const ex = Math.max(explode, window.__introExplode || 0);

  assembly.forEach(a => {
    const nx = a.origin.x + a.out.x * ex;
    const ny = a.origin.y + a.out.y * ex;
    const nz = a.origin.z + a.out.z * ex;
    a.node.position.set(nx, ny, nz);
  });

  vramGroup.children.forEach((v, i) => {
    const o = v.userData.origin;
    const dir = new THREE.Vector3(Math.sign(o.x) || (i%2?1:-1), 0, Math.sign(o.z) || 0).normalize();
    const add = dir.multiplyScalar(ex * 0.9);
    v.position.set(o.x + add.x, o.y, o.z + add.z);
  });

  finGroup.children.forEach(f => {
    if (!f.userData.origin) return;
    const o = f.userData.origin;
    f.position.set(o.x, o.y, o.z * (1 + ex * 1.8));
  });

  // Rings orbit around GPU
  ring.rotation.z += 0.002;
  ring.rotation.x = Math.PI / 2 + Math.sin(now * 0.0004) * 0.1;
  ring.material.opacity = 0.15 + ex * 0.4;
  ring2.rotation.z -= 0.0015;
  ring2.rotation.y += 0.001;
  ring2.material.opacity = 0.08 + ex * 0.25;

  // Particles drift
  const posArr = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    posArr[i*3 + 1] += pSpeed[i] * 0.002;
    if (posArr[i*3 + 1] > 4) posArr[i*3 + 1] = -4;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  particles.material.opacity = 0.35 + ex * 0.45;

  // LEDs breathe
  const breath = 1.8 + Math.sin(now * 0.002) * 0.8 + ex * 1.5;
  ledStrip.material.emissiveIntensity = breath;
  ledStripBack.material.emissiveIntensity = breath;

  // Scale softens during explode
  gpu.scale.setScalar(1 - explode * 0.05 - t * 0.05);

  // Camera dolly
  const camZ = 8 - Math.sin(t * Math.PI) * 2.5;
  const camY = 0.4 + Math.sin(t * Math.PI * 2) * 0.4;
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, 0, 0);

  gpu.position.x = getViewShift(t);
  gpu.position.y = 0;

  // Wireframe reveal
  const wireOp =
    t < 0.60 ? 0 :
    t < 0.80 ? (t - 0.60) / 0.20 * 0.6 :
    t < 0.95 ? (1 - (t - 0.80) / 0.15) * 0.6 : 0;
  wire.material.opacity = wireOp;

  // Die pulse on AI section
  const aiFocus = Math.max(0, 1 - Math.abs(t - 0.30) * 5);
  matDie.emissiveIntensity = 1 + aiFocus * 3 + Math.sin(now*0.003)*0.2;

  // Cyan glow spikes on cooling section
  const coolFocus = Math.max(0, 1 - Math.abs(t - 0.55) * 5);
  rimCyan.intensity = 2 + coolFocus * 5;

  // Fans spin faster with explode/cooling
  const rpm = 0.02 + ex * 0.08 + coolFocus * 0.12;
  fanL.userData.blades.rotation.y += rpm;
  fanR.userData.blades.rotation.y -= rpm;
}

function getViewShift(t) {
  const vw = Math.max(600, window.innerWidth);
  if (vw < 960) return 0;
  const amt = vw < 1200 ? 1.6 : 2.2;
  if (t < 0.12) return 0;
  if (t < 0.28) return -amt * ((t-0.12)/0.16);
  if (t < 0.45) return -amt;
  if (t < 0.55) return -amt + (amt*2)*((t-0.45)/0.10);
  if (t < 0.68) return  amt;
  if (t < 0.78) return  amt - (amt*2)*((t-0.68)/0.10);
  if (t < 0.88) return -amt;
  return 0;
}

// ═══ Helpers ═══
function makeTextTexture(text) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#a6ff66";
  ctx.shadowColor = "#76ff03";
  ctx.shadowBlur = 18;
  ctx.font = "700 34px Orbitron, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "6px";
  ctx.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makeGridTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#001a00";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(118,255,3,0.9)";
  ctx.lineWidth = 1;
  const step = size / 16;
  for (let i = 0; i <= 16; i++) {
    ctx.beginPath(); ctx.moveTo(i*step, 0); ctx.lineTo(i*step, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i*step); ctx.lineTo(size, i*step); ctx.stroke();
  }
  // glow dots
  ctx.fillStyle = "#d6ff6b";
  for (let i = 0; i < 14; i++) {
    const x = Math.random()*size, y = Math.random()*size;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

// ═══ RAF loop ═══
function loop() {
  const p = typeof window.__scroll === "number" ? window.__scroll : 0;
  updateFromScroll(p);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

// Expose a tiny API for app.js to ping on resize
window.__gpuResize = resize;

// Apply initial theme if page loaded with theme-light already set
if (document.body.classList.contains("theme-light")) {
  window.__gpuTheme(true);
}
