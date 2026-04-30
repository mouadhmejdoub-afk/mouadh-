const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stats = document.getElementById("stats");
const menu = document.getElementById("menu-card");
const startBtn = document.getElementById("start-btn");
const shopBtn = document.getElementById("shop-btn");
const mapBtn = document.getElementById("map-btn");

const W = canvas.width;
const H = canvas.height;
const G = 0.72;
const keys = new Set();
const saveKey = "mouadh_mobile_save_v1";

const characters = {
  knight: { name: "الفارس", color: "#5a7996", speed: 5.6, jump: -15.2, hp: 110, weapon: "سيف الفارس", reach: 82, damage: 13, special: "موجة سيف" },
  ninja: { name: "النينجا", color: "#2a9d8f", speed: 7.4, jump: -17.2, hp: 90, weapon: "كاتانا النينجا", reach: 70, damage: 10, special: "اندفاعة" },
  mage: { name: "الساحر", color: "#6c5ce7", speed: 5.1, jump: -15.8, hp: 100, weapon: "عصا البرق", reach: 125, damage: 9, special: "انفجار سحري" },
  guardian: { name: "الحارس", color: "#8d6e63", speed: 4.8, jump: -14.6, hp: 145, weapon: "مطرقة الحارس", reach: 68, damage: 18, special: "درع الصمود" },
};

const themes = [
  ["الغابة", "#172a24", "#294536", "#5b3924"],
  ["الحمم", "#2b1118", "#813122", "#3b3340"],
  ["الثلج", "#123047", "#7bdff2", "#d8f3ff"],
  ["الأطلال", "#2d2438", "#6d597a", "#a98467"],
  ["السماء", "#1d3557", "#76c7ff", "#f6f7fb"],
  ["المقبرة", "#151820", "#5c677d", "#2f3e46"],
];

let state = "menu";
let stage = 1;
let score = 0;
let gems = 0;
let currentCharacter = "knight";
let unlocked = new Set(["knight"]);
let camera = 0;
let message = "";
let messageTimer = 0;
let mode = "runner";
let stageLength = 2400;
let platforms = [];
let coins = [];
let enemies = [];
let hazards = [];
let goal = { x: 2200, y: 460, w: 42, h: 90 };
let attackTimer = 0;
let attackCooldown = 0;
let specialCooldown = 0;
let invincible = 0;

let player = makePlayer();

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(saveKey) || "{}");
    stage = data.stage || 1;
    score = data.score || 0;
    gems = data.gems || 0;
    currentCharacter = data.currentCharacter || "knight";
    unlocked = new Set(data.unlocked || ["knight"]);
  } catch {
    // Ignore broken save data.
  }
}

function save() {
  localStorage.setItem(saveKey, JSON.stringify({ stage, score, gems, currentCharacter, unlocked: [...unlocked] }));
}

function makePlayer() {
  const c = characters[currentCharacter];
  return { x: 90, y: 370, w: 42, h: 68, vx: 0, vy: 0, facing: 1, onGround: false, hp: c.hp, maxHp: c.hp, extraJump: false };
}

function rects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function setMessage(text, time = 120) {
  message = text;
  messageTimer = time;
}

