
// Bronny Bird — HTML Canvas game
// Controls: Space (or click/tap) to jump. Pass pipes for +1.
// Pick up basketballs (carry one). Dunk by passing through hoop while carrying ball for +3.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// UI
const scoreEl = document.getElementById("score");
const hiEl = document.getElementById("hiscore");
const carryEl = document.getElementById("carry");

const menu = document.getElementById("menu");
const menuHigh = document.getElementById("menuHigh");

const gameover = document.getElementById("gameover");
const finalScoreEl = document.getElementById("finalScore");
const finalHighEl = document.getElementById("finalHigh");

const playBtn = document.getElementById("playBtn");
const retryBtn = document.getElementById("retryBtn");
const menuBtn = document.getElementById("menuBtn");

// Persistent high score
let hiScore = Number(localStorage.getItem("bronnybird_hiscore") || 0);
hiEl.textContent = hiScore;
menuHigh.textContent = hiScore;

// Game constants
const W = canvas.width;
const H = canvas.height;

const GRAVITY = 1600;      // px/s^2
const JUMP_V = -520;       // px/s
const SCROLL = 240;        // base scroll speed px/s

// Pipes
const PIPE_GAP_BASE = 150;
const PIPE_W = 70;
const PIPE_SPAWN = 1.35;   // seconds

// Basketball + hoop
const BALL_RADIUS = 10;
const BALL_SPAWN = 3.3;    // seconds (approx)
const HOOP_SPAWN = 4.8;    // seconds (approx)
const HOOP_R = 24;         // ring radius

// Player
const player = {
  x: 150,
  y: H / 2,
  r: 16,
  vy: 0,
  hasBall: false,
};

// State
let running = false;
let dead = false;
let score = 0;

let pipes = [];
let balls = [];
let hoops = [];

let pipeTimer = 0;
let ballTimer = 0;
let hoopTimer = 0;

let tPrev = 0;

// Helpers
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function resetGame() {
  player.y = H / 2;
  player.vy = 0;
  player.hasBall = false;

  pipes = [];
  balls = [];
  hoops = [];

  pipeTimer = 0;
  ballTimer = 0;
  hoopTimer = 0;

  score = 0;
  dead = false;

  updateHUD();
}

function showMenu() {
  running = false;
  dead = false;
  gameover.classList.add("hidden");
  menu.classList.remove("hidden");
  menuHigh.textContent = hiScore;
}

function startGame() {
  resetGame();
  menu.classList.add("hidden");
  gameover.classList.add("hidden");
  running = true;
}

function endGame() {
  running = false;
  dead = true;

  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem("bronnybird_hiscore", String(hiScore));
  }

  hiEl.textContent = hiScore;

  finalScoreEl.textContent = score;
  finalHighEl.textContent = hiScore;

  gameover.classList.remove("hidden");
}

function updateHUD() {
  scoreEl.textContent = score;
  hiEl.textContent = hiScore;
  carryEl.textContent = player.hasBall ? "Yes" : "No";
}

function jump() {
  if (!running) return;
  player.vy = JUMP_V;
}

// Spawners
function spawnPipePair() {
  // Difficulty: gap slowly shrinks as score increases
  const gap = clamp(PIPE_GAP_BASE - Math.floor(score * 0.8), 112, 170);

  const margin = 50;
  const topMax = H - margin - gap - margin;
  const topH = margin + Math.random() * (topMax - margin);

  pipes.push({
    x: W + 20,
    w: PIPE_W,
    topH,
    gap,
    scored: false,
  });
}

function spawnBall() {
  // spawn only if player is not holding a ball (otherwise it's pointless)
  if (player.hasBall) return;

  const y = 80 + Math.random() * (H - 160);
  balls.push({
    x: W + 20,
    y,
    r: BALL_RADIUS,
    taken: false,
  });
}

function spawnHoop() {
  const y = 90 + Math.random() * (H - 180);
  hoops.push({
    x: W + 20,
    y,
    r: HOOP_R,
    scored: false,
  });
}

// Collision helpers
function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const px = clamp(cx, rx, rx + rw);
  const py = clamp(cy, ry, ry + rh);
  const dx = cx - px;
  const dy = cy - py;
  return dx * dx + dy * dy <= cr * cr;
}

function circleCircleCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

