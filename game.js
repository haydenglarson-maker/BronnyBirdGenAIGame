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

const W = canvas.width;
const H = canvas.height;

// ---------- STATE ----------
let state = "menu"; // "menu" | "playing" | "gameover"

// ---------- SCORE ----------
let hiScore = Number(localStorage.getItem("bronnybird_hiscore") || 0);
hiScoreText.textContent = hiScore;
hiScoreText2.textContent = hiScore;

let score = 0;

// ---------- GAME OBJECTS ----------
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

let basketball = null; // {x,y,r,active}
let hoop = null;       // {x,y,w,h,active}

let hoopTimer = 0;
let nextHoopIn = 3.0;

const particles = []; // dunk explosion

let tPrev = 0;
let worldT = 0;

// ---------- HELPERS ----------
function rand(a, b) { return a + Math.random() * (b - a); }

function circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) <= cr * cr;
}

function basketballOverlapsAnyPipe(x, y, r) {
  for (const p of pipes) {
    const topRect = { x: p.x, y: 0, w: pipeW, h: p.gapY };
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

function trySpawnBasketball() {
  if (bird.hasBall) return;
  if (basketball && basketball.active) return;

  const r = 10;
  for (let attempts = 0; attempts < 50; attempts++) {
    const x = rand(W * 0.60, W * 0.93);
    const y = rand(70, H - 80);

    // ✅ key rule: never inside pipes
    if (!basketballOverlapsAnyPipe(x, y, r)) {
      basketball = { x, y, r, active: true };
      return;
    }
  }
}

function spawnHoop() {
  const w = 56, h = 40;
  hoop = {
    x: W + 80,
    y: rand(90, H - 140),
    w, h,
    active: true
  };
}

function scheduleNextHoop() {
  nextHoopIn = rand(2.2, 4.2);
}

// ---------- EXPLOSION ----------
function dunkExplosion(x, y) {
  for (let i = 0; i < 28; i++) {
    particles.push({
      x, y,
      vx: rand(-260, 260),
      vy: rand(-320, 140),
      life: rand(0.35, 0.8),
      t: 0,
      size: rand(2, 6)
    });
  }
}

// ---------- COLLISIONS ----------
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
  const dunkRect = { x: hoop.x + 10, y: hoop.y + 14, w: hoop.w - 20, h: 12 };
  return circleRectOverlap(bird.x, bird.y, bird.r, dunkRect.x, dunkRect.y, dunkRect.w, dunkRect.h);
}

// ---------- GAME FLOW ----------
function startGame() {
  state = "playing";
  score = 0;

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

  menu.style.display = "none";
  gameOverOverlay.classList.add("hidden");
}

function endGame() {
  state = "gameover";
  finalScoreEl.textContent = score;

  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem("bronnybird_hiscore", String(hiScore));
  }
  hiScoreText.textContent = hiScore;
  hiScoreText2.textContent = hiScore;

  gameOverOverlay.classList.remove("hidden");
}

function showMenu() {
  state = "menu";
  menu.style.display = "grid";
  gameOverOverlay.classList.add("hidden");
}

// ---------- INPUT ----------
let spaceHeld = false;

function flap() {
  if (state !== "playing") return;
  bird.vy = flapVel;
}

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
  // click-to-flap + helps focus the page
  if (state === "playing") flap();
});

// UI buttons
playBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
menuBtn.addEventListener("click", showMenu);