function generateStage(n) {
  const modes = ["runner", "arena", "maze", "climb", "treasure", "hazard", "sky", "dragon"];
  mode = modes[(n - 1) % modes.length];
  stageLength = 2200 + n * 150;
  platforms = [{ x: 0, y: 492, w: stageLength + 400, h: 70 }];
  coins = [];
  enemies = [];
  hazards = [];
  goal = { x: stageLength - 160, y: 404, w: 48, h: 88 };

  if (mode === "runner") {
    for (let x = 430; x < stageLength - 300; x += 390) {
      platforms.push({ x, y: 390 - (x % 2) * 35, w: 170, h: 20 });
      coins.push({ x: x + 70, y: 345 });
      hazards.push({ x: x + 210, y: 470, w: 90, h: 22, type: "spike" });
    }
  } else if (mode === "arena") {
    for (let x = 520; x < stageLength - 350; x += 420) enemies.push(makeEnemy(x, "golem"));
    platforms.push({ x: 700, y: 390, w: 210, h: 20 }, { x: 1320, y: 350, w: 210, h: 20 });
  } else if (mode === "maze") {
    for (let x = 430; x < stageLength - 330; x += 360) {
      platforms.push({ x, y: 410, w: 190, h: 20 });
      platforms.push({ x: x + 140, y: 320, w: 170, h: 20 });
      enemies.push(makeEnemy(x + 210, "zombie"));
    }
  } else if (mode === "climb") {
    for (let i = 0; i < 11; i++) {
      const x = 360 + i * 220;
      const y = 430 - (i % 4) * 70;
      platforms.push({ x, y, w: 150, h: 20 });
      coins.push({ x: x + 55, y: y - 42 });
    }
  } else if (mode === "treasure") {
    for (let x = 420; x < stageLength - 320; x += 250) coins.push({ x, y: 420 - Math.sin(x) * 65 });
    enemies.push(makeEnemy(900, "bat"), makeEnemy(1650, "zombie"), makeEnemy(2360, "golem"));
  } else if (mode === "hazard") {
    for (let x = 520; x < stageLength - 300; x += 330) hazards.push({ x, y: 465, w: 130, h: 28, type: "lava" });
    enemies.push(makeEnemy(740, "zombie"), makeEnemy(1480, "bat"), makeEnemy(2280, "zombie"));
  } else if (mode === "sky") {
    platforms = [{ x: 0, y: 492, w: 360, h: 70 }];
    for (let i = 0; i < 13; i++) platforms.push({ x: 370 + i * 210, y: 380 + Math.sin(i) * 72, w: 140, h: 20 });
    enemies.push(makeEnemy(1250, "bat"), makeEnemy(2060, "bat"));
  } else {
    enemies.push(makeEnemy(760, "zombie"), makeEnemy(1320, "golem"), makeEnemy(stageLength - 520, "dragon"));
    hazards.push({ x: 980, y: 465, w: 140, h: 28, type: "lava" });
    platforms.push({ x: 620, y: 390, w: 180, h: 20 }, { x: 1480, y: 365, w: 210, h: 20 });
  }

  for (let x = 340; x < stageLength - 260; x += 510) {
    if (coins.length < 12) coins.push({ x, y: 430 });
  }
  player = makePlayer();
  camera = 0;
  setMessage(`مرحلة ${n}: ${modeName(mode)}`, 140);
}

function modeName(m) {
  return { runner: "اندفاع", arena: "قتال", maze: "متاهة", climb: "صعود", treasure: "كنوز", hazard: "مصائد", sky: "سماء", dragon: "عرين التنين" }[m] || "مغامرة";
}

function makeEnemy(x, type) {
  const stats = {
    zombie: { w: 42, h: 60, hp: 24 + stage * 3, speed: 1.45, color: "#4f8f62" },
    bat: { w: 46, h: 30, hp: 18 + stage * 2, speed: 2.2, color: "#5e548e" },
    golem: { w: 58, h: 76, hp: 42 + stage * 5, speed: 1.15, color: "#8d6e63" },
    dragon: { w: 190, h: 118, hp: 180 + stage * 12, speed: 1.9, color: "#8f1018" },
  }[type];
  return { type, x, y: type === "bat" ? 250 : type === "dragon" ? 245 : 492 - stats.h, ...stats, dir: -1, alive: true, phase: Math.random() * 7 };
}

function startGame() {
  state = "playing";
  menu.classList.add("hidden");
  generateStage(stage);
}

function showMenu() {
  state = "menu";
  menu.classList.remove("hidden");
}

function showShop() {
  state = "shop";
  menu.classList.remove("hidden");
  menu.innerHTML = `<h1>المتجر</h1><p>النقاط: ${score} | الجواهر: ${gems}</p>`;
  for (const id of Object.keys(characters)) {
    const c = characters[id];
    const cost = { knight: 0, ninja: 500, mage: 650, guardian: 720 }[id];
    const btn = document.createElement("button");
    btn.textContent = unlocked.has(id) ? `جهز ${c.name} - ${c.weapon}` : `اشتر ${c.name} (${cost} نقطة)`;
    btn.onclick = () => {
      if (unlocked.has(id)) {
        currentCharacter = id;
        save();
        setMessage(`تم تجهيز ${c.name}`);
        showMainCard();
      } else if (score >= cost) {
        score -= cost;
        unlocked.add(id);
        currentCharacter = id;
        save();
        showMainCard();
      } else {
        alert("النقاط لا تكفي");
      }
    };
    menu.appendChild(btn);
  }
  const back = document.createElement("button");
  back.textContent = "رجوع";
  back.onclick = showMainCard;
  menu.appendChild(back);
}

