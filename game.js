"use strict";

(() => {
  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const arena = document.querySelector(".arena");
  const overlay = document.querySelector("#game-overlay");
  const touchControls = document.querySelector("#touch-controls");
  const touchDragHint = document.querySelector("#touch-drag-hint");
  const touchFire = document.querySelector("#touch-fire");
  const touchFireHint = document.querySelector("#touch-fire-hint");
  const touchControlButtons = [...touchControls.querySelectorAll("[data-control]")];
  const hasTouchInput = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const movementKeyGrid = document.querySelector(".key-grid");
  const spaceKey = document.querySelector(".space-key");
  const pauseKey = document.querySelector(".esc-key");
  const pauseDescription = document.querySelector("#pause-description");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const startButton = document.querySelector("#start-button");
  const scoreValue = document.querySelector("#score-value");
  const scoreGoalValue = document.querySelector("#score-goal");
  const levelValue = document.querySelector("#level-value");
  const livesValue = document.querySelector("#lives-value");
  const moodValue = document.querySelector("#mood-value");
  const chargeMeter = document.querySelector(".charge-meter");
  const chargeLabel = document.querySelector("#charge-label");
  const chargeTimeLabel = document.querySelector("#charge-time");
  const chargeFill = document.querySelector("#charge-fill");
  const toast = document.querySelector("#game-toast");
  const weaponButtons = [...document.querySelectorAll(".weapon-card")];
  const locationButtons = [...document.querySelectorAll(".location-button")];
  const locationStamp = document.querySelector("#location-stamp");
  const locationScoreLabel = document.querySelector("#location-score-label");
  const locationCaption = document.querySelector("#location-caption");
  const movementDescription = document.querySelector("#movement-description");
  const spaceDescription = document.querySelector("#space-description");
  const overlayHint = document.querySelector(".overlay-hint");
  const playerNameInput = document.querySelector("#player-name");
  const leaderboardList = document.querySelector("#leaderboard-list");
  const leaderboardButtons = [...document.querySelectorAll(".leaderboard-tab")];
  const ratingModal = document.querySelector("#rating-modal");
  const ratingOpenButton = document.querySelector("#rating-open");
  const ratingCloseButton = document.querySelector("#rating-close");
  const globalRatingEndpoint = document.querySelector('meta[name="global-rating-endpoint"]').content.trim();
  const width = canvas.width;
  const height = canvas.height;
  const chargeDuration = 3;
  const chargeBlastDuration = 1.8;
  const movementKeys = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d" };
  const playerNameStorageKey = "dragonheart.player-name.v1";

  const weapons = {
    ember: { color: "#f39a65", glow: "#ffd27d", speed: 500, rate: 0.26, damage: 1, slow: 0, pierce: 0 },
    frost: { color: "#92d8e6", glow: "#d8ffff", speed: 395, rate: 0.38, damage: 1, slow: 1.6, pierce: 0 },
    starlight: { color: "#c5a3f4", glow: "#fff2bc", speed: 440, rate: 0.34, damage: 1, slow: 0, pierce: 2 },
  };
  const keys = new Set();
  const stars = Array.from({ length: 60 }, (_, index) => ({
    x: (index * 157.7 + 23) % width,
    y: (index * 89.3 + 17) % 252,
    size: 0.7 + (index % 4) * 0.35,
    phase: index * 1.71,
  }));
  const flowers = Array.from({ length: 34 }, (_, index) => ({
    x: (index * 97 + 16) % width,
    y: 465 + ((index * 47) % 77),
    scale: 0.5 + (index % 5) * 0.14,
    color: ["#ffe1a7", "#f7b7aa", "#f9f2d2", "#dbb9d1"][index % 4],
  }));
  let state = "title";
  let weapon = "ember";
  let location = "wildwood";
  let leaderboardLocation = "wildwood";
  let ratingPausedGame = false;
  let player = { x: 168, y: 290, lives: 3, invulnerable: 0 };
  let enemies = [];
  let projectiles = [];
  let particles = [];
  let score = 0;
  let level = 1;
  let levelsCompleted = 0;
  let levelGoal = 12;
  let runStats = { destroyed: 0, shots: 0, weapons: {} };
  let leaderboardRequestId = 0;
  let spawnTimer = 0.35;
  let chargeHeld = false;
  let spaceConsumed = false;
  let chargeTime = 0;
  let shotTimer = 0;
  let chargeFlashTimer = 0;
  let chargeBlastTimer = 0;
  let endingTimer = 0;
  let fireworksTimer = 0;
  let lastFrame = 0;
  let toastTimer = 0;
  let touchDragPointerId = null;
  let touchDragStartX = 0;
  let touchDragStartY = 0;

  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }

  function roundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function drawBackground(time) {
    if (location === "wildwood") {
      drawWildwoodBackground(time);
      return;
    }
    drawCastleBackground(time);
  }

  function drawWildwoodBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#9792b6");
    sky.addColorStop(0.52, "#e1b4ad");
    sky.addColorStop(0.76, "#f5d6b3");
    sky.addColorStop(1, "#b0c6a1");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 237, 200, 0.78)";
    ctx.beginPath();
    ctx.arc(754, 122, 47, 0, Math.PI * 2);
    ctx.fill();

    for (const star of stars) {
      ctx.globalAlpha = 0.38 + Math.sin(time * 1.3 + star.phase) * 0.24;
      ctx.fillStyle = "#fff8e6";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawCloud(140 + Math.sin(time * 0.09) * 7, 116, 0.9);
    drawCloud(492 - Math.sin(time * 0.07) * 8, 177, 0.64);

    ctx.fillStyle = "#8b83a0";
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.quadraticCurveTo(155, 210, 301, 296);
    ctx.quadraticCurveTo(470, 211, 636, 295);
    ctx.quadraticCurveTo(805, 220, width, 278);
    ctx.lineTo(width, 408);
    ctx.lineTo(0, 408);
    ctx.fill();
    ctx.fillStyle = "#9992a9";
    ctx.beginPath();
    ctx.moveTo(0, 332);
    ctx.quadraticCurveTo(175, 253, 360, 339);
    ctx.quadraticCurveTo(570, 245, 762, 331);
    ctx.quadraticCurveTo(869, 282, width, 317);
    ctx.lineTo(width, 421);
    ctx.lineTo(0, 421);
    ctx.fill();
    drawCastle(692, 214, 0.93);
    drawTreeLine();

    ctx.fillStyle = "#829a7c";
    ctx.beginPath();
    ctx.moveTo(0, 382);
    ctx.quadraticCurveTo(180, 341, 357, 390);
    ctx.quadraticCurveTo(565, 339, 725, 389);
    ctx.quadraticCurveTo(863, 353, width, 374);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();
    ctx.fillStyle = "#9fb18a";
    ctx.beginPath();
    ctx.moveTo(0, 431);
    ctx.quadraticCurveTo(222, 389, 435, 438);
    ctx.quadraticCurveTo(679, 391, width, 429);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 239, 201, 0.38)";
    ctx.beginPath();
    ctx.ellipse(499, 504, 310, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    drawFlowers(time);
    drawGrass(time);
  }

  function drawCastleBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#8983a4");
    sky.addColorStop(0.4, "#d29e9f");
    sky.addColorStop(0.72, "#f1c99f");
    sky.addColorStop(1, "#8d9f7d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = "#ffedc8";
    ctx.beginPath();
    ctx.arc(732, 153, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.17;
    ctx.beginPath();
    ctx.arc(732, 153, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const star of stars) {
      const twinkle = 0.38 + Math.sin(time * 1.3 + star.phase) * 0.24;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#fff8e6";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawCloud(302 + Math.sin(time * 0.09) * 7, 146, 0.72);
    drawCloud(580 - Math.sin(time * 0.07) * 8, 220, 0.52);

    ctx.fillStyle = "#89839a";
    ctx.beginPath();
    ctx.moveTo(0, 294);
    ctx.quadraticCurveTo(155, 224, 301, 292);
    ctx.quadraticCurveTo(470, 218, 636, 291);
    ctx.quadraticCurveTo(805, 230, 960, 279);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    ctx.fillStyle = "#89977d";
    ctx.beginPath();
    ctx.moveTo(0, 340);
    ctx.quadraticCurveTo(175, 277, 360, 339);
    ctx.quadraticCurveTo(570, 270, 762, 334);
    ctx.quadraticCurveTo(869, 290, 960, 325);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    drawCastle(661, 226, 0.6);
    drawTreeLine();

    ctx.fillStyle = "#7e936f";
    ctx.beginPath();
    ctx.moveTo(0, 364);
    ctx.quadraticCurveTo(222, 322, 435, 369);
    ctx.quadraticCurveTo(679, 324, 960, 359);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    drawRoad(time);
    drawFlowers(time);
    drawGrass(time);
    drawCastleWall(time);
    drawPrincessAtCastle(time);
  }

  function drawRoad(time) {
    ctx.fillStyle = "#8f776f";
    ctx.beginPath();
    ctx.moveTo(461, 251);
    ctx.lineTo(519, 251);
    ctx.lineTo(835, height);
    ctx.lineTo(125, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(229, 193, 149, 0.25)";
    ctx.beginPath();
    ctx.moveTo(476, 253);
    ctx.lineTo(484, 253);
    ctx.lineTo(556, height);
    ctx.lineTo(407, height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(246, 222, 179, 0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(468, 258); ctx.lineTo(232, height);
    ctx.moveTo(492, 258); ctx.lineTo(729, height);
    ctx.stroke();

    ctx.strokeStyle = "rgba(244, 216, 173, 0.5)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) {
      const depth = ((i / 7 + time * 0.08) % 1);
      const y = 266 + depth * depth * 270;
      const halfWidth = 18 + depth * 265;
      ctx.beginPath();
      ctx.moveTo(480 - halfWidth, y);
      ctx.lineTo(480 + halfWidth, y);
      ctx.stroke();
    }
  }

  function traceCastleOpening() {
    ctx.moveTo(133, height);
    ctx.lineTo(133, 304);
    ctx.bezierCurveTo(133, 173, 262, 112, 480, 108);
    ctx.bezierCurveTo(698, 112, 827, 173, 827, 304);
    ctx.lineTo(827, height);
    ctx.closePath();
  }

  function drawCastleWall(time) {
    const stone = ctx.createLinearGradient(0, 0, width, height);
    stone.addColorStop(0, "#5e526c");
    stone.addColorStop(0.5, "#756579");
    stone.addColorStop(1, "#514b66");
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    traceCastleOpening();
    ctx.fill("evenodd");

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    traceCastleOpening();
    ctx.clip("evenodd");
    ctx.strokeStyle = "rgba(230, 211, 189, 0.12)";
    ctx.lineWidth = 1;
    for (let row = 28; row < height; row += 34) {
      ctx.beginPath();
      ctx.moveTo(0, row);
      ctx.lineTo(width, row + 4);
      ctx.stroke();
      const offset = (Math.floor(row / 34) % 2) * 28;
      for (let column = offset; column < width; column += 56) {
        ctx.beginPath();
        ctx.moveTo(column, row - 30);
        ctx.lineTo(column - 2, row + 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.lineWidth = 23;
    ctx.strokeStyle = "#c8aa8d";
    ctx.beginPath();
    ctx.moveTo(133, height);
    ctx.lineTo(133, 304);
    ctx.bezierCurveTo(133, 173, 262, 112, 480, 108);
    ctx.bezierCurveTo(698, 112, 827, 173, 827, 304);
    ctx.lineTo(827, height);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ead0aa";
    ctx.stroke();

    drawTorch(73, 332, time);
    drawTorch(887, 332, time + 1.5);
  }

  function drawTorch(x, y, time) {
    const flicker = Math.sin(time * 12) * 2;
    ctx.fillStyle = "#554a60";
    ctx.fillRect(x - 5, y + 9, 10, 28);
    ctx.fillStyle = "#c59b72";
    ctx.fillRect(x - 8, y + 5, 16, 5);
    ctx.save();
    ctx.shadowColor = "#f4a35f";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#f5bd72";
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 6 + flicker * 0.25, 12 + flicker, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff2be";
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPrincessAtCastle(time) {
    ctx.save();
    ctx.fillStyle = "#4c465d";
    ctx.fillRect(25, 346, 103, 47);
    ctx.fillStyle = "#b99b87";
    ctx.fillRect(25, 346, 103, 5);
    ctx.translate(76, 372 + Math.sin(time * 2) * 1.5);
    ctx.scale(0.86, 0.86);
    drawPrincess(time);
    ctx.restore();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff5e7";
    ctx.beginPath();
    ctx.ellipse(x, y, 34 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 15 * scale, y - 3 * scale, 15 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 4 * scale, y - 7 * scale, 20 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 21 * scale, y - 1 * scale, 17 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCastle(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.64;
    ctx.fillStyle = "#6e6988";
    ctx.fillRect(19, 51, 101, 65);
    ctx.fillRect(5, 65, 24, 50);
    ctx.fillRect(110, 63, 25, 52);
    ctx.fillRect(44, 30, 20, 85);
    ctx.fillRect(81, 35, 18, 80);
    ctx.beginPath();
    ctx.moveTo(2, 65); ctx.lineTo(17, 43); ctx.lineTo(32, 65);
    ctx.moveTo(38, 32); ctx.lineTo(54, 7); ctx.lineTo(70, 32);
    ctx.moveTo(76, 36); ctx.lineTo(90, 14); ctx.lineTo(104, 36);
    ctx.moveTo(106, 63); ctx.lineTo(122, 41); ctx.lineTo(139, 63);
    ctx.fill();
    ctx.fillStyle = "#d5b29f";
    for (const [wx, wy] of [[15, 77], [50, 46], [86, 50], [118, 75], [42, 75], [96, 79]]) {
      ctx.beginPath();
      ctx.roundRect(wx, wy, 6, 12, 4);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTreeLine() {
    for (let i = 0; i < 17; i += 1) {
      const x = i * 64 - 17;
      const base = 419 + (i % 3) * 10;
      const scale = 0.56 + (i % 4) * 0.13;
      ctx.fillStyle = i % 2 ? "#687f72" : "#718674";
      ctx.fillRect(x - 4 * scale, base - 42 * scale, 8 * scale, 44 * scale);
      ctx.beginPath();
      ctx.arc(x, base - 48 * scale, 22 * scale, 0, Math.PI * 2);
      ctx.arc(x - 14 * scale, base - 38 * scale, 15 * scale, 0, Math.PI * 2);
      ctx.arc(x + 13 * scale, base - 39 * scale, 16 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFlowers(time) {
    for (const flower of flowers) {
      const bob = Math.sin(time * 1.3 + flower.x) * 1.7;
      ctx.strokeStyle = "rgba(71, 103, 70, 0.72)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(flower.x, flower.y + 8);
      ctx.lineTo(flower.x, flower.y + 19);
      ctx.stroke();
      ctx.fillStyle = flower.color;
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (petal / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          flower.x + Math.cos(angle) * 3 * flower.scale,
          flower.y + bob + Math.sin(angle) * 3 * flower.scale,
          2.2 * flower.scale,
          1.5 * flower.scale,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#e3bc76";
      ctx.beginPath();
      ctx.arc(flower.x, flower.y + bob, 1.3 * flower.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGrass(time) {
    ctx.strokeStyle = "rgba(69, 101, 70, 0.58)";
    ctx.lineWidth = 1.15;
    for (let i = 0; i < 64; i += 1) {
      const x = (i * 43 + 11) % width;
      const y = 455 + ((i * 29) % 94);
      const sway = Math.sin(time * 1.5 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(x, y + 7);
      ctx.quadraticCurveTo(x + sway, y + 1, x + sway * 1.2, y - 5 - (i % 4));
      ctx.stroke();
    }
  }

  function drawDragon(time) {
    if (location === "wildwood") {
      drawWildwoodDragon(time);
    } else {
      drawCastleDragon(time);
    }
  }

  function drawWildwoodDragon(time) {
    if (player.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) return;
    const x = player.x;
    const y = player.y + Math.sin(time * 6) * 3;
    const flap = Math.sin(time * 12) * 0.18;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(47, 55, 74, 0.17)";
    ctx.beginPath();
    ctx.ellipse(4, 33, 55, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4c6a61";
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.quadraticCurveTo(-31, -45 - flap * 65, -48, -55 - flap * 42);
    ctx.quadraticCurveTo(-35, -15, -29, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(4, -47 + flap * 63, 33, -58 + flap * 36);
    ctx.quadraticCurveTo(23, -18, 22, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(202, 220, 173, 0.72)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-30, -16); ctx.lineTo(-42, -49);
    ctx.moveTo(-19, -13); ctx.lineTo(-32, -40);
    ctx.moveTo(15, -13); ctx.lineTo(28, -48);
    ctx.stroke();

    ctx.strokeStyle = "#35564f";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-37, 2);
    ctx.quadraticCurveTo(-54, 15, -65, 1);
    ctx.stroke();
    ctx.fillStyle = "#d89c91";
    ctx.beginPath();
    ctx.arc(-65, 1, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#54796a";
    ctx.beginPath();
    ctx.ellipse(-5, 7, 44, 25, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8bd91";
    ctx.beginPath();
    ctx.ellipse(11, 17, 27, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#405c53";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-21, 22); ctx.lineTo(-24, 30);
    ctx.moveTo(11, 23); ctx.lineTo(9, 30);
    ctx.stroke();
    ctx.fillStyle = "#e5bf9e";
    ctx.beginPath();
    ctx.ellipse(-25, 31, 7, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(8, 31, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#5b806e";
    ctx.beginPath();
    ctx.ellipse(31, -7, 20, 18, -0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#70917a";
    ctx.beginPath();
    ctx.ellipse(45, 0, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9c5a5";
    ctx.beginPath();
    ctx.ellipse(51, 4, 12, 5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d3b97f";
    ctx.beginPath();
    ctx.moveTo(22, -20); ctx.lineTo(19, -31); ctx.lineTo(31, -21);
    ctx.moveTo(37, -21); ctx.lineTo(40, -32); ctx.lineTo(45, -19);
    ctx.fill();
    ctx.fillStyle = "#463c53";
    ctx.beginPath();
    ctx.arc(37, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1bd";
    ctx.beginPath();
    ctx.arc(38, -10, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4b5c53";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(46, 8);
    ctx.quadraticCurveTo(51, 11, 55, 7);
    ctx.stroke();
    ctx.fillStyle = "#df9687";
    ctx.beginPath();
    ctx.arc(33, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    drawPrincess(time);
    ctx.restore();
  }

  function drawCastleDragon(time) {
    ctx.save();
    const sway = Math.sin(time * 2.4) * 4;
    if (player.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) ctx.globalAlpha = 0.55;

    ctx.fillStyle = "#344d49";
    ctx.beginPath();
    ctx.ellipse(480, 586, 231, 82, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(711, 596);
    ctx.quadraticCurveTo(480, 535, 249, 596);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#59786b";
    ctx.beginPath();
    ctx.ellipse(480 + sway, 558, 123, 58, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(603 + sway, 592);
    ctx.quadraticCurveTo(480 + sway, 617, 357 + sway, 592);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a4b993";
    ctx.beginPath();
    ctx.ellipse(480 + sway, 566, 85, 34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#648472";
    ctx.beginPath();
    ctx.moveTo(388, 560);
    ctx.quadraticCurveTo(355, 527, 346, 482);
    ctx.quadraticCurveTo(388, 493, 421, 542);
    ctx.closePath();
    ctx.moveTo(572, 560);
    ctx.quadraticCurveTo(605, 527, 614, 482);
    ctx.quadraticCurveTo(572, 493, 539, 542);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e6c699";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(352, 491); ctx.lineTo(390, 540);
    ctx.moveTo(608, 491); ctx.lineTo(570, 540);
    ctx.stroke();

    ctx.fillStyle = "#4c6e60";
    ctx.beginPath();
    ctx.ellipse(480 + sway, 533, 75, 38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a9bd91";
    ctx.beginPath();
    ctx.ellipse(480 + sway, 543, 56, 23, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#354e49";
    ctx.beginPath();
    ctx.ellipse(458 + sway, 524, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(502 + sway, 524, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const charge = Math.min(1, chargeTime / chargeDuration);
    if (charge > 0) {
      ctx.globalAlpha = 0.3 + charge * 0.55;
      ctx.shadowColor = "#ffb761";
      ctx.shadowBlur = 12 + charge * 26;
      ctx.fillStyle = charge >= 1 ? "#fff0a1" : "#f4a66a";
      ctx.beginPath();
      ctx.ellipse(480 + sway, 555, 35 + charge * 18, 10 + charge * 9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawCrosshair();
  }

  function drawCrosshair() {
    const charge = Math.min(1, chargeTime / chargeDuration);
    const radius = 13 + charge * 8;
    ctx.save();
    ctx.strokeStyle = charge >= 1 ? "#fff1ae" : "#fff8e6";
    ctx.fillStyle = charge >= 1 ? "#fff1ae" : "#fff8e6";
    ctx.lineWidth = 1.5 + charge;
    ctx.shadowColor = charge >= 1 ? "#ffaf5e" : "#594f63";
    ctx.shadowBlur = 7 + charge * 13;
    ctx.beginPath();
    ctx.arc(player.x, player.y, radius, 0.18, Math.PI * 1.82);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(player.x, player.y, 2.3, 0, Math.PI * 2);
    ctx.fill();
    const gap = radius + 5;
    ctx.beginPath();
    ctx.moveTo(player.x - gap - 5, player.y); ctx.lineTo(player.x - gap, player.y);
    ctx.moveTo(player.x + gap, player.y); ctx.lineTo(player.x + gap + 5, player.y);
    ctx.moveTo(player.x, player.y - gap - 5); ctx.lineTo(player.x, player.y - gap);
    ctx.moveTo(player.x, player.y + gap); ctx.lineTo(player.x, player.y + gap + 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawPrincess(time) {
    const bob = Math.sin(time * 7) * 1.5;
    ctx.save();
    ctx.translate(-3, -23 + bob);

    ctx.fillStyle = "#584557";
    ctx.beginPath();
    ctx.ellipse(0, -6, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e9b18f";
    ctx.beginPath();
    ctx.arc(1, -8, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b86f70";
    ctx.beginPath();
    ctx.arc(7, -6, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#684a5c";
    ctx.beginPath();
    ctx.arc(0, -15, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-8, -8, 4, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e9bf6f";
    ctx.beginPath();
    ctx.moveTo(-8, -20); ctx.lineTo(-6, -29); ctx.lineTo(-1, -23);
    ctx.lineTo(3, -30); ctx.lineTo(6, -22); ctx.lineTo(10, -25);
    ctx.lineTo(9, -18); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f9e3a5";
    ctx.beginPath();
    ctx.arc(2, -24, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#cb7f87";
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(12, 14);
    ctx.lineTo(-12, 14); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#efd4a7";
    ctx.beginPath();
    ctx.moveTo(-8, 0); ctx.lineTo(0, 5); ctx.lineTo(8, 0);
    ctx.lineTo(5, 3); ctx.lineTo(0, 8); ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function projectEnemy(enemy, time = 0) {
    const scale = 0.25 + enemy.depth * 1.2;
    return {
      x: width / 2 + enemy.lane * (34 + enemy.depth * 275),
      y: 233 + enemy.depth * 235 + Math.sin(time * 8 + enemy.phase) * scale * 1.4,
      scale,
    };
  }

  function drawWildwoodEnemy(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y + Math.sin(time * 5 + enemy.phase) * 2);
    ctx.globalAlpha = enemy.hitFlash > 0 ? 0.55 + Math.sin(time * 35) * 0.35 : 1;
    ctx.fillStyle = "rgba(55, 49, 66, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 25, 19, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = enemy.kind === "knight" ? "#6c708a" : "#784c67";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, 10); ctx.lineTo(-7, 22);
    ctx.moveTo(5, 10); ctx.lineTo(7, 22);
    ctx.stroke();
    ctx.fillStyle = "#c8a188";
    ctx.beginPath();
    ctx.ellipse(-8, 23, 7, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(7, 23, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = enemy.kind === "knight" ? "#8b91a1" : "#754e72";
    roundedRect(-12, -8, 24, 21, 6);
    ctx.fill();
    ctx.fillStyle = enemy.kind === "knight" ? "#bac0c7" : "#b97378";
    ctx.beginPath();
    ctx.moveTo(-13, -3); ctx.lineTo(0, 7); ctx.lineTo(13, -3);
    ctx.lineTo(9, 14); ctx.lineTo(-9, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e8b99a";
    ctx.beginPath();
    ctx.arc(0, -17, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#553e59";
    ctx.beginPath();
    ctx.arc(2, -17, 1.3, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.kind === "knight") {
      ctx.fillStyle = "#858a9a";
      ctx.beginPath();
      ctx.moveTo(-11, -18); ctx.lineTo(-9, -34); ctx.lineTo(8, -35);
      ctx.lineTo(12, -18); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c5c6c6";
      ctx.fillRect(-8, -24, 17, 3);
      ctx.fillStyle = "#d6a86e";
      ctx.beginPath();
      ctx.moveTo(1, -34); ctx.lineTo(5, -46); ctx.lineTo(8, -34);
      ctx.fill();
      ctx.strokeStyle = "#a7adb7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -1); ctx.lineTo(30, -30);
      ctx.stroke();
      ctx.fillStyle = "#e5c27c";
      ctx.beginPath();
      ctx.moveTo(30, -30); ctx.lineTo(33, -38); ctx.lineTo(35, -28);
      ctx.fill();
    } else {
      ctx.fillStyle = "#684464";
      ctx.beginPath();
      ctx.arc(0, -19, 10, Math.PI, Math.PI * 2);
      ctx.lineTo(9, -18); ctx.lineTo(-10, -18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#eac879";
      ctx.beginPath();
      ctx.moveTo(-6, -23); ctx.lineTo(-4, -31); ctx.lineTo(0, -25);
      ctx.lineTo(4, -32); ctx.lineTo(7, -23); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#865967";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.quadraticCurveTo(25, -5, 25, -19);
      ctx.stroke();
      ctx.fillStyle = "#f0d7bd";
      ctx.beginPath();
      ctx.ellipse(25, -20, 5, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCastleEnemy(enemy, time) {
    const projected = projectEnemy(enemy, time);
    ctx.save();
    ctx.translate(projected.x, projected.y);
    ctx.scale(projected.scale, projected.scale);
    ctx.globalAlpha = enemy.hitFlash > 0 ? 0.55 + Math.sin(time * 35) * 0.35 : 1;

    ctx.fillStyle = "rgba(55, 49, 66, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 29, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const horseColor = enemy.kind === "knight" ? "#947765" : "#785b63";
    ctx.strokeStyle = horseColor;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-17, -1); ctx.lineTo(-20, 12);
    ctx.moveTo(-5, 1); ctx.lineTo(-7, 13);
    ctx.moveTo(12, 0); ctx.lineTo(16, 12);
    ctx.moveTo(21, -4); ctx.lineTo(24, 8);
    ctx.stroke();

    ctx.strokeStyle = "#6b4b55";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-24, -9); ctx.quadraticCurveTo(-34, -13, -31, -23);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = horseColor;
    ctx.beginPath();
    ctx.ellipse(-2, -7, 25, 14, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -14); ctx.quadraticCurveTo(22, -27, 30, -23);
    ctx.lineTo(34, -16); ctx.lineTo(24, -8); ctx.lineTo(12, -5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c79c84";
    ctx.beginPath();
    ctx.arc(31, -18, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d3b67d";
    ctx.beginPath();
    ctx.ellipse(20, -12, 13, 3, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = enemy.kind === "knight" ? "#78849a" : "#985b75";
    ctx.beginPath();
    ctx.moveTo(-10, -19); ctx.lineTo(-2, -27); ctx.lineTo(9, -18);
    ctx.lineTo(10, -5); ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e1c997";
    ctx.fillRect(-6, -20, 12, 3);

    ctx.fillStyle = "#e8b99a";
    ctx.beginPath();
    ctx.arc(0, -33, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#553e59";
    ctx.beginPath();
    ctx.arc(3, -33, 1.2, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.kind === "knight") {
      ctx.fillStyle = "#858a9a";
      ctx.beginPath();
      ctx.moveTo(-9, -34); ctx.lineTo(-7, -47); ctx.lineTo(7, -48);
      ctx.lineTo(10, -34); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c5c6c6";
      ctx.fillRect(-7, -40, 15, 3);
      ctx.fillStyle = "#d6a86e";
      ctx.beginPath();
      ctx.moveTo(1, -48); ctx.lineTo(5, -59); ctx.lineTo(8, -48);
      ctx.fill();
      ctx.strokeStyle = "#a7adb7";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(9, -15); ctx.lineTo(26, -48);
      ctx.stroke();
      ctx.fillStyle = "#e5c27c";
      ctx.beginPath();
      ctx.moveTo(26, -48); ctx.lineTo(29, -57); ctx.lineTo(31, -46);
      ctx.fill();
    } else {
      ctx.fillStyle = "#684464";
      ctx.beginPath();
      ctx.arc(0, -35, 9, Math.PI, Math.PI * 2);
      ctx.lineTo(9, -34); ctx.lineTo(-10, -34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#eac879";
      ctx.beginPath();
      ctx.moveTo(-6, -39); ctx.lineTo(-4, -47); ctx.lineTo(0, -41);
      ctx.lineTo(4, -48); ctx.lineTo(7, -39); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#865967";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(10, -16); ctx.quadraticCurveTo(27, -22, 24, -39);
      ctx.stroke();
      ctx.fillStyle = "#f0d7bd";
      ctx.beginPath();
      ctx.ellipse(24, -40, 5, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    if (location === "wildwood") drawWildwoodEnemy(enemy, time);
    else drawCastleEnemy(enemy, time);
  }

  function drawProjectile(projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.angle);
    ctx.shadowColor = projectile.glow;
    ctx.shadowBlur = 17;
    if (projectile.type === "starlight") {
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff8d5";
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-12, -0.7, 24, 1.4);
      ctx.fillRect(-0.7, -12, 1.4, 24);
    } else {
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, projectile.type === "frost" ? 9 : 12, projectile.type === "frost" ? 5 : 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = projectile.glow;
      ctx.beginPath();
      ctx.arc(3, 0, 2.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateParticles(delta) {
    for (const particle of particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 22 * delta;
      particle.life -= delta;
    }
    particles = particles.filter((particle) => particle.life > 0);
  }

  function update(delta) {
    if (state === "celebrating" || state === "defeat-pending") {
      endingTimer -= delta;
      chargeBlastTimer = Math.max(0, chargeBlastTimer - delta);
      if (state === "celebrating") {
        fireworksTimer -= delta;
        if (fireworksTimer <= 0) {
          spawnFireworks();
          fireworksTimer = 0.42;
        }
      }
      updateParticles(delta);
      if (endingTimer <= 0) {
        const won = state === "celebrating";
        state = won ? "won" : "lost";
        showOverlay(won ? "win" : "loss");
      }
      return;
    }
    if (state !== "playing") return;
    player.invulnerable = Math.max(0, player.invulnerable - delta);
    chargeFlashTimer = Math.max(0, chargeFlashTimer - delta);
    chargeBlastTimer = Math.max(0, chargeBlastTimer - delta);
    shotTimer = Math.max(0, shotTimer - delta);

    let dx = 0;
    let dy = 0;
    if (keys.has("a")) dx -= 1;
    if (keys.has("d")) dx += 1;
    if (keys.has("w")) dy -= 1;
    if (keys.has("s")) dy += 1;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      const speed = location === "wildwood" ? 245 : 300;
      player.x += (dx / length) * speed * delta;
      player.y += (dy / length) * speed * delta;
    }
    if (location === "wildwood") {
      player.x = Math.max(75, Math.min(width - 76, player.x));
      player.y = Math.max(142, Math.min(height - 72, player.y));
    } else {
      player.x = Math.max(184, Math.min(width - 184, player.x));
      player.y = Math.max(188, Math.min(421, player.y));
    }

    if (location === "castle" && chargeHeld) {
      chargeTime = Math.min(chargeDuration, chargeTime + delta);
      if (chargeTime >= chargeDuration) {
        fireChargedBlast();
        chargeHeld = false;
        spaceConsumed = true;
      }
    }
    if (location === "wildwood" && keys.has(" ") && shotTimer === 0) fire();
    updateChargeHud();

    spawnTimer -= delta;
    const enemyLimit = location === "wildwood" ? 7 : 5;
    if (spawnTimer <= 0 && enemies.length < enemyLimit) {
      spawnEnemy();
      if (location === "wildwood") {
        spawnTimer = Math.max(0.72, 1.7 - score * 0.055) + Math.random() * 0.48;
      } else {
        spawnTimer = Math.max(0.7, 1.08 - score * 0.018) + Math.random() * 0.2;
      }
    }

    for (const enemy of enemies) {
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      enemy.slowed = Math.max(0, enemy.slowed - delta);
      if (location === "wildwood") {
        const distance = Math.max(1, Math.hypot(player.x - enemy.x, player.y - enemy.y));
        const speed = enemy.slowed > 0 ? enemy.speed * 0.38 : enemy.speed;
        enemy.x += ((player.x - enemy.x) / distance) * speed * delta;
        enemy.y += ((player.y - enemy.y) / distance) * speed * delta;
        if (distance < 39) {
          enemy.remove = true;
          if (player.invulnerable <= 0) {
            player.lives -= 1;
            player.invulnerable = 1.35;
            burst(player.x + 30, player.y, "#f5c2a6", 12);
            updateHud();
            announceToast("A little too close! Flutter away!");
            if (player.lives <= 0) finishGame(false);
          }
        }
      } else {
        const speed = enemy.slowed > 0 ? enemy.speed * 0.4 : enemy.speed;
        enemy.depth += speed * delta;
        if (enemy.depth >= 1) {
          enemy.remove = true;
          if (player.invulnerable <= 0) {
            player.lives -= 1;
            player.invulnerable = 1.2;
            burst(480, 456, "#f5c2a6", 16);
            updateHud();
            announceToast("A rider reached the castle! Keep them back!");
            if (player.lives <= 0) finishGame(false);
          }
        }
      }
    }

    for (const projectile of projectiles) {
      projectile.x += projectile.vx * delta;
      projectile.y += projectile.vy * delta;
      projectile.life -= delta;
      for (const enemy of enemies) {
        if (enemy.remove || projectile.hitIds.has(enemy.id)) continue;
        const projected = location === "wildwood"
          ? { x: enemy.x, y: enemy.y - 7, scale: 1 }
          : projectEnemy(enemy);
        const hitRadius = location === "wildwood" ? 27 : 20 * projected.scale + 5;
        if (Math.hypot(projectile.x - projected.x, projectile.y - (projected.y - (location === "wildwood" ? 0 : 19 * projected.scale))) < hitRadius) {
          enemy.health -= weapons[projectile.type].damage;
          enemy.hitFlash = 0.18;
          if (weapons[projectile.type].slow) enemy.slowed = weapons[projectile.type].slow;
          projectile.hitIds.add(enemy.id);
          burst(projectile.x, projectile.y, projectile.color, 6);
          if (enemy.health <= 0) {
            enemy.remove = true;
            recordDefeat();
            burst(projected.x, projected.y - 12 * projected.scale, enemy.kind === "knight" ? "#e4d5ba" : "#e2b1cb", 14);
          }
          if (projectile.pierce > 0) projectile.pierce -= 1;
          else projectile.life = -1;
          break;
        }
      }
    }

    updateParticles(delta);
    enemies = enemies.filter((enemy) => !enemy.remove && (location === "wildwood" || enemy.depth < 1));
    projectiles = projectiles.filter((projectile) => projectile.life > 0 && projectile.x < width + 30 && projectile.x > -30);
    if (toastTimer > 0) {
      toastTimer -= delta;
      if (toastTimer <= 0) toast.classList.remove("visible");
    }
  }

  function spawnEnemy() {
    if (location === "wildwood") {
      enemies.push({
        id: `${Date.now()}-${Math.random()}`,
        x: width + 34,
        y: 166 + Math.random() * 275,
        kind: Math.random() < 0.55 ? "knight" : "prince",
        health: score >= 7 && Math.random() < 0.24 ? 2 : 1,
        speed: 38 + Math.min(score * 1.7, 19) + Math.random() * 14,
        phase: Math.random() * 10,
        slowed: 0,
        hitFlash: 0,
        remove: false,
      });
      return;
    }

    enemies.push({
      id: `${Date.now()}-${Math.random()}`,
      lane: -0.82 + Math.random() * 1.64,
      depth: 0.04,
      kind: Math.random() < 0.55 ? "knight" : "prince",
      health: score >= 7 && Math.random() < 0.24 ? 2 : 1,
      speed: 0.095 + Math.min(score * 0.002, 0.025) + Math.random() * 0.018,
      phase: Math.random() * 10,
      slowed: 0,
      hitFlash: 0,
      remove: false,
    });
  }

  function fire() {
    const config = weapons[weapon];
    runStats.shots += 1;
    runStats.weapons[weapon] = (runStats.weapons[weapon] || 0) + 1;
    const isWildwood = location === "wildwood";
    const originX = isWildwood ? player.x + 42 : width / 2;
    const originY = isWildwood ? player.y - 1 : height - 23;
    let target = null;
    if (isWildwood) {
      let nearest = Infinity;
      for (const enemy of enemies) {
        const distance = Math.hypot(enemy.x - originX, enemy.y - originY);
        if (!enemy.remove && distance < nearest) {
          nearest = distance;
          target = enemy;
        }
      }
    }
    const angle = isWildwood
      ? target ? Math.atan2(target.y - originY, target.x - originX) : 0
      : Math.atan2(player.y - originY, player.x - originX);
    const speed = config.speed;
    projectiles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      color: config.color,
      glow: config.glow,
      type: weapon,
      life: 2.2,
      pierce: config.pierce,
      hitIds: new Set(),
    });
    if (isWildwood) shotTimer = config.rate;
    burst(originX, originY - 5, config.glow, 3, 25);
  }

  function fireChargedBlast() {
    chargeBlastTimer = chargeBlastDuration;
    chargeFlashTimer = 1.6;
    chargeTime = 0;
    runStats.shots += 1;
    const targets = enemies.filter((enemy) => !enemy.remove).slice(0, Math.min(5, levelGoal - score));
    for (const enemy of targets) {
      enemy.remove = true;
      recordDefeat();
      const projected = projectEnemy(enemy);
      burst(projected.x, projected.y - 14 * projected.scale, enemy.kind === "knight" ? "#f8d68e" : "#f2b1b2", 22, 130);
    }
    updateChargeHud();
    announceToast(targets.length
      ? `Dragonfire! ${targets.length} horse${targets.length === 1 ? "man" : "men"} sent packing!`
      : "Dragonfire! The gate is clear!");
  }

  function updateChargeHud() {
    const progress = Math.min(1, chargeTime / chargeDuration);
    chargeFill.style.width = `${progress * 100}%`;
    chargeTimeLabel.textContent = `${progress.toFixed(1)} / 3.0s`;
    const holdLabel = hasTouchInput ? "HOLD FIRE · 3S DRAGONFIRE" : "HOLD SPACE · 3S DRAGONFIRE";
    chargeLabel.textContent = chargeHeld
      ? "DRAGONFIRE CHARGING"
      : chargeFlashTimer > 0
        ? "DRAGONFIRE UNLEASHED!"
        : holdLabel;
    chargeFill.classList.toggle("charged", progress >= 1);
  }

  function updateLocationDetails() {
    const wildwood = location === "wildwood";
    locationStamp.textContent = wildwood ? "THE WILDWOOD" : "THE CASTLE";
    locationScoreLabel.textContent = wildwood ? "UNWELCOME SUITORS" : "RIDERS SENT PACKING";
    locationCaption.textContent = wildwood
      ? "THE WILDWOOD IS NOT A DATING APP"
      : "THE CASTLE IS NOT A DATING APP";
    movementKeyGrid.hidden = hasTouchInput;
    spaceKey.hidden = hasTouchInput;
    pauseKey.hidden = hasTouchInput;
    movementDescription.textContent = hasTouchInput
      ? wildwood ? "touch & drag to fly" : "touch & drag to aim"
      : wildwood ? "move your dragon" : "aim your dragon";
    overlayKicker.textContent = wildwood ? "A STORY OF FIRE & FRIENDSHIP" : "FROM THE SAFETY OF THE CASTLE";
    overlayTitle.innerHTML = wildwood
      ? "Not all knights<br>are <em>charming.</em>"
      : "The castle gate<br>is <em>under siege.</em>";
    overlayCopy.textContent = wildwood
      ? "Help Princess Poppy and her dragon keep the Wildwood safe. Clear 12 suitors to finish Level 1; each new level adds 2 more."
      : "Defend the castle from mounted knights and princes. Clear 12 riders to finish Level 1; each new level adds 2 more.";
    overlayHint.textContent = hasTouchInput
      ? wildwood
        ? "Touch & drag to fly · hold FIRE to breathe"
        : "Touch & drag to aim · hold FIRE 3s for dragonfire"
      : wildwood
        ? "WASD to fly · hold SPACE to fire your homing breath"
        : "WASD to aim · tap SPACE to fire · hold 3 seconds for dragonfire";
    chargeMeter.hidden = wildwood;
    spaceDescription.textContent = hasTouchInput
      ? wildwood ? "hold FIRE to breathe" : "tap FIRE · hold 3s: dragonfire"
      : wildwood ? "hold to fire your homing breath" : "tap: fire · hold 3s: dragonfire";
    pauseDescription.textContent = hasTouchInput ? "tap Pause to take a breather" : "take a little breather";
    touchDragHint.textContent = "Swipe up, down, left or right to guide your dragon";
    touchFire.setAttribute("aria-label", wildwood
      ? "Hold to fire homing breath"
      : "Tap to fire or hold for 3 seconds to unleash dragonfire");
    touchFireHint.textContent = wildwood ? "HOLD" : "HOLD 3S";
    canvas.setAttribute("aria-label", wildwood
      ? "Princess Poppy riding a dragon through the Wildwood as knights approach"
      : "A dragon's first-person view defending the princess's castle from approaching mounted knights and princes");
  }

  function selectLocation(nextLocation) {
    if (location === nextLocation) return;
    location = nextLocation;
    level = 1;
    levelsCompleted = 0;
    levelGoal = 12;
    runStats = { destroyed: 0, shots: 0, weapons: {} };
    locationButtons.forEach((button) => {
      const selected = button.dataset.location === location;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    state = "title";
    keys.clear();
    player = location === "wildwood"
      ? { x: 168, y: 290, lives: 3, invulnerable: 0 }
      : { x: 480, y: 310, lives: 3, invulnerable: 0 };
    enemies = [];
    projectiles = [];
    particles = [];
    score = 0;
    spawnTimer = location === "wildwood" ? 0.9 : 0.35;
    chargeHeld = false;
    spaceConsumed = false;
    chargeTime = 0;
    shotTimer = 0;
    chargeFlashTimer = 0;
    chargeBlastTimer = 0;
    toast.classList.remove("visible");
    toast.textContent = "";
    toastTimer = 0;
    overlay.classList.remove("hidden");
    startButton.innerHTML = "Let’s fly <span aria-hidden=\"true\">↗</span>";
    updateTouchControls();
    updateHud();
    updateChargeHud();
    updateLocationDetails();
  }

  function burst(x, y, color, count, force = 68) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 16 + Math.random() * force;
      const life = 0.22 + Math.random() * 0.4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1 + Math.random() * 2.4,
        color,
        life,
        maxLife: life,
      });
    }
  }

  function spawnFireworks() {
    burst(225, 152, "#ffe09a", 26, 132);
    burst(480, 115, "#f5b1aa", 30, 145);
    burst(735, 154, "#d4b8f3", 26, 132);
  }

  function updateHud() {
    scoreValue.textContent = String(score).padStart(2, "0");
    scoreGoalValue.textContent = String(levelGoal);
    levelValue.textContent = `LEVEL ${level} · ${levelsCompleted} CLEARED`;
    livesValue.textContent = `${"♥ ".repeat(Math.max(0, player.lives))}${"♡ ".repeat(Math.max(0, 3 - player.lives))}`.trim();
    moodValue.innerHTML = `<span class="mood-dot"></span> ${player.lives === 1 ? "A LITTLE NERVOUS" : player.lives === 2 ? "BRAVE" : "PLAYFUL"}`;
  }

  function recordDefeat() {
    if (state !== "playing") return;
    score = Math.min(levelGoal, score + 1);
    runStats.destroyed += 1;
    updateHud();
    if (score >= levelGoal) finishGame(true);
  }

  function readStoredValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error(`Could not read ${key} from local storage.`, error);
      announceToast("Your saved preferences are unavailable in this browser.");
      return null;
    }
  }

  function writeStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Could not save ${key} to local storage.`, error);
      announceToast("Your preference could not be saved.");
      return false;
    }
  }

  async function saveLeaderboard() {
    if (levelsCompleted === 0) return;
    if (!globalRatingEndpoint) {
      announceToast("Global rating setup is required before scores can be shared.");
      return;
    }
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      announceToast("Open the game in Telegram to submit a global score.");
      return;
    }
    const mostUsedWeapon = Object.entries(runStats.weapons)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "none yet";
    try {
      const response = await fetch(globalRatingEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          location,
          name: playerNameInput.value.trim().slice(0, 24),
          levelsCompleted,
          destroyed: runStats.destroyed,
          shots: runStats.shots,
          weapon: mostUsedWeapon,
        }),
      });
      if (!response.ok) throw new Error(`Score submission failed (${response.status}).`);
      announceToast("Your score was added to the global rating!");
      if (!ratingModal.hidden) renderLeaderboard();
    } catch (error) {
      console.error("Could not submit score to the global rating.", error);
      announceToast("Your global score could not be submitted. Try again later.");
    }
  }

  async function renderLeaderboard() {
    const requestId = ++leaderboardRequestId;
    leaderboardList.replaceChildren();
    const message = (text) => {
      const item = document.createElement("li");
      item.className = "leaderboard-empty";
      item.textContent = text;
      leaderboardList.replaceChildren(item);
    };
    if (!globalRatingEndpoint) {
      message("Global rating setup is not complete yet.");
      return;
    }
    message("Loading global scores…");
    try {
      const url = new URL(globalRatingEndpoint);
      url.searchParams.set("location", leaderboardLocation);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Leaderboard request failed (${response.status}).`);
      const result = await response.json();
      if (!Array.isArray(result.entries)) throw new Error("Leaderboard response is malformed.");
      if (requestId !== leaderboardRequestId) return;
      leaderboardList.replaceChildren();
      if (!result.entries.length) {
        message("No global scores yet. Complete a level to claim the first spot.");
        return;
      }
      result.entries.forEach((entry, index) => {
        const item = document.createElement("li");
        item.className = "leaderboard-entry";
        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = String(index + 1).padStart(2, "0");
        const details = document.createElement("span");
        details.className = "leaderboard-details";
        const name = document.createElement("strong");
        name.textContent = entry.name;
        const stats = document.createElement("small");
        const levels = `${entry.levelsCompleted} ${entry.levelsCompleted === 1 ? "level" : "levels"}`;
        stats.textContent = `${levels} · ${entry.destroyed} suitors / ${entry.shots} shots · ${entry.weapon}`;
        details.append(name, stats);
        item.append(rank, details);
        leaderboardList.append(item);
      });
    } catch (error) {
      console.error("Could not load the global rating.", error);
      if (requestId === leaderboardRequestId) message("Global rating is temporarily unavailable.");
    }
  }

  async function updatePlayerName() {
    const name = playerNameInput.value.trim().slice(0, 24);
    writeStoredValue(playerNameStorageKey, name);
    const initData = window.Telegram?.WebApp?.initData;
    if (!globalRatingEndpoint || !initData) return;
    try {
      const response = await fetch(globalRatingEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, name }),
      });
      if (!response.ok) throw new Error(`Name update failed (${response.status}).`);
      if (!ratingModal.hidden) renderLeaderboard();
    } catch (error) {
      console.error("Could not update the global rating name.", error);
      announceToast("Your global rating name could not be updated.");
    }
  }

  function announceToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = 2.3;
  }

  function startGame() {
    if (state === "won") {
      startNextLevel();
      return;
    }
    levelsCompleted = 0;
    level = 1;
    levelGoal = 12;
    runStats = { destroyed: 0, shots: 0, weapons: {} };
    startLevel(true);
  }

  function startNextLevel() {
    level = levelsCompleted + 1;
    levelGoal = 12 + (levelsCompleted * 2);
    startLevel(false);
  }

  function startLevel(resetLives) {
    keys.clear();
    const lives = resetLives ? 3 : player.lives;
    player = location === "wildwood"
      ? { x: 168, y: 290, lives, invulnerable: 0 }
      : { x: 480, y: 310, lives, invulnerable: 0 };
    enemies = [];
    projectiles = [];
    particles = [];
    score = 0;
    spawnTimer = location === "wildwood" ? 0.9 : 0.35;
    chargeHeld = false;
    spaceConsumed = false;
    chargeTime = 0;
    shotTimer = 0;
    chargeFlashTimer = 0;
    chargeBlastTimer = 0;
    state = "playing";
    overlay.classList.add("hidden");
    updateTouchControls();
    updateHud();
    updateChargeHud();
    startButton.blur();
  }

  function showOverlay(kind) {
    overlay.classList.remove("hidden");
    if (kind === "pause") {
      overlayKicker.textContent = "TAKE YOUR TIME";
      overlayTitle.innerHTML = "A little<br><em>breather.</em>";
      overlayCopy.textContent = location === "wildwood"
        ? "The Wildwood can wait a moment. Take a breath, then get back to protecting the princess."
        : "The castle gate can wait a moment. Take a breath, then keep those riders back.";
      startButton.innerHTML = "Back to it <span aria-hidden=\"true\">↗</span>";
    } else if (kind === "win") {
      overlayKicker.textContent = `LEVEL ${levelsCompleted} COMPLETE · ${levelsCompleted} ${levelsCompleted === 1 ? "LEVEL" : "LEVELS"} WITHOUT A LOSS`;
      overlayTitle.innerHTML = location === "wildwood"
        ? "Another little<br><em>victory.</em>"
        : "The castle is<br><em>safe again.</em>";
      overlayCopy.textContent = `You sent ${levelGoal} unwelcome suitors packing without losing a heart. Next level: ${levelGoal + 2} suitors.`;
      startButton.innerHTML = `Next level · ${levelGoal + 2} <span aria-hidden="true">↗</span>`;
    } else if (kind === "loss") {
      overlayKicker.textContent = "A SMALL SETBACK";
      overlayTitle.innerHTML = "Heroes need<br>a <em>rest, too.</em>";
      overlayCopy.textContent = location === "wildwood"
        ? `The Wildwood will be here when you’re ready. Your streak ends at ${levelsCompleted} ${levelsCompleted === 1 ? "level" : "levels"}. Perhaps choose a different dragon breath next time?`
        : `The castle will be here when you’re ready. Your streak ends at ${levelsCompleted} ${levelsCompleted === 1 ? "level" : "levels"}. Perhaps choose a different dragon breath next time?`;
      startButton.innerHTML = "Try again <span aria-hidden=\"true\">↗</span>";
    }
    updateTouchControls();
  }

  function finishGame(won) {
    if (state !== "playing") return;
    if (won) {
      levelsCompleted += 1;
      saveLeaderboard();
    } else {
      saveLeaderboard();
    }
    state = won ? "celebrating" : "defeat-pending";
    updateHud();
    endingTimer = won ? 2.8 : 1.8;
    fireworksTimer = 0;
    keys.clear();
    chargeHeld = false;
    chargeTime = 0;
    updateChargeHud();
    updateTouchControls();
    if (won) spawnFireworks();
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      keys.clear();
      spaceConsumed = chargeHeld;
      chargeHeld = false;
      chargeTime = 0;
      updateChargeHud();
      showOverlay("pause");
      updateTouchControls();
    } else if (state === "paused") {
      state = "playing";
      overlay.classList.add("hidden");
      updateTouchControls();
    }
  }

  function updateTouchControls() {
    const active = state === "playing";
    touchControls.classList.toggle("active", active);
    touchControls.setAttribute("aria-hidden", String(!active));
    if (!active) {
      touchDragPointerId = null;
      ["w", "a", "s", "d"].forEach((key) => keys.delete(key));
      touchControlButtons.forEach((button) => {
        button.classList.remove("pressed");
        button.setAttribute("aria-pressed", "false");
      });
    }
  }

  function pressControl(key, repeat = false) {
    if (key === " ") {
      if (state === "playing" && location === "wildwood") {
        if (!repeat && !keys.has(" ")) fire();
        keys.add(" ");
      } else if (state === "playing" && !repeat && !spaceConsumed) {
        chargeHeld = true;
        chargeTime = 0;
        updateChargeHud();
      }
      return;
    }
    keys.add(key);
  }

  function releaseControl(key) {
    if (key !== " ") {
      keys.delete(key);
      return;
    }
    keys.delete(" ");
    if (chargeHeld) {
      chargeHeld = false;
      if (chargeTime < chargeDuration) fire();
      chargeTime = 0;
      updateChargeHud();
    }
    spaceConsumed = false;
  }

  function setTouchButtonPressed(button, pressed) {
    button.classList.toggle("pressed", pressed);
    button.setAttribute("aria-pressed", String(pressed));
  }

  function startTouchDrag(event) {
    if (!hasTouchInput || event.pointerType !== "touch" || state !== "playing" || event.target.closest("#touch-controls")) return;
    event.preventDefault();
    if (touchDragPointerId !== null) return;
    touchDragPointerId = event.pointerId;
    touchDragStartX = event.clientX;
    touchDragStartY = event.clientY;
    arena.setPointerCapture(event.pointerId);
  }

  function updateTouchDrag(event) {
    if (event.pointerId !== touchDragPointerId || state !== "playing") return;
    event.preventDefault();
    const deltaX = event.clientX - touchDragStartX;
    const deltaY = event.clientY - touchDragStartY;
    ["w", "a", "s", "d"].forEach((key) => keys.delete(key));
    if (deltaX < -18) keys.add("a");
    if (deltaX > 18) keys.add("d");
    if (deltaY < -18) keys.add("w");
    if (deltaY > 18) keys.add("s");
  }

  function endTouchDrag(event) {
    if (event.pointerId !== touchDragPointerId) return;
    ["w", "a", "s", "d"].forEach((key) => keys.delete(key));
    touchDragPointerId = null;
  }

  function openRating() {
    ratingPausedGame = state === "playing";
    if (ratingPausedGame) togglePause();
    ratingModal.hidden = false;
    renderLeaderboard();
    ratingCloseButton.focus();
  }

  function closeRating() {
    if (ratingModal.hidden) return;
    ratingModal.hidden = true;
    if (ratingPausedGame && state === "paused") togglePause();
    ratingPausedGame = false;
    ratingOpenButton.focus();
  }

  function render(time) {
    drawBackground(time);
    for (const projectile of projectiles) drawProjectile(projectile);
    for (const enemy of enemies) drawEnemy(enemy, time);
    drawDragon(time);
    drawParticles();
    drawChargedBlast();
  }

  function drawChargedBlast() {
    if (chargeBlastTimer <= 0) return;
    const progress = 1 - chargeBlastTimer / chargeBlastDuration;
    const alpha = Math.min(1, chargeBlastTimer / 0.32);
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    const glow = ctx.createRadialGradient(width / 2, height - 90, 8, width / 2, height - 90, 230 + progress * 290);
    glow.addColorStop(0, "rgba(255, 246, 194, 0.95)");
    glow.addColorStop(0.35, "rgba(255, 188, 100, 0.58)");
    glow.addColorStop(1, "rgba(241, 130, 89, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = alpha * (0.25 + progress * 0.35);
    const flame = ctx.createLinearGradient(0, height, 0, 150);
    flame.addColorStop(0, "#fff0a7");
    flame.addColorStop(0.42, "#f7a460");
    flame.addColorStop(1, "rgba(240, 126, 91, 0)");
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(359 - progress * 90, height);
    ctx.quadraticCurveTo(402, 392, 480, 165);
    ctx.quadraticCurveTo(558, 392, 601 + progress * 90, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function frame(timestamp) {
    const delta = Math.min(0.035, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    update(delta);
    render(timestamp / 1000);
    requestAnimationFrame(frame);
  }

  startButton.addEventListener("click", () => {
    if (state === "paused") {
      togglePause();
    } else {
      startGame();
    }
  });

  weaponButtons.forEach((button) => {
    button.addEventListener("click", () => {
      weapon = button.dataset.weapon;
      weaponButtons.forEach((option) => {
        const selected = option === button;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
      const names = { ember: "Ember breath", frost: "Frost bloom", starlight: "Stardust" };
      announceToast(`${names[weapon]} — ready!`);
    });
  });

  locationButtons.forEach((button) => {
    button.addEventListener("click", () => selectLocation(button.dataset.location));
  });

  leaderboardButtons.forEach((button) => {
    button.addEventListener("click", () => {
      leaderboardLocation = button.dataset.leaderboard;
      leaderboardButtons.forEach((tab) => {
        const selected = tab === button;
        tab.classList.toggle("selected", selected);
        tab.setAttribute("aria-selected", String(selected));
      });
      renderLeaderboard();
    });
  });

  playerNameInput.value = readStoredValue(playerNameStorageKey) || "";
  playerNameInput.addEventListener("change", updatePlayerName);

  touchControlButtons.forEach((button) => {
    const key = " ";
    const release = (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTouchButtonPressed(button, false);
      releaseControl(key);
    };
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      if (state !== "playing") return;
      button.setPointerCapture(event.pointerId);
      setTouchButtonPressed(button, true);
      pressControl(key);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  arena.addEventListener("pointerdown", startTouchDrag);
  arena.addEventListener("pointermove", updateTouchDrag);
  arena.addEventListener("pointerup", endTouchDrag);
  arena.addEventListener("pointercancel", endTouchDrag);
  arena.addEventListener("lostpointercapture", endTouchDrag);

  document.querySelector("#touch-pause").addEventListener("click", togglePause);
  ratingOpenButton.addEventListener("click", openRating);
  ratingCloseButton.addEventListener("click", closeRating);
  ratingModal.querySelector("[data-rating-close]").addEventListener("click", closeRating);

  document.addEventListener("keydown", (event) => {
    if (event.repeat && (event.code === "Escape" || event.code === "Enter")) return;
    if (event.code === "Escape") {
      event.preventDefault();
      if (!ratingModal.hidden) {
        closeRating();
        return;
      }
      if (state === "playing" || state === "paused") togglePause();
      return;
    }
    if (event.code === "Enter" && (state === "title" || state === "won" || state === "lost")) {
      startGame();
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      pressControl(" ", event.repeat);
      return;
    }
    const key = movementKeys[event.code];
    if (key) {
      event.preventDefault();
      pressControl(key, event.repeat);
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      releaseControl(" ");
      return;
    }
    const key = movementKeys[event.code];
    if (key) releaseControl(key);
  });
  window.addEventListener("blur", () => {
    keys.clear();
    chargeHeld = false;
    spaceConsumed = false;
    chargeTime = 0;
    updateChargeHud();
    updateTouchControls();
  });

  updateTouchControls();
  updateLocationDetails();
  updateHud();
  updateChargeHud();
  startGame();
  requestAnimationFrame(frame);
})();
