/**
 * farm-map.js — 2D Farm Map with Canvas rendering
 * Pixel-art style isometric farm with animated chickens, eggs, chicks.
 */
const FarmMap = (() => {
  let canvas, ctx, W, H;
  let entities = [];
  let selectedEntity = null;
  let animFrame = 0;
  let farmData = null;
  let onSelectCallback = null;
  let dpr = 1;

  // ── Color palette ──────────────────────────────────
  const PAL = {
    grass1: '#2d5a1e', grass2: '#3a6e28', grass3: '#4a8233',
    dirt: '#6b5030', dirtLight: '#8a6840',
    fence: '#8b6914', fencePost: '#6b4f0a',
    water: '#3b7dd8', waterLight: '#5fa0f0',
    barn: '#9c3030', barnRoof: '#6b1818', barnDoor: '#5a2020',
    coop: '#c4a35a', coopRoof: '#8b7030',
    silo: '#889098', siloRoof: '#606870',
    trough: '#7a6840',
    shadow: 'rgba(0,0,0,0.18)',
  };

  // ── Species color map ──────────────────────────────
  const SPECIES_COLORS = {
    'Comum':             { body: '#f5f5dc', wing: '#e8dcc0', comb: '#cc3030', beak: '#e8a020' },
    'Caipira Melhorada': { body: '#c87830', wing: '#a06020', comb: '#dd2020', beak: '#d89020' },
    'Poedeira Premium':  { body: '#f0e68c', wing: '#daa520', comb: '#ff2040', beak: '#ff8c00' },
  };

  const DEFAULT_COLORS = { body: '#ddd', wing: '#bbb', comb: '#c33', beak: '#da0' };

  // ── Initialization ─────────────────────────────────
  function init(canvasId, onSelect) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    onSelectCallback = onSelect;
    dpr = window.devicePixelRatio || 1;

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleHover);

    loop();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = Math.max(420, Math.min(560, W * 0.5));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Update farm data ───────────────────────────────
  function update(data) {
    farmData = data;
    rebuildEntities();
  }

  function rebuildEntities() {
    if (!farmData) return;
    entities = [];

    const margin = 60;
    const farmW = W - margin * 2;
    const farmH = H - margin * 2 - 40;

    // Place chickens in a semi-random but stable grid
    const chickens = farmData.chickens || [];
    const chicks = farmData.chicks || [];
    const eggCount = farmData.eggs_available || 0;

    // Chicken positions — spread across pasture area
    chickens.forEach((c, i) => {
      const seed = hashId(c.id);
      const col = i % 6;
      const row = Math.floor(i / 6);
      const x = margin + 100 + col * (farmW - 100) / 6 + seededRandom(seed) * 30;
      const y = margin + 80 + row * 65 + seededRandom(seed + 1) * 20;

      entities.push({
        type: 'chicken',
        data: c,
        x, y,
        dir: seededRandom(seed + 2) > 0.5 ? 1 : -1,
        bobOffset: seededRandom(seed + 3) * Math.PI * 2,
        walkPhase: seededRandom(seed + 4) * Math.PI * 2,
        colors: SPECIES_COLORS[c.species] || DEFAULT_COLORS,
        starving: !!c.starvation_started_at,
      });
    });

    // Chicks — near their region
    chicks.forEach((c, i) => {
      const seed = hashId(c.id + 1000);
      const x = margin + 80 + (i % 8) * 55 + seededRandom(seed) * 20;
      const y = H - margin - 80 + seededRandom(seed + 1) * 40;

      entities.push({
        type: 'chick',
        data: c,
        x, y,
        dir: seededRandom(seed + 2) > 0.5 ? 1 : -1,
        bobOffset: seededRandom(seed + 3) * Math.PI * 2,
      });
    });

    // Eggs — scattered near the coop
    for (let i = 0; i < Math.min(eggCount, 20); i++) {
      const seed = hashId(i + 5000);
      entities.push({
        type: 'egg',
        x: margin + 20 + seededRandom(seed) * 70,
        y: margin + 60 + seededRandom(seed + 1) * (farmH - 40),
        tilt: seededRandom(seed + 2) * 0.3 - 0.15,
      });
    }
  }

  // ── Main render loop ───────────────────────────────
  function loop() {
    animFrame++;
    render();
    requestAnimationFrame(loop);
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawStructures();
    drawEntities();
    drawHUD();
  }

  // ── Background ─────────────────────────────────────
  function drawBackground() {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    skyGrad.addColorStop(0, '#1a2a44');
    skyGrad.addColorStop(1, '#2a4a30');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Ground
    const groundY = 40;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, PAL.grass2);
    groundGrad.addColorStop(0.3, PAL.grass1);
    groundGrad.addColorStop(1, '#1e4015');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Grass texture patches
    const t = animFrame * 0.02;
    for (let i = 0; i < 40; i++) {
      const seed = i * 137.5;
      const gx = (seed * 7.31) % W;
      const gy = groundY + 20 + (seed * 3.17) % (H - groundY - 30);
      const sway = Math.sin(t + seed) * 2;

      ctx.strokeStyle = PAL.grass3;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.quadraticCurveTo(gx + sway, gy - 8, gx + sway * 0.5, gy - 14);
      ctx.stroke();
    }

    // Dirt path
    ctx.fillStyle = PAL.dirt;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.65);
    ctx.quadraticCurveTo(W * 0.3, H * 0.6, W * 0.5, H * 0.63);
    ctx.quadraticCurveTo(W * 0.7, H * 0.66, W, H * 0.62);
    ctx.lineTo(W, H * 0.68);
    ctx.quadraticCurveTo(W * 0.7, H * 0.72, W * 0.5, H * 0.69);
    ctx.quadraticCurveTo(W * 0.3, H * 0.66, 0, H * 0.71);
    ctx.closePath();
    ctx.fill();

    // Fence
    drawFence(30, H * 0.35, W - 60, H * 0.55);

    // Pond
    drawPond(W - 120, H * 0.42, 45, 22);
  }

  function drawFence(x, y, w, h) {
    ctx.strokeStyle = PAL.fence;
    ctx.lineWidth = 2;

    // Horizontal rails
    for (let r = 0; r < 2; r++) {
      const ry = y + r * 18;
      ctx.beginPath();
      ctx.moveTo(x, ry);
      ctx.lineTo(x + w, ry);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, ry + h);
      ctx.lineTo(x + w, ry + h);
      ctx.stroke();
    }

    // Posts
    const postSpacing = w / 12;
    ctx.fillStyle = PAL.fencePost;
    for (let i = 0; i <= 12; i++) {
      const px = x + i * postSpacing;
      ctx.fillRect(px - 2, y - 5, 4, 45);
      // Post cap
      ctx.fillStyle = PAL.fence;
      ctx.fillRect(px - 3, y - 8, 6, 4);
      ctx.fillStyle = PAL.fencePost;
    }
  }

  function drawPond(cx, cy, rx, ry) {
    ctx.fillStyle = PAL.water;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shimmer
    const shimmer = Math.sin(animFrame * 0.05) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(95,160,240,${shimmer})`;
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy - 4, rx * 0.4, ry * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Farm structures ────────────────────────────────
  function drawStructures() {
    // Chicken coop (left side)
    drawCoop(20, 50);

    // Barn (far right)
    drawBarn(W - 95, 25);

    // Feed trough
    drawTrough(W * 0.45, H * 0.48);

    // Silo
    drawSilo(W - 55, 80);
  }

  function drawCoop(x, y) {
    // Body
    ctx.fillStyle = PAL.coop;
    ctx.fillRect(x, y + 20, 60, 40);

    // Roof
    ctx.fillStyle = PAL.coopRoof;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 20);
    ctx.lineTo(x + 30, y);
    ctx.lineTo(x + 65, y + 20);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#4a3520';
    roundRect(x + 22, y + 35, 16, 25, 3);
    ctx.fill();

    // Perch
    ctx.strokeStyle = PAL.fence;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 45);
    ctx.lineTo(x + 55, y + 45);
    ctx.stroke();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Coop', x + 30, y + 73);
  }

  function drawBarn(x, y) {
    // Body
    ctx.fillStyle = PAL.barn;
    ctx.fillRect(x, y + 25, 70, 50);

    // Roof
    ctx.fillStyle = PAL.barnRoof;
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 25);
    ctx.lineTo(x + 35, y);
    ctx.lineTo(x + 75, y + 25);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = PAL.barnDoor;
    roundRect(x + 24, y + 42, 22, 33, 3);
    ctx.fill();

    // Cross beam
    ctx.strokeStyle = '#4a1515';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 42);
    ctx.lineTo(x + 46, y + 75);
    ctx.moveTo(x + 46, y + 42);
    ctx.lineTo(x + 24, y + 75);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Barn', x + 35, y + 88);
  }

  function drawSilo(x, y) {
    ctx.fillStyle = PAL.silo;
    ctx.fillRect(x, y, 25, 55);

    ctx.fillStyle = PAL.siloRoof;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 12.5, y - 15);
    ctx.lineTo(x + 27, y);
    ctx.closePath();
    ctx.fill();

    // Bands
    ctx.strokeStyle = '#606870';
    ctx.lineWidth = 1.5;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.moveTo(x, y + 12 + b * 16);
      ctx.lineTo(x + 25, y + 12 + b * 16);
      ctx.stroke();
    }
  }

  function drawTrough(x, y) {
    ctx.fillStyle = PAL.trough;
    ctx.fillRect(x - 20, y, 40, 10);
    ctx.fillRect(x - 22, y + 10, 4, 8);
    ctx.fillRect(x + 18, y + 10, 4, 8);

    // Feed inside
    if (farmData && farmData.feed_balance > 0) {
      const fillLevel = Math.min(1, farmData.feed_balance / 50);
      ctx.fillStyle = '#d4a040';
      ctx.fillRect(x - 18, y + 2, 36, 6 * fillLevel);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Feed', x, y + 28);
  }

  // ── Entity rendering ───────────────────────────────
  function drawEntities() {
    // Sort by y position for depth ordering
    const sorted = [...entities].sort((a, b) => a.y - b.y);

    for (const e of sorted) {
      const isSelected = selectedEntity === e;
      switch (e.type) {
        case 'chicken': drawChicken(e, isSelected); break;
        case 'chick':   drawChick(e, isSelected); break;
        case 'egg':     drawEgg(e); break;
      }
    }
  }

  function drawChicken(e, selected) {
    const t = animFrame * 0.04;
    const bob = Math.sin(t + e.bobOffset) * 2;
    const walkBob = Math.abs(Math.sin(t * 1.5 + e.walkPhase)) * 1.5;
    const headBob = Math.sin(t * 2 + e.bobOffset) * 1.5;
    const x = e.x;
    const y = e.y + bob;
    const d = e.dir;
    const c = e.colors;

    ctx.save();

    // Shadow
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = '#d89020';
    ctx.lineWidth = 2;
    const legSpread = Math.sin(t * 1.5 + e.walkPhase) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 4 * d, y + 8);
    ctx.lineTo(x - 4 * d - legSpread, y + 15);
    ctx.moveTo(x + 2 * d, y + 8);
    ctx.lineTo(x + 2 * d + legSpread, y + 15);
    ctx.stroke();

    // Feet
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 4 * d - legSpread - 3, y + 15);
    ctx.lineTo(x - 4 * d - legSpread + 3, y + 15);
    ctx.moveTo(x + 2 * d + legSpread - 3, y + 15);
    ctx.lineTo(x + 2 * d + legSpread + 3, y + 15);
    ctx.stroke();

    // Body
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.ellipse(x, y, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = c.wing;
    ctx.beginPath();
    ctx.ellipse(x - 3 * d, y + 1, 8, 6, d * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Tail feathers
    ctx.fillStyle = c.wing;
    ctx.beginPath();
    ctx.moveTo(x - 12 * d, y - 2);
    ctx.lineTo(x - 18 * d, y - 8);
    ctx.lineTo(x - 16 * d, y - 2);
    ctx.lineTo(x - 20 * d, y - 5);
    ctx.lineTo(x - 14 * d, y + 2);
    ctx.closePath();
    ctx.fill();

    // Head
    const hx = x + 10 * d + headBob * d;
    const hy = y - 8 + walkBob;
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.arc(hx, hy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(hx + 3 * d, hy - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx + 3.5 * d, hy - 1.5, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = c.beak;
    ctx.beginPath();
    ctx.moveTo(hx + 6 * d, hy - 1);
    ctx.lineTo(hx + 11 * d, hy + 1);
    ctx.lineTo(hx + 6 * d, hy + 2);
    ctx.closePath();
    ctx.fill();

    // Comb
    ctx.fillStyle = c.comb;
    ctx.beginPath();
    ctx.moveTo(hx - 1 * d, hy - 5);
    ctx.lineTo(hx + 1 * d, hy - 9);
    ctx.lineTo(hx + 3 * d, hy - 6);
    ctx.lineTo(hx + 5 * d, hy - 10);
    ctx.lineTo(hx + 6 * d, hy - 5);
    ctx.closePath();
    ctx.fill();

    // Wattle
    ctx.fillStyle = c.comb;
    ctx.beginPath();
    ctx.ellipse(hx + 4 * d, hy + 4, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Starving indicator
    if (e.starving) {
      const pulse = Math.sin(animFrame * 0.1) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255,80,80,${pulse})`;
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 22);

      // Hunger icon
      ctx.strokeStyle = `rgba(255,80,80,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 26, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Selection ring
    if (selected) {
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 20, 14, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Name tag
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      roundRect(x - 35, y - 40, 70, 16, 4);
      ctx.fill();
      ctx.fillStyle = '#69f0ae';
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${e.data.species} #${e.data.id}`, x, y - 28);
    }

    ctx.restore();
  }

  function drawChick(e, selected) {
    const t = animFrame * 0.06;
    const bob = Math.sin(t + e.bobOffset) * 1.5;
    const hop = Math.abs(Math.sin(t * 2 + e.bobOffset)) * 2;
    const x = e.x;
    const y = e.y + bob - hop;
    const d = e.dir;

    ctx.save();

    // Shadow
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath();
    ctx.ellipse(x, e.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tiny legs
    ctx.strokeStyle = '#d89020';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 5);
    ctx.lineTo(x - 3, y + 7);
    ctx.moveTo(x + 2, y + 5);
    ctx.lineTo(x + 3, y + 7);
    ctx.stroke();

    // Fluffy body
    ctx.fillStyle = '#fff44f';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Fluff texture
    ctx.fillStyle = '#ffe040';
    ctx.beginPath();
    ctx.arc(x - 2, y - 1, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 2.5 * d, y - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // Tiny beak
    ctx.fillStyle = '#e8a020';
    ctx.beginPath();
    ctx.moveTo(x + 5 * d, y);
    ctx.lineTo(x + 8 * d, y + 1);
    ctx.lineTo(x + 5 * d, y + 2);
    ctx.closePath();
    ctx.fill();

    // Tiny wing flap
    const flapAngle = Math.sin(t * 3) * 0.4;
    ctx.fillStyle = '#ffe840';
    ctx.beginPath();
    ctx.ellipse(x - 3 * d, y + 1, 4, 3, flapAngle * d, 0, Math.PI * 2);
    ctx.fill();

    if (selected) {
      ctx.strokeStyle = '#69f0ae';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.ellipse(x, y, 12, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      roundRect(x - 40, y - 24, 80, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#fff44f';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Chick → ${e.data.target_species}`, x, y - 14);
    }

    ctx.restore();
  }

  function drawEgg(e) {
    const x = e.x;
    const y = e.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(e.tilt);

    // Shadow
    ctx.fillStyle = PAL.shadow;
    ctx.beginPath();
    ctx.ellipse(0, 6, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Egg shape
    ctx.fillStyle = '#faf0e6';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(-1.5, -2, 2, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── HUD overlay ────────────────────────────────────
  function drawHUD() {
    if (!farmData) return;

    // Top-left stats
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(8, 8, 150, 52, 8);
    ctx.fill();

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#69f0ae';
    ctx.fillText(`Chickens: ${farmData.chickens.length}`, 16, 24);
    ctx.fillStyle = '#faf0e6';
    ctx.fillText(`Eggs: ${farmData.eggs_available}`, 16, 38);
    ctx.fillStyle = '#fff44f';
    ctx.fillText(`Chicks: ${farmData.chicks.length}`, 16, 52);

    // Feed + Balance (top-right)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(W - 158, 8, 150, 38, 8);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#d4a040';
    ctx.fillText(`Feed: ${farmData.feed_balance.toFixed(1)}`, W - 16, 24);
    ctx.fillStyle = '#76f7be';
    ctx.fillText(`${farmData.balance_usdt.toFixed(2)} USDT`, W - 16, 38);

    // Time of day indicator
    const hour = new Date().getHours();
    const isDaytime = hour >= 6 && hour < 20;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(W / 2 - 30, 8, 60, 18, 6);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = isDaytime ? '#ffd700' : '#aac';
    ctx.fillText(isDaytime ? 'Day' : 'Night', W / 2, 21);

    // Empty farm message
    if (entities.length === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(W / 2 - 120, H / 2 - 20, 240, 40, 10);
      ctx.fill();
      ctx.fillStyle = '#a9b6d0';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Buy your first chicken to start!', W / 2, H / 2 + 5);
    }
  }

  // ── Interaction ────────────────────────────────────
  function handleClick(evt) {
    const rect = canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;

    const hit = findEntity(mx, my);
    selectedEntity = hit;

    if (hit && onSelectCallback) {
      onSelectCallback(hit);
    }
  }

  function handleHover(evt) {
    const rect = canvas.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;
    const hit = findEntity(mx, my);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }

  function findEntity(mx, my) {
    // Search in reverse (top-rendered last = front)
    const sorted = [...entities].sort((a, b) => b.y - a.y);
    for (const e of sorted) {
      const radius = e.type === 'egg' ? 8 : e.type === 'chick' ? 10 : 18;
      const dx = mx - e.x;
      const dy = my - e.y;
      if (dx * dx + dy * dy < radius * radius) {
        return e;
      }
    }
    return null;
  }

  // ── Helpers ────────────────────────────────────────
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function hashId(id) {
    return ((id * 2654435761) >>> 0) % 10000;
  }

  function seededRandom(seed) {
    const x = Math.sin(seed * 127.1) * 43758.5453;
    return x - Math.floor(x);
  }

  return { init, update };
})();