function showMap() {
  state = "map";
  menu.classList.remove("hidden");
  menu.innerHTML = `<h1>خريطة المراحل</h1><p>اختر مرحلة للعب. المرحلة الحالية المفتوحة: ${stage}</p>`;
  for (let i = 1; i <= Math.max(stage, 12); i++) {
    const btn = document.createElement("button");
    btn.textContent = `مرحلة ${i} - ${modeName(["runner", "arena", "maze", "climb", "treasure", "hazard", "sky", "dragon"][(i - 1) % 8])}`;
    btn.disabled = i > stage;
    btn.onclick = () => {
      stage = i;
      startGame();
    };
    menu.appendChild(btn);
  }
  const back = document.createElement("button");
  back.textContent = "رجوع";
  back.onclick = showMainCard;
  menu.appendChild(back);
}

function showMainCard() {
  menu.innerHTML = `
    <h1>مغامرة معاذ</h1>
    <p>نسخة هاتف وحاسوب: مراحل مختلفة، متجر، شخصيات بأسلحة خاصة، وحوش تطاردك.</p>
    <button id="start-btn">ابدأ اللعب</button>
    <button id="shop-btn">المتجر</button>
    <button id="map-btn">خريطة المراحل</button>
    <small>حاسوب: الأسهم أو WASD، هجوم M، قدرة Q. الهاتف: الأزرار أسفل الشاشة.</small>
  `;
  menu.classList.remove("hidden");
  document.getElementById("start-btn").onclick = startGame;
  document.getElementById("shop-btn").onclick = showShop;
  document.getElementById("map-btn").onclick = showMap;
}

function attack() {
  if (attackCooldown > 0) return;
  const c = characters[currentCharacter];
  attackCooldown = currentCharacter === "ninja" ? 8 : currentCharacter === "guardian" ? 18 : 13;
  attackTimer = 9;
  const hit = {
    x: player.facing > 0 ? player.x + player.w - 4 : player.x - c.reach,
    y: player.y + 15,
    w: c.reach,
    h: currentCharacter === "mage" ? 58 : 38,
  };
  for (const e of enemies) {
    if (e.alive && rects(hit, e)) {
      e.hp -= c.damage + Math.floor(stage * 1.4);
      if (e.hp <= 0) {
        e.alive = false;
        score += e.type === "dragon" ? 500 : 85;
        gems += e.type === "dragon" ? 3 : 1;
      }
    }
  }
}

function special() {
  if (specialCooldown > 0) return;
  specialCooldown = currentCharacter === "ninja" ? 120 : currentCharacter === "mage" ? 150 : 180;
  if (currentCharacter === "ninja") player.x += player.facing * 180;
  if (currentCharacter === "guardian") invincible = 90;
  const area = { x: player.x - 110, y: player.y - 80, w: 260, h: 210 };
  for (const e of enemies) {
    if (e.alive && rects(area, e)) {
      e.hp -= currentCharacter === "mage" ? 45 : 30;
      if (e.hp <= 0) {
        e.alive = false;
        score += 120;
        gems += 1;
      }
    }
  }
  setMessage(characters[currentCharacter].special, 60);
}