function update(dt) {
  if (!running) return;

  // Physics
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  // Bounds: ceiling/floor are fatal
  if (player.y - player.r <= 0 || player.y + player.r >= H) {
    endGame();
    return;
  }

  // Timers
  pipeTimer += dt;
  ballTimer += dt;
  hoopTimer += dt;

  if (pipeTimer >= PIPE_SPAWN) {
    pipeTimer -= PIPE_SPAWN;
    spawnPipePair();
  }

  // Spawn balls + hoops with mild randomness
  if (ballTimer >= BALL_SPAWN + (Math.random() * 0.8 - 0.4)) {
    ballTimer = 0;
    spawnBall();
  }

  if (hoopTimer >= HOOP_SPAWN + (Math.random() * 1.2 - 0.6)) {
    hoopTimer = 0;
    spawnHoop();
  }

  // Scroll speed increases slightly with score
  const scroll = SCROLL + score * 2.0;

  // Move pipes
  for (const p of pipes) p.x -= scroll * dt;

  // Move balls/hoops
  for (const b of balls) b.x -= scroll * dt;
  for (const h of hoops) h.x -= scroll * dt;

  // Remove off-screen
  pipes = pipes.filter(p => p.x + p.w > -60);
  balls = balls.filter(b => b.x + b.r > -60 && !b.taken);
  hoops = hoops.filter(h => h.x + h.r > -60 && !h.scored);

  // Pipe collisions + scoring
  for (const p of pipes) {
    // Top pipe rect: (x, 0, w, topH)
    if (circleRectCollide(player.x, player.y, player.r, p.x, 0, p.w, p.topH)) {
      endGame();
      return;
    }
    // Bottom pipe rect: (x, topH+gap, w, H-(topH+gap))
    const by = p.topH + p.gap;
    if (circleRectCollide(player.x, player.y, player.r, p.x, by, p.w, H - by)) {
      endGame();
      return;
    }

    // Score when passing the pipe pair midpoint
    if (!p.scored && player.x > p.x + p.w) {
      p.scored = true;
      score += 1;
      updateHUD();
    }
  }

  // Ball pickup
  if (!player.hasBall) {
    for (const b of balls) {
      if (circleCircleCollide(player.x, player.y, player.r, b.x, b.y, b.r + 2)) {
        player.hasBall = true;
        b.taken = true;
        updateHUD();
        break;
      }
    }
  }

  // Dunk scoring (through hoop ring)
  // We score if player circle overlaps hoop ring area and player has a ball.
  for (const h of hoops) {
    if (h.scored) continue;

    const inRing = circleCircleCollide(player.x, player.y, player.r, h.x, h.y, h.r * 0.85);
    if (inRing && player.hasBall) {
      // Dunk!
      h.scored = true;
      player.hasBall = false;
      score += 3;
      updateHUD();
      // (optional) small pop: nudge player upward a bit
      player.vy = Math.min(player.vy, 80);
    }
  }
}

function drawBackground() {
  // Sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0f1730");
  g.addColorStop(1, "#0b1024");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 60; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

function drawPipes() {
  for (const p of pipes) {
    // pipe color
    ctx.fillStyle = "rgba(124, 247, 212, 0.18)";
    ctx.strokeStyle = "rgba(124, 247, 212, 0.55)";
    ctx.lineWidth = 2;

    // top
    ctx.fillRect(p.x, 0, p.w, p.topH);
    ctx.strokeRect(p.x, 0, p.w, p.topH);

    // bottom
    const by = p.topH + p.gap;
    ctx.fillRect(p.x, by, p.w, H - by);
    ctx.strokeRect(p.x, by, p.w, H - by);

    // caps
    ctx.fillStyle = "rgba(124, 247, 212, 0.22)";
    ctx.fillRect(p.x - 6, p.topH - 14, p.w + 12, 14);
    ctx.fillRect(p.x - 6, by, p.w + 12, 14);
  }
}

function drawBalls() {
  for (const b of balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8a3d";
    ctx.fill();

    // seams
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.9, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.9, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.stroke();
  }
}

function drawHoops() {
  for (const h of hoops) {
    // backboard
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.fillRect(h.x - 10, h.y - 40, 40, 60);
    ctx.strokeRect(h.x - 10, h.y - 40, 40, 60);

    // rim (ring)
    ctx.beginPath();
    ctx.arc(h.x + 18, h.y, h.r, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff5c7a";
    ctx.lineWidth = 5;
    ctx.stroke();

    // net hint
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(h.x + 18 + i * 6, h.y + 5);
      ctx.lineTo(h.x + 18 + i * 4, h.y + 28);
      ctx.stroke();
    }
  }
}

function drawPlayer() {
  // Bronny (simple “basketball player” icon)
  // body
  ctx.fillStyle = "#7cf7d4";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(player.x + 9, player.y - 10, 6, 0, Math.PI * 2);
  ctx.fill();

  // jersey stripe
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x - 10, player.y);
  ctx.lineTo(player.x + 12, player.y + 6);
  ctx.stroke();

  // carried ball
  if (player.hasBall) {
    const bx = player.x - 18;
    const by = player.y + 2;
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#ff8a3d";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 7.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  }
}

function draw() {
  drawBackground();
  drawPipes();
  drawBalls();
  drawHoops();
  drawPlayer();

  // subtle ground line
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 2);
  ctx.lineTo(W, H - 2);
  ctx.stroke();
}

function loop(ts) {
  const t = ts / 1000;
  const dt = Math.min(0.033, t - tPrev || 0);
  tPrev = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// Input
function onAction() {
  if (menu.classList.contains("hidden") === false) return; // ignore clicks on menu (play button handles)
  if (gameover.classList.contains("hidden") === false) {
    // allow click to retry
    startGame();
    return;
  }
  jump();
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (!running && !menu.classList.contains("hidden") === false) return;
    if (!running && !gameover.classList.contains("hidden")) {
      // if game over screen visible, space retries
      startGame();
      return;
    }
    if (running) jump();
  }
});

canvas.addEventListener("mousedown", () => onAction());
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  onAction();
}, { passive: false });

// Buttons
playBtn.addEventListener("click", startGame);
retryBtn.addEventListener("click", startGame);
menuBtn.addEventListener("click", showMenu);

// Init
updateHUD();
showMenu();
requestAnimationFrame(loop);
