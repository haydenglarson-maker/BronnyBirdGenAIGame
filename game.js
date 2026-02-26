// Bronny Bird — Flappy-style with basketball pickup + dunk explosion

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const playBtn = document.getElementById("playBtn");

const gameOverOverlay = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");

const hiScoreText = document.getElementById("hiScoreText");
const hiScoreText2 = document.getElementById("hiScoreText2");
const finalScoreEl = document.getElementById("finalScore");

let hiScore = Number(localStorage.getItem("bronnybird_hiscore") || 0);
hiScoreText.textContent = hiScore;
hiScoreText2.textContent = hiScore;

const W = canvas.width;
const H = canvas.height;

// ---------- GAME STATE ----------
let running = false;
let gameOver = false;
let score = 0;
let frameT = 0;
let lastTs = 0;

const gravity = 1400;
const flapVel = -520;

const bird = {
  x: 170,
  y: H / 2,
  vy: 0,
  r: 18,
  hasBall: false
};

const pipes = [];
let pipeTimer = 0;
const pipeEvery = 1.35;
const pipeSpeed = 260;
const pipeW = 78;
const gapMin = 150;
const gapMax = 190;

// Collectible + hoop
let basketball = null; // {x,y,r,active}
let hoop = null;       // {x,y,w,h,active}
let hoopTimer = 0;
let nextHoopIn = 2.8;  // seconds (randomized later)

const particles = [];  // dunk explosion

// ---------- INPUT ----------
let spaceHeld = false;
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    if (!spaceHeld) flap();
    spaceHeld = true;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") spaceHeld = false;
});

canvas.addEventListener("mousedown", () => {
  // quick focus/click-to-flap if you want
  flap();
});

function flap() {
  if (!running || gameOver) return;
  bird.vy = flapVel;
}

// ---------- HELPERS ----------
function rand(a, b) { return a + Math.random() * (b - a); }

function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= cr * cr;
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// Ensure basketball doesn't spawn inside (overlapping) any pipe rectangles.
function basketballOverlapsAnyPipe(x, y, r) {
  for (const p of pipes) {
    // top pipe rect
    const topRect = { x: p.x, y: 0, w: pipeW, h: p.gapY };
    // bottom pipe rect
    const botRect = { x: p.x, y: p.gapY + p.gapH, w: pipeW, h: H - (p.gapY + p.gapH) };

    if (circleRectOverlap(x, y, r, topRect.x, topRect.y, topRect.w, topRect.h)) return true;
    if (circleRectOverlap(x, y, r, botRect.x, botRect.y, botRect.w, botRect.h)) return true;
  }
  return false;
}

// ---------- SPAWN ----------
function spawnPipe() {
  const gapH = rand(gapMin, gapMax);
  const margin = 50;
  const gapY = rand(margin, H - margin - gapH);

  pipes.push({
    x: W + 40,
    gapY,
    gapH,
    passed: false
  });
}

// Spawn basketball safely (not inside any pipe), and not if already carrying one
function trySpawnBasketball() {
  if (bird.hasBall) return;
  if (basketball && basketball.active) return;

  // spawn in front area near upcoming pipes so it's meaningful
  const r = 10;
  let attempts = 0;

  while (attempts < 40) {
    attempts++;
    const x = rand(W * 0.55, W * 0.92);
    const y = rand(70, H - 80);

    if (!basketballOverlapsAnyPipe(x, y, r)) {
      basketball = { x, y, r, active: true };
      return;
    }
  }
  // If we fail to find a safe place, just skip this spawn cycle.
}

function spawnHoop() {
  // hoop comes from right side
  const w = 56, h = 40;
  const x = W + 80;
  const y = rand(90, H - 140);

  hoop = { x, y, w, h, active: true };
}

function scheduleNextHoop() {
  nextHoopIn = rand(2.2, 4.2);
}

// ---------- PARTICLES (DUNK EXPLOSION) ----------
function dunkExplosion(x, y) {
  const count = 26;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: rand(-260, 260),
      vy: rand(-320, 120),
      life: rand(0.35, 0.75),
      t: 0,
      size: rand(2, 6)
    });
  }
}

// ---------- GAME FLOW ----------
function resetGame() {
  running = true;
  gameOver = false;
  score = 0;
  frameT = 0;
  lastTs = 0;

  bird.y = H / 2;
  bird.vy = 0;
  bird.hasBall = false;

  pipes.length = 0;
  pipeTimer = 0;

  basketball = null;
  hoop = null;
  hoopTimer = 0;
  scheduleNextHoop();

  particles.length = 0;
}

