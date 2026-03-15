/**
 * farm-map.js — Pixel-Art Living Farm with AI entities
 */
const FarmMap = (() => {
  let canvas, ctx, W, H, dpr = 1, SC = 1;
  let farmData = null, onSelectCb = null, selectedEntity = null;
  let lastTime = 0, gt = 0;
  let entities = [], particles = [], clouds = [], butterflies = [];
  let grass = [], flowers = [], trees = [], rocks = [], fireflies = [];
  const MAX_PARTICLES = 150;
  let sortedEntities = [], sortDirty = true;
  let rooster = null;
  let farmer = { active:false, x:-40, y:0, dir:1, phase:0, state:'idle', timer:0, feedTimer:0, walkTarget:0, wp:0 };
  const POND = { cxR:0.78, cyR:0.40 };

  const S = { IDLE:0, WALK:1, PECK:2, EAT:3, SLEEP:4, FLAP:5, DRINK:6, SCRATCH:7, CROW:8, COURT:9 };
  const TROUGH = { xR: 0.45, yR: 0.55 };
  const PASTURE = { x0: 0.06, x1: 0.94, y0: 0.30, y1: 0.90 };
  const FENCE_Y = 0.26;

  const PAL = {
    grass1:'#3a7a28', grass2:'#4a9030', grass3:'#5aaa3a', grass4:'#6abb48', grassD:'#2a6018',
    grassHi:'#8cd060', grassShadow:'#1e5510',
    dirt1:'#7a5a38', dirt2:'#9a7850', dirt3:'#b89868', dirtD:'#5a4028',
    fence:'#a08040', fenceD:'#705828', fenceHi:'#c0a060',
    water1:'#3090c8', water2:'#2070a0', waterHi:'#90d8ff', waterD:'#1a5080',
    barn1:'#b03838', barn2:'#c84848', barnD:'#802020', barnR:'#6a2020',
    coop1:'#c8a858', coop2:'#dabb68', coopD:'#8a7030', coopR:'#7a6028',
    silo1:'#8898a8', silo2:'#a8b8c8', siloD:'#606878',
    trough:'#705838', troughD:'#504020', feed:'#d8a838',
    shadow:'rgba(0,0,0,0.18)',
    leafG:'#388828', leafD:'#286818', leafHi:'#50a838', trunk:'#5a3818', trunkD:'#3a2410', trunkHi:'#7a5830',
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
    W = r.width;
    // Mobile: taller ratio, Desktop: wider
    const isMobile = W < 600;
    H = isMobile ? Math.max(400, W * 0.85) : Math.max(500, Math.min(700, W * 0.52));
    SC = Math.max(0.5, Math.min(1.2, W / 900)); // global scale factor
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
    if(night&&e.type==='chicken'){e.state=S.SLEEP;e.st=4+Math.random()*6;return;}
    const r=Math.random();
    if(e.type==='chick'){
      if(r<0.30){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=15+Math.random()*10;e.st=5;}
      else if(r<0.50){e.state=S.PECK;e.st=1+Math.random()*2;}
      else if(r<0.62){e.state=S.SCRATCH;e.st=1+Math.random()*1.5;}
      else{e.state=S.IDLE;e.st=1+Math.random()*3;}
      return;
    }
    if(r<0.22){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=12+Math.random()*8;e.st=6;}
    else if(r<0.35&&farmData&&farmData.feed_balance>0){e.state=S.WALK;e.tx=W*TROUGH.xR+rr(-15,15);e.ty=H*TROUGH.yR+rr(-5,10);e.spd=14+Math.random()*6;e.st=8;e.goEat=1;}
    else if(r<0.48){e.state=S.SCRATCH;e.st=2+Math.random()*3;}
    else if(r<0.58){e.state=S.WALK;e.tx=W*POND.cxR+rr(-15,10);e.ty=H*POND.cyR+rr(5,15);e.spd=10+Math.random()*6;e.st=10;e.goDrink=1;}
    else if(r<0.70){e.state=S.PECK;e.st=1.5+Math.random()*2.5;}
    else if(r<0.78){e.state=S.FLAP;e.st=0.8+Math.random()*1.2;}
    else{e.state=S.IDLE;e.st=2+Math.random()*4;}
  }

  function moveToTarget(e, dt) {
    if(!e.tx){e.state=S.IDLE;return;}
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<5){
      if(e.goEat){e.state=S.EAT;e.st=2+Math.random()*3;e.goEat=0;}
      else if(e.goDrink){e.state=S.DRINK;e.st=2+Math.random()*3;e.goDrink=0;}
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
          if(r.goCourt&&r.courtTarget){r.state=S.COURT;r.st=2+Math.random()*2;}
          else{r.state=S.IDLE;r.st=1+Math.random()*3;}
        } else {const s=r.spd||16;r.x+=(dx/d)*s*dt;r.y+=(dy/d)*s*dt;r.dir=dx>0?1:-1;r.wp=(r.wp||0)+dt*8;}
        break;
      }
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
    if(rnd<0.35&&chickens.length>0){
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
      if(farmer.feedTimer>90){farmer.feedTimer=0;farmer.active=true;farmer.x=-40;farmer.y=H*0.58;farmer.dir=1;farmer.state='walkIn';farmer.walkTarget=W*TROUGH.xR;farmer.phase=0;farmer.wp=0;}
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
    if(!ctx) return; ctx.clearRect(0,0,W,H); ctx.imageSmoothingEnabled=true;
    drawSky(); drawClouds(); drawGround(); drawTrees(); drawFence(); drawPond();
    drawRocks(); drawFlowers(); drawGrass(); drawStructures();
    drawEntities(); drawButterflies(); drawParticles(); drawFireflies(); drawHUD();
  }

  function lerpCol(a,b,t){const ah=parseInt(a.slice(1),16),bh=parseInt(b.slice(1),16);const ar=(ah>>16)&0xff,ag=(ah>>8)&0xff,ab=ah&0xff;const br=(bh>>16)&0xff,bg=(bh>>8)&0xff,bb=bh&0xff;const r=Math.round(ar+(br-ar)*t),g=Math.round(ag+(bg-ag)*t),bl=Math.round(ab+(bb-ab)*t);return'#'+((r<<16)|(g<<8)|bl).toString(16).padStart(6,'0');}

  function drawSky() {
    const hr=new Date().getHours()+new Date().getMinutes()/60;
    let st,sm,sb,na=0;
    if(hr>=6&&hr<8){const t=(hr-6)/2;st=lerpCol('#101830','#5898cc',t);sm=lerpCol('#182040','#88bbdd',t);sb=lerpCol('#1a2030','#ee8844',t*0.7);}
    else if(hr>=8&&hr<17){st='#4888bb';sm='#6aabcc';sb='#90ccee';}
    else if(hr>=17&&hr<20){const t=(hr-17)/3;st=lerpCol('#4888bb','#101830',t);sm=lerpCol('#6aabcc','#1a2848',t);sb=lerpCol('#90ccee','#cc6030',t<0.5?t*1.5:1.5-t*1.2);na=t*0.25;}
    else{st='#080e20';sm='#0c1428';sb='#101830';na=0.30;}
    const skyH=H*0.30;
    const g=ctx.createLinearGradient(0,0,0,skyH);g.addColorStop(0,st);g.addColorStop(0.5,sm||st);g.addColorStop(1,sb);ctx.fillStyle=g;ctx.fillRect(0,0,W,skyH);
    // Distant hills silhouette
    ctx.fillStyle=lerpCol(sb,PAL.grass1,0.4);
    ctx.beginPath();ctx.moveTo(0,skyH);
    for(let i=0;i<=W;i+=20){ctx.lineTo(i,skyH-8-Math.sin(i*0.008)*12-Math.sin(i*0.022)*6);}
    ctx.lineTo(W,skyH+5);ctx.lineTo(0,skyH+5);ctx.closePath();ctx.fill();
    const night=hr<6||hr>=20;
    if(night){
      for(let i=0;i<50;i++){const sx=sr(i*13)*W,sy=sr(i*17)*skyH*0.9,tw=0.15+Math.sin(gt*1.5+i*0.7)*0.25;ctx.fillStyle=`rgba(255,255,240,${tw})`;ctx.beginPath();ctx.arc(sx,sy,0.8+sr(i*31)*0.8,0,Math.PI*2);ctx.fill();}
      // Moon with glow
      const mx=W*0.82,my=30*SC;
      const mg=ctx.createRadialGradient(mx,my,8*SC,mx,my,40*SC);mg.addColorStop(0,'rgba(220,215,200,0.3)');mg.addColorStop(1,'rgba(220,215,200,0)');ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,40*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e8e4d8';ctx.beginPath();ctx.arc(mx,my,14*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#d0ccc0';ctx.beginPath();ctx.arc(mx-3*SC,my-2*SC,4*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#c8c4b8';ctx.beginPath();ctx.arc(mx+5*SC,my+4*SC,2.5*SC,0,Math.PI*2);ctx.fill();
    } else if(hr>=6&&hr<20){
      const sp=(hr-6)/14,sx=W*0.1+sp*W*0.8,sy=20+Math.sin(sp*Math.PI)*-15+25;
      const gl=ctx.createRadialGradient(sx,sy,4*SC,sx,sy,50*SC);gl.addColorStop(0,'rgba(255,240,150,0.6)');gl.addColorStop(0.3,'rgba(255,220,100,0.2)');gl.addColorStop(1,'rgba(255,220,100,0)');ctx.fillStyle=gl;ctx.beginPath();ctx.arc(sx,sy,50*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffe866';ctx.beginPath();ctx.arc(sx,sy,8*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,250,200,0.5)';ctx.beginPath();ctx.arc(sx,sy,6*SC,0,Math.PI*2);ctx.fill();
    }
    if(na>0){ctx.fillStyle=`rgba(8,12,28,${na})`;ctx.fillRect(0,0,W,skyH);}
  }

  function drawClouds(){clouds.forEach(c=>{ctx.fillStyle=`rgba(255,255,255,${c.op})`;ctx.beginPath();ctx.ellipse(c.x,c.y,c.w*0.5,10,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x-c.w*0.2,c.y-5,c.w*0.3,8,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(c.x+c.w*0.2,c.y-3,c.w*0.25,7,0,0,Math.PI*2);ctx.fill();});}

  function drawGround() {
    const gy=H*0.28;
    // Main grass gradient - rich, layered
    const g=ctx.createLinearGradient(0,gy,0,H);
    g.addColorStop(0,PAL.grass3);g.addColorStop(0.05,PAL.grass2);g.addColorStop(0.3,PAL.grass1);g.addColorStop(0.7,PAL.grassD);g.addColorStop(1,PAL.grassShadow);
    ctx.fillStyle=g;ctx.fillRect(0,gy,W,H-gy);
    // Grass edge highlight
    const eg=ctx.createLinearGradient(0,gy,0,gy+6);eg.addColorStop(0,PAL.grassHi);eg.addColorStop(1,'rgba(100,200,60,0)');ctx.fillStyle=eg;ctx.fillRect(0,gy,W,6);
    // Subtle light patches
    for(let i=0;i<8;i++){const px=sr(i*71)*W,py=gy+sr(i*37)*(H-gy)*0.6,pr=30+sr(i*23)*50;const pg=ctx.createRadialGradient(px,py,0,px,py,pr);pg.addColorStop(0,'rgba(120,200,60,0.08)');pg.addColorStop(1,'rgba(120,200,60,0)');ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fill();}
    // Dirt path with gradient edges
    const pathY=H*0.62,pathH=H*0.05;
    ctx.save();
    ctx.beginPath();ctx.moveTo(-10,pathY-pathH);
    ctx.bezierCurveTo(W*0.2,pathY-pathH-8,W*0.4,pathY-pathH+4,W*0.5,pathY-pathH);
    ctx.bezierCurveTo(W*0.6,pathY-pathH-4,W*0.8,pathY-pathH+6,W+10,pathY-pathH-2);
    ctx.lineTo(W+10,pathY+pathH+2);
    ctx.bezierCurveTo(W*0.8,pathY+pathH-4,W*0.6,pathY+pathH+6,W*0.5,pathY+pathH);
    ctx.bezierCurveTo(W*0.4,pathY+pathH-4,W*0.2,pathY+pathH+6,-10,pathY+pathH+2);
    ctx.closePath();
    const dg=ctx.createLinearGradient(0,pathY-pathH,0,pathY+pathH);
    dg.addColorStop(0,PAL.dirt3);dg.addColorStop(0.3,PAL.dirt1);dg.addColorStop(0.7,PAL.dirt2);dg.addColorStop(1,PAL.dirtD);
    ctx.fillStyle=dg;ctx.fill();
    // Path texture - small pebbles
    for(let i=0;i<40;i++){const px=sr(i*47)*W,py=pathY+sr(i*53)*pathH*1.5-pathH*0.5;ctx.fillStyle=`rgba(${140+sr(i*19)*40|0},${110+sr(i*29)*30|0},${70+sr(i*39)*30|0},0.3)`;ctx.beginPath();ctx.arc(px,py,0.8+sr(i*61)*1.5,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  function drawTrees(){trees.forEach(t=>drawTree(t.x,t.y,t.sc,t.ph));}
  function drawTree(x,y,s,ph){
    const sw=Math.sin(gt*0.6+ph)*1.5*s;
    s*=SC;
    // Shadow on ground
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(x+5*s,y+30*s,18*s,6*s,0,0,Math.PI*2);ctx.fill();
    // Trunk with gradient
    const tg=ctx.createLinearGradient(x-4*s,0,x+4*s,0);tg.addColorStop(0,PAL.trunkD);tg.addColorStop(0.4,PAL.trunk);tg.addColorStop(1,PAL.trunkHi);
    ctx.fillStyle=tg;ctx.fillRect(x-4*s,y,8*s,30*s);
    // Bark texture
    ctx.fillStyle='rgba(0,0,0,0.1)';for(let i=0;i<4;i++){ctx.fillRect(x-2*s,y+5*s+i*7*s,5*s,1);}
    // Foliage layers with depth
    const layers=[
      {ox:sw*0.5,oy:-22*s,r:18*s,c:PAL.leafD},
      {ox:-10*s+sw*0.8,oy:-16*s,r:14*s,c:PAL.leafG},
      {ox:10*s+sw*0.6,oy:-14*s,r:13*s,c:PAL.leafG},
      {ox:sw,oy:-26*s,r:15*s,c:PAL.leafD},
      {ox:4*s+sw*0.7,oy:-22*s,r:12*s,c:PAL.leafHi},
    ];
    layers.forEach(l=>{
      const lg=ctx.createRadialGradient(x+l.ox,l.oy+y-l.r*0.3,l.r*0.1,x+l.ox,l.oy+y,l.r);
      lg.addColorStop(0,l.c);lg.addColorStop(1,lerpCol(l.c,'#000000',0.3));
      ctx.fillStyle=lg;ctx.beginPath();ctx.arc(x+l.ox,y+l.oy,l.r,0,Math.PI*2);ctx.fill();
    });
    // Light spots
    ctx.fillStyle='rgba(150,230,100,0.12)';
    for(let i=0;i<4;i++){const lx=x+sr(hash((x|0)+i))*16*s-8*s+sw,ly=y-12*s-sr(hash((x|0)+i+50))*16*s;ctx.beginPath();ctx.arc(lx,ly,2*s,0,Math.PI*2);ctx.fill();}
  }

  function drawFence(){
    const fy=H*FENCE_Y,fh=18*SC,fx=15,fw=W-30,np=Math.floor(fw/(35*SC));
    // Post shadows
    for(let i=0;i<=np;i++){const px=fx+i*(fw/np);ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(px,fy+fh+1,4*SC,3*SC);}
    // Horizontal rails with gradient
    const rg=ctx.createLinearGradient(0,fy,0,fy+3*SC);rg.addColorStop(0,PAL.fenceHi);rg.addColorStop(1,PAL.fence);
    ctx.fillStyle=rg;ctx.fillRect(fx,fy+3*SC,fw,2.5*SC);ctx.fillRect(fx,fy+fh-4*SC,fw,2.5*SC);
    // Rail highlight
    ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(fx,fy+3*SC,fw,1);ctx.fillRect(fx,fy+fh-4*SC,fw,1);
    // Posts with wood grain
    for(let i=0;i<=np;i++){
      const px=fx+i*(fw/np);
      const pg=ctx.createLinearGradient(px,0,px+4*SC,0);pg.addColorStop(0,PAL.fenceD);pg.addColorStop(0.5,PAL.fence);pg.addColorStop(1,PAL.fenceD);
      ctx.fillStyle=pg;ctx.fillRect(px,fy-2*SC,4*SC,fh+4*SC);
      // Post cap
      ctx.fillStyle=PAL.fenceHi;ctx.fillRect(px-0.5*SC,fy-3*SC,5*SC,3*SC);
      // Wood grain
      ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(px+1*SC,fy+2*SC,1,fh-2*SC);
    }
  }

  function drawPond(){
    const cx=W*POND.cxR,cy=H*POND.cyR,rx=38*SC,ry=16*SC;
    // Muddy edge
    ctx.fillStyle=PAL.dirtD;ctx.beginPath();ctx.ellipse(cx,cy+2,rx+5*SC,ry+4*SC,0,0,Math.PI*2);ctx.fill();
    // Dark bottom
    const wg=ctx.createRadialGradient(cx,cy,rx*0.2,cx,cy,rx);
    wg.addColorStop(0,PAL.waterD);wg.addColorStop(0.6,PAL.water1);wg.addColorStop(1,PAL.water2);
    ctx.fillStyle=wg;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
    // Animated ripples
    for(let i=0;i<4;i++){
      const sx=cx-rx*0.4+i*rx*0.25+Math.sin(gt*1.2+i*1.5)*5*SC;
      const sa=0.1+Math.sin(gt*1.8+i*2)*0.08;
      ctx.strokeStyle=`rgba(144,216,255,${sa})`;ctx.lineWidth=1;
      ctx.beginPath();ctx.ellipse(sx,cy-2+i*2*SC,6*SC,1.5*SC,0,0,Math.PI*2);ctx.stroke();
    }
    // Reflection highlight
    ctx.fillStyle='rgba(200,240,255,0.15)';ctx.beginPath();ctx.ellipse(cx-rx*0.2,cy-ry*0.3,rx*0.35,ry*0.3,0,0,Math.PI*2);ctx.fill();
    // Lily pad
    ctx.fillStyle='#2a7828';ctx.beginPath();ctx.ellipse(cx+rx*0.3,cy+ry*0.15,5*SC,3*SC,0.3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff8898';ctx.beginPath();ctx.arc(cx+rx*0.3,cy+ry*0.05,1.8*SC,0,Math.PI*2);ctx.fill();
    // Reeds on edge
    ctx.strokeStyle='#3a8830';ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){const rx2=cx-rx*0.6+i*6*SC,sway=Math.sin(gt*0.8+i*2)*2;ctx.beginPath();ctx.moveTo(rx2,cy+ry*0.5);ctx.quadraticCurveTo(rx2+sway,cy-4*SC,rx2+sway*1.2,cy-10*SC);ctx.stroke();}
  }

  function drawRocks(){rocks.forEach(r=>{const sz=r.sz*SC;ctx.fillStyle=r.c;ctx.beginPath();ctx.ellipse(r.x,r.y,sz,sz*0.6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.ellipse(r.x-sz*0.2,r.y-sz*0.2,sz*0.35,sz*0.2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(0,0,0,0.08)';ctx.beginPath();ctx.ellipse(r.x+sz*0.1,r.y+sz*0.2,sz*0.4,sz*0.2,0,0,Math.PI*2);ctx.fill();});}

  function drawFlowers(){flowers.forEach(f=>{const sw=Math.sin(gt*1.5+f.ph)*1.5;ctx.strokeStyle='#2a7a18';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+sw,f.y-f.sz*3);ctx.stroke();const fx=f.x+sw,fy=f.y-f.sz*3;ctx.fillStyle=f.c;for(let p=0;p<5;p++){const a=(p/5)*Math.PI*2+gt*0.3;ctx.beginPath();ctx.arc(fx+Math.cos(a)*f.sz,fy+Math.sin(a)*f.sz,f.sz*0.6,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#ffee44';ctx.beginPath();ctx.arc(fx,fy,f.sz*0.4,0,Math.PI*2);ctx.fill();});}

  function drawGrass(){grass.forEach(g=>{const sw=Math.sin(gt*1.2+g.ph)*2;ctx.strokeStyle=g.c;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.quadraticCurveTo(g.x+sw,g.y-g.h*0.6,g.x+sw*0.8,g.y-g.h);ctx.stroke();ctx.beginPath();ctx.moveTo(g.x+2,g.y);ctx.quadraticCurveTo(g.x+2+sw*0.7,g.y-g.h*0.5,g.x+3+sw*0.6,g.y-g.h*0.8);ctx.stroke();});}

  // ── Structures ─────────────────────────────────
  function drawStructures(){drawCoop(W*0.04,H*0.30);drawBarn(W*0.86,H*0.24);drawSilo(W*0.80,H*0.22);drawTrough(W*TROUGH.xR,H*TROUGH.yR);}

  function rr2(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}

  function drawCoop(x,y){
    const w=55*SC,h=38*SC;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.12)';ctx.beginPath();ctx.ellipse(x+w/2+3,y+h+1,w*0.55,5*SC,0,0,Math.PI*2);ctx.fill();
    // Walls with gradient
    const wg=ctx.createLinearGradient(x,0,x+w,0);wg.addColorStop(0,PAL.coopD);wg.addColorStop(0.3,PAL.coop1);wg.addColorStop(0.8,PAL.coop2);
    ctx.fillStyle=wg;ctx.fillRect(x,y+10*SC,w,h-10*SC);
    // Plank lines
    ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=0.5;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y+16*SC+i*6*SC);ctx.lineTo(x+w,y+16*SC+i*6*SC);ctx.stroke();}
    // Roof with gradient
    const rg=ctx.createLinearGradient(x+w/2,y-5*SC,x+w/2,y+12*SC);rg.addColorStop(0,PAL.coopR);rg.addColorStop(1,lerpCol(PAL.coopR,'#000',0.15));
    ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(x-5*SC,y+10*SC);ctx.lineTo(x+w/2,y-5*SC);ctx.lineTo(x+w+5*SC,y+10*SC);ctx.closePath();ctx.fill();
    // Roof light side
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.moveTo(x-5*SC,y+10*SC);ctx.lineTo(x+w/2,y-5*SC);ctx.lineTo(x+w/2,y+10*SC);ctx.closePath();ctx.fill();
    // Door
    ctx.fillStyle='#3a2818';rr2(x+w/2-6*SC,y+h-18*SC,12*SC,18*SC,2);ctx.fill();
    ctx.fillStyle='#c8a040';ctx.beginPath();ctx.arc(x+w/2+3*SC,y+h-9*SC,1.5*SC,0,Math.PI*2);ctx.fill();
    // Nest box
    ctx.fillStyle='#7a5828';ctx.fillRect(x+w-1,y+20*SC,8*SC,10*SC);ctx.fillStyle=PAL.coopR;ctx.fillRect(x+w-2,y+18*SC,10*SC,3*SC);
    ctx.fillStyle='#c8a040';ctx.fillRect(x+w+1,y+24*SC,5*SC,4*SC);
  }

  function drawBarn(x,y){
    const w=65*SC,h=48*SC;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.12)';ctx.beginPath();ctx.ellipse(x+w/2+4,y+h+1,w*0.55,6*SC,0,0,Math.PI*2);ctx.fill();
    // Walls with gradient
    const wg=ctx.createLinearGradient(x,0,x+w,0);wg.addColorStop(0,PAL.barnD);wg.addColorStop(0.3,PAL.barn1);wg.addColorStop(0.8,PAL.barn2);
    ctx.fillStyle=wg;ctx.fillRect(x,y+15*SC,w,h-15*SC);
    // Plank lines
    ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=0.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x,y+20*SC+i*6*SC);ctx.lineTo(x+w,y+20*SC+i*6*SC);ctx.stroke();}
    // Roof
    const rg=ctx.createLinearGradient(x+w/2,y-2,x+w/2,y+15*SC);rg.addColorStop(0,PAL.barnR);rg.addColorStop(1,PAL.barnD);
    ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(x-4*SC,y+15*SC);ctx.lineTo(x+w/2,y-2);ctx.lineTo(x+w+4*SC,y+15*SC);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.05)';ctx.beginPath();ctx.moveTo(x-4*SC,y+15*SC);ctx.lineTo(x+w/2,y-2);ctx.lineTo(x+w/2,y+15*SC);ctx.closePath();ctx.fill();
    // Doors
    ctx.fillStyle='#4a1515';ctx.fillRect(x+w/2-10*SC,y+h-22*SC,9*SC,22*SC);ctx.fillRect(x+w/2+1*SC,y+h-22*SC,9*SC,22*SC);
    // Door cross
    ctx.strokeStyle='#2a0808';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+w/2-9*SC,y+h-21*SC);ctx.lineTo(x+w/2-1*SC,y+h-1);ctx.moveTo(x+w/2-1*SC,y+h-21*SC);ctx.lineTo(x+w/2-9*SC,y+h-1);ctx.stroke();
    // Loft window
    ctx.fillStyle='#2a0808';rr2(x+w/2-4*SC,y+18*SC,8*SC,6*SC,1);ctx.fill();
    ctx.fillStyle='#c8a040';ctx.fillRect(x+w/2-3*SC,y+21*SC,6*SC,3*SC);
  }

  function drawSilo(x,y){
    const w=18*SC,h=42*SC;
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(x+w/2+2,y+h+1,w/2+2,3*SC,0,0,Math.PI*2);ctx.fill();
    // Body with gradient
    const sg=ctx.createLinearGradient(x,0,x+w,0);sg.addColorStop(0,PAL.siloD);sg.addColorStop(0.35,PAL.silo1);sg.addColorStop(0.7,PAL.silo2);sg.addColorStop(1,PAL.silo1);
    ctx.fillStyle=sg;ctx.fillRect(x,y+5*SC,w,h-5*SC);
    // Metal bands
    ctx.fillStyle=PAL.siloD;for(let b=0;b<4;b++) ctx.fillRect(x-1,y+8*SC+b*10*SC,w+2,1.5*SC);
    // Top dome
    ctx.fillStyle=PAL.siloD;ctx.beginPath();ctx.ellipse(x+w/2,y+5*SC,w/2,5*SC,0,0,Math.PI*2);ctx.fill();
    // Roof cone
    ctx.fillStyle=PAL.siloD;ctx.beginPath();ctx.moveTo(x,y+5*SC);ctx.lineTo(x+w/2,y-8*SC);ctx.lineTo(x+w,y+5*SC);ctx.closePath();ctx.fill();
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(x+2*SC,y+5*SC,4*SC,h-5*SC);
  }

  function drawTrough(x,y){
    const tw=36*SC,th=6*SC;
    // Legs
    ctx.fillStyle=PAL.troughD;ctx.fillRect(x-tw*0.55,y+th,2.5*SC,8*SC);ctx.fillRect(x+tw*0.45,y+th,2.5*SC,8*SC);
    // Body with gradient
    const tg=ctx.createLinearGradient(0,y-th*0.5,0,y+th);tg.addColorStop(0,PAL.fenceHi);tg.addColorStop(0.5,PAL.trough);tg.addColorStop(1,PAL.troughD);
    ctx.fillStyle=tg;ctx.fillRect(x-tw*0.6,y-th*0.5,tw*1.2,th*1.5);
    // Side walls
    ctx.fillStyle=PAL.troughD;ctx.fillRect(x-tw*0.65,y-th,3*SC,th*2.5);ctx.fillRect(x+tw*0.55,y-th,3*SC,th*2.5);
    // Inner
    ctx.fillStyle=PAL.trough;ctx.fillRect(x-tw*0.5,y-th*0.3,tw,th);
    // Feed level
    if(farmData&&farmData.feed_balance>0){
      const fl=Math.min(1,farmData.feed_balance/50);
      const fg=ctx.createLinearGradient(0,y-th*0.2,0,y+th*0.5);fg.addColorStop(0,'#e0b848');fg.addColorStop(1,PAL.feed);
      ctx.fillStyle=fg;ctx.fillRect(x-tw*0.45,y-th*0.1,tw*0.9*fl,th*0.6);
    }
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
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0,s=SC;
    let yO=0,lA=0,hD=0,wF=0,bS=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*2.5*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-1;break;case S.PECK:hD=(e.peckB||0)*s;break;case S.EAT:hD=(e.eatB||0)*s;break;case S.DRINK:hD=(e.drinkB||0)*s;break;case S.FLAP:wF=e.flapA||0;yO=-Math.abs(wF)*3*s;break;case S.SLEEP:bS=1.5*s;yO=1;break;case S.SCRATCH:lA=(e.scratchB||0)*s;break;default:yO=Math.sin(a*2+(e.bo||0))*0.6;}
    const y=(e.y+yO)|0;
    ctx.save();
    // Shadow
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,(e.y|0)+9*s,9*s,3.5*s,0,0,Math.PI*2);ctx.fill();
    // Legs with feet
    ctx.strokeStyle=c.legs;ctx.lineWidth=1.5*s;
    ctx.beginPath();ctx.moveTo(x-3*d*s,y+6*s+bS);ctx.lineTo(x-3*d*s-lA,y+10*s+bS);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+2*d*s,y+6*s+bS);ctx.lineTo(x+2*d*s+lA,y+10*s+bS);ctx.stroke();
    // Feet (3 toes)
    ctx.lineWidth=1*s;
    [-1,0,1].forEach(t=>{const fx=x-3*d*s-lA;ctx.beginPath();ctx.moveTo(fx,y+10*s+bS);ctx.lineTo(fx+t*2*s,y+11.5*s+bS);ctx.stroke();});
    [-1,0,1].forEach(t=>{const fx=x+2*d*s+lA;ctx.beginPath();ctx.moveTo(fx,y+10*s+bS);ctx.lineTo(fx+t*2*s,y+11.5*s+bS);ctx.stroke();});
    // Body with gradient for volume
    const bg=ctx.createRadialGradient(x-2*d*s,y-1*s+bS,1,x,y+2*s+bS,10*s);
    bg.addColorStop(0,c.body);bg.addColorStop(1,c.outline||c.wing);
    ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(x,y+bS,10*s,8*s,0,0,Math.PI*2);ctx.fill();
    // Belly highlight
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.ellipse(x-1*d*s,y-2*s+bS,5*s,4*s,0,0,Math.PI*2);ctx.fill();
    // Wing
    if(e.state===S.FLAP){ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-2*d*s,y+bS);ctx.rotate(wF*d);ctx.beginPath();ctx.ellipse(0,-4*s,6*s,8*s,d*0.2,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-2*d*s,y+1*s+bS,6*s,5*s,d*0.15,0,Math.PI*2);ctx.fill();}
    // Tail feathers
    ctx.fillStyle=c.wing;ctx.beginPath();
    ctx.moveTo(x-9*d*s,y-1*s+bS);ctx.quadraticCurveTo(x-14*d*s,y-8*s+bS,x-12*d*s,y-6*s+bS);
    ctx.quadraticCurveTo(x-16*d*s,y-5*s+bS,x-11*d*s,y+1*s+bS);
    ctx.closePath();ctx.fill();
    // Head
    const hx=x+8*d*s, hy=y-6*s+hD+bS;
    if(e.state===S.SLEEP){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+3*d*s,y-3*s+bS,4*s,0,Math.PI*2);ctx.fill();
      const za=0.35+Math.sin(a*2)*0.25;ctx.fillStyle=`rgba(180,200,255,${za})`;ctx.font=`bold ${7*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('z',x+10*s,y-12*s+Math.sin(a)*2);ctx.font=`bold ${9*s|0}px sans-serif`;ctx.fillText('Z',x+15*s,y-18*s+Math.sin(a+1)*2);
    } else {
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,4.5*s,0,Math.PI*2);ctx.fill();
      // Head highlight
      ctx.fillStyle='rgba(255,255,255,0.1)';ctx.beginPath();ctx.arc(hx-d*s,hy-s,2*s,0,Math.PI*2);ctx.fill();
      // Eye
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+2.5*d*s,hy-0.5*s,1.2*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+2.8*d*s,hy-1*s,0.5*s,0,Math.PI*2);ctx.fill();
      // Beak
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+4.5*d*s,hy-0.5*s);ctx.lineTo(hx+8*d*s,hy+0.5*s);ctx.lineTo(hx+4.5*d*s,hy+1.5*s);ctx.closePath();ctx.fill();
      // Comb
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-1*d*s,hy-4*s);ctx.lineTo(hx+1*d*s,hy-7*s);ctx.lineTo(hx+3*d*s,hy-5*s);ctx.lineTo(hx+4*d*s,hy-8*s);ctx.lineTo(hx+5*d*s,hy-4*s);ctx.closePath();ctx.fill();
      // Wattle
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+3*d*s,hy+3*s,1.5*s,2.5*s,0,0,Math.PI*2);ctx.fill();
      if(e.state===S.EAT&&hD>1.5*s){ctx.fillStyle=PAL.feed;ctx.beginPath();ctx.arc(hx+7*d*s,hy+1*s,1*s,0,Math.PI*2);ctx.fill();}
    }
    // Premium shimmer
    if(c.shimmer){const sh=0.08+Math.sin(a*3)*0.06;ctx.fillStyle=`rgba(255,255,180,${sh})`;ctx.beginPath();ctx.ellipse(x,y+bS,13*s,10*s,0,0,Math.PI*2);ctx.fill();}
    // Starving indicator
    if(e.starving){const p=0.5+Math.sin(a*4)*0.3;ctx.fillStyle=`rgba(220,40,40,${p})`;ctx.beginPath();ctx.arc(x,y-18*s,6*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font=`bold ${8*s|0}px sans-serif`;ctx.textAlign='center';ctx.fillText('!',x,y-15*s);}
    // Selected
    if(sel){ctx.strokeStyle='rgba(105,240,174,0.7)';ctx.lineWidth=1.5;ctx.setLineDash([3,2]);ctx.beginPath();ctx.ellipse(x,y+1,16*s,12*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`${e.data.species} #${e.data.id}`;ctx.font=`bold ${7*s|0}px monospace`;const tw=ctx.measureText(lb).width+8;ctx.fillStyle='rgba(0,0,0,0.7)';rr2(x-tw/2,y-30*s,tw,13*s,3);ctx.fill();ctx.fillStyle='#69f0ae';ctx.textAlign='center';ctx.fillText(lb,x,y-20*s);}
    ctx.restore();
  }

  function drawChick(e,sel){
    const a=e.at||0,d=e.dir,s=SC;let yO=0,lA=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*1.5*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-1;break;case S.PECK:yO=(e.peckB||0)*0.4*s;break;case S.SCRATCH:lA=(e.scratchB||0)*0.5*s;break;default:yO=Math.sin(a*3+(e.bo||0))*0.6;}
    const x=e.x|0,y=(e.y+yO)|0;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.12)';ctx.beginPath();ctx.ellipse(x,(e.y|0)+5*s,5*s,2*s,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c88020';ctx.lineWidth=0.8*s;
    ctx.beginPath();ctx.moveTo(x-1.5*s,y+3.5*s);ctx.lineTo(x-2*s-lA*0.4,y+5*s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+1.5*s,y+3.5*s);ctx.lineTo(x+2*s+lA*0.4,y+5*s);ctx.stroke();
    const cg=ctx.createRadialGradient(x-s,y-s,0,x,y,4.5*s);cg.addColorStop(0,'#fffc90');cg.addColorStop(0.6,'#ffe838');cg.addColorStop(1,'#d8b828');
    ctx.fillStyle=cg;ctx.beginPath();ctx.arc(x,y,4.5*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,200,0.25)';ctx.beginPath();ctx.arc(x-s,y-1.5*s,2*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(x+2.2*d*s,y-0.8*s,0.8*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e09018';ctx.beginPath();ctx.moveTo(x+3.5*d*s,y-0.2*s);ctx.lineTo(x+5.5*d*s,y+0.5*s);ctx.lineTo(x+3.5*d*s,y+1.2*s);ctx.closePath();ctx.fill();
    const fa=Math.sin(a*(e.state===S.WALK?8:4))*0.2;
    ctx.fillStyle='#eec828';ctx.beginPath();ctx.ellipse(x-2*d*s,y+0.5*s,3*s,2.5*s,fa*d,0,Math.PI*2);ctx.fill();
    if(sel){ctx.strokeStyle='rgba(255,244,79,0.7)';ctx.lineWidth=1;ctx.setLineDash([2,2]);ctx.beginPath();ctx.ellipse(x,y,8*s,7*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`Chick > ${e.data.target_species}`;ctx.font=`bold ${6*s|0}px monospace`;const tw=ctx.measureText(lb).width+8;ctx.fillStyle='rgba(0,0,0,0.7)';rr2(x-tw/2,y-18*s,tw,11*s,3);ctx.fill();ctx.fillStyle='#fff44f';ctx.textAlign='center';ctx.fillText(lb,x,y-10*s);}
    ctx.restore();
  }

  function drawEgg(e){
    const x=e.x|0,y=e.y|0,s=SC;
    ctx.save();ctx.translate(x,y);ctx.rotate(e.tilt||0);
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(0,5*s,4*s,1.5*s,0,0,Math.PI*2);ctx.fill();
    const eg=ctx.createRadialGradient(-s,-s*1.5,0,0,0,6*s);eg.addColorStop(0,'#fff8ee');eg.addColorStop(0.7,'#f0e8d8');eg.addColorStop(1,'#d8ccb8');
    ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(0,0,4*s,5.5*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.beginPath();ctx.ellipse(-s,-1.5*s,1.5*s,2*s,-0.3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // ── Rooster Drawing ──────────────────────────
  function drawRooster(e){
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0,s=SC;
    let yO=0,lA=0,bS=0;
    if(e.state===S.WALK){lA=Math.sin(e.wp||0)*3*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-1.5;}
    else if(e.state===S.CROW){yO=-1;}
    else if(e.state===S.FLAP){yO=-Math.abs(Math.sin(a*12)*0.6)*4*s;}
    else if(e.state===S.COURT){yO=Math.sin(a*6)*1.5;}
    else if(e.state===S.SLEEP){bS=1.5*s;yO=1;}
    else{yO=Math.sin(a*2)*0.8;}
    const y=(e.y+yO)|0;
    ctx.save();
    // Shadow
    ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(x,(e.y|0)+12*s,12*s,4.5*s,0,0,Math.PI*2);ctx.fill();
    // Legs
    ctx.strokeStyle=c.legs;ctx.lineWidth=2*s;
    ctx.beginPath();ctx.moveTo(x-3*d*s,y+8*s+bS);ctx.lineTo(x-3*d*s-lA,y+12*s+bS);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+2*d*s,y+8*s+bS);ctx.lineTo(x+2*d*s+lA,y+12*s+bS);ctx.stroke();
    // Feet
    ctx.lineWidth=1.2*s;
    [-1,0,1].forEach(t=>{const fx=x-3*d*s-lA;ctx.beginPath();ctx.moveTo(fx,y+12*s+bS);ctx.lineTo(fx+t*2.5*s,y+13.5*s+bS);ctx.stroke();});
    // Spurs
    ctx.strokeStyle='#bb8820';ctx.lineWidth=1.2*s;ctx.beginPath();ctx.moveTo(x-3*d*s-lA,y+11*s+bS);ctx.lineTo(x-3*d*s-lA-2.5*d*s,y+9.5*s+bS);ctx.stroke();
    // Body with gradient
    const bg=ctx.createRadialGradient(x-2*d*s,y-s+bS,1,x,y+2*s+bS,12*s);bg.addColorStop(0,c.body);bg.addColorStop(1,c.outline);
    ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(x,y+bS,12*s,9*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.ellipse(x-d*s,y-2*s+bS,6*s,4*s,0,0,Math.PI*2);ctx.fill();
    // Wing
    if(e.state===S.FLAP||e.state===S.COURT){const wf=Math.sin(a*12)*0.6;ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-3*d*s,y+bS);ctx.rotate(wf*d);ctx.beginPath();ctx.ellipse(0,-4*s,8*s,10*s,d*0.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-3*d*s,y+s+bS,7*s,5.5*s,d*0.15,0,Math.PI*2);ctx.fill();}
    // Grand tail feathers
    ctx.fillStyle=c.tail1;ctx.beginPath();ctx.moveTo(x-10*d*s,y-3*s+bS);ctx.quadraticCurveTo(x-22*d*s,y-18*s+bS,x-18*d*s,y-14*s+bS);ctx.lineTo(x-10*d*s,y+s+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail2;ctx.beginPath();ctx.moveTo(x-10*d*s,y-s+bS);ctx.quadraticCurveTo(x-24*d*s,y-12*s+bS,x-18*d*s,y-8*s+bS);ctx.lineTo(x-10*d*s,y+3*s+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail3;ctx.beginPath();ctx.moveTo(x-9*d*s,y+bS);ctx.quadraticCurveTo(x-20*d*s,y-8*s+bS,x-16*d*s,y-3*s+bS);ctx.lineTo(x-9*d*s,y+4*s+bS);ctx.closePath();ctx.fill();
    // Head
    const hx=x+10*d*s, hy=y-8*s+bS;
    if(e.state===S.SLEEP){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+4*d*s,y-4*s+bS,5*s,0,Math.PI*2);ctx.fill();
      const za=0.35+Math.sin(a*2)*0.25;ctx.fillStyle=`rgba(180,200,255,${za})`;ctx.font=`bold ${8*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('z',x+12*s,y-15*s+Math.sin(a)*2);ctx.font=`bold ${10*s|0}px sans-serif`;ctx.fillText('Z',x+18*s,y-21*s+Math.sin(a+1)*2);
    } else if(e.state===S.CROW){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy-s,5.5*s,0,Math.PI*2);ctx.fill();
      // Open beak
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+5*d*s,hy-3*s);ctx.lineTo(hx+12*d*s,hy-4*s);ctx.lineTo(hx+5*d*s,hy-s);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(hx+5*d*s,hy);ctx.lineTo(hx+10*d*s,hy+s);ctx.lineTo(hx+5*d*s,hy+s);ctx.closePath();ctx.fill();
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+3*d*s,hy-1.5*s,1.5*s,0,Math.PI*2);ctx.fill();
      // Crow text
      const ca=0.4+Math.sin(a*4)*0.3;ctx.fillStyle=`rgba(255,210,60,${ca})`;ctx.font=`bold ${8*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('COCORIC\u00D3\u00D3!',hx,hy-18*s+Math.sin(a*3)*2);
      // Comb
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-s*d,hy-6*s);ctx.lineTo(hx+s*d,hy-11*s);ctx.lineTo(hx+3*d*s,hy-7*s);ctx.lineTo(hx+4*d*s,hy-12*s);ctx.lineTo(hx+6*d*s,hy-6*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+4*d*s,hy+3*s,2.5*s,3.5*s,0,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,5.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.arc(hx-d*s,hy-s,2.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+3*d*s,hy-s,1.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+3.3*d*s,hy-1.5*s,0.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+5.5*d*s,hy-0.5*s);ctx.lineTo(hx+10*d*s,hy+0.5*s);ctx.lineTo(hx+5.5*d*s,hy+1.5*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-s*d,hy-5*s);ctx.lineTo(hx+s*d,hy-10*s);ctx.lineTo(hx+3*d*s,hy-6*s);ctx.lineTo(hx+4*d*s,hy-11*s);ctx.lineTo(hx+6*d*s,hy-5*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+4*d*s,hy+3.5*s,2*s,3.5*s,0,0,Math.PI*2);ctx.fill();
    }
    // Court hearts
    if(e.state===S.COURT){const ca=e.courtA||0;if(Math.sin(ca)>0.3){ctx.fillStyle='rgba(255,70,70,0.5)';ctx.font=`${8*s|0}px sans-serif`;ctx.textAlign='center';ctx.fillText('\u2665',x+Math.sin(ca*2)*8*s,y-20*s+Math.cos(ca)*4);}}
    ctx.restore();
  }

  // ── Farmer Drawing ──────────────────────────
  function drawFarmerSprite(){
    const x=farmer.x|0, y=farmer.y|0, a=farmer.phase, s=SC;
    const wc=farmer.state!=='feed'?Math.sin((farmer.wp||0)*2)*2.5*s:0;
    ctx.save();
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(x,y+16*s,10*s,4*s,0,0,Math.PI*2);ctx.fill();
    // Boots
    ctx.fillStyle='#3a2010';ctx.fillRect(x-6*s,y+10*s+wc,5*s,5*s);ctx.fillRect(x+1*s,y+10*s-wc,5*s,5*s);
    // Jeans with gradient
    const jg=ctx.createLinearGradient(x-5*s,0,x+5*s,0);jg.addColorStop(0,'#284880');jg.addColorStop(1,'#3868a8');
    ctx.fillStyle=jg;ctx.fillRect(x-5*s,y+1*s+wc,4*s,11*s);ctx.fillRect(x+1*s,y+1*s-wc,4*s,11*s);
    // Shirt with gradient
    const sg=ctx.createLinearGradient(x-6*s,0,x+6*s,0);sg.addColorStop(0,'#a83030');sg.addColorStop(0.5,'#cc4040');sg.addColorStop(1,'#b03535');
    ctx.fillStyle=sg;ctx.fillRect(x-6*s,y-11*s,12*s,14*s);
    // Arms
    ctx.strokeStyle='#c89060';ctx.lineWidth=2.5*s;
    if(farmer.state==='feed'){
      ctx.beginPath();ctx.moveTo(x+6*s,y-6*s);ctx.lineTo(x+12*s+Math.sin(a*3)*4*s,y-3*s+Math.cos(a*4)*3*s);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-6*s,y-6*s);ctx.lineTo(x-9*s,y-1*s);ctx.stroke();
      // Bucket
      const bg=ctx.createLinearGradient(x-13*s,0,x-6*s,0);bg.addColorStop(0,'#666');bg.addColorStop(1,'#999');
      ctx.fillStyle=bg;ctx.fillRect(x-13*s,y-4*s,7*s,8*s);ctx.fillStyle='#555';ctx.fillRect(x-13*s,y-4*s,7*s,1.5*s);
      ctx.fillStyle=PAL.feed;ctx.fillRect(x-12*s,y-2*s,5*s,5*s);
    } else {
      ctx.beginPath();ctx.moveTo(x+6*s,y-6*s);ctx.lineTo(x+8*s,y+1*s+wc*0.4);ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-6*s,y-6*s);ctx.lineTo(x-8*s,y+1*s-wc*0.4);ctx.stroke();
    }
    // Head with skin gradient
    const hg=ctx.createRadialGradient(x-s,y-16*s,0,x,y-15*s,6*s);hg.addColorStop(0,'#e0b080');hg.addColorStop(1,'#c89060');
    ctx.fillStyle=hg;ctx.beginPath();ctx.arc(x,y-15*s,5.5*s,0,Math.PI*2);ctx.fill();
    // Straw hat
    const hatg=ctx.createLinearGradient(0,y-24*s,0,y-18*s);hatg.addColorStop(0,'#d4a848');hatg.addColorStop(1,'#b08830');
    ctx.fillStyle=hatg;ctx.fillRect(x-8*s,y-22*s,16*s,3*s);ctx.fillRect(x-5*s,y-27*s,10*s,6*s);
    ctx.fillStyle='#987028';ctx.fillRect(x-5*s,y-22*s,10*s,1.5*s);
    // Eyes
    ctx.fillStyle='#2a2a2a';ctx.beginPath();ctx.arc(x-2*s,y-16*s,1*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x+2*s,y-16*s,1*s,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // ── Ambient Life ───────────────────────────────
  function drawButterflies(){butterflies.forEach(b=>{const wa=Math.sin(b.wp)*0.8;ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle=b.c;ctx.beginPath();ctx.ellipse(-3,0,4,2.5*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(3,0,4,2.5*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#333';ctx.fillRect(-0.5,-2,1,4);ctx.restore();});}

  function drawParticles(){particles.forEach(p=>{const al=clamp(p.life/0.8,0,1);if(p.feather){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(gt*3);ctx.fillStyle=p.color;ctx.globalAlpha=al;ctx.beginPath();ctx.ellipse(0,0,p.sz,p.sz*0.4,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.restore();}else{ctx.fillStyle=p.color||PAL.dirt2;ctx.globalAlpha=al;ctx.fillRect(p.x|0,p.y|0,p.sz||2,p.sz||2);ctx.globalAlpha=1;}});}

  function drawFireflies(){fireflies.forEach(f=>{const br=0.4+Math.sin(f.ph*3)*0.4;const gl=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,8);gl.addColorStop(0,`rgba(200,255,100,${br})`);gl.addColorStop(1,'rgba(200,255,100,0)');ctx.fillStyle=gl;ctx.fillRect(f.x-8,f.y-8,16,16);ctx.fillStyle=`rgba(220,255,120,${br+0.2})`;ctx.fillRect(f.x|0,f.y|0,2,2);});}

  // ── HUD ────────────────────────────────────────
  function drawHUD(){
    if(!farmData) return;
    const s=SC, fs=Math.max(8,9*s)|0, pad=6*s;
    ctx.font=`bold ${fs}px monospace`;
    // Stats (left)
    const lw=110*s,lh=42*s;
    ctx.fillStyle='rgba(0,0,0,0.55)';rr2(pad,pad,lw,lh,4*s);ctx.fill();
    ctx.strokeStyle='rgba(105,240,174,0.15)';ctx.lineWidth=0.5;rr2(pad,pad,lw,lh,4*s);ctx.stroke();
    const lx=pad+6*s;
    ctx.textAlign='left';
    ctx.fillStyle='#69f0ae';ctx.fillText(`${(farmData.chickens||[]).length}`,lx,pad+12*s);
    ctx.fillStyle='#faf0e6';ctx.fillText(`${farmData.eggs_available||0}`,lx,pad+24*s);
    ctx.fillStyle='#fff44f';ctx.fillText(`${(farmData.chicks||[]).length}`,lx,pad+36*s);
    // Icons
    ctx.font=`${fs-1}px monospace`;ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.textAlign='right';const rx=pad+lw-4*s;
    ctx.fillText('hens',rx,pad+12*s);ctx.fillText('eggs',rx,pad+24*s);ctx.fillText('chicks',rx,pad+36*s);
    // Economy (right)
    ctx.font=`bold ${fs}px monospace`;
    const rw=100*s,rh=30*s;
    ctx.fillStyle='rgba(0,0,0,0.55)';rr2(W-rw-pad,pad,rw,rh,4*s);ctx.fill();
    ctx.strokeStyle='rgba(105,240,174,0.15)';ctx.lineWidth=0.5;rr2(W-rw-pad,pad,rw,rh,4*s);ctx.stroke();
    ctx.textAlign='right';const rrx=W-pad-4*s;
    ctx.fillStyle='#d4a040';ctx.fillText(`${(farmData.feed_balance||0).toFixed(1)}`,rrx,pad+12*s);
    ctx.fillStyle='#76f7be';ctx.fillText(`$${(farmData.balance_usdt||0).toFixed(2)}`,rrx,pad+24*s);
    // Labels
    ctx.font=`${fs-1}px monospace`;ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.textAlign='left';const rlx=W-rw-pad+4*s;
    ctx.fillText('feed',rlx,pad+12*s);ctx.fillText('usdt',rlx,pad+24*s);
    // Day/Night indicator
    const hr=new Date().getHours(),isD=hr>=6&&hr<20;
    const tw=48*s;
    ctx.fillStyle='rgba(0,0,0,0.45)';rr2(W/2-tw/2,pad,tw,14*s,3*s);ctx.fill();
    ctx.textAlign='center';ctx.font=`bold ${fs-1}px monospace`;ctx.fillStyle=isD?'#ffd700':'#8888cc';
    ctx.fillText(isD?'\u2600 DAY':'\u263E NIGHT',W/2,pad+10*s);
    // Empty farm message
    if(!entities.length&&!rooster){ctx.fillStyle='rgba(0,0,0,0.55)';const mw=200*s;rr2(W/2-mw/2,H/2-12*s,mw,24*s,6*s);ctx.fill();ctx.fillStyle='#a9b6d0';ctx.font=`${11*s|0}px monospace`;ctx.textAlign='center';ctx.fillText('Buy your first chicken!',W/2,H/2+3*s);}
  }

  // ── Interaction ────────────────────────────────
  function onClick(ev){const r=canvas.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top;const h=findE(mx,my);selectedEntity=h;if(h&&onSelectCb)onSelectCb(h);}
  function onHover(ev){const r=canvas.getBoundingClientRect();canvas.style.cursor=findE(ev.clientX-r.left,ev.clientY-r.top)?'pointer':'default';}
  function findE(mx,my){const s=[...entities].sort((a,b)=>b.y-a.y);for(const e of s){const r=e.type==='egg'?8:e.type==='chick'?10:20,dx=mx-e.x,dy=my-e.y;if(dx*dx+dy*dy<r*r)return e;}return null;}

  return { init, update };
})();