function update() {
  if (state !== "playing") return;
  const c = characters[currentCharacter];
  const left = keys.has("left") || keys.has("a");
  const right = keys.has("right") || keys.has("d");
  const jump = keys.has("jump") || keys.has("up") || keys.has("w") || keys.has(" ");

  let target = 0;
  if (left) {
    target = -c.speed;
    player.facing = -1;
  } else if (right) {
    target = c.speed;
    player.facing = 1;
  }
  player.vx += (target - player.vx) * (player.onGround ? 0.34 : 0.22);
  if (!target) player.vx *= player.onGround ? 0.74 : 0.93;
  if (jump && player.onGround) {
    player.vy = c.jump;
    player.onGround = false;
    player.extraJump = currentCharacter === "ninja";
  } else if (jump && currentCharacter === "ninja" && player.extraJump && player.vy > -3) {
    player.vy = c.jump + 1;
    player.extraJump = false;
  }

  player.vy = Math.min(player.vy + G, 18);
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;
  player.x = Math.max(0, Math.min(player.x, stageLength - player.w));

  for (const p of platforms) {
    if (rects(player, p) && player.vy >= 0 && player.y + player.h - player.vy <= p.y + 18) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.extraJump = currentCharacter === "ninja";
    }
  }

  for (const h of hazards) {
    if (rects(player, h)) damage(h.type === "lava" ? 2.2 : 3);
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = player.x - e.x;
    if (Math.abs(dx) < 520 || e.type === "dragon") e.dir = dx > 0 ? 1 : -1;
    e.x += e.dir * e.speed;
    if (e.type === "bat") e.y += Math.sin(performance.now() / 180 + e.phase) * 1.3;
    if (e.type === "dragon") e.y += Math.sin(performance.now() / 260) * 1.1;
    if (rects(player, e)) damage(e.type === "dragon" ? 5 : 1.2);
  }

  for (const coin of coins) {
    if (!coin.got && rects(player, { x: coin.x - 14, y: coin.y - 14, w: 28, h: 28 })) {
      coin.got = true;
      score += 30;
      gems += 1;
    }
  }

  if (player.y > H + 100 || player.hp <= 0) {
    setMessage("انتهت المحاولة", 120);
    generateStage(stage);
  }

  if (rects(player, goal) && enemies.every((e) => !e.alive || e.type !== "dragon")) {
    stage += 1;
    score += 180;
    save();
    generateStage(stage);
  }

  camera = Math.max(0, Math.min(player.x - 300, stageLength - W));
  if (attackCooldown > 0) attackCooldown--;
  if (attackTimer > 0) attackTimer--;
  if (specialCooldown > 0) specialCooldown--;
  if (invincible > 0) invincible--;
  if (messageTimer > 0) messageTimer--;
}

function damage(amount) {
  if (invincible > 0) return;
  player.hp -= amount;
  invincible = 24;
}

function draw() {
  const theme = themes[(stage - 1) % themes.length];
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, theme[1]);
  grad.addColorStop(0.55, theme[2]);
  grad.addColorStop(1, "#111827");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  drawBackground(theme);
  drawWorld();
  drawPlayer();
  drawOverlay();
}

function drawBackground(theme) {
  ctx.fillStyle = "rgba(255, 209, 102, 0.75)";
  ctx.beginPath();
  ctx.arc(760 - (camera * 0.03) % 140, 92, 44, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i < 8; i++) {
    const x = i * 190 - (camera * 0.12) % 190;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.moveTo(x, 310);
    ctx.lineTo(x + 95, 165 + (i % 2) * 36);
    ctx.lineTo(x + 210, 310);
    ctx.fill();
  }
  for (let i = 0; i < 16; i++) {
    const x = i * 92 - (camera * 0.25) % 92;
    ctx.fillStyle = theme[3];
    ctx.fillRect(x + 35, 385, 16, 110);
    ctx.beginPath();
    ctx.moveTo(x, 415);
    ctx.lineTo(x + 43, 318);
    ctx.lineTo(x + 88, 415);
    ctx.fill();
  }
}