function endGame() {
  gameOver = true;
  running = false;

  const finalScore = score;
  finalScoreEl.textContent = finalScore;

  if (finalScore > hiScore) {
    hiScore = finalScore;
    localStorage.setItem("bronnybird_hiscore", String(hiScore));
  }

  hiScoreText.textContent = hiScore;
  hiScoreText2.textContent = hiScore;

  gameOverOverlay.classList.remove("hidden");
}

// ---------- COLLISION ----------
function birdHitsPipe() {
  for (const p of pipes) {
    const topRect = { x: p.x, y: 0, w: pipeW, h: p.gapY };
    const botRect = { x: p.x, y: p.gapY + p.gapH, w: pipeW, h: H - (p.gapY + p.gapH) };

    if (circleRectOverlap(bird.x, bird.y, bird.r, topRect.x, topRect.y, topRect.w, topRect.h)) return true;
    if (circleRectOverlap(bird.x, bird.y, bird.r, botRect.x, botRect.y, botRect.w, botRect.h)) return true;
  }
  return false;
}

function birdCollectsBall() {
  if (!basketball || !basketball.active) return false;
  const dx = bird.x - basketball.x;
  const dy = bird.y - basketball.y;
  const rr = bird.r + basketball.r + 2;
  return (dx * dx + dy * dy) <= rr * rr;
}

function birdDunksHoop() {
  if (!hoop || !hoop.active) return false;
  // dunk zone: inside the ring-ish area (simple rect around hoop)
  const dunkRect = {
    x: hoop.x + 10,
    y: hoop.y + 14,
    w: hoop.w - 20,
    h: 12
  };
  return circleRectOverlap(bird.x, bird.y, bird.r, dunkRect.x, dunkRect.y, dunkRect.w, dunkRect.h);
}

// ---------- UPDATE ----------
function update(dt) {
  frameT += dt;

  // gravity
  bird.vy += gravity * dt;
  bird.y += bird.vy * dt;

  // floor/ceiling
  if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }
  if (bird.y + bird.r > H) endGame();

  // pipes
  pipeTimer += dt;
  if (pipeTimer >= pipeEvery) {
    pipeTimer -= pipeEvery;
    spawnPipe();
    // occasionally try to spawn a basketball right after new pipe spawns
    if (Math.random() < 0.55) trySpawnBasketball();
  }

  for (const p of pipes) {
    p.x -= pipeSpeed * dt;

    // score when passed
    if (!p.passed && p.x + pipeW < bird.x) {
      p.passed = true;
      score += 1;
    }
  }
  while (pipes.length && pipes[0].x < -pipeW - 60) pipes.shift();

  // hoop timing + movement
  hoopTimer += dt;
  if (!hoop || !hoop.active) {
    if (hoopTimer >= nextHoopIn) {
      hoopTimer = 0;
      spawnHoop();
      scheduleNextHoop();
    }
  } else {
    hoop.x -= (pipeSpeed * 0.9) * dt;
    if (hoop.x < -100) hoop.active = false;
  }

  // move ball slightly with world (so it feels embedded)
  if (basketball && basketball.active) {
    basketball.x -= (pipeSpeed) * dt;
    if (basketball.x < -60) basketball.active = false;
  }

  // pick up ball
  if (!bird.hasBall && birdCollectsBall()) {
    bird.hasBall = true;
    basketball.active = false;
  }

  // dunk
  if (bird.hasBall && hoop && hoop.active && birdDunksHoop()) {
    bird.hasBall = false;
    hoop.active = false;
    score += 3;
    dunkExplosion(hoop.x + hoop.w / 2, hoop.y + hoop.h / 2);
  }

  // particles
  for (const part of particles) {
    part.t += dt;
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vy += 900 * dt; // fall
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].t >= particles[i].life) particles.splice(i, 1);
  }

  // collisions (pipes)
  if (birdHitsPipe()) endGame();
}

// ---------- DRAW ----------
function drawBackground() {
  // sky already set via canvas background, but add some drifting clouds
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 6; i++) {
    const x = (W - ((frameT * 40 + i * 160) % (W + 260))) - 120;
    const y = 40 + i * 45;
    ctx.beginPath();
    ctx.ellipse(x, y, 52, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40, y + 4, 46, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 38, y + 6, 40, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();

  // court line near grass
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, H * 0.45, W, 2);
  ctx.restore();
}