// ---------- UPDATE ----------
function update(dt) {
  if (state !== "playing") return;

  // bird physics
  bird.vy += gravity * dt;
  bird.y += bird.vy * dt;

  // ceiling
  if (bird.y - bird.r < 0) { bird.y = bird.r; bird.vy = 0; }

  // ground = lose
  if (bird.y + bird.r > H) { endGame(); return; }

  // spawn pipes
  pipeTimer += dt;
  if (pipeTimer >= pipeEvery) {
    pipeTimer -= pipeEvery;
    spawnPipe();
    if (Math.random() < 0.55) trySpawnBasketball();
  }

  // move pipes + score
  for (const p of pipes) {
    p.x -= pipeSpeed * dt;

    if (!p.passed && p.x + pipeW < bird.x) {
      p.passed = true;
      score += 1;
    }
  }
  while (pipes.length && pipes[0].x < -pipeW - 80) pipes.shift();

  // hoop timing
  hoopTimer += dt;
  if (!hoop || !hoop.active) {
    if (hoopTimer >= nextHoopIn) {
      hoopTimer = 0;
      spawnHoop();
      scheduleNextHoop();
    }
  } else {
    hoop.x -= pipeSpeed * 0.9 * dt;
    if (hoop.x < -120) hoop.active = false;
  }

  // move basketball with world
  if (basketball && basketball.active) {
    basketball.x -= pipeSpeed * dt;
    if (basketball.x < -80) basketball.active = false;
  }

  // pickup
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

  // pipe collision
  if (birdHitsPipe()) { endGame(); return; }

  // particles
  for (const p of particles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 900 * dt;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (particles[i].t >= particles[i].life) particles.splice(i, 1);
  }
}

// ---------- DRAW ----------
function drawBackground() {
  // drifting clouds
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 6; i++) {
    const x = (W - ((worldT * 40 + i * 160) % (W + 260))) - 120;
    const y = 40 + i * 45;
    ctx.beginPath();
    ctx.ellipse(x, y, 52, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 40, y + 4, 46, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 38, y + 6, 40, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  }
  ctx.restore();

  // horizon line
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, H * 0.45, W, 2);
  ctx.restore();
}

function drawPipe(p) {
  const topH = p.gapY;
  const botY = p.gapY + p.gapH;
  const botH = H - botY;

  ctx.fillStyle = "#1f9f4a";
  ctx.fillRect(p.x, 0, pipeW, topH);
  ctx.fillRect(p.x, botY, pipeW, botH);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(p.x + 10, 0, 8, topH);
  ctx.fillRect(p.x + 10, botY, 8, botH);
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

  ctx.strokeStyle = "rgba(20,10,0,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.stroke();
  ctx.restore();
}

function drawHoop(h) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(h.x, h.y, h.w, h.h);

  ctx.strokeStyle = "#ff4b2b";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(h.x + h.w / 2, h.y + h.h * 0.65, 14, 0, Math.PI * 2);
  ctx.stroke();

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

// LeBron-inspired cartoon: headband + beard + #23 jersey vibe
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

  // jersey body
  ctx.beginPath();
  ctx.ellipse(x, y + 3, 20, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#5b2dff";
  ctx.fill();

  // number
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "bold 12px system-ui";
  ctx.fillText("23", x - 10, y + 8);

  // head
  ctx.beginPath();
  ctx.arc(x, y - 12, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#7b4a2a";
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

  // carried ball
  if (bird.hasBall) drawBasketballBall(x + 22, y + 6, 8);

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
  ctx.fillRect(14, 14, 190, 56);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 18px system-ui";
  ctx.fillText(`Score: ${score}`, 26, 40);

  ctx.font = "14px system-ui";
  ctx.fillText(bird.hasBall ? "Ball: ✅" : "Ball: ❌", 26, 62);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  drawBackground();

  for (const p of pipes) drawPipe(p);
  if (hoop && hoop.active) drawHoop(hoop);
  if (basketball && basketball.active) drawBasketballBall(basketball.x, basketball.y, basketball.r);

  drawBronnyBird();
  drawParticles();
  drawHUD();

  if (state === "menu") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 22px system-ui";
    ctx.fillText("Press PLAY to start!", W / 2 - 120, H / 2);
    ctx.restore();
  }
}

// ---------- MAIN LOOP (always runs) ----------
function loop(ts) {
  const t = ts / 1000;
  const dt = Math.min(0.033, (t - tPrev) || 0);
  tPrev = t;
  worldT += dt;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// init
showMenu();
requestAnimationFrame(loop);