function drawWorld() {
  for (const h of hazards) {
    ctx.fillStyle = h.type === "lava" ? "#ff6b00" : "#c1121f";
    ctx.fillRect(h.x - camera, h.y, h.w, h.h);
    for (let x = h.x - camera; x < h.x - camera + h.w; x += 22) {
      ctx.fillStyle = "#ffe66d";
      ctx.beginPath();
      ctx.moveTo(x, h.y + h.h);
      ctx.lineTo(x + 11, h.y - 20);
      ctx.lineTo(x + 22, h.y + h.h);
      ctx.fill();
    }
  }

  for (const p of platforms) {
    ctx.fillStyle = "#34251f";
    ctx.fillRect(p.x - camera, p.y, p.w, p.h);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(p.x - camera, p.y, p.w, 6);
  }

  for (const coin of coins) {
    if (coin.got) continue;
    const y = coin.y + Math.sin(performance.now() / 180 + coin.x) * 5;
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(coin.x - camera, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8c6a18";
    ctx.stroke();
  }

  ctx.fillStyle = "#7bdff2";
  ctx.fillRect(goal.x - camera, goal.y, goal.w, goal.h);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(goal.x - camera + 7, goal.y + 8, goal.w - 14, 12);

  for (const e of enemies) {
    if (!e.alive) continue;
    drawEnemy(e);
  }
}

function drawEnemy(e) {
  const x = e.x - camera;
  ctx.fillStyle = e.color;
  if (e.type === "dragon") {
    ctx.fillStyle = "#5c1018";
    ctx.beginPath();
    ctx.ellipse(x + 95, e.y + 62, 100, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#25070a";
    ctx.beginPath();
    ctx.moveTo(x + 40, e.y + 35);
    ctx.lineTo(x - 35, e.y - 10);
    ctx.lineTo(x + 10, e.y + 85);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 145, e.y + 35);
    ctx.lineTo(x + 225, e.y - 14);
    ctx.lineTo(x + 184, e.y + 86);
    ctx.fill();
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(x + 140, e.y + 35, 12, 9);
  } else if (e.type === "bat") {
    ctx.beginPath();
    ctx.moveTo(x + 20, e.y + 10);
    ctx.lineTo(x - 20, e.y - 8);
    ctx.lineTo(x - 5, e.y + 28);
    ctx.lineTo(x + 20, e.y + 16);
    ctx.lineTo(x + 60, e.y - 8);
    ctx.lineTo(x + 48, e.y + 28);
    ctx.fill();
  } else {
    ctx.fillRect(x, e.y, e.w, e.h);
    ctx.fillStyle = "#ff4d6d";
    ctx.fillRect(x + 10, e.y + 14, 7, 6);
    ctx.fillRect(x + e.w - 18, e.y + 14, 7, 6);
  }
  ctx.fillStyle = "#111";
  ctx.fillRect(x, e.y - 12, e.w, 5);
  ctx.fillStyle = "#ff595e";
  ctx.fillRect(x, e.y - 12, e.w * Math.max(0, e.hp / (e.type === "dragon" ? 240 : 80)), 5);
}

function drawPlayer() {
  const c = characters[currentCharacter];
  const x = player.x - camera;
  const y = player.y;
  ctx.save();
  if (invincible % 8 > 3) ctx.globalAlpha = 0.5;

  if (currentCharacter === "ninja") {
    ctx.fillStyle = "#101820";
    ctx.fillRect(x + 8, y + 8, 28, 24);
    ctx.fillStyle = "#132a24";
    ctx.fillRect(x + 10, y + 32, 25, 40);
    ctx.fillStyle = "#d8fff3";
    ctx.fillRect(x + 15, y + 16, 16, 5);
    ctx.strokeStyle = "#dff7ff";
    ctx.lineWidth = 4;
    line(x + 3, y + 24, x + 40, y + 66);
  } else if (currentCharacter === "mage") {
    ctx.fillStyle = "#5f3dc4";
    poly([x + 5, y + 70, x + 23, y + 18, x + 43, y + 70]);
    ctx.fillStyle = "#2d1b69";
    ctx.fillRect(x + 10, y + 8, 28, 22);
    ctx.strokeStyle = "#9bf6ff";
    ctx.lineWidth = 5;
    line(x + 42, y + 40, x + 60, y - 5);
    circle(x + 62, y - 8, 9, "#9bf6ff");
  } else if (currentCharacter === "guardian") {
    ctx.fillStyle = "#6d4c41";
    ctx.fillRect(x + 4, y + 20, 40, 52);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(x + 9, y + 4, 31, 24);
    circle(x - 2, y + 52, 20, "#495057", "#ffd166");
  } else {
    ctx.fillStyle = c.color;
    ctx.fillRect(x + 8, y + 25, 34, 44);
    ctx.fillStyle = "#dce3ec";
    ctx.fillRect(x + 12, y + 7, 28, 24);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(x + 16, y + 13, 18, 6);
    ctx.fillStyle = "#a4133c";
    poly([x + 7, y + 30, x - 10, y + 57, x + 8, y + 64]);
  }

  ctx.strokeStyle = "#dce3ec";
  ctx.lineWidth = 5;
  line(x + 14, y + 70, x + 10, y + 92);
  line(x + 34, y + 70, x + 40, y + 92);

  if (attackTimer > 0) drawWeapon(x, y, c);
  ctx.restore();
}

function drawWeapon(x, y, c) {
  const dir = player.facing;
  const hx = dir > 0 ? x + 40 : x + 5;
  const hy = y + 42;
  if (currentCharacter === "mage") {
    ctx.strokeStyle = "#9bf6ff";
    ctx.lineWidth = 5;
    line(hx, hy, hx + dir * 100, y + 20);
    circle(hx + dir * 118, y + 25, 25, "rgba(155,246,255,.55)", "#fff");
  } else if (currentCharacter === "guardian") {
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 8;
    line(hx, hy, hx + dir * 54, y + 34);
    circle(hx + dir * 66, y + 38, 24, "#9e9e9e", "#ffd166");
  } else if (currentCharacter === "ninja") {
    ctx.strokeStyle = "#dff7ff";
    ctx.lineWidth = 5;
    line(hx, hy, hx + dir * 66, y + 18);
    line(hx + dir * 4, hy + 12, hx + dir * 52, y + 58);
  } else {
    ctx.fillStyle = "#f8fafc";
    poly([hx, hy, hx + dir * 44, y + 27, hx + dir * 76, y + 22, hx + dir * 44, y + 36]);
    ctx.strokeStyle = "#bde0fe";
    ctx.lineWidth = 3;
    line(hx, hy, hx + dir * 58, y + 30);
  }
}

function drawOverlay() {
  const c = characters[currentCharacter];
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(12, 12, 310, 76);
  ctx.fillStyle = "#260707";
  ctx.fillRect(28, 28, 210, 18);
  ctx.fillStyle = "#d90429";
  ctx.fillRect(28, 28, 210 * Math.max(0, player.hp / player.maxHp), 18);
  ctx.fillStyle = "#fff1d6";
  ctx.font = "bold 16px Tahoma";
  ctx.fillText(`${c.name} - ${c.weapon}`, 28, 70);
  if (messageTimer > 0) {
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 24px Tahoma";
    ctx.textAlign = "center";
    ctx.fillText(message, W / 2, 112);
    ctx.textAlign = "start";
  }
  stats.textContent = `مرحلة ${stage} | ${modeName(mode)} | نقاط ${score} | جواهر ${gems} | Q ${Math.ceil(specialCooldown / 60)}`;
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function poly(points) {
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function circle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function mapKey(k) {
  if (k === "ArrowLeft" || k.toLowerCase() === "a") return "left";
  if (k === "ArrowRight" || k.toLowerCase() === "d") return "right";
  if (k === "ArrowUp" || k.toLowerCase() === "w" || k === " ") return "jump";
  if (k.toLowerCase() === "m") return "attack";
  if (k.toLowerCase() === "q") return "special";
  return k;
}

window.addEventListener("keydown", (e) => {
  const k = mapKey(e.key);
  keys.add(k);
  if (k === "attack") attack();
  if (k === "special") special();
});

window.addEventListener("keyup", (e) => keys.delete(mapKey(e.key)));

document.querySelectorAll("[data-key]").forEach((btn) => {
  const k = btn.dataset.key;
  const down = (e) => {
    e.preventDefault();
    btn.classList.add("active");
    keys.add(k);
    if (k === "attack") attack();
    if (k === "special") special();
  };
  const up = (e) => {
    e.preventDefault();
    btn.classList.remove("active");
    keys.delete(k);
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
});

startBtn.onclick = startGame;
shopBtn.onclick = showShop;
mapBtn.onclick = showMap;

load();
showMainCard();
loop();