function drawPipe(x, gapY, gapH) {
  // simple green pipes with slight highlights
  const topH = gapY;
  const botY = gapY + gapH;
  const botH = H - botY;

  // top
  ctx.fillStyle = "#1f9f4a";
  ctx.fillRect(x, 0, pipeW, topH);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 10, 0, 8, topH);

  // bottom
  ctx.fillStyle = "#1f9f4a";
  ctx.fillRect(x, botY, pipeW, botH);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 10, botY, 8, botH);
}

function drawBasketballBall(x, y, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ff7a1a";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(20,10,0,0.6)";
  ctx.stroke();

  // seams
  ctx.strokeStyle = "rgba(20,10,0,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.95, Math.PI * 0.15, Math.PI * 1.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.95, Math.PI * 1.15, Math.PI * 2.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  ctx.restore();
}

function drawHoop(h) {
  // backboard
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(h.x, h.y, h.w, h.h);

  // rim
  ctx.strokeStyle = "#ff4b2b";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(h.x + h.w / 2, h.y + h.h * 0.65, 14, 0, Math.PI * 2);
  ctx.stroke();

  // net
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(h.x + h.w / 2 + i * 6, h.y + h.h * 0.65);
    ctx.lineTo(h.x + h.w / 2 + i * 4, h.y + h.h);
    ctx.stroke();
  }
  ctx.restore();
}

// “LeBron-inspired” cartoon player: headband + beard + #23 jersey vibe
function drawBronnyBird() {
  const x = bird.x, y = bird.y;

  ctx.save();

  // shadow
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(x + 4, y + 18, 18, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.globalAlpha = 1;

  // body (jersey)
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 20, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5b2dff"; // jersey color
  ctx.fill();

  // jersey number
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 12px system-ui";
  ctx.fillText("23", x - 10, y + 8);

  // head
  ctx.beginPath();
  ctx.arc(x, y - 12, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#7b4a2a"; // skin tone
  ctx.fill();

  // headband
  ctx.fillStyle = "#ffcc3a";
  ctx.fillRect(x - 14, y - 20, 28, 6);

  // beard
  ctx.beginPath();
  ctx.arc(x, y - 8, 11, 0, Math.PI);
  ctx.fillStyle = "rgba(20,10,0,0.55)";
  ctx.fill();

  // eye
  ctx.beginPath();
  ctx.arc(x + 5, y - 14, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#111";
  ctx.fill();

  // arm hint
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 18, y + 2);
  ctx.lineTo(x - 28, y - 4);
  ctx.stroke();

  // carried basketball (if holding)
  if (bird.hasBall) {
    drawBasketballBall(x + 22, y + 6, 8);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const alpha = 1 - (p.t / p.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffe16b";
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.restore();
  }
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(14, 14, 170, 40);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 18px system-ui";
  ctx.fillText(`Score: ${score}`, 26, 40);

  // indicator for holding ball
  ctx.font = "14px system-ui";
  ctx.fillText(bird.hasBall ? "Ball: ✅" : "Ball: ❌", 26, 60);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawBackground();

  // pipes
  for (const p of pipes) drawPipe(p.x, p.gapY, p.gapH);

  // hoop
  if (hoop && hoop.active) drawHoop(hoop);

  // basketball pickup
  if (basketball && basketball.active) drawBasketballBall(basketball.x, basketball.y, basketball.r);

  // player
  drawBronnyBird();

  // particles over everything
  drawParticles();

  drawHUD();
}

// ---------- LOOP ----------
function loop(ts) {
  if (!running) return;

  const t = ts / 1000;
  const dt = Math.min(0.033, (t - lastTs) || 0);
  lastTs = t;

  update(dt);
  draw();

  if (running) requestAnimationFrame(loop);
}

// ---------- UI ----------
function startFromMenu() {
  menu.style.display = "none";
  gameOverOverlay.classList.add("hidden");
  resetGame();
  requestAnimationFrame(loop);
}

function showMenu() {
  menu.style.display = "grid";
  gameOverOverlay.classList.add("hidden");
  draw(); // show idle frame
}

playBtn.addEventListener("click", () => startFromMenu());
restartBtn.addEventListener("click", () => startFromMenu());
menuBtn.addEventListener("click", () => showMenu());

// Initialize view
showMenu();
