/**
 * farm-map.js — Pixel-Art Living Farm with AI entities
 */
const FarmMap = (() => {
  let canvas, ctx, W, H, dpr = 1;
  let farmData = null, onSelectCb = null, selectedEntity = null;
  let lastTime = 0, gt = 0; // gt = gameTime
  let entities = [], particles = [], clouds = [], butterflies = [];
  let grass = [], flowers = [], trees = [], rocks = [], fireflies = [];
  const MAX_PARTICLES = 120;
  let sortedEntities = [], sortDirty = true;
  let rooster = null;
  let farmer = { active:false, x:-40, y:0, dir:1, phase:0, state:'idle', timer:0, feedTimer:0, walkTarget:0 };
  const FENCE_Y_RATIO = 0.27;
  const POND = { cxR:0.82, cyR:0.38 };

  const S = { IDLE:0, WALK:1, PECK:2, EAT:3, SLEEP:4, FLAP:5, DRINK:6, FENCE:7, SCRATCH:8, CROW:9, COURT:10 };
  const TROUGH = { xR: 0.48, yR: 0.58 };
  const PASTURE = { x0: 0.05, x1: 0.95, y0: 0.28, y1: 0.92 };

  const PAL = {
    grass1:'#1e6b12', grass2:'#2d8a1e', grass3:'#3da82e', grass4:'#4ec03a', grassD:'#165a0e',
    dirt1:'#6b4e31', dirt2:'#8a6842', dirt3:'#a88855',
    fence:'#9b7b3a', fenceD:'#6b5020',
    water1:'#2878b8', waterHi:'#70c0f0',
    barn1:'#a83030', barn2:'#d84040', barnR:'#5a1818',
    coop1:'#c4a050', coop2:'#dab860', coopR:'#7a6028',
    silo1:'#8090a0', silo2:'#a0b0c0',
    trough:'#6a5830', feed:'#daa040',
    shadow:'rgba(0,0,0,0.15)',
    leafG:'#2a8020', leafD:'#1a5a10', trunk:'#5a3a1a', trunkD:'#3a2010',
  };

  const SPCOL = {
    'Comum':            {body:'#f8f4ee',wing:'#e8e0d0',comb:'#cc3030',beak:'#e8a020',legs:'#d89020',outline:'#c8c0b0'},
    'Caipira Melhorada':{body:'#a85020',wing:'#884018',comb:'#dd2020',beak:'#d89020',legs:'#8a5020',outline:'#6a3010'},
    'Poedeira Premium': {body:'#ffe040',wing:'#daa520',comb:'#ff2040',beak:'#ff8c00',legs:'#d8a030',outline:'#c89000',shimmer:true},
  };
  const DCOL = {body:'#ddd',wing:'#bbb',comb:'#c33',beak:'#da0',legs:'#d90',outline:'#aaa'};
  const ROOSTER_COL = {body:'#1a5a30',wing:'#0e4020',comb:'#ff1a1a',beak:'#ff8c00',legs:'#cc7020',outline:'#0a3018',tail1:'#003080',tail2:'#1a6030',tail3:'#008060'};

  function hash(n){return((n*2654435761)>>>0)%10000}
  function sr(s){const x=Math.sin(s*127.1)*43758.5453;return x-Math.floor(x)}
  function rr(a,b){return a+Math.random()*(b-a)}
  function lerp(a,b,t){return a+(b-a)*t}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

  // ── Init ───────────────────────────────────────
  function init(canvasId, onSelect) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    onSelectCb = onSelect;
    dpr = window.devicePixelRatio || 1;
    resize();
    window.addEventListener('resize', () => { resize(); genWorld(); });
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onHover);
    genWorld();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = r.width; H = Math.max(550, Math.min(780, W * 0.65));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function update(data) { farmData = data; rebuildEntities(); }

  // ── World Gen ──────────────────────────────────
  function genWorld() {
    clouds = []; for(let i=0;i<8;i++) clouds.push({x:Math.random()*W*1.5-W*0.25, y:10+Math.random()*60, w:50+Math.random()*100, spd:3+Math.random()*6, op:0.12+Math.random()*0.2});
    grass = []; for(let i=0;i<120;i++) grass.push({x:Math.random()*W, y:H*0.25+Math.random()*H*0.75, h:4+Math.random()*12, ph:Math.random()*Math.PI*2, c:[PAL.grass2,PAL.grass3,PAL.grass4][i%3]});
    flowers = []; const fc=['#ff6b8a','#ffaa40','#aa80ff','#ff4060','#fff','#ffccee','#88ddff']; for(let i=0;i<40;i++) flowers.push({x:Math.random()*W, y:H*0.32+Math.random()*H*0.60, c:fc[i%fc.length], sz:1.5+Math.random()*2.5, ph:Math.random()*Math.PI*2});
    trees = []; [0.02,0.92,0.50,0.72,0.15].forEach((p,i) => trees.push({x:W*p+sr(i*77)*30, y:H*0.18+sr(i*33)*25, sc:0.7+sr(i*55)*0.6, ph:Math.random()*Math.PI*2}));
    rocks = []; for(let i=0;i<10;i++) rocks.push({x:W*0.05+sr(i*99)*W*0.9, y:H*0.4+sr(i*44)*H*0.45, sz:2+sr(i*22)*5, c:sr(i*66)>0.5?'#667':'#778'});
    butterflies = []; ['#ff6b8a','#aa80ff','#ffdd44','#80ddff','#ff9944','#88ff88'].forEach((c,i) => butterflies.push({x:Math.random()*W, y:H*0.3+Math.random()*H*0.4, vx:0,vy:0, tx:Math.random()*W, ty:H*0.3+Math.random()*H*0.4, c, wp:Math.random()*Math.PI*2, tmr:0}));
  }

  // ── Loop ───────────────────────────────────────
  function loop(now) {
    const dt = Math.min(0.05,(now-lastTime)/1000); lastTime=now; gt+=dt;
    tick(dt); render();
    requestAnimationFrame(loop);
  }

  function tick(dt) {
    clouds.forEach(c => { c.x += c.spd*dt; if(c.x > W+c.w) c.x = -c.w*1.5; });
    butterflies.forEach(b => {
      b.tmr-=dt; if(b.tmr<=0){b.tx=W*0.05+Math.random()*W*0.9; b.ty=H*0.25+Math.random()*H*0.45; b.tmr=2+Math.random()*4;}
      const dx=b.tx-b.x, dy=b.ty-b.y, d=Math.sqrt(dx*dx+dy*dy)||1;
      b.vx=lerp(b.vx,(dx/d)*30,dt*2); b.vy=lerp(b.vy,(dy/d)*30+Math.sin(gt*3)*10,dt*2);
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.wp+=dt*14;
    });
    entities.forEach(e => tickEntity(e,dt));
    if(rooster) tickRooster(rooster,dt);
    tickFarmer(dt);
    sortDirty = true;
    // Cap particles
    if(particles.length>MAX_PARTICLES) particles.length=MAX_PARTICLES;
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||0)*dt;}
    const hr=new Date().getHours(), night=hr<6||hr>=20;
    if(night&&fireflies.length<12) fireflies.push({x:Math.random()*W,y:H*0.3+Math.random()*H*0.5,vx:rr(-15,15),vy:rr(-10,10),ph:Math.random()*Math.PI*2,life:3+Math.random()*5});
    if(!night) fireflies=[];
    for(let i=fireflies.length-1;i>=0;i--){const f=fireflies[i];f.life-=dt;if(f.life<=0){fireflies.splice(i,1);continue;}f.x+=f.vx*dt+Math.sin(gt*2+f.ph)*8*dt;f.y+=f.vy*dt+Math.cos(gt*1.5+f.ph)*5*dt;f.ph+=dt;}
  }

  // ── Entity AI ──────────────────────────────────
  function canSpawn(){return particles.length<MAX_PARTICLES;}
  function tickEntity(e, dt) {
    e.at = (e.at||0)+dt; e.st = (e.st||0)-dt;
    if (e.type==='egg') return;
    if (e.st<=0) pickState(e);
    switch(e.state) {
      case S.WALK: moveToTarget(e,dt); break;
      case S.EAT: e.eatB=Math.abs(Math.sin(e.at*8))*3; if(canSpawn()&&Math.random()<dt*3) particles.push({x:e.x+e.dir*8,y:e.y-2,vx:rr(-15,15),vy:rr(-25,-10),life:0.5,color:PAL.feed,sz:1.5,g:50}); break;
      case S.PECK: e.peckB=Math.abs(Math.sin(e.at*10))*5; if(canSpawn()&&Math.random()<dt*2) particles.push({x:e.x+e.dir*6,y:e.y+8,vx:rr(-8,8),vy:rr(-5,-15),life:0.6,color:PAL.dirt2,sz:1.5,g:20}); break;
      case S.FLAP: e.flapA=Math.sin(e.at*12)*0.6; if(canSpawn()&&Math.random()<dt*2) particles.push({x:e.x,y:e.y-4,vx:rr(-20,20),vy:rr(-20,-5),life:1.2,color:e.colors?e.colors.wing:'#eee',sz:2,g:12,feather:1}); break;
      case S.SLEEP: e.sleepB=Math.sin(e.at*1.5)*1; break;
      case S.DRINK: e.drinkB=Math.abs(Math.sin(e.at*6))*4; if(canSpawn()&&Math.random()<dt*2) particles.push({x:e.x+e.dir*6,y:e.y+2,vx:rr(-3,3),vy:rr(-8,-3),life:0.4,color:PAL.waterHi,sz:1.5,g:15}); break;
      case S.FENCE: e.fenceB=Math.sin(e.at*1.5)*1; break;
      case S.SCRATCH: {
        e.scratchB=Math.sin(e.at*10)*3;
        // Alternate feet scratching
        if(canSpawn()&&Math.random()<dt*4) particles.push({x:e.x+(Math.sin(e.at*5)>0?-4:4),y:e.y+(e.type==='chick'?6:14),vx:rr(-12,12),vy:rr(-8,-3),life:0.5,color:PAL.dirt2,sz:2,g:25});
        break;
      }
      default: e.idleB=Math.sin(e.at*2+(e.bo||0))*1;
    }
  }

  function pickState(e) {
    const hr=new Date().getHours(), night=hr<6||hr>=21;
    if(night&&e.type==='chicken'){
      // Some chickens sleep on the fence at night
      if(Math.random()<0.2){e.state=S.FENCE;e.st=5+Math.random()*8;e.y=H*FENCE_Y_RATIO+18;e.x=W*0.1+Math.random()*W*0.7;return;}
      e.state=S.SLEEP;e.st=3+Math.random()*5;return;
    }
    const r=Math.random();
    if(e.type==='chick'){
      if(r<0.30){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=18+Math.random()*12;e.st=6;}
      else if(r<0.50){e.state=S.PECK;e.st=1+Math.random()*2;}
      else if(r<0.60){e.state=S.SCRATCH;e.st=1.5+Math.random()*2;} // chicks scratch too
      else{e.state=S.IDLE;e.st=1+Math.random()*3;}
      return;
    }
    if(r<0.20){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=14+Math.random()*10;e.st=8;}
    else if(r<0.32&&farmData&&farmData.feed_balance>0){e.state=S.WALK;e.tx=W*TROUGH.xR+rr(-20,20);e.ty=H*TROUGH.yR+rr(-5,15);e.spd=16+Math.random()*8;e.st=8;e.goEat=1;}
    else if(r<0.42){e.state=S.SCRATCH;e.st=2+Math.random()*3;} // scratching the ground
    else if(r<0.52){
      // Walk to pond and drink
      e.state=S.WALK;e.tx=W*POND.cxR+rr(-20,15);e.ty=H*POND.cyR+rr(-5,10);e.spd=12+Math.random()*6;e.st=10;e.goDrink=1;
    }
    else if(r<0.62){e.state=S.PECK;e.st=1.5+Math.random()*2.5;}
    else if(r<0.70){e.state=S.FLAP;e.st=0.8+Math.random()*1.2;}
    else if(r<0.78){
      // Perch on fence
      e.state=S.WALK;e.tx=W*0.1+Math.random()*W*0.7;e.ty=H*FENCE_Y_RATIO+18;e.spd=14;e.st=8;e.goFence=1;
    }
    else{e.state=S.IDLE;e.st=2+Math.random()*4;}
  }

  function moveToTarget(e, dt) {
    if(!e.tx){e.state=S.IDLE;return;}
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<5){
      if(e.goEat){e.state=S.EAT;e.st=2+Math.random()*3;e.goEat=0;}
      else if(e.goDrink){e.state=S.DRINK;e.st=2+Math.random()*3;e.goDrink=0;}
      else if(e.goFence){e.state=S.FENCE;e.st=4+Math.random()*6;e.goFence=0;e.y=H*FENCE_Y_RATIO+18;}
      else{e.state=S.IDLE;e.st=1+Math.random()*2;}
      return;
    }
    const s=e.spd||20;e.x+=(dx/d)*s*dt;e.y+=(dy/d)*s*dt;e.dir=dx>0?1:-1;
    e.wp=(e.wp||0)+dt*8;
    if(canSpawn()&&Math.random()<dt*4) particles.push({x:e.x-e.dir*3,y:e.y+(e.type==='chick'?6:14),vx:-e.dir*rr(3,10),vy:rr(-3,-8),life:0.4,color:'rgba(139,119,90,0.4)',sz:2,g:8});
  }

  // ── Rooster AI ────────────────────────────────
  function tickRooster(r, dt) {
    r.at=(r.at||0)+dt; r.st=(r.st||0)-dt;
    if(r.st<=0) pickRoosterState(r);
    switch(r.state){
      case S.WALK: {
        const dx=r.tx-r.x,dy=r.ty-r.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<5){
          if(r.goFence){r.state=S.FENCE;r.st=4+Math.random()*6;r.goFence=0;r.y=H*FENCE_Y_RATIO+18;}
          else if(r.goCourt&&r.courtTarget){r.state=S.COURT;r.st=2+Math.random()*2;}
          else{r.state=S.IDLE;r.st=1+Math.random()*3;}
        } else {const s=r.spd||16;r.x+=(dx/d)*s*dt;r.y+=(dy/d)*s*dt;r.dir=dx>0?1:-1;r.wp=(r.wp||0)+dt*8;}
        break;
      }
      case S.FENCE: r.fenceB=Math.sin(r.at*1.5)*1; break;
      case S.CROW: r.crowB=Math.sin(r.at*6)*3; if(r.at-r.crowStart>1.5){r.state=S.IDLE;r.st=2;} break;
      case S.COURT: {
        if(r.courtTarget){const ct=r.courtTarget;r.dir=ct.x>r.x?1:-1;r.courtA=(r.courtA||0)+dt*10;}
        break;
      }
      case S.FLAP: r.flapA=Math.sin(r.at*12)*0.6; break;
      default: r.idleB=Math.sin(r.at*2)*1;
    }
  }

  function pickRoosterState(r) {
    const hr=new Date().getHours(), night=hr<6||hr>=21;
    if(night){r.state=S.SLEEP;r.st=5+Math.random()*8;return;}
    // Dawn crow
    if(hr>=6&&hr<7&&Math.random()<0.3){r.state=S.CROW;r.st=3;r.crowStart=r.at;return;}
    const rnd=Math.random();
    const chickens=entities.filter(e=>e.type==='chicken');
    if(rnd<0.25){
      // Walk to fence and perch
      r.state=S.WALK;r.tx=W*0.15+Math.random()*W*0.6;r.ty=H*FENCE_Y_RATIO+18;r.spd=14;r.st=10;r.goFence=1;
    } else if(rnd<0.45&&chickens.length>0){
      // Court a chicken
      const target=chickens[Math.floor(Math.random()*chickens.length)];
      r.state=S.WALK;r.tx=target.x+15*r.dir;r.ty=target.y;r.spd=18;r.st=8;r.goCourt=1;r.courtTarget=target;r.courtA=0;
    } else if(rnd<0.55){
      r.state=S.CROW;r.st=3;r.crowStart=r.at;
    } else if(rnd<0.70){
      r.state=S.WALK;r.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());r.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());r.spd=12+Math.random()*8;r.st=8;
    } else if(rnd<0.80){
      r.state=S.FLAP;r.st=1+Math.random()*1.5;
    } else {
      r.state=S.IDLE;r.st=2+Math.random()*4;
    }
  }

  // ── Farmer AI ────────────────────────────────
  function tickFarmer(dt) {
    farmer.phase+=dt;
    // Farmer appears 5 times per day (every ~4.8h game time), stays ~20 seconds
    if(!farmer.active) {
      farmer.feedTimer=(farmer.feedTimer||0)+dt;
      if(farmer.feedTimer>90){farmer.feedTimer=0;farmer.active=true;farmer.x=-40;farmer.y=H*0.63;farmer.dir=1;farmer.state='walkIn';farmer.walkTarget=W*TROUGH.xR;farmer.phase=0;}
      return;
    }
    farmer.phase+=dt;
    switch(farmer.state){
      case 'walkIn':
        farmer.x+=45*dt; farmer.wp=(farmer.wp||0)+dt*5;
        if(farmer.x>=farmer.walkTarget){farmer.state='feed';farmer.timer=3;}
        break;
      case 'feed':
        farmer.timer-=dt; farmer.feedAnim=(farmer.feedAnim||0)+dt;
        if(canSpawn()&&Math.random()<dt*5) particles.push({x:farmer.x+10,y:farmer.y-10,vx:rr(-20,20),vy:rr(-30,-10),life:0.8,color:PAL.feed,sz:2,g:40});
        if(farmer.timer<=0){farmer.state='walkOut';farmer.dir=1;}
        break;
      case 'walkOut':
        farmer.x+=45*dt; farmer.wp=(farmer.wp||0)+dt*5;
        if(farmer.x>W+50){farmer.active=false;}
        break;
    }
  }

  // ── Rebuild Entities ───────────────────────────
  function rebuildEntities() {
    if(!farmData) return;
    const old=new Map(); entities.forEach(e=>{const k=e.type+':'+(e.data?e.data.id:e.ei);old.set(k,e);});
    const nw=[];
    (farmData.chickens||[]).forEach(c=>{
      const k='chicken:'+c.id, ex=old.get(k);
      if(ex){ex.data=c;ex.starving=!!c.starvation_started_at;ex.colors=SPCOL[c.species]||DCOL;nw.push(ex);}
      else{const s=hash(c.id);nw.push({type:'chicken',data:c,x:lerp(W*PASTURE.x0,W*PASTURE.x1,sr(s)),y:lerp(H*PASTURE.y0,H*PASTURE.y1,sr(s+1)),dir:sr(s+2)>0.5?1:-1,bo:sr(s+3)*Math.PI*2,wp:0,colors:SPCOL[c.species]||DCOL,starving:!!c.starvation_started_at,state:S.IDLE,st:Math.random()*3,at:Math.random()*10,spd:14+sr(s+4)*10});}
    });
    (farmData.chicks||[]).forEach(c=>{
      const k='chick:'+c.id, ex=old.get(k);
      if(ex){ex.data=c;nw.push(ex);}
      else{const s=hash(c.id+5000);nw.push({type:'chick',data:c,x:lerp(W*PASTURE.x0,W*PASTURE.x1,sr(s)),y:lerp(H*(PASTURE.y1-0.15),H*PASTURE.y1,sr(s+1)),dir:sr(s+2)>0.5?1:-1,bo:sr(s+3)*Math.PI*2,wp:0,state:S.IDLE,st:Math.random()*2,at:Math.random()*10,spd:18+sr(s+4)*12});}
    });
    const ec=farmData.eggs_available||0;
    for(let i=0;i<Math.min(ec,20);i++){const s=hash(i+9000);nw.push({type:'egg',ei:i,x:W*0.06+sr(s)*W*0.08,y:H*0.38+sr(s+1)*H*0.15,tilt:sr(s+2)*0.3-0.15,state:S.IDLE});}
    entities=nw;
    // Spawn rooster if there are chickens and no rooster yet
    if(nw.some(e=>e.type==='chicken') && !rooster) {
      rooster={type:'rooster',x:W*0.5,y:H*0.5,dir:1,bo:0,wp:0,colors:ROOSTER_COL,state:S.IDLE,st:2+Math.random()*3,at:0,spd:12+Math.random()*8,courtTarget:null};
    } else if(!nw.some(e=>e.type==='chicken')) { rooster=null; }
  }

  // ── Render ─────────────────────────────────────
  function render() {
    if(!ctx) return; ctx.clearRect(0,0,W,H); ctx.imageSmoothingEnabled=false;
    drawSky(); drawClouds(); drawGround(); drawTrees(); drawFence(); drawPond();
    drawRocks(); drawFlowers(); drawGrass(); drawStructures();
    drawEntities(); drawButterflies(); drawParticles(); drawFireflies(); drawHUD();
  }

  function lerpCol(a,b,t){const ah=parseInt(a.slice(1),16),bh=parseInt(b.slice(1),16);const ar=(ah>>16)&0xff,ag=(ah>>8)&0xff,ab=ah&0xff;const br=(bh>>16)&0xff,bg=(bh>>8)&0xff,bb=bh&0xff;const r=Math.round(ar+(br-ar)*t),g=Math.round(ag+(bg-ag)*t),bl=Math.round(ab+(bb-ab)*t);return'#'+((r<<16)|(g<<8)|bl).toString(16).padStart(6,'0');}

  function drawSky() {
    const hr=new Date().getHours()+new Date().getMinutes()/60;
    let st,sb,na=0;
    if(hr>=6&&hr<8){const t=(hr-6)/2;st=lerpCol('#0f1b2d','#4a90c4',t);sb=lerpCol('#1a2030','#ff6b35',t*0.6);} else if(hr>=8&&hr<17){st='#4a90c4';sb='#87ceeb';} else if(hr>=17&&hr<20){const t=(hr-17)/3;st=lerpCol('#4a90c4','#0f1b2d',t);sb=lerpCol('#87ceeb','#ff6b35',t<0.5?t*2:2-t*2);na=t*0.3;} else{st='#0f1b2d';sb='#0a0f1a';na=0.35;}
    const g=ctx.createLinearGradient(0,0,0,H*0.32);g.addColorStop(0,st);g.addColorStop(1,sb);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const night=hr<6||hr>=20;
    if(night){for(let i=0;i<30;i++){const sx=sr(i*13)*W,sy=sr(i*17)*H*0.25,tw=0.3+Math.sin(gt*2+i)*0.3;ctx.fillStyle=`rgba(255,255,240,${tw})`;ctx.fillRect(sx|0,sy|0,1.5,1.5);}ctx.fillStyle='#e8e4d4';ctx.beginPath();ctx.arc(W*0.8,35,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d8d4c4';ctx.beginPath();ctx.arc(W*0.8-4,32,4,0,Math.PI*2);ctx.fill();}
    else if(hr>=6&&hr<20){const sp=(hr-6)/14,sx=W*0.1+sp*W*0.8,sy=15+Math.sin(sp*Math.PI)*-10+30;const gl=ctx.createRadialGradient(sx,sy,5,sx,sy,30);gl.addColorStop(0,'rgba(255,230,100,0.5)');gl.addColorStop(1,'rgba(255,230,100,0)');ctx.fillStyle=gl;ctx.fillRect(sx-30,sy-30,60,60);ctx.fillStyle='#ffe066';ctx.beginPath();ctx.arc(sx,sy,10,0,Math.PI*2);ctx.fill();}
    if(na>0){ctx.fillStyle=`rgba(10,15,30,${na})`;ctx.fillRect(0,0,W,H);}
  }

  function drawClouds(){clouds.forEach(c=>{ctx.fillStyle=`rgba(255,255,255,${c.op})`;ctx.beginPath();ctx.ellipse(c.x,c.y,c.w*0.5,10,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x-c.w*0.2,c.y-5,c.w*0.3,8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x+c.w*0.2,c.y-3,c.w*0.25,7,0,0,Math.PI*2);ctx.fill();});}

  function drawGround() {
    const gy=H*0.28;
    const g=ctx.createLinearGradient(0,gy,0,H);g.addColorStop(0,PAL.grass2);g.addColorStop(0.15,PAL.grass1);g.addColorStop(0.6,PAL.grassD);g.addColorStop(1,'#0e3008');ctx.fillStyle=g;ctx.fillRect(0,gy,W,H-gy);
    ctx.fillStyle=PAL.grass3;ctx.fillRect(0,gy,W,3);
    // Dirt path
    ctx.fillStyle=PAL.dirt1;ctx.beginPath();ctx.moveTo(-10,H*0.62);ctx.bezierCurveTo(W*0.2,H*0.58,W*0.35,H*0.64,W*0.5,H*0.61);ctx.bezierCurveTo(W*0.65,H*0.58,W*0.8,H*0.63,W+10,H*0.60);ctx.lineTo(W+10,H*0.66);ctx.bezierCurveTo(W*0.8,H*0.69,W*0.65,H*0.64,W*0.5,H*0.67);ctx.bezierCurveTo(W*0.35,H*0.70,W*0.2,H*0.64,-10,H*0.68);ctx.closePath();ctx.fill();
    ctx.fillStyle=PAL.dirt3;for(let i=0;i<30;i++){const px=sr(i*47)*W,py=H*0.60+sr(i*53)*H*0.08;ctx.fillRect(px|0,py|0,2,1);}
  }

  function drawTrees(){trees.forEach(t=>drawTree(t.x,t.y,t.sc,t.ph));}
  function drawTree(x,y,s,ph){
    const sw=Math.sin(gt*0.8+ph)*2*s;
    ctx.fillStyle=PAL.trunk;ctx.fillRect(x-4*s,y,8*s,30*s);ctx.fillStyle=PAL.trunkD;ctx.fillRect(x-4*s,y,3*s,30*s);
    [{ox:sw,oy:-18*s,r:22*s,c:PAL.leafD},{ox:-8*s+sw*0.8,oy:-14*s,r:16*s,c:PAL.leafG},{ox:8*s+sw*0.6,oy:-12*s,r:14*s,c:PAL.leafG},{ox:sw*0.5,oy:-24*s,r:16*s,c:PAL.leafD},{ox:3*s+sw*0.7,oy:-20*s,r:14*s,c:PAL.grass2}].forEach(l=>{ctx.fillStyle=l.c;ctx.beginPath();ctx.arc(x+l.ox,y+l.oy,l.r,0,Math.PI*2);ctx.fill();});
    ctx.fillStyle=PAL.grass4;for(let i=0;i<5;i++){const lx=x+sr(hash((x|0)+i))*20*s-10*s+sw,ly=y-10*s-sr(hash((x|0)+i+50))*20*s;ctx.fillRect(lx|0,ly|0,3,2);}
  }

  function drawFence(){
    const fy=H*FENCE_Y_RATIO,fh=20,fx=20,fw=W-40,np=Math.floor(fw/40);
    for(let i=0;i<=np;i++){const px=fx+i*(fw/np);ctx.fillStyle=PAL.shadow;ctx.fillRect(px-1,fy+fh+1,5,3);ctx.fillStyle=PAL.fenceD;ctx.fillRect(px,fy-3,4,fh+6);ctx.fillStyle=PAL.fence;ctx.fillRect(px-1,fy-5,6,4);}
    ctx.fillStyle=PAL.fence;ctx.fillRect(fx,fy+3,fw,3);ctx.fillRect(fx,fy+fh-5,fw,3);
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(fx,fy+3,fw,1);ctx.fillRect(fx,fy+fh-5,fw,1);
  }

  function drawPond(){
    const cx=W*POND.cxR,cy=H*POND.cyR,rx=42,ry=18;
    ctx.fillStyle='#0a3a10';ctx.beginPath();ctx.ellipse(cx,cy+2,rx+3,ry+2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=PAL.water1;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<3;i++){const sx=cx-12+i*12+Math.sin(gt*1.5+i)*4,sa=0.15+Math.sin(gt*2+i*2)*0.1;ctx.fillStyle=`rgba(112,192,240,${sa})`;ctx.beginPath();ctx.ellipse(sx,cy-2+i*3,8,2,0,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#2a7a20';ctx.beginPath();ctx.ellipse(cx+14,cy+3,6,3,0.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff8090';ctx.beginPath();ctx.arc(cx+14,cy+1,2,0,Math.PI*2);ctx.fill();
  }

  function drawRocks(){rocks.forEach(r=>{ctx.fillStyle=r.c;ctx.beginPath();ctx.ellipse(r.x,r.y,r.sz,r.sz*0.6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.1)';ctx.beginPath();ctx.ellipse(r.x-r.sz*0.2,r.y-r.sz*0.2,r.sz*0.4,r.sz*0.25,0,0,Math.PI*2);ctx.fill();});}

  function drawFlowers(){flowers.forEach(f=>{const sw=Math.sin(gt*1.5+f.ph)*1.5;ctx.strokeStyle='#2a7a18';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+sw,f.y-f.sz*3);ctx.stroke();const fx=f.x+sw,fy=f.y-f.sz*3;ctx.fillStyle=f.c;for(let p=0;p<5;p++){const a=(p/5)*Math.PI*2+gt*0.3;ctx.beginPath();ctx.arc(fx+Math.cos(a)*f.sz,fy+Math.sin(a)*f.sz,f.sz*0.6,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ffee44';ctx.beginPath();ctx.arc(fx,fy,f.sz*0.4,0,Math.PI*2);ctx.fill();});}

  function drawGrass(){grass.forEach(g=>{const sw=Math.sin(gt*1.2+g.ph)*2;ctx.strokeStyle=g.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.quadraticCurveTo(g.x+sw,g.y-g.h*0.6,g.x+sw*0.8,g.y-g.h);ctx.stroke();ctx.beginPath();ctx.moveTo(g.x+2,g.y);ctx.quadraticCurveTo(g.x+2+sw*0.7,g.y-g.h*0.5,g.x+3+sw*0.6,g.y-g.h*0.8);ctx.stroke();});}

  // ── Structures ─────────────────────────────────
  function drawStructures(){drawCoop(W*0.04,H*0.32);drawBarn(W*0.85,H*0.22);drawSilo(W*0.78,H*0.20);drawTrough(W*TROUGH.xR,H*TROUGH.yR);}

  function rr2(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}

  function drawCoop(x,y){
    const w=65,h=45;
    ctx.fillStyle=PAL.shadow;ctx.fillRect(x+3,y+h-2,w,6);
    ctx.fillStyle=PAL.coop1;ctx.fillRect(x,y+12,w,h-12);
    ctx.fillStyle=PAL.coop2;ctx.fillRect(x+2,y+14,w-4,4);
    ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=1;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y+20+i*8);ctx.lineTo(x+w,y+20+i*8);ctx.stroke();}
    ctx.fillStyle=PAL.coopR;ctx.beginPath();ctx.moveTo(x-6,y+12);ctx.lineTo(x+w/2,y-5);ctx.lineTo(x+w+6,y+12);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.moveTo(x-6,y+12);ctx.lineTo(x+w/2,y-5);ctx.lineTo(x+w/2,y+12);ctx.closePath();ctx.fill();
    ctx.fillStyle='#4a3520';rr2(x+w/2-8,y+h-22,16,22,2);ctx.fill();ctx.fillStyle='#d4a040';ctx.fillRect(x+w/2+4,y+h-12,2,2);
    ctx.fillStyle='#8a6830';ctx.fillRect(x+w-2,y+25,10,12);ctx.fillStyle=PAL.coopR;ctx.fillRect(x+w-3,y+23,12,3);ctx.fillStyle='#d4a040';ctx.fillRect(x+w,y+30,6,5);
  }

  function drawBarn(x,y){
    const w=75,h=55;
    ctx.fillStyle=PAL.shadow;ctx.fillRect(x+4,y+h-2,w,7);
    ctx.fillStyle=PAL.barn1;ctx.fillRect(x,y+18,w,h-18);ctx.fillStyle=PAL.barn2;ctx.fillRect(x+2,y+20,w-4,3);
    ctx.strokeStyle='rgba(0,0,0,0.12)';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x,y+26+i*8);ctx.lineTo(x+w,y+26+i*8);ctx.stroke();}
    ctx.fillStyle=PAL.barnR;ctx.beginPath();ctx.moveTo(x-5,y+18);ctx.lineTo(x+w/2,y-2);ctx.lineTo(x+w+5,y+18);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.moveTo(x-5,y+18);ctx.lineTo(x+w/2,y-2);ctx.lineTo(x+w/2,y+18);ctx.closePath();ctx.fill();
    ctx.fillStyle='#5a1818';ctx.fillRect(x+w/2-14,y+h-28,12,28);ctx.fillRect(x+w/2+2,y+h-28,12,28);
    ctx.strokeStyle='#3a0a0a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+w/2-13,y+h-27);ctx.lineTo(x+w/2-3,y+h-1);ctx.moveTo(x+w/2-3,y+h-27);ctx.lineTo(x+w/2-13,y+h-1);ctx.stroke();
    ctx.fillStyle='#3a0a0a';ctx.fillRect(x+w/2-5,y+22,10,8);ctx.fillStyle='#d4a040';ctx.fillRect(x+w/2-4,y+26,8,4);
  }

  function drawSilo(x,y){
    const w=22,h=50;
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x+w/2+3,y+h+1,w/2+2,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=PAL.silo1;ctx.fillRect(x,y+5,w,h-5);ctx.fillStyle=PAL.silo2;ctx.fillRect(x+2,y+5,6,h-5);
    ctx.fillStyle='#606870';for(let b=0;b<4;b++) ctx.fillRect(x-1,y+10+b*12,w+2,2);
    ctx.fillStyle='#606870';ctx.beginPath();ctx.ellipse(x+w/2,y+5,w/2,6,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#505860';ctx.beginPath();ctx.moveTo(x-1,y+5);ctx.lineTo(x+w/2,y-10);ctx.lineTo(x+w+1,y+5);ctx.closePath();ctx.fill();
  }

  function drawTrough(x,y){
    ctx.fillStyle='#5a4020';ctx.fillRect(x-22,y+10,3,10);ctx.fillRect(x+19,y+10,3,10);
    ctx.fillStyle=PAL.trough;ctx.fillRect(x-24,y+4,48,8);ctx.fillRect(x-26,y-2,4,14);ctx.fillRect(x+22,y-2,4,14);
    ctx.fillStyle='#5a4820';ctx.fillRect(x-22,y,44,6);
    if(farmData&&farmData.feed_balance>0){const fl=Math.min(1,farmData.feed_balance/50);ctx.fillStyle=PAL.feed;ctx.fillRect(x-20,y+1,40*fl,4);ctx.fillStyle='#c49030';for(let i=0;i<Math.floor(fl*8);i++) ctx.fillRect(x-18+i*5,y+2,2,1);}
  }

  // ── Entity Drawing ─────────────────────────────
  function drawEntities(){
    // Combine entities + rooster + farmer for y-sorting
    const all=entities.slice();
    if(rooster) all.push(rooster);
    if(farmer.active) all.push({type:'farmer',x:farmer.x,y:farmer.y});
    if(sortDirty){sortedEntities=all.sort((a,b)=>a.y-b.y);sortDirty=false;}
    for(let i=0;i<sortedEntities.length;i++){
      const e=sortedEntities[i],s=selectedEntity===e;
      if(e.type==='chicken')drawChicken(e,s);
      else if(e.type==='chick')drawChick(e,s);
      else if(e.type==='rooster')drawRooster(e);
      else if(e.type==='farmer')drawFarmerSprite();
      else drawEgg(e);
    }
  }

  function drawChicken(e,sel){
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0;
    let yO=0,lA=0,hD=0,wF=0,bS=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*4;yO=Math.abs(Math.sin((e.wp||0)*2))*-1.5;break;case S.PECK:hD=e.peckB||0;break;case S.EAT:hD=e.eatB||0;break;case S.DRINK:hD=e.drinkB||0;break;case S.FLAP:wF=e.flapA||0;yO=-Math.abs(wF)*4;break;case S.SLEEP:bS=2;yO=2;break;case S.FENCE:yO=-22;bS=1;break;case S.SCRATCH:lA=e.scratchB||0;break;default:yO=Math.sin(a*2+(e.bo||0))*1;}
    const y=(e.y+yO)|0;
    ctx.save();
    // Shadow (hide when on fence)
    if(e.state!==S.FENCE){ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,(e.y|0)+15,14,5,0,0,Math.PI*2);ctx.fill();}
    // Legs
    ctx.strokeStyle=c.legs;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-4*d,y+8+bS);ctx.lineTo(x-4*d-lA,y+14+bS);ctx.moveTo(x+2*d,y+8+bS);ctx.lineTo(x+2*d+lA,y+14+bS);ctx.stroke();
    ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-4*d-lA-3,y+14+bS);ctx.lineTo(x-4*d-lA+3,y+14+bS);ctx.moveTo(x+2*d+lA-3,y+14+bS);ctx.lineTo(x+2*d+lA+3,y+14+bS);ctx.stroke();
    // Body
    ctx.fillStyle=c.body;ctx.beginPath();ctx.ellipse(x,y+bS,13,10-bS*0.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.06)';ctx.beginPath();ctx.ellipse(x+2*d,y+3+bS,10,6,0,0,Math.PI*2);ctx.fill();
    // Wing
    if(e.state===S.FLAP){ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-3*d,y+1);ctx.rotate(wF*d);ctx.beginPath();ctx.ellipse(0,-6,8,10,d*0.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-3*d,y+1+bS,8,6,d*0.2,0,Math.PI*2);ctx.fill();}
    // Tail
    ctx.fillStyle=c.wing;ctx.beginPath();ctx.moveTo(x-12*d,y-2+bS);ctx.lineTo(x-18*d,y-10+bS);ctx.lineTo(x-15*d,y-3+bS);ctx.lineTo(x-20*d,y-7+bS);ctx.lineTo(x-14*d,y+1+bS);ctx.closePath();ctx.fill();
    // Head
    const hx=x+10*d, hy=y-8+hD+bS;
    if(e.state===S.SLEEP){ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+4*d,y-4+bS,5,0,Math.PI*2);ctx.fill();const za=0.4+Math.sin(a*2)*0.3;ctx.fillStyle=`rgba(180,200,255,${za})`;ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('z',x+12,y-16+Math.sin(a)*2);ctx.font='bold 10px monospace';ctx.fillText('Z',x+18,y-22+Math.sin(a+1)*2);}
    else{ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(hx+3*d,hy-1,1.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+3.5*d,hy-1.5,0.6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+6*d,hy-1);ctx.lineTo(hx+11*d,hy+1);ctx.lineTo(hx+6*d,hy+2);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-1*d,hy-5);ctx.lineTo(hx+1*d,hy-9);ctx.lineTo(hx+3*d,hy-6);ctx.lineTo(hx+5*d,hy-10);ctx.lineTo(hx+6*d,hy-5);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+4*d,hy+4,2,3,0,0,Math.PI*2);ctx.fill();
      if(e.state===S.EAT&&hD>2){ctx.fillStyle=PAL.feed;ctx.beginPath();ctx.arc(hx+9*d,hy+2,1.5,0,Math.PI*2);ctx.fill();}
    }
    // Shimmer for premium
    if(c.shimmer){const sh=0.1+Math.sin(a*3)*0.08;ctx.fillStyle=`rgba(255,255,180,${sh})`;ctx.beginPath();ctx.ellipse(x,y+bS,16,13,0,0,Math.PI*2);ctx.fill();for(let sp=0;sp<3;sp++){const sa=gt*2+sp*2.1,sx=x+Math.cos(sa)*12,sy=y-5+Math.sin(sa)*8,so=0.3+Math.sin(sa*2)*0.3;ctx.fillStyle=`rgba(255,255,100,${so})`;ctx.fillRect(sx|0,sy|0,2,2);}}
    // Starving
    if(e.starving){const p=0.5+Math.sin(a*4)*0.3;ctx.fillStyle=`rgba(255,60,60,${p})`;ctx.beginPath();ctx.arc(x,y-26,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('!',x,y-22);}
    // Selected
    if(sel){ctx.strokeStyle='#69f0ae';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.ellipse(x,y+2,22,16,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`${e.data.species} #${e.data.id}`,tw=ctx.measureText(lb).width+12;ctx.fillStyle='rgba(0,0,0,0.75)';rr2(x-tw/2,y-42,tw,16,4);ctx.fill();ctx.fillStyle='#69f0ae';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText(lb,x,y-30);}
    ctx.restore();
  }

  function drawChick(e,sel){
    const a=e.at||0,d=e.dir;let yO=0,lA=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*2;yO=Math.abs(Math.sin((e.wp||0)*2))*-2;break;case S.PECK:yO=(e.peckB||0)*0.5;break;default:yO=Math.sin(a*3+(e.bo||0))*1;}
    const x=e.x|0,y=(e.y+yO)|0;
    ctx.save();
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,(e.y|0)+8,7,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#d89020';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-2,y+5);ctx.lineTo(x-3-lA*0.5,y+7);ctx.moveTo(x+2,y+5);ctx.lineTo(x+3+lA*0.5,y+7);ctx.stroke();
    ctx.fillStyle='#fff44f';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fffa80';ctx.beginPath();ctx.arc(x-1.5,y-1.5,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#eecc30';ctx.beginPath();ctx.arc(x+1,y+2,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#111';ctx.beginPath();ctx.arc(x+3*d,y-1,1,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e8a020';ctx.beginPath();ctx.moveTo(x+5*d,y);ctx.lineTo(x+8*d,y+1);ctx.lineTo(x+5*d,y+2);ctx.closePath();ctx.fill();
    const fa=Math.sin(a*(e.state===S.WALK?8:4))*0.3;ctx.fillStyle='#ffe840';ctx.beginPath();ctx.ellipse(x-3*d,y+1,4,3,fa*d,0,Math.PI*2);ctx.fill();
    if(sel){ctx.strokeStyle='#fff44f';ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.beginPath();ctx.ellipse(x,y,12,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`Chick > ${e.data.target_species}`,tw=ctx.measureText(lb).width+12;ctx.fillStyle='rgba(0,0,0,0.75)';rr2(x-tw/2,y-24,tw,14,4);ctx.fill();ctx.fillStyle='#fff44f';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText(lb,x,y-14);}
    ctx.restore();
  }

  function drawEgg(e){
    const x=e.x|0,y=e.y|0,gl=0.15+Math.sin(gt*2+x)*0.08;
    ctx.save();ctx.translate(x,y);ctx.rotate(e.tilt||0);
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(0,7,5,2,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(255,250,230,${gl})`;ctx.beginPath();ctx.ellipse(0,0,8,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#faf0e0';ctx.beginPath();ctx.ellipse(0,0,5,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.45)';ctx.beginPath();ctx.ellipse(-1.5,-2,2,3,-0.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(180,150,120,0.3)';ctx.fillRect(-2,2,1,1);ctx.fillRect(1,-1,1,1);ctx.fillRect(2,3,1,1);
    ctx.restore();
  }

  // ── Rooster Drawing ──────────────────────────
  function drawRooster(e){
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0;
    let yO=0,lA=0,bS=0;
    if(e.state===S.WALK){lA=Math.sin(e.wp||0)*4;yO=Math.abs(Math.sin((e.wp||0)*2))*-2;}
    else if(e.state===S.FENCE){yO=-20;bS=1;}
    else if(e.state===S.CROW){yO=-2;}
    else if(e.state===S.FLAP){yO=-Math.abs(Math.sin(a*12)*0.6)*5;}
    else if(e.state===S.COURT){yO=Math.sin(a*6)*2;}
    else if(e.state===S.SLEEP){bS=2;yO=2;}
    else{yO=Math.sin(a*2)*1;}
    const y=(e.y+yO)|0;
    ctx.save();
    // Shadow
    if(e.state!==S.FENCE){ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,(e.y|0)+16,16,6,0,0,Math.PI*2);ctx.fill();}
    // Legs (taller than hen)
    ctx.strokeStyle=c.legs;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x-4*d,y+10+bS);ctx.lineTo(x-4*d-lA,y+16+bS);ctx.moveTo(x+2*d,y+10+bS);ctx.lineTo(x+2*d+lA,y+16+bS);ctx.stroke();
    ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-4*d-lA-4,y+16+bS);ctx.lineTo(x-4*d-lA+4,y+16+bS);ctx.moveTo(x+2*d+lA-4,y+16+bS);ctx.lineTo(x+2*d+lA+4,y+16+bS);ctx.stroke();
    // Spurs
    ctx.strokeStyle='#cc9900';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-4*d-lA,y+14+bS);ctx.lineTo(x-4*d-lA-3*d,y+12+bS);ctx.stroke();
    // Body (slightly larger)
    ctx.fillStyle=c.body;ctx.beginPath();ctx.ellipse(x,y+bS,15,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.08)';ctx.beginPath();ctx.ellipse(x+2*d,y+3+bS,12,7,0,0,Math.PI*2);ctx.fill();
    // Wing
    if(e.state===S.FLAP||e.state===S.COURT){const wf=Math.sin(a*12)*0.6;ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-4*d,y);ctx.rotate(wf*d);ctx.beginPath();ctx.ellipse(0,-6,10,12,d*0.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-4*d,y+bS,10,7,d*0.2,0,Math.PI*2);ctx.fill();}
    // Grand tail (multiple feathers, iridescent)
    ctx.fillStyle=c.tail1;ctx.beginPath();ctx.moveTo(x-14*d,y-4+bS);ctx.quadraticCurveTo(x-28*d,y-22+bS,x-22*d,y-18+bS);ctx.lineTo(x-14*d,y+2+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail2;ctx.beginPath();ctx.moveTo(x-14*d,y-2+bS);ctx.quadraticCurveTo(x-30*d,y-16+bS,x-24*d,y-10+bS);ctx.lineTo(x-14*d,y+4+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail3;ctx.beginPath();ctx.moveTo(x-12*d,y+bS);ctx.quadraticCurveTo(x-26*d,y-10+bS,x-20*d,y-4+bS);ctx.lineTo(x-12*d,y+5+bS);ctx.closePath();ctx.fill();
    // Head
    const hx=x+12*d, hy=y-10+bS;
    if(e.state===S.SLEEP){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+5*d,y-5+bS,6,0,Math.PI*2);ctx.fill();
      const za=0.4+Math.sin(a*2)*0.3;ctx.fillStyle=`rgba(180,200,255,${za})`;ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('z',x+14,y-18+Math.sin(a)*2);ctx.font='bold 12px monospace';ctx.fillText('Z',x+20,y-24+Math.sin(a+1)*2);
    } else if(e.state===S.CROW){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy-2,7,0,Math.PI*2);ctx.fill();
      // Open beak crowing
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+7*d,hy-4);ctx.lineTo(hx+16*d,hy-6);ctx.lineTo(hx+7*d,hy-2);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(hx+7*d,hy);ctx.lineTo(hx+14*d,hy+2);ctx.lineTo(hx+7*d,hy+2);ctx.closePath();ctx.fill();
      // Eye
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(hx+3*d,hy-2,2,0,Math.PI*2);ctx.fill();
      // Crow text
      const ca=0.5+Math.sin(a*4)*0.3;ctx.fillStyle=`rgba(255,200,50,${ca})`;ctx.font='bold 10px monospace';ctx.textAlign='center';
      ctx.fillText('COCORICOOO!',hx,hy-22+Math.sin(a*3)*2);
      // Large comb
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-2*d,hy-8);ctx.lineTo(hx,hy-15);ctx.lineTo(hx+3*d,hy-10);ctx.lineTo(hx+5*d,hy-16);ctx.lineTo(hx+7*d,hy-8);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+5*d,hy+5,3,4,0,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111';ctx.beginPath();ctx.arc(hx+4*d,hy-1,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+4.5*d,hy-1.5,0.7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+7*d,hy-1);ctx.lineTo(hx+13*d,hy+1);ctx.lineTo(hx+7*d,hy+2);ctx.closePath();ctx.fill();
      // Large comb
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-2*d,hy-6);ctx.lineTo(hx,hy-14);ctx.lineTo(hx+3*d,hy-8);ctx.lineTo(hx+5*d,hy-15);ctx.lineTo(hx+7*d,hy-6);ctx.closePath();ctx.fill();
      // Wattle
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+5*d,hy+5,3,5,0,0,Math.PI*2);ctx.fill();
    }
    // Court display - puff up and dance
    if(e.state===S.COURT){
      const ca=e.courtA||0;
      ctx.fillStyle=`rgba(255,50,50,${0.15+Math.sin(ca)*0.1})`;ctx.beginPath();ctx.arc(x,y-20,4,0,Math.PI*2);ctx.fill();
      // Hearts
      if(Math.sin(ca)>0.5){ctx.fillStyle='rgba(255,80,80,0.6)';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('\u2665',x+Math.sin(ca*2)*10,y-25+Math.cos(ca)*5);}
    }
    ctx.restore();
  }

  // ── Farmer Drawing ──────────────────────────
  function drawFarmerSprite(){
    const x=farmer.x|0, y=farmer.y|0, a=farmer.phase;
    const walkCycle=farmer.state!=='feed'?Math.sin((farmer.wp||0)*2)*3:0;
    ctx.save();
    // Shadow
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,y+20,12,5,0,0,Math.PI*2);ctx.fill();
    // Boots
    ctx.fillStyle='#3a2010';
    ctx.fillRect(x-7,y+14+walkCycle,6,6);ctx.fillRect(x+1,y+14-walkCycle,6,6);
    // Jeans
    ctx.fillStyle='#3060a0';
    ctx.fillRect(x-6,y+2+walkCycle,5,14);ctx.fillRect(x+1,y+2-walkCycle,5,14);
    // Shirt
    ctx.fillStyle='#d04040';ctx.fillRect(x-8,y-14,16,18);
    ctx.fillStyle='#b03030';ctx.fillRect(x-8,y-14,5,18); // shade
    // Arms
    if(farmer.state==='feed'){
      const armA=Math.sin(a*4)*0.5;
      ctx.strokeStyle='#daa070';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x+8,y-8);ctx.lineTo(x+16+Math.sin(a*3)*5,y-4+Math.cos(a*4)*4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x-12,y-2);ctx.stroke();
      // Bucket
      ctx.fillStyle='#888';ctx.fillRect(x-16,y-6,8,10);ctx.fillStyle='#666';ctx.fillRect(x-16,y-6,8,2);
      ctx.fillStyle=PAL.feed;ctx.fillRect(x-15,y-4,6,6);
    } else {
      ctx.strokeStyle='#daa070';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(x+8,y-8);ctx.lineTo(x+10,y+2+walkCycle*0.5);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-8,y-8);ctx.lineTo(x-10,y+2-walkCycle*0.5);ctx.stroke();
    }
    // Head
    ctx.fillStyle='#daa070';ctx.beginPath();ctx.arc(x,y-20,7,0,Math.PI*2);ctx.fill();
    // Hat
    ctx.fillStyle='#c8a050';ctx.fillRect(x-10,y-28,20,4);ctx.fillRect(x-6,y-34,12,8);
    ctx.fillStyle='#a88030';ctx.fillRect(x-6,y-28,12,2);
    // Eyes
    ctx.fillStyle='#333';ctx.fillRect(x-3,y-21,2,2);ctx.fillRect(x+2,y-21,2,2);
    ctx.restore();
  }

  // ── Ambient Life ───────────────────────────────
  function drawButterflies(){butterflies.forEach(b=>{const wa=Math.sin(b.wp)*0.8;ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle=b.c;ctx.beginPath();ctx.ellipse(-3,0,4,2.5*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(3,0,4,2.5*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#333';ctx.fillRect(-0.5,-2,1,4);ctx.restore();});}

  function drawParticles(){particles.forEach(p=>{const al=clamp(p.life/0.8,0,1);if(p.feather){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(gt*3);ctx.fillStyle=p.color;ctx.globalAlpha=al;ctx.beginPath();ctx.ellipse(0,0,p.sz,p.sz*0.4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.restore();}else{ctx.fillStyle=p.color||PAL.dirt2;ctx.globalAlpha=al;ctx.fillRect(p.x|0,p.y|0,p.sz||2,p.sz||2);ctx.globalAlpha=1;}});}

  function drawFireflies(){fireflies.forEach(f=>{const br=0.4+Math.sin(f.ph*3)*0.4;const gl=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,8);gl.addColorStop(0,`rgba(200,255,100,${br})`);gl.addColorStop(1,'rgba(200,255,100,0)');ctx.fillStyle=gl;ctx.fillRect(f.x-8,f.y-8,16,16);ctx.fillStyle=`rgba(220,255,120,${br+0.2})`;ctx.fillRect(f.x|0,f.y|0,2,2);});}

  // ── HUD ────────────────────────────────────────
  function drawHUD(){
    if(!farmData) return;
    ctx.font='bold 10px monospace';
    // Stats
    ctx.fillStyle='rgba(0,0,0,0.6)';rr2(8,8,140,54,6);ctx.fill();ctx.strokeStyle='rgba(105,240,174,0.2)';ctx.lineWidth=1;rr2(8,8,140,54,6);ctx.stroke();
    ctx.textAlign='left';ctx.fillStyle='#69f0ae';ctx.fillText(`Chickens: ${(farmData.chickens||[]).length}`,16,24);
    ctx.fillStyle='#faf0e6';ctx.fillText(`Eggs: ${farmData.eggs_available||0}`,16,38);
    ctx.fillStyle='#fff44f';ctx.fillText(`Chicks: ${(farmData.chicks||[]).length}`,16,52);
    // Economy
    ctx.fillStyle='rgba(0,0,0,0.6)';rr2(W-148,8,140,40,6);ctx.fill();ctx.strokeStyle='rgba(105,240,174,0.2)';ctx.lineWidth=1;rr2(W-148,8,140,40,6);ctx.stroke();
    ctx.textAlign='right';ctx.fillStyle='#d4a040';ctx.fillText(`Feed: ${(farmData.feed_balance||0).toFixed(1)}`,W-16,24);
    ctx.fillStyle='#76f7be';ctx.fillText(`${(farmData.balance_usdt||0).toFixed(2)} USDT`,W-16,38);
    // Day/Night
    const hr=new Date().getHours(),isD=hr>=6&&hr<20;
    ctx.fillStyle='rgba(0,0,0,0.5)';rr2(W/2-32,8,64,18,6);ctx.fill();ctx.textAlign='center';ctx.font='10px monospace';ctx.fillStyle=isD?'#ffd700':'#8888cc';ctx.fillText(isD?'DAY':'NIGHT',W/2,21);
    // Empty
    if(!entities.length){ctx.fillStyle='rgba(0,0,0,0.6)';rr2(W/2-130,H/2-18,260,36,8);ctx.fill();ctx.fillStyle='#a9b6d0';ctx.font='13px monospace';ctx.textAlign='center';ctx.fillText('Buy your first chicken to start!',W/2,H/2+5);}
  }

  // ── Interaction ────────────────────────────────
  function onClick(ev){const r=canvas.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top;const h=findE(mx,my);selectedEntity=h;if(h&&onSelectCb)onSelectCb(h);}
  function onHover(ev){const r=canvas.getBoundingClientRect();canvas.style.cursor=findE(ev.clientX-r.left,ev.clientY-r.top)?'pointer':'default';}
  function findE(mx,my){const s=[...entities].sort((a,b)=>b.y-a.y);for(const e of s){const r=e.type==='egg'?8:e.type==='chick'?10:20,dx=mx-e.x,dy=my-e.y;if(dx*dx+dy*dy<r*r)return e;}return null;}

  return { init, update };
})();
