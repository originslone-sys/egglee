/**
 * farm-map.js — Illustrated Living Farm (Canvas 2D)
 * High-quality painterly rendering with depth, atmosphere, and rich detail.
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
  let farmer = {active:false,x:-40,y:0,dir:1,phase:0,state:'idle',timer:0,feedTimer:0,walkTarget:0,wp:0,feedAnim:0};

  // Layout ratios
  const SKY_H = 0.38;      // sky ends here
  const HILLS_H = 0.30;    // distant hills
  const FENCE_Y = 0.38;    // fence row
  const GROUND_Y = 0.36;   // grass starts
  const PATH_Y = 0.72;     // dirt path center
  const POND = {cxR:0.72, cyR:0.55};
  const TROUGH = {xR:0.38, yR:0.65};
  const PASTURE = {x0:0.08, x1:0.92, y0:0.45, y1:0.88};

  const S = {IDLE:0,WALK:1,PECK:2,EAT:3,SLEEP:4,FLAP:5,DRINK:6,SCRATCH:7,CROW:8,COURT:9};

  // Chicken species colors — distinct
  const SPCOL = {
    'Comum':   {body:'#f5f0e8',wing:'#e0d8c8',comb:'#cc2020',beak:'#e89020',legs:'#d08828',outline:'#c0b090'},
    'Premium': {body:'#ffd030',wing:'#cc9818',comb:'#ff1838',beak:'#ff8c00',legs:'#c89028',outline:'#a87810'},
    'Rare':    {body:'#2848a0',wing:'#1a3078',comb:'#dd1818',beak:'#e88820',legs:'#907040',outline:'#182860'},
  };
  const DCOL = {body:'#ddd',wing:'#bbb',comb:'#c33',beak:'#da0',legs:'#d90',outline:'#aaa'};
  const RCOL = {body:'#1a4828',wing:'#0e3018',comb:'#ee1818',beak:'#ff8800',legs:'#b87020',outline:'#0a2810',
    tail1:'#001880',tail2:'#004828',tail3:'#006848'};

  // Helpers
  function hash(n){return((n*2654435761)>>>0)%10000}
  function sr(s){const x=Math.sin(s*127.1)*43758.5453;return x-Math.floor(x)}
  function rr(a,b){return a+Math.random()*(b-a)}
  function lerp(a,b,t){return a+(b-a)*t}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function lerpCol(a,b,t){const ah=parseInt(a.slice(1),16),bh=parseInt(b.slice(1),16);const ar=(ah>>16)&0xff,ag=(ah>>8)&0xff,ab=ah&0xff;const br=(bh>>16)&0xff,bg=(bh>>8)&0xff,bb=bh&0xff;const r=Math.round(ar+(br-ar)*t),g=Math.round(ag+(bg-ag)*t),bl=Math.round(ab+(bb-ab)*t);return'#'+((r<<16)|(g<<8)|bl).toString(16).padStart(6,'0');}
  function rr2(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
  function canSpawn(){return particles.length<MAX_PARTICLES;}

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
    const mob = W < 600;
    H = mob ? Math.max(380, W * 0.75) : Math.max(440, Math.min(620, W * 0.48));
    SC = Math.max(0.45, Math.min(1.1, W / 950));
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function update(data) { farmData = data; rebuildEntities(); }

  // ── World Gen ──────────────────────────────────
  function genWorld() {
    clouds=[];for(let i=0;i<7;i++)clouds.push({x:rr(-W*0.2,W*1.2),y:rr(8,H*SKY_H*0.55),w:rr(60,160)*SC,spd:rr(3,8),op:rr(0.5,0.85),bubbles:Math.floor(rr(4,8))});
    grass=[];for(let i=0;i<200;i++)grass.push({x:rr(0,W),y:rr(H*GROUND_Y,H),h:rr(3,10)*SC,ph:rr(0,Math.PI*2),shade:rr(0,1)});
    flowers=[];const fc=['#ff5070','#ff8840','#cc70ff','#ff3050','#fff','#ffccdd','#80ccff','#5050ff','#ffee30','#ff90b0','#70dd70'];
    for(let i=0;i<35;i++)flowers.push({x:rr(0,W),y:rr(H*0.68,H*0.98),c:fc[i%fc.length],sz:rr(1.5,4)*SC,ph:rr(0,Math.PI*2),petals:Math.floor(rr(4,7))});
    // mid-field flowers (sparser)
    for(let i=0;i<12;i++)flowers.push({x:rr(0,W),y:rr(H*0.45,H*0.68),c:fc[i%fc.length],sz:rr(1,2.5)*SC,ph:rr(0,Math.PI*2),petals:Math.floor(rr(4,6))});
    trees=[];[0.08,0.25,0.52,0.68,0.88].forEach((p,i)=>trees.push({x:W*p+sr(i*77)*30,y:H*FENCE_Y-rr(5,15)*SC,sc:rr(0.7,1.1),ph:rr(0,Math.PI*2)}));
    rocks=[];for(let i=0;i<12;i++)rocks.push({x:rr(W*0.02,W*0.98),y:rr(H*0.65,H*0.96),sz:rr(3,8)*SC,c:'#'+[['778899','889988','8a8878','99887a'][i%4]],rot:rr(-0.3,0.3)});
    butterflies=[];['#ff6090','#aa80ff','#ffdd44','#80ddff','#ff9944'].forEach((c,i)=>butterflies.push({x:rr(0,W),y:rr(H*0.4,H*0.7),vx:0,vy:0,tx:rr(0,W),ty:rr(H*0.3,H*0.7),c,wp:rr(0,Math.PI*2),tmr:0}));
  }

  // ── Loop ───────────────────────────────────────
  function loop(now) {
    const dt = Math.min(0.05,(now-lastTime)/1000); lastTime=now; gt+=dt;
    tick(dt); render();
    requestAnimationFrame(loop);
  }

  function tick(dt) {
    clouds.forEach(c=>{c.x+=c.spd*dt;if(c.x>W+c.w)c.x=-c.w*1.5;});
    butterflies.forEach(b=>{
      b.tmr-=dt;if(b.tmr<=0){b.tx=rr(W*0.05,W*0.95);b.ty=rr(H*0.35,H*0.7);b.tmr=rr(2,5);}
      const dx=b.tx-b.x,dy=b.ty-b.y,d=Math.sqrt(dx*dx+dy*dy)||1;
      b.vx=lerp(b.vx,(dx/d)*25,dt*2);b.vy=lerp(b.vy,(dy/d)*25+Math.sin(gt*3)*8,dt*2);
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.wp+=dt*14;
    });
    entities.forEach(e=>tickEntity(e,dt));
    if(rooster)tickRooster(rooster,dt);
    tickFarmer(dt);
    sortDirty=true;
    if(particles.length>MAX_PARTICLES)particles.length=MAX_PARTICLES;
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||0)*dt;}
    const hr=new Date().getHours(),night=hr<6||hr>=20;
    if(night&&fireflies.length<15)fireflies.push({x:rr(0,W),y:rr(H*0.4,H*0.85),vx:rr(-12,12),vy:rr(-8,8),ph:rr(0,Math.PI*2),life:rr(3,7)});
    if(!night)fireflies=[];
    for(let i=fireflies.length-1;i>=0;i--){const f=fireflies[i];f.life-=dt;if(f.life<=0){fireflies.splice(i,1);continue;}f.x+=f.vx*dt+Math.sin(gt*2+f.ph)*6*dt;f.y+=f.vy*dt+Math.cos(gt*1.5+f.ph)*4*dt;f.ph+=dt;}
  }

  // ── Entity AI ──────────────────────────────────
  function tickEntity(e, dt) {
    e.at=(e.at||0)+dt; e.st=(e.st||0)-dt;
    if(e.type==='egg')return;
    if(e.st<=0)pickState(e);
    switch(e.state){
      case S.WALK:moveToTarget(e,dt);break;
      case S.EAT:e.eatB=Math.abs(Math.sin(e.at*8))*3;if(canSpawn()&&Math.random()<dt*3)particles.push({x:e.x+e.dir*5*SC,y:e.y-2,vx:rr(-12,12),vy:rr(-20,-8),life:0.5,color:'#d8a838',sz:1.5*SC,g:45});break;
      case S.PECK:e.peckB=Math.abs(Math.sin(e.at*10))*4;if(canSpawn()&&Math.random()<dt*2)particles.push({x:e.x+e.dir*4*SC,y:e.y+6*SC,vx:rr(-6,6),vy:rr(-5,-12),life:0.5,color:'#9a7850',sz:1.5*SC,g:18});break;
      case S.FLAP:e.flapA=Math.sin(e.at*12)*0.6;if(canSpawn()&&Math.random()<dt*2)particles.push({x:e.x,y:e.y-3*SC,vx:rr(-15,15),vy:rr(-15,-5),life:1,color:e.colors?e.colors.wing:'#eee',sz:2*SC,g:10,feather:1});break;
      case S.SLEEP:e.sleepB=Math.sin(e.at*1.5)*1;break;
      case S.DRINK:e.drinkB=Math.abs(Math.sin(e.at*6))*3;if(canSpawn()&&Math.random()<dt*2)particles.push({x:e.x+e.dir*4*SC,y:e.y+2,vx:rr(-3,3),vy:rr(-6,-2),life:0.4,color:'#90d8ff',sz:1.2*SC,g:12});break;
      case S.SCRATCH:e.scratchB=Math.sin(e.at*10)*2.5;if(canSpawn()&&Math.random()<dt*3)particles.push({x:e.x+(Math.sin(e.at*5)>0?-3:3)*SC,y:e.y+(e.type==='chick'?4:10)*SC,vx:rr(-10,10),vy:rr(-6,-2),life:0.4,color:'#9a7850',sz:1.8*SC,g:20});break;
      default:e.idleB=Math.sin(e.at*2+(e.bo||0))*0.6;
    }
  }

  function pickState(e) {
    const hr=new Date().getHours(),night=hr<6||hr>=21;
    if(night&&e.type==='chicken'){e.state=S.SLEEP;e.st=4+rr(0,6);return;}
    const r=Math.random();
    if(e.type==='chick'){
      if(r<0.30){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=14+rr(0,10);e.st=5;}
      else if(r<0.50){e.state=S.PECK;e.st=1+rr(0,2);}
      else if(r<0.62){e.state=S.SCRATCH;e.st=1+rr(0,1.5);}
      else{e.state=S.IDLE;e.st=1+rr(0,3);}
      return;
    }
    if(r<0.22){e.state=S.WALK;e.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());e.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());e.spd=10+rr(0,8);e.st=6;}
    else if(r<0.35&&farmData&&farmData.feed_balance>0){e.state=S.WALK;e.tx=W*TROUGH.xR+rr(-12,12);e.ty=H*TROUGH.yR+rr(-3,8);e.spd=12+rr(0,6);e.st=8;e.goEat=1;}
    else if(r<0.48){e.state=S.SCRATCH;e.st=2+rr(0,3);}
    else if(r<0.58){e.state=S.WALK;e.tx=W*POND.cxR+rr(-12,8);e.ty=H*POND.cyR+rr(8,18);e.spd=10+rr(0,5);e.st=10;e.goDrink=1;}
    else if(r<0.70){e.state=S.PECK;e.st=1.5+rr(0,2.5);}
    else if(r<0.78){e.state=S.FLAP;e.st=0.8+rr(0,1.2);}
    else{e.state=S.IDLE;e.st=2+rr(0,4);}
  }

  function moveToTarget(e, dt) {
    if(!e.tx){e.state=S.IDLE;return;}
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.sqrt(dx*dx+dy*dy);
    if(d<5){
      if(e.goEat){e.state=S.EAT;e.st=2+rr(0,3);e.goEat=0;}
      else if(e.goDrink){e.state=S.DRINK;e.st=2+rr(0,3);e.goDrink=0;}
      else{e.state=S.IDLE;e.st=1+rr(0,2);}
      return;
    }
    const s=e.spd||18;e.x+=(dx/d)*s*dt;e.y+=(dy/d)*s*dt;e.dir=dx>0?1:-1;
    e.wp=(e.wp||0)+dt*8;
    if(canSpawn()&&Math.random()<dt*3)particles.push({x:e.x-e.dir*2,y:e.y+(e.type==='chick'?4:10)*SC,vx:-e.dir*rr(2,8),vy:rr(-2,-6),life:0.35,color:'rgba(130,110,80,0.3)',sz:1.5*SC,g:6});
  }

  // ── Rooster AI ─────────────────────────────────
  function tickRooster(r, dt) {
    r.at=(r.at||0)+dt;r.st=(r.st||0)-dt;
    if(r.st<=0)pickRoosterState(r);
    switch(r.state){
      case S.WALK:{
        const dx=r.tx-r.x,dy=r.ty-r.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<5){if(r.goCourt&&r.courtTarget){r.state=S.COURT;r.st=2+rr(0,2);}else{r.state=S.IDLE;r.st=1+rr(0,3);}}
        else{const s=r.spd||14;r.x+=(dx/d)*s*dt;r.y+=(dy/d)*s*dt;r.dir=dx>0?1:-1;r.wp=(r.wp||0)+dt*8;}
        break;
      }
      case S.CROW:r.crowB=Math.sin(r.at*6)*3;if(r.at-r.crowStart>1.8){r.state=S.IDLE;r.st=2;}break;
      case S.COURT:{if(r.courtTarget){r.dir=r.courtTarget.x>r.x?1:-1;r.courtA=(r.courtA||0)+dt*10;}break;}
      case S.FLAP:r.flapA=Math.sin(r.at*12)*0.6;break;
      default:r.idleB=Math.sin(r.at*2)*0.8;
    }
  }

  function pickRoosterState(r) {
    const hr=new Date().getHours(),night=hr<6||hr>=21;
    if(night){r.state=S.SLEEP;r.st=5+rr(0,8);return;}
    if(hr>=6&&hr<7&&Math.random()<0.3){r.state=S.CROW;r.st=3;r.crowStart=r.at;return;}
    const rnd=Math.random(),chickens=entities.filter(e=>e.type==='chicken');
    if(rnd<0.35&&chickens.length>0){
      const t=chickens[Math.floor(Math.random()*chickens.length)];
      r.state=S.WALK;r.tx=t.x+12*r.dir;r.ty=t.y;r.spd=16;r.st=8;r.goCourt=1;r.courtTarget=t;r.courtA=0;
    } else if(rnd<0.48){r.state=S.CROW;r.st=3;r.crowStart=r.at;}
    else if(rnd<0.68){r.state=S.WALK;r.tx=lerp(W*PASTURE.x0,W*PASTURE.x1,Math.random());r.ty=lerp(H*PASTURE.y0,H*PASTURE.y1,Math.random());r.spd=12+rr(0,8);r.st=7;}
    else if(rnd<0.78){r.state=S.FLAP;r.st=1+rr(0,1.5);}
    else{r.state=S.IDLE;r.st=2+rr(0,4);}
  }

  // ── Farmer AI ──────────────────────────────────
  function tickFarmer(dt) {
    farmer.phase+=dt;
    if(!farmer.active){
      farmer.feedTimer=(farmer.feedTimer||0)+dt;
      if(farmer.feedTimer>3600){farmer.feedTimer=0;farmer.active=true;farmer.x=-30;farmer.y=H*PATH_Y;farmer.dir=1;farmer.state='walkIn';farmer.walkTarget=W*TROUGH.xR;farmer.phase=0;farmer.wp=0;}
      return;
    }
    switch(farmer.state){
      case'walkIn':farmer.x+=40*dt;farmer.wp+=dt*5;if(farmer.x>=farmer.walkTarget){farmer.state='feed';farmer.timer=3;farmer.feedAnim=0;}break;
      case'feed':farmer.timer-=dt;farmer.feedAnim+=dt;if(canSpawn()&&Math.random()<dt*5)particles.push({x:farmer.x+8*SC,y:farmer.y-8*SC,vx:rr(-18,18),vy:rr(-25,-8),life:0.7,color:'#d8a838',sz:2*SC,g:35});if(farmer.timer<=0){farmer.state='walkOut';farmer.dir=1;}break;
      case'walkOut':farmer.x+=40*dt;farmer.wp+=dt*5;if(farmer.x>W+50)farmer.active=false;break;
    }
  }

  // ── Rebuild Entities ───────────────────────────
  function rebuildEntities() {
    if(!farmData)return;
    const old=new Map();entities.forEach(e=>{const k=e.type+':'+(e.data?e.data.id:e.ei);old.set(k,e);});
    const nw=[];
    (farmData.chickens||[]).forEach(c=>{
      const k='chicken:'+c.id,ex=old.get(k);
      if(ex){ex.data=c;ex.starving=!!c.starvation_started_at;ex.colors=SPCOL[c.species]||DCOL;nw.push(ex);}
      else{const s=hash(c.id);nw.push({type:'chicken',data:c,x:lerp(W*PASTURE.x0,W*PASTURE.x1,sr(s)),y:lerp(H*PASTURE.y0,H*PASTURE.y1,sr(s+1)),dir:sr(s+2)>0.5?1:-1,bo:sr(s+3)*Math.PI*2,wp:0,colors:SPCOL[c.species]||DCOL,starving:!!c.starvation_started_at,state:S.IDLE,st:rr(0,3),at:rr(0,10),spd:10+sr(s+4)*8});}
    });
    (farmData.chicks||[]).forEach(c=>{
      const k='chick:'+c.id,ex=old.get(k);
      if(ex){ex.data=c;nw.push(ex);}
      else{const s=hash(c.id+5000);nw.push({type:'chick',data:c,x:lerp(W*PASTURE.x0,W*PASTURE.x1,sr(s)),y:lerp(H*(PASTURE.y1-0.15),H*PASTURE.y1,sr(s+1)),dir:sr(s+2)>0.5?1:-1,bo:sr(s+3)*Math.PI*2,wp:0,state:S.IDLE,st:rr(0,2),at:rr(0,10),spd:14+sr(s+4)*10});}
    });
    const ec=farmData.eggs_available||0;
    for(let i=0;i<Math.min(ec,20);i++){const s=hash(i+9000);nw.push({type:'egg',ei:i,x:W*0.06+sr(s)*W*0.08,y:H*0.45+sr(s+1)*H*0.12,tilt:sr(s+2)*0.3-0.15,state:S.IDLE});}
    entities=nw;
    if(nw.some(e=>e.type==='chicken')&&!rooster){rooster={type:'rooster',x:W*0.5,y:H*0.6,dir:1,bo:0,wp:0,colors:RCOL,state:S.IDLE,st:2+rr(0,3),at:0,spd:12+rr(0,8),courtTarget:null};}
    else if(!nw.some(e=>e.type==='chicken'))rooster=null;
  }

  // ── Render ─────────────────────────────────────
  function render() {
    if(!ctx)return;
    ctx.clearRect(0,0,W,H);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    drawSky(); drawDistantHills(); drawClouds();
    drawGround(); drawTrees(); drawFence(); drawPond();
    drawRocks(); drawStructures();
    drawEntities(); drawForegroundFlowers();
    drawButterflies(); drawParticles(); drawFireflies(); drawHUD();
  }

  // ── Sky ────────────────────────────────────────
  function drawSky() {
    const hr=new Date().getHours()+new Date().getMinutes()/60;
    const skyH=H*SKY_H;
    let c1,c2,c3,na=0;
    if(hr>=6&&hr<8){const t=(hr-6)/2;c1=lerpCol('#0a1428','#2868a8',t);c2=lerpCol('#101830','#5898cc',t);c3=lerpCol('#182040','#e88838',t*0.6);}
    else if(hr>=8&&hr<17){c1='#2060a0';c2='#4090cc';c3='#88ccee';}
    else if(hr>=17&&hr<20){const t=(hr-17)/3;c1=lerpCol('#2060a0','#0a1428',t);c2=lerpCol('#4090cc','#182848',t);c3=lerpCol('#88ccee','#cc6838',t<0.5?t*1.5:1.5-t);na=t*0.2;}
    else{c1='#060c18';c2='#0a1020';c3='#101828';na=0.25;}
    const g=ctx.createLinearGradient(0,0,0,skyH+10);
    g.addColorStop(0,c1);g.addColorStop(0.4,c2);g.addColorStop(1,c3);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,skyH+10);
    // Sun or moon
    const night=hr<6||hr>=20;
    if(night){
      for(let i=0;i<60;i++){const sx=sr(i*13)*W,sy=sr(i*17)*skyH*0.85;const tw=0.12+Math.sin(gt*1.2+i*0.7)*0.2;ctx.fillStyle=`rgba(255,255,240,${tw})`;ctx.beginPath();ctx.arc(sx,sy,0.6+sr(i*31)*0.6,0,Math.PI*2);ctx.fill();}
      const mx=W*0.82,my=28*SC;
      const mg=ctx.createRadialGradient(mx,my,6*SC,mx,my,45*SC);mg.addColorStop(0,'rgba(200,210,230,0.25)');mg.addColorStop(1,'rgba(200,210,230,0)');ctx.fillStyle=mg;ctx.beginPath();ctx.arc(mx,my,45*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e0ddd0';ctx.beginPath();ctx.arc(mx,my,12*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(180,175,165,0.4)';ctx.beginPath();ctx.arc(mx-3*SC,my-2*SC,3.5*SC,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(mx+4*SC,my+3*SC,2*SC,0,Math.PI*2);ctx.fill();
    } else if(hr>=6&&hr<20){
      const sp=(hr-6)/14,sx=W*0.12+sp*W*0.76,sy=skyH*0.25+Math.sin(sp*Math.PI)*skyH*-0.15;
      // Sun glow layers
      const g3=ctx.createRadialGradient(sx,sy,2*SC,sx,sy,80*SC);g3.addColorStop(0,'rgba(255,250,200,0.4)');g3.addColorStop(0.2,'rgba(255,240,150,0.15)');g3.addColorStop(1,'rgba(255,240,150,0)');ctx.fillStyle=g3;ctx.beginPath();ctx.arc(sx,sy,80*SC,0,Math.PI*2);ctx.fill();
      const g2=ctx.createRadialGradient(sx,sy,2*SC,sx,sy,25*SC);g2.addColorStop(0,'rgba(255,255,230,0.8)');g2.addColorStop(0.5,'rgba(255,240,180,0.3)');g2.addColorStop(1,'rgba(255,240,180,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(sx,sy,25*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff8e0';ctx.beginPath();ctx.arc(sx,sy,7*SC,0,Math.PI*2);ctx.fill();
    }
    if(na>0){ctx.fillStyle=`rgba(6,10,20,${na})`;ctx.fillRect(0,0,W,skyH);}
  }

  // ── Distant Hills (atmospheric perspective) ────
  function drawDistantHills() {
    const baseY=H*SKY_H;
    const hr=new Date().getHours(),night=hr<6||hr>=20;
    // Far hills (blue-tinted)
    const farC=night?'#0a1828':'#4878a0';
    ctx.fillStyle=farC;ctx.beginPath();ctx.moveTo(0,baseY+5);
    for(let x=0;x<=W;x+=8){const h=Math.sin(x*0.004)*18+Math.sin(x*0.012)*10+Math.sin(x*0.002)*25;ctx.lineTo(x,baseY-h*SC);}
    ctx.lineTo(W,baseY+20);ctx.lineTo(0,baseY+20);ctx.closePath();ctx.fill();
    // Mid hills (green-blue)
    const midC=night?'#0c2018':'#3a7848';
    ctx.fillStyle=midC;ctx.beginPath();ctx.moveTo(0,baseY+10);
    for(let x=0;x<=W;x+=6){const h=Math.sin(x*0.006+2)*14+Math.sin(x*0.018)*8+Math.sin(x*0.003+1)*18;ctx.lineTo(x,baseY+5-h*SC);}
    ctx.lineTo(W,baseY+25);ctx.lineTo(0,baseY+25);ctx.closePath();ctx.fill();
    // Near hills (green)
    const nearC=night?'#102818':'#4a8838';
    ctx.fillStyle=nearC;ctx.beginPath();ctx.moveTo(0,baseY+15);
    for(let x=0;x<=W;x+=5){const h=Math.sin(x*0.008+4)*10+Math.sin(x*0.025)*6+Math.sin(x*0.005+3)*12;ctx.lineTo(x,baseY+12-h*SC);}
    ctx.lineTo(W,baseY+30);ctx.lineTo(0,baseY+30);ctx.closePath();ctx.fill();
  }

  // ── Clouds (volumetric multi-bubble) ───────────
  function drawClouds() {
    clouds.forEach(c=>{
      ctx.save();ctx.globalAlpha=c.op;
      for(let b=0;b<c.bubbles;b++){
        const bx=c.x+(b-c.bubbles/2)*c.w*0.14+Math.sin(b*1.3)*c.w*0.08;
        const by=c.y+Math.cos(b*2.1)*8*SC-Math.abs(b-c.bubbles/2)*3*SC;
        const br=c.w*0.12+Math.sin(b*0.9)*c.w*0.04;
        // Cloud body
        const cg=ctx.createRadialGradient(bx,by-br*0.3,br*0.1,bx,by,br);
        cg.addColorStop(0,'rgba(255,255,255,0.95)');cg.addColorStop(0.6,'rgba(245,248,255,0.7)');cg.addColorStop(1,'rgba(220,230,245,0.1)');
        ctx.fillStyle=cg;ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    });
  }

  // ── Ground ─────────────────────────────────────
  function drawGround() {
    const gy=H*GROUND_Y;
    // Rich grass gradient
    const g=ctx.createLinearGradient(0,gy,0,H);
    g.addColorStop(0,'#6aaa40');g.addColorStop(0.08,'#5a9830');g.addColorStop(0.2,'#4a8828');g.addColorStop(0.4,'#3a7820');g.addColorStop(0.7,'#2a6018');g.addColorStop(1,'#1a4810');
    ctx.fillStyle=g;ctx.fillRect(0,gy,W,H-gy);
    // Sunlit patches
    for(let i=0;i<10;i++){
      const px=sr(i*71)*W,py=gy+sr(i*37)*(H-gy)*0.7,pr=rr(30,70)*SC;
      const pg=ctx.createRadialGradient(px,py,0,px,py,pr);
      pg.addColorStop(0,'rgba(140,200,60,0.12)');pg.addColorStop(0.5,'rgba(120,180,50,0.05)');pg.addColorStop(1,'rgba(120,180,50,0)');
      ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.fill();
    }
    // Grass tufts
    grass.forEach(g=>{
      const sw=Math.sin(gt*0.8+g.ph)*1.5;
      const c=g.shade<0.33?'#5a9830':g.shade<0.66?'#6aaa40':'#7abb50';
      ctx.strokeStyle=c;ctx.lineWidth=1.2*SC;
      ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.quadraticCurveTo(g.x+sw,g.y-g.h*0.6,g.x+sw*0.8,g.y-g.h);ctx.stroke();
      ctx.beginPath();ctx.moveTo(g.x+1.5*SC,g.y);ctx.quadraticCurveTo(g.x+1.5*SC+sw*0.6,g.y-g.h*0.4,g.x+2*SC+sw*0.5,g.y-g.h*0.7);ctx.stroke();
    });
    // Dirt path with natural edges
    const py=H*PATH_Y,ph=H*0.035;
    ctx.save();ctx.beginPath();
    ctx.moveTo(-10,py-ph);
    ctx.bezierCurveTo(W*0.15,py-ph-6,W*0.3,py-ph+5,W*0.5,py-ph-2);
    ctx.bezierCurveTo(W*0.7,py-ph-6,W*0.85,py-ph+4,W+10,py-ph-3);
    ctx.lineTo(W+10,py+ph+3);
    ctx.bezierCurveTo(W*0.85,py+ph-3,W*0.7,py+ph+5,W*0.5,py+ph);
    ctx.bezierCurveTo(W*0.3,py+ph-4,W*0.15,py+ph+5,-10,py+ph+2);
    ctx.closePath();
    const dg=ctx.createLinearGradient(0,py-ph,0,py+ph);
    dg.addColorStop(0,'#b89860');dg.addColorStop(0.3,'#a08048');dg.addColorStop(0.7,'#8a6838');dg.addColorStop(1,'#705828');
    ctx.fillStyle=dg;ctx.fill();
    // Path pebbles/texture
    for(let i=0;i<50;i++){const px2=sr(i*47)*W,py2=py+sr(i*53)*ph*1.8-ph*0.5;
      ctx.fillStyle=`rgba(${130+sr(i*19)*40|0},${100+sr(i*29)*30|0},${60+sr(i*39)*30|0},0.25)`;
      ctx.beginPath();ctx.arc(px2,py2,0.5+sr(i*61)*1.2,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  // ── Trees (lush, round canopies) ───────────────
  function drawTrees() {trees.forEach(t=>drawTree(t.x,t.y,t.sc*SC,t.ph));}
  function drawTree(x,y,s,ph) {
    const sw=Math.sin(gt*0.5+ph)*1.5*s;
    // Ground shadow
    ctx.fillStyle='rgba(0,0,0,0.08)';ctx.beginPath();ctx.ellipse(x+3*s,y+28*s,16*s,5*s,0,0,Math.PI*2);ctx.fill();
    // Trunk with bark gradient
    const tg=ctx.createLinearGradient(x-3*s,0,x+3*s,0);tg.addColorStop(0,'#3a2410');tg.addColorStop(0.4,'#5a3818');tg.addColorStop(1,'#4a2c14');
    ctx.fillStyle=tg;ctx.fillRect(x-3*s,y+2*s,6*s,26*s);
    // Roots
    ctx.fillStyle='#4a2c14';ctx.beginPath();ctx.moveTo(x-3*s,y+26*s);ctx.quadraticCurveTo(x-8*s,y+30*s,x-6*s,y+28*s);ctx.stroke;ctx.lineTo(x-3*s,y+28*s);ctx.fill();
    // Foliage - multiple layers for depth
    const foliage=[
      {dx:0+sw*0.4,dy:-20*s,r:16*s,c1:'#2a6818',c2:'#1a4810'},
      {dx:-8*s+sw*0.7,dy:-14*s,r:12*s,c1:'#3a8828',c2:'#2a6818'},
      {dx:8*s+sw*0.5,dy:-12*s,r:11*s,c1:'#3a8828',c2:'#286018'},
      {dx:sw*0.3,dy:-24*s,r:13*s,c1:'#286818',c2:'#1a4810'},
      {dx:4*s+sw*0.6,dy:-18*s,r:10*s,c1:'#4a9838',c2:'#3a8028'},
      {dx:-3*s+sw*0.5,dy:-8*s,r:9*s,c1:'#3a8828',c2:'#2a6818'},
    ];
    foliage.forEach(f=>{
      const fg=ctx.createRadialGradient(x+f.dx,y+f.dy-f.r*0.4,f.r*0.15,x+f.dx,y+f.dy,f.r);
      fg.addColorStop(0,f.c1);fg.addColorStop(0.7,f.c2);fg.addColorStop(1,lerpCol(f.c2,'#000000',0.3));
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(x+f.dx,y+f.dy,f.r,0,Math.PI*2);ctx.fill();
    });
    // Leaf highlights
    ctx.fillStyle='rgba(130,210,80,0.15)';
    for(let i=0;i<5;i++){
      const lx=x+sr(hash((x|0)+i))*14*s-7*s+sw,ly=y-10*s-sr(hash((x|0)+i+50))*16*s;
      ctx.beginPath();ctx.arc(lx,ly,2*s,0,Math.PI*2);ctx.fill();
    }
  }

  // ── Fence ──────────────────────────────────────
  function drawFence() {
    const fy=H*FENCE_Y,fh=15*SC,fx=12,fw=W-24,np=Math.floor(fw/(30*SC));
    // Rails
    ctx.fillStyle='#a08040';ctx.fillRect(fx,fy+3*SC,fw,2*SC);ctx.fillRect(fx,fy+fh-3*SC,fw,2*SC);
    ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(fx,fy+3*SC,fw,0.8);ctx.fillRect(fx,fy+fh-3*SC,fw,0.8);
    // Posts
    for(let i=0;i<=np;i++){
      const px=fx+i*(fw/np);
      ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(px+1,fy+fh+1,3*SC,2*SC);
      const pg=ctx.createLinearGradient(px,0,px+3*SC,0);pg.addColorStop(0,'#705828');pg.addColorStop(0.5,'#a08040');pg.addColorStop(1,'#806830');
      ctx.fillStyle=pg;ctx.fillRect(px,fy-1*SC,3*SC,fh+2*SC);
      ctx.fillStyle='#b09050';ctx.fillRect(px-0.5*SC,fy-2*SC,4*SC,2.5*SC);
    }
  }

  // ── Pond (natural with rocks) ──────────────────
  function drawPond() {
    const cx=W*POND.cxR,cy=H*POND.cyR,rx=34*SC,ry=14*SC;
    // Rocks around edge
    const pondRocks=[{a:0.3,d:1.05,sz:5},{a:0.8,d:1.1,sz:4},{a:1.5,d:1.02,sz:6},{a:2.2,d:1.08,sz:3.5},{a:2.8,d:1.05,sz:5},{a:3.8,d:1.1,sz:4},{a:4.5,d:1.03,sz:5.5},{a:5.5,d:1.08,sz:3}];
    pondRocks.forEach(r=>{
      const px=cx+Math.cos(r.a)*rx*r.d,py=cy+Math.sin(r.a)*ry*r.d,sz=r.sz*SC;
      const rg=ctx.createRadialGradient(px-sz*0.2,py-sz*0.2,0,px,py,sz);
      rg.addColorStop(0,'#90887a');rg.addColorStop(1,'#605848');
      ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(px,py,sz,sz*0.65,r.a*0.3,0,Math.PI*2);ctx.fill();
    });
    // Mud edge
    ctx.fillStyle='#4a4028';ctx.beginPath();ctx.ellipse(cx,cy+1,rx+3*SC,ry+3*SC,0,0,Math.PI*2);ctx.fill();
    // Water body
    const wg=ctx.createRadialGradient(cx-rx*0.15,cy-ry*0.3,rx*0.1,cx,cy,rx);
    wg.addColorStop(0,'#88ccee');wg.addColorStop(0.3,'#4098c8');wg.addColorStop(0.7,'#2870a0');wg.addColorStop(1,'#1a5080');
    ctx.fillStyle=wg;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);ctx.fill();
    // Ripples
    for(let i=0;i<5;i++){
      const sx=cx-rx*0.35+i*rx*0.18+Math.sin(gt*1.0+i*1.3)*3*SC;
      const sa=0.08+Math.sin(gt*1.5+i*1.8)*0.06;
      ctx.strokeStyle=`rgba(180,230,255,${sa})`;ctx.lineWidth=0.8;
      ctx.beginPath();ctx.ellipse(sx,cy-1+i*1.5*SC,5*SC,1.2*SC,0,0,Math.PI*2);ctx.stroke();
    }
    // Sky reflection highlight
    ctx.fillStyle='rgba(200,235,255,0.12)';ctx.beginPath();ctx.ellipse(cx-rx*0.2,cy-ry*0.25,rx*0.3,ry*0.25,0,0,Math.PI*2);ctx.fill();
    // Reeds
    ctx.strokeStyle='#388828';ctx.lineWidth=1.2;
    for(let i=0;i<4;i++){const rx2=cx-rx*0.7+i*5*SC,sway=Math.sin(gt*0.7+i*1.8)*2;ctx.beginPath();ctx.moveTo(rx2,cy+ry*0.6);ctx.quadraticCurveTo(rx2+sway,cy-3*SC,rx2+sway*1.2,cy-8*SC);ctx.stroke();
      ctx.fillStyle='#3a6020';ctx.beginPath();ctx.ellipse(rx2+sway*1.2,cy-9*SC,1.5*SC,3*SC,sway*0.1,0,Math.PI*2);ctx.fill();}
    // Lily pad
    ctx.fillStyle='#2a7828';ctx.beginPath();ctx.ellipse(cx+rx*0.25,cy+ry*0.1,4*SC,2.5*SC,0.2,0.2,Math.PI*1.9);ctx.fill();
    ctx.fillStyle='#ff7888';ctx.beginPath();ctx.arc(cx+rx*0.25,cy+ry*-0.05,1.5*SC,0,Math.PI*2);ctx.fill();
  }

  // ── Rocks ──────────────────────────────────────
  function drawRocks() {
    rocks.forEach(r=>{
      const sz=r.sz;
      ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.rot);
      const rg=ctx.createRadialGradient(-sz*0.2,-sz*0.25,0,0,0,sz);
      rg.addColorStop(0,'#a09888');rg.addColorStop(0.5,r.c);rg.addColorStop(1,'#504838');
      ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(0,0,sz,sz*0.6,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.ellipse(-sz*0.2,-sz*0.15,sz*0.3,sz*0.18,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
  }

  // ── Structures ─────────────────────────────────
  function drawStructures(){drawCoop(W*0.06,H*0.44);drawBarn(W*0.85,H*0.38);drawSilo(W*0.80,H*0.34);drawTrough(W*TROUGH.xR,H*TROUGH.yR);}

  function drawCoop(x,y) {
    const s=SC,w=48*s,h=35*s;
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(x+w/2+2,y+h,w*0.55,4*s,0,0,Math.PI*2);ctx.fill();
    // Dirt patch
    ctx.fillStyle='rgba(140,110,70,0.2)';ctx.beginPath();ctx.ellipse(x+w/2,y+h+2,w*0.7,6*s,0,0,Math.PI*2);ctx.fill();
    const wg=ctx.createLinearGradient(x,0,x+w,0);wg.addColorStop(0,'#8a6828');wg.addColorStop(0.3,'#c8a858');wg.addColorStop(0.8,'#b89848');
    ctx.fillStyle=wg;ctx.fillRect(x,y+9*s,w,h-9*s);
    ctx.strokeStyle='rgba(0,0,0,0.05)';ctx.lineWidth=0.5;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x,y+14*s+i*5*s);ctx.lineTo(x+w,y+14*s+i*5*s);ctx.stroke();}
    const rg=ctx.createLinearGradient(x+w/2,y-4*s,x+w/2,y+9*s);rg.addColorStop(0,'#684818');rg.addColorStop(1,'#8a6828');
    ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(x-4*s,y+9*s);ctx.lineTo(x+w/2,y-4*s);ctx.lineTo(x+w+4*s,y+9*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.04)';ctx.beginPath();ctx.moveTo(x-4*s,y+9*s);ctx.lineTo(x+w/2,y-4*s);ctx.lineTo(x+w/2,y+9*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2a1810';rr2(x+w/2-5*s,y+h-15*s,10*s,15*s,1.5);ctx.fill();
    ctx.fillStyle='#b89040';ctx.beginPath();ctx.arc(x+w/2+3*s,y+h-8*s,1*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#6a4820';ctx.fillRect(x+w,y+17*s,7*s,8*s);ctx.fillStyle='#8a6828';ctx.fillRect(x+w-1,y+15*s,9*s,2.5*s);
    ctx.fillStyle='#c8a040';ctx.fillRect(x+w+1,y+20*s,4*s,3*s);
  }

  function drawBarn(x,y) {
    const s=SC,w=58*s,h=42*s;
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(x+w/2+3,y+h,w*0.55,5*s,0,0,Math.PI*2);ctx.fill();
    const wg=ctx.createLinearGradient(x,0,x+w,0);wg.addColorStop(0,'#782020');wg.addColorStop(0.3,'#b83838');wg.addColorStop(0.8,'#a03030');
    ctx.fillStyle=wg;ctx.fillRect(x,y+13*s,w,h-13*s);
    ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=0.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(x,y+18*s+i*5*s);ctx.lineTo(x+w,y+18*s+i*5*s);ctx.stroke();}
    const rg=ctx.createLinearGradient(x+w/2,y-1,x+w/2,y+13*s);rg.addColorStop(0,'#581818');rg.addColorStop(1,'#782020');
    ctx.fillStyle=rg;ctx.beginPath();ctx.moveTo(x-3*s,y+13*s);ctx.lineTo(x+w/2,y-1);ctx.lineTo(x+w+3*s,y+13*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.04)';ctx.beginPath();ctx.moveTo(x-3*s,y+13*s);ctx.lineTo(x+w/2,y-1);ctx.lineTo(x+w/2,y+13*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='#401010';ctx.fillRect(x+w/2-8*s,y+h-18*s,7*s,18*s);ctx.fillRect(x+w/2+1*s,y+h-18*s,7*s,18*s);
    ctx.strokeStyle='#2a0808';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+w/2-7*s,y+h-17*s);ctx.lineTo(x+w/2-1*s,y+h-1);ctx.moveTo(x+w/2-1*s,y+h-17*s);ctx.lineTo(x+w/2-7*s,y+h-1);ctx.stroke();
    ctx.fillStyle='#2a0808';rr2(x+w/2-3.5*s,y+16*s,7*s,5*s,1);ctx.fill();
    ctx.fillStyle='#c8a040';ctx.fillRect(x+w/2-2.5*s,y+18.5*s,5*s,2.5*s);
  }

  function drawSilo(x,y) {
    const s=SC,w=15*s,h=36*s;
    ctx.fillStyle='rgba(0,0,0,0.08)';ctx.beginPath();ctx.ellipse(x+w/2+1,y+h,w/2+1,2.5*s,0,0,Math.PI*2);ctx.fill();
    const sg=ctx.createLinearGradient(x,0,x+w,0);sg.addColorStop(0,'#606870');sg.addColorStop(0.35,'#8898a8');sg.addColorStop(0.7,'#a8b8c8');sg.addColorStop(1,'#8090a0');
    ctx.fillStyle=sg;ctx.fillRect(x,y+4*s,w,h-4*s);
    ctx.fillStyle='#58606a';for(let b=0;b<4;b++)ctx.fillRect(x-0.5,y+7*s+b*8*s,w+1,1.2*s);
    ctx.fillStyle='#606870';ctx.beginPath();ctx.ellipse(x+w/2,y+4*s,w/2,4*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#505860';ctx.beginPath();ctx.moveTo(x,y+4*s);ctx.lineTo(x+w/2,y-6*s);ctx.lineTo(x+w,y+4*s);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(x+1.5*s,y+4*s,3*s,h-4*s);
  }

  function drawTrough(x,y) {
    const s=SC,tw=30*s;
    // Dirt patch under trough
    ctx.fillStyle='rgba(140,110,70,0.15)';ctx.beginPath();ctx.ellipse(x,y+8*s,tw*0.8,5*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#504020';ctx.fillRect(x-tw*0.5,y+5*s,2*s,6*s);ctx.fillRect(x+tw*0.4,y+5*s,2*s,6*s);
    const tg=ctx.createLinearGradient(0,y-3*s,0,y+5*s);tg.addColorStop(0,'#b09050');tg.addColorStop(0.5,'#8a6838');tg.addColorStop(1,'#604828');
    ctx.fillStyle=tg;ctx.fillRect(x-tw*0.55,y-3*s,tw*1.1,8*s);
    ctx.fillStyle='#604828';ctx.fillRect(x-tw*0.6,y-5*s,3*s,10*s);ctx.fillRect(x+tw*0.5,y-5*s,3*s,10*s);
    ctx.fillStyle='#705838';ctx.fillRect(x-tw*0.45,y-2*s,tw*0.9,5*s);
    if(farmData&&farmData.feed_balance>0){
      const fl=Math.min(1,farmData.feed_balance/50);
      const fg=ctx.createLinearGradient(0,y-1*s,0,y+3*s);fg.addColorStop(0,'#e0b848');fg.addColorStop(1,'#c89838');
      ctx.fillStyle=fg;ctx.fillRect(x-tw*0.40,y-0.5*s,tw*0.8*fl,3.5*s);
      // Grain texture
      for(let i=0;i<Math.floor(fl*10);i++){ctx.fillStyle='rgba(180,140,60,0.3)';ctx.beginPath();ctx.arc(x-tw*0.35+i*tw*0.08,y+0.5*s,0.8*s,0,Math.PI*2);ctx.fill();}
    }
  }

  // ── Entity Drawing ─────────────────────────────
  function drawEntities() {
    const all=entities.slice();
    if(rooster)all.push(rooster);
    if(farmer.active)all.push({type:'farmer',x:farmer.x,y:farmer.y});
    sortedEntities=all.sort((a,b)=>a.y-b.y);sortDirty=false;
    for(let i=0;i<sortedEntities.length;i++){
      const e=sortedEntities[i],sel=selectedEntity===e;
      if(e.type==='chicken')drawChicken(e,sel);
      else if(e.type==='chick')drawChick(e,sel);
      else if(e.type==='rooster')drawRooster(e);
      else if(e.type==='farmer')drawFarmerSprite();
      else drawEgg(e);
    }
  }

  function drawChicken(e,sel) {
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0,s=SC*0.85;
    let yO=0,lA=0,hD=0,wF=0,bS=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*2*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-1;break;case S.PECK:hD=(e.peckB||0)*s;break;case S.EAT:hD=(e.eatB||0)*s;break;case S.DRINK:hD=(e.drinkB||0)*s;break;case S.FLAP:wF=e.flapA||0;yO=-Math.abs(wF)*2.5*s;break;case S.SLEEP:bS=1.5*s;yO=1;break;case S.SCRATCH:lA=(e.scratchB||0)*s;break;default:yO=Math.sin(a*2+(e.bo||0))*0.5;}
    const y=(e.y+yO)|0;
    ctx.save();
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(x,(e.y|0)+8*s,8*s,3*s,0,0,Math.PI*2);ctx.fill();
    // Legs
    ctx.strokeStyle=c.legs;ctx.lineWidth=1.3*s;
    ctx.beginPath();ctx.moveTo(x-2.5*d*s,y+5*s+bS);ctx.lineTo(x-2.5*d*s-lA,y+8*s+bS);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+1.5*d*s,y+5*s+bS);ctx.lineTo(x+1.5*d*s+lA,y+8*s+bS);ctx.stroke();
    ctx.lineWidth=0.8*s;
    [-1,0,1].forEach(t=>{const fx=x-2.5*d*s-lA;ctx.beginPath();ctx.moveTo(fx,y+8*s+bS);ctx.lineTo(fx+t*1.8*s,y+9.5*s+bS);ctx.stroke();});
    [-1,0,1].forEach(t=>{const fx=x+1.5*d*s+lA;ctx.beginPath();ctx.moveTo(fx,y+8*s+bS);ctx.lineTo(fx+t*1.8*s,y+9.5*s+bS);ctx.stroke();});
    // Body
    const bg=ctx.createRadialGradient(x-1.5*d*s,y-1*s+bS,0,x,y+1.5*s+bS,8*s);
    bg.addColorStop(0,c.body);bg.addColorStop(0.8,c.outline);bg.addColorStop(1,lerpCol(c.outline,'#000',0.15));
    ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(x,y+bS,8.5*s,6.5*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.ellipse(x-d*s,y-1.5*s+bS,4*s,3*s,0,0,Math.PI*2);ctx.fill();
    // Wing
    if(e.state===S.FLAP){ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-2*d*s,y+bS);ctx.rotate(wF*d);ctx.beginPath();ctx.ellipse(0,-3*s,5*s,7*s,d*0.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-2*d*s,y+0.5*s+bS,5*s,4*s,d*0.15,0,Math.PI*2);ctx.fill();}
    // Tail
    ctx.fillStyle=c.wing;ctx.beginPath();ctx.moveTo(x-7*d*s,y-1*s+bS);ctx.quadraticCurveTo(x-12*d*s,y-6*s+bS,x-10*d*s,y-4*s+bS);ctx.quadraticCurveTo(x-13*d*s,y-3*s+bS,x-9*d*s,y+1*s+bS);ctx.closePath();ctx.fill();
    // Head
    const hx=x+7*d*s,hy=y-5*s+hD+bS;
    if(e.state===S.SLEEP){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+3*d*s,y-2*s+bS,3.5*s,0,Math.PI*2);ctx.fill();
      const za=0.3+Math.sin(a*2)*0.2;ctx.fillStyle=`rgba(180,200,255,${za})`;
      ctx.font=`bold ${6*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('z',x+8*s,y-10*s+Math.sin(a)*1.5);ctx.font=`bold ${8*s|0}px sans-serif`;ctx.fillText('Z',x+13*s,y-15*s+Math.sin(a+1)*1.5);
    } else {
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,3.8*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.arc(hx-d*0.5*s,hy-0.8*s,1.8*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+2*d*s,hy-0.5*s,1*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+2.3*d*s,hy-0.8*s,0.4*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+3.8*d*s,hy-0.5*s);ctx.lineTo(hx+6.5*d*s,hy+0.5*s);ctx.lineTo(hx+3.8*d*s,hy+1.2*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-0.5*d*s,hy-3.5*s);ctx.lineTo(hx+0.5*d*s,hy-6*s);ctx.lineTo(hx+2*d*s,hy-4*s);ctx.lineTo(hx+3*d*s,hy-6.5*s);ctx.lineTo(hx+4*d*s,hy-3.5*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.ellipse(hx+2.5*d*s,hy+2.5*s,1.2*s,2*s,0,0,Math.PI*2);ctx.fill();
      if(e.state===S.EAT&&hD>1.2*s){ctx.fillStyle='#d8a838';ctx.beginPath();ctx.arc(hx+5.5*d*s,hy+1*s,0.8*s,0,Math.PI*2);ctx.fill();}
    }
    if(e.starving){const p=0.5+Math.sin(a*4)*0.3;ctx.fillStyle=`rgba(220,40,40,${p})`;ctx.beginPath();ctx.arc(x,y-14*s,5*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font=`bold ${7*s|0}px sans-serif`;ctx.textAlign='center';ctx.fillText('!',x,y-11.5*s);}
    if(sel){ctx.strokeStyle='rgba(105,240,174,0.6)';ctx.lineWidth=1.2;ctx.setLineDash([3,2]);ctx.beginPath();ctx.ellipse(x,y,13*s,10*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`${e.data.species} #${e.data.id}`;ctx.font=`bold ${6*s|0}px monospace`;const tw=ctx.measureText(lb).width+6;ctx.fillStyle='rgba(0,0,0,0.65)';rr2(x-tw/2,y-24*s,tw,11*s,3);ctx.fill();ctx.fillStyle='#69f0ae';ctx.textAlign='center';ctx.fillText(lb,x,y-16*s);}
    ctx.restore();
  }

  function drawChick(e,sel) {
    const a=e.at||0,d=e.dir,s=SC*0.85;let yO=0,lA=0;
    switch(e.state){case S.WALK:lA=Math.sin(e.wp||0)*1.2*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-0.8;break;case S.PECK:yO=(e.peckB||0)*0.3*s;break;case S.SCRATCH:lA=(e.scratchB||0)*0.4*s;break;default:yO=Math.sin(a*3+(e.bo||0))*0.4;}
    const x=e.x|0,y=(e.y+yO)|0;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.1)';ctx.beginPath();ctx.ellipse(x,(e.y|0)+4*s,4*s,1.5*s,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c08020';ctx.lineWidth=0.6*s;
    ctx.beginPath();ctx.moveTo(x-1*s,y+2.5*s);ctx.lineTo(x-1.5*s-lA*0.3,y+4*s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+1*s,y+2.5*s);ctx.lineTo(x+1.5*s+lA*0.3,y+4*s);ctx.stroke();
    const cg=ctx.createRadialGradient(x-0.5*s,y-0.5*s,0,x,y,3.5*s);
    cg.addColorStop(0,'#fffc90');cg.addColorStop(0.5,'#ffe838');cg.addColorStop(1,'#c8a020');
    ctx.fillStyle=cg;ctx.beginPath();ctx.arc(x,y,3.5*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,220,0.2)';ctx.beginPath();ctx.arc(x-0.5*s,y-s,1.5*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(x+1.8*d*s,y-0.5*s,0.6*s,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d88018';ctx.beginPath();ctx.moveTo(x+2.8*d*s,y);ctx.lineTo(x+4.5*d*s,y+0.3*s);ctx.lineTo(x+2.8*d*s,y+0.8*s);ctx.closePath();ctx.fill();
    const fa=Math.sin(a*(e.state===S.WALK?8:4))*0.15;
    ctx.fillStyle='#ddb828';ctx.beginPath();ctx.ellipse(x-1.5*d*s,y+0.3*s,2.2*s,1.8*s,fa*d,0,Math.PI*2);ctx.fill();
    if(sel){ctx.strokeStyle='rgba(255,244,79,0.6)';ctx.lineWidth=0.8;ctx.setLineDash([2,1.5]);ctx.beginPath();ctx.ellipse(x,y,6*s,5*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      const lb=`Chick > ${e.data.target_species}`;ctx.font=`bold ${5*s|0}px monospace`;const tw=ctx.measureText(lb).width+6;ctx.fillStyle='rgba(0,0,0,0.65)';rr2(x-tw/2,y-14*s,tw,9*s,2);ctx.fill();ctx.fillStyle='#fff44f';ctx.textAlign='center';ctx.fillText(lb,x,y-7.5*s);}
    ctx.restore();
  }

  function drawEgg(e) {
    const x=e.x|0,y=e.y|0,s=SC*0.85;
    ctx.save();ctx.translate(x,y);ctx.rotate(e.tilt||0);
    ctx.fillStyle='rgba(0,0,0,0.08)';ctx.beginPath();ctx.ellipse(0,4*s,3.5*s,1.2*s,0,0,Math.PI*2);ctx.fill();
    const eg=ctx.createRadialGradient(-0.5*s,-s,0,0,0,5*s);
    eg.addColorStop(0,'#fff8ee');eg.addColorStop(0.6,'#f0e8d8');eg.addColorStop(1,'#c8b898');
    ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(0,0,3.5*s,4.8*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.beginPath();ctx.ellipse(-0.8*s,-1.2*s,1.2*s,1.6*s,-0.3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // ── Rooster Drawing ────────────────────────────
  function drawRooster(e) {
    const x=e.x|0,d=e.dir,c=e.colors,a=e.at||0,s=SC*0.9;
    let yO=0,lA=0,bS=0;
    if(e.state===S.WALK){lA=Math.sin(e.wp||0)*2.5*s;yO=Math.abs(Math.sin((e.wp||0)*2))*-1.2;}
    else if(e.state===S.CROW){yO=-1;}
    else if(e.state===S.FLAP){yO=-Math.abs(Math.sin(a*12)*0.6)*3*s;}
    else if(e.state===S.COURT){yO=Math.sin(a*6)*1.2;}
    else if(e.state===S.SLEEP){bS=1.5*s;yO=1;}
    else{yO=Math.sin(a*2)*0.6;}
    const y=(e.y+yO)|0;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(x,(e.y|0)+10*s,10*s,3.5*s,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=c.legs;ctx.lineWidth=1.8*s;
    ctx.beginPath();ctx.moveTo(x-2.5*d*s,y+7*s+bS);ctx.lineTo(x-2.5*d*s-lA,y+10*s+bS);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+1.5*d*s,y+7*s+bS);ctx.lineTo(x+1.5*d*s+lA,y+10*s+bS);ctx.stroke();
    ctx.lineWidth=1*s;[-1,0,1].forEach(t=>{const fx=x-2.5*d*s-lA;ctx.beginPath();ctx.moveTo(fx,y+10*s+bS);ctx.lineTo(fx+t*2*s,y+11.5*s+bS);ctx.stroke();});
    ctx.strokeStyle='#aa7818';ctx.lineWidth=1*s;ctx.beginPath();ctx.moveTo(x-2.5*d*s-lA,y+9.5*s+bS);ctx.lineTo(x-2.5*d*s-lA-2*d*s,y+8*s+bS);ctx.stroke();
    const bg=ctx.createRadialGradient(x-1.5*d*s,y-s+bS,0,x,y+1.5*s+bS,10*s);
    bg.addColorStop(0,c.body);bg.addColorStop(0.7,c.outline);bg.addColorStop(1,lerpCol(c.outline,'#000',0.2));
    ctx.fillStyle=bg;ctx.beginPath();ctx.ellipse(x,y+bS,10*s,7.5*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.05)';ctx.beginPath();ctx.ellipse(x-d*s,y-2*s+bS,5*s,3.5*s,0,0,Math.PI*2);ctx.fill();
    if(e.state===S.FLAP||e.state===S.COURT){const wf=Math.sin(a*12)*0.6;ctx.fillStyle=c.wing;ctx.save();ctx.translate(x-2.5*d*s,y+bS);ctx.rotate(wf*d);ctx.beginPath();ctx.ellipse(0,-3*s,6.5*s,9*s,d*0.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    else{ctx.fillStyle=c.wing;ctx.beginPath();ctx.ellipse(x-2.5*d*s,y+0.8*s+bS,6*s,4.5*s,d*0.15,0,Math.PI*2);ctx.fill();}
    // Grand tail
    ctx.fillStyle=c.tail1;ctx.beginPath();ctx.moveTo(x-8*d*s,y-2*s+bS);ctx.quadraticCurveTo(x-18*d*s,y-15*s+bS,x-15*d*s,y-12*s+bS);ctx.lineTo(x-8*d*s,y+s+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail2;ctx.beginPath();ctx.moveTo(x-8*d*s,y-s+bS);ctx.quadraticCurveTo(x-20*d*s,y-10*s+bS,x-15*d*s,y-6*s+bS);ctx.lineTo(x-8*d*s,y+2*s+bS);ctx.closePath();ctx.fill();
    ctx.fillStyle=c.tail3;ctx.beginPath();ctx.moveTo(x-7*d*s,y+bS);ctx.quadraticCurveTo(x-17*d*s,y-6*s+bS,x-13*d*s,y-2*s+bS);ctx.lineTo(x-7*d*s,y+3*s+bS);ctx.closePath();ctx.fill();
    const hx=x+8.5*d*s,hy=y-7*s+bS;
    if(e.state===S.SLEEP){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(x+3.5*d*s,y-3*s+bS,4.5*s,0,Math.PI*2);ctx.fill();
      const za=0.3+Math.sin(a*2)*0.2;ctx.fillStyle=`rgba(180,200,255,${za})`;ctx.font=`bold ${7*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('z',x+10*s,y-13*s+Math.sin(a)*1.5);ctx.font=`bold ${9*s|0}px sans-serif`;ctx.fillText('Z',x+16*s,y-18*s+Math.sin(a+1)*1.5);
    } else if(e.state===S.CROW){
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy-s,4.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+4*d*s,hy-2.5*s);ctx.lineTo(hx+10*d*s,hy-3.5*s);ctx.lineTo(hx+4*d*s,hy-s);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(hx+4*d*s,hy);ctx.lineTo(hx+8*d*s,hy+s);ctx.lineTo(hx+4*d*s,hy+s);ctx.closePath();ctx.fill();
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+2.5*d*s,hy-1.5*s,1.2*s,0,Math.PI*2);ctx.fill();
      const ca=0.35+Math.sin(a*4)*0.25;ctx.fillStyle=`rgba(255,210,60,${ca})`;ctx.font=`bold ${7*s|0}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('COCORIC\u00D3\u00D3!',hx,hy-15*s+Math.sin(a*3)*1.5);
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-d*s,hy-5*s);ctx.lineTo(hx+d*s,hy-9*s);ctx.lineTo(hx+2.5*d*s,hy-6*s);ctx.lineTo(hx+3.5*d*s,hy-10*s);ctx.lineTo(hx+5*d*s,hy-5*s);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.ellipse(hx+3.5*d*s,hy+2.5*s,2*s,3*s,0,0,Math.PI*2);ctx.fill();
    } else {
      ctx.fillStyle=c.body;ctx.beginPath();ctx.arc(hx,hy,4.5*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.06)';ctx.beginPath();ctx.arc(hx-d*0.5*s,hy-s,2*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#1a1a1a';ctx.beginPath();ctx.arc(hx+2.5*d*s,hy-0.8*s,1.2*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx+2.8*d*s,hy-1.2*s,0.4*s,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=c.beak;ctx.beginPath();ctx.moveTo(hx+4.5*d*s,hy-0.5*s);ctx.lineTo(hx+8.5*d*s,hy+0.5*s);ctx.lineTo(hx+4.5*d*s,hy+1.2*s);ctx.closePath();ctx.fill();
      ctx.fillStyle=c.comb;ctx.beginPath();ctx.moveTo(hx-d*s,hy-4*s);ctx.lineTo(hx+d*s,hy-8.5*s);ctx.lineTo(hx+2.5*d*s,hy-5.5*s);ctx.lineTo(hx+3.5*d*s,hy-9*s);ctx.lineTo(hx+5*d*s,hy-4*s);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.ellipse(hx+3.5*d*s,hy+3*s,1.5*s,3*s,0,0,Math.PI*2);ctx.fill();
    }
    if(e.state===S.COURT){const ca=e.courtA||0;if(Math.sin(ca)>0.3){ctx.fillStyle='rgba(255,60,60,0.45)';ctx.font=`${7*s|0}px sans-serif`;ctx.textAlign='center';ctx.fillText('\u2665',x+Math.sin(ca*2)*7*s,y-17*s+Math.cos(ca)*3);}}
    ctx.restore();
  }

  // ── Farmer Drawing ─────────────────────────────
  function drawFarmerSprite() {
    const x=farmer.x|0,y=farmer.y|0,a=farmer.phase,s=SC*1.15;
    const wc=farmer.state!=='feed'?Math.sin((farmer.wp||0)*2)*2.5*s:0;
    ctx.save();
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.15)';ctx.beginPath();ctx.ellipse(x,y+18*s,10*s,4*s,0,0,Math.PI*2);ctx.fill();
    // Boots with soles
    ctx.fillStyle='#1a0e05';ctx.fillRect(x-6*s,y+14*s+wc,5.5*s,2*s);ctx.fillRect(x+0.5*s,y+14*s-wc,5.5*s,2*s);
    ctx.fillStyle='#3a2010';ctx.fillRect(x-5.5*s,y+10*s+wc,5*s,5*s);ctx.fillRect(x+0.5*s,y+10*s-wc,5*s,5*s);
    // Boot highlights
    ctx.fillStyle='rgba(255,255,255,0.06)';ctx.fillRect(x-5*s,y+10.5*s+wc,2*s,3*s);ctx.fillRect(x+1*s,y+10.5*s-wc,2*s,3*s);
    // Jeans with belt
    const jg=ctx.createLinearGradient(x-5.5*s,0,x+5.5*s,0);jg.addColorStop(0,'#1e3868');jg.addColorStop(0.4,'#2a5090');jg.addColorStop(1,'#1e3868');
    ctx.fillStyle=jg;ctx.fillRect(x-5.5*s,y+1*s+wc,5*s,11*s);ctx.fillRect(x+0.5*s,y+1*s-wc,5*s,11*s);
    // Belt
    ctx.fillStyle='#3a2818';ctx.fillRect(x-6*s,y+0.5*s,12*s,2*s);
    ctx.fillStyle='#c8a838';ctx.beginPath();ctx.arc(x,y+1.5*s,1.2*s,0,Math.PI*2);ctx.fill();
    // Plaid shirt
    const sg2=ctx.createLinearGradient(x-6.5*s,0,x+6.5*s,0);sg2.addColorStop(0,'#882020');sg2.addColorStop(0.3,'#cc3838');sg2.addColorStop(0.5,'#aa2828');sg2.addColorStop(0.7,'#cc3838');sg2.addColorStop(1,'#882020');
    ctx.fillStyle=sg2;ctx.fillRect(x-6.5*s,y-12*s,13*s,14*s);
    // Plaid lines
    ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=0.6*s;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-6.5*s,y-10*s+i*4*s);ctx.lineTo(x+6.5*s,y-10*s+i*4*s);ctx.stroke();}
    ctx.strokeStyle='rgba(0,0,0,0.08)';
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x-4.5*s+i*4*s,y-12*s);ctx.lineTo(x-4.5*s+i*4*s,y+2*s);ctx.stroke();}
    // Collar
    ctx.fillStyle='#fff8e8';ctx.beginPath();ctx.moveTo(x-2*s,y-12*s);ctx.lineTo(x,y-10*s);ctx.lineTo(x+2*s,y-12*s);ctx.lineTo(x+3*s,y-12.5*s);ctx.lineTo(x,y-9*s);ctx.lineTo(x-3*s,y-12.5*s);ctx.closePath();ctx.fill();
    // Arms with hands
    ctx.strokeStyle='#c89060';ctx.lineWidth=2.5*s;ctx.lineCap='round';
    if(farmer.state==='feed'){
      // Right arm throwing feed
      const throwX=x+12*s+Math.sin(a*3.5)*5*s;
      const throwY=y-5*s+Math.cos(a*4)*3*s;
      ctx.beginPath();ctx.moveTo(x+6.5*s,y-7*s);ctx.quadraticCurveTo(x+10*s,y-9*s,throwX,throwY);ctx.stroke();
      // Hand
      ctx.fillStyle='#c89060';ctx.beginPath();ctx.arc(throwX,throwY,1.8*s,0,Math.PI*2);ctx.fill();
      // Feed grains flying from hand
      if(canSpawn()&&Math.random()<0.15){particles.push({x:throwX,y:throwY,vx:rr(-20,20),vy:rr(-28,-10),life:0.8,color:'#d8a838',sz:2*s,g:40});}
      // Left arm holding bucket
      ctx.strokeStyle='#c89060';ctx.lineWidth=2.5*s;
      ctx.beginPath();ctx.moveTo(x-6.5*s,y-7*s);ctx.quadraticCurveTo(x-9*s,y-3*s,x-10*s,y-1*s);ctx.stroke();
      ctx.fillStyle='#c89060';ctx.beginPath();ctx.arc(x-10*s,y-1*s,1.5*s,0,Math.PI*2);ctx.fill();
      // Bucket with handle
      const bx=x-13*s,by=y-4*s;
      ctx.strokeStyle='#555';ctx.lineWidth=0.8*s;ctx.beginPath();ctx.arc(bx+3.5*s,by-2*s,3*s,Math.PI,0);ctx.stroke();
      const bg3=ctx.createLinearGradient(bx,0,bx+7*s,0);bg3.addColorStop(0,'#606060');bg3.addColorStop(0.5,'#909090');bg3.addColorStop(1,'#686868');
      ctx.fillStyle=bg3;ctx.fillRect(bx,by,7*s,8*s);
      ctx.fillStyle='#505050';ctx.fillRect(bx,by,7*s,1.5*s);
      // Metal bands
      ctx.fillStyle='#484848';ctx.fillRect(bx,by+3*s,7*s,0.8*s);ctx.fillRect(bx,by+6*s,7*s,0.8*s);
      // Feed inside bucket
      ctx.fillStyle='#d8a838';ctx.fillRect(bx+0.8*s,by+1.8*s,5.4*s,4*s);
    } else {
      // Arms swinging while walking
      ctx.beginPath();ctx.moveTo(x+6.5*s,y-7*s);ctx.lineTo(x+8*s,y+1*s+wc*0.4);ctx.stroke();
      ctx.fillStyle='#c89060';ctx.beginPath();ctx.arc(x+8*s,y+1*s+wc*0.4,1.5*s,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(x-6.5*s,y-7*s);ctx.lineTo(x-8*s,y+1*s-wc*0.4);ctx.stroke();
      ctx.fillStyle='#c89060';ctx.beginPath();ctx.arc(x-8*s,y+1*s-wc*0.4,1.5*s,0,Math.PI*2);ctx.fill();
    }
    ctx.lineCap='butt';
    // Neck
    ctx.fillStyle='#c89060';ctx.fillRect(x-1.5*s,y-14*s,3*s,3*s);
    // Head with face
    const hg2=ctx.createRadialGradient(x-s,y-18*s,0,x,y-17*s,5.5*s);
    hg2.addColorStop(0,'#e0b080');hg2.addColorStop(0.7,'#c89060');hg2.addColorStop(1,'#b07848');
    ctx.fillStyle=hg2;ctx.beginPath();ctx.arc(x,y-17*s,5.5*s,0,Math.PI*2);ctx.fill();
    // Ears
    ctx.fillStyle='#d0a068';ctx.beginPath();ctx.arc(x-5.2*s,y-17*s,1.5*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x+5.2*s,y-17*s,1.5*s,0,Math.PI*2);ctx.fill();
    // Eyes
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x-2*s,y-18*s,1.5*s,1.2*s,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(x+2*s,y-18*s,1.5*s,1.2*s,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2a1808';ctx.beginPath();ctx.arc(x-1.8*s,y-17.8*s,0.8*s,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(x+2.2*s,y-17.8*s,0.8*s,0,Math.PI*2);ctx.fill();
    // Eyebrows
    ctx.strokeStyle='#5a3818';ctx.lineWidth=0.8*s;
    ctx.beginPath();ctx.moveTo(x-3*s,y-19.5*s);ctx.lineTo(x-1*s,y-19.8*s);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+1*s,y-19.8*s);ctx.lineTo(x+3*s,y-19.5*s);ctx.stroke();
    // Nose
    ctx.fillStyle='#c08050';ctx.beginPath();ctx.ellipse(x,y-16.5*s,1*s,0.8*s,0,0,Math.PI*2);ctx.fill();
    // Mouth - slight smile
    ctx.strokeStyle='#905838';ctx.lineWidth=0.6*s;
    ctx.beginPath();ctx.arc(x,y-15*s,1.5*s,0.2,Math.PI-0.2);ctx.stroke();
    // Straw hat with brim
    const hatg2=ctx.createLinearGradient(0,y-27*s,0,y-21*s);hatg2.addColorStop(0,'#d8a840');hatg2.addColorStop(0.5,'#c89830');hatg2.addColorStop(1,'#b08828');
    ctx.fillStyle=hatg2;
    // Hat brim
    ctx.beginPath();ctx.ellipse(x,y-22.5*s,9*s,2.5*s,0,0,Math.PI*2);ctx.fill();
    // Hat crown
    ctx.fillStyle=hatg2;ctx.fillRect(x-5*s,y-28*s,10*s,6.5*s);
    // Hat top
    ctx.beginPath();ctx.ellipse(x,y-28*s,5*s,1.5*s,0,0,Math.PI*2);ctx.fill();
    // Hat band
    ctx.fillStyle='#8a6020';ctx.fillRect(x-5*s,y-23.5*s,10*s,1.8*s);
    // Straw texture
    ctx.strokeStyle='rgba(160,120,40,0.2)';ctx.lineWidth=0.4*s;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(x-4*s,y-27*s+i*1.5*s);ctx.lineTo(x+4*s,y-27*s+i*1.5*s);ctx.stroke();}
    ctx.restore();
  }

  // ── Foreground Flowers (dense, in front of entities) ──
  function drawForegroundFlowers() {
    flowers.forEach(f=>{
      const sw=Math.sin(gt*1.2+f.ph)*1.2;
      // Stem
      ctx.strokeStyle='#2a7818';ctx.lineWidth=0.8*SC;
      ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+sw,f.y-f.sz*2.5);ctx.stroke();
      const fx=f.x+sw,fy=f.y-f.sz*2.5;
      // Petals
      ctx.fillStyle=f.c;
      for(let p=0;p<f.petals;p++){
        const a=(p/f.petals)*Math.PI*2+gt*0.2;
        ctx.beginPath();ctx.arc(fx+Math.cos(a)*f.sz*0.7,fy+Math.sin(a)*f.sz*0.7,f.sz*0.45,0,Math.PI*2);ctx.fill();
      }
      // Center
      ctx.fillStyle='#ffee44';ctx.beginPath();ctx.arc(fx,fy,f.sz*0.28,0,Math.PI*2);ctx.fill();
    });
    // Foreground grass blades (taller, in front)
    for(let i=0;i<30;i++){
      const gx=sr(i*99)*W,gy=H-sr(i*77)*H*0.08,gh=(8+sr(i*33)*10)*SC;
      const sw=Math.sin(gt*0.9+i*0.8)*2;
      ctx.strokeStyle=sr(i*44)<0.5?'#5a9830':'#4a8828';ctx.lineWidth=1.5*SC;
      ctx.beginPath();ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx+sw,gy-gh*0.6,gx+sw*0.8,gy-gh);ctx.stroke();
    }
  }

  // ── Ambient Life ───────────────────────────────
  function drawButterflies() {
    butterflies.forEach(b=>{
      const wa=Math.sin(b.wp)*0.7;
      ctx.save();ctx.translate(b.x,b.y);
      ctx.fillStyle=b.c;ctx.globalAlpha=0.75;
      ctx.beginPath();ctx.ellipse(-2*SC,0,3*SC,2*SC*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(2*SC,0,3*SC,2*SC*Math.abs(Math.cos(wa)),0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#333';ctx.globalAlpha=0.6;ctx.fillRect(-0.3*SC,-1.5*SC,0.6*SC,3*SC);
      ctx.globalAlpha=1;ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach(p=>{
      const al=clamp(p.life/0.7,0,1);
      if(p.feather){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(gt*3);ctx.fillStyle=p.color;ctx.globalAlpha=al;ctx.beginPath();ctx.ellipse(0,0,p.sz,p.sz*0.35,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.restore();}
      else{ctx.fillStyle=p.color||'#9a7850';ctx.globalAlpha=al;ctx.beginPath();ctx.arc(p.x,p.y,p.sz*0.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    });
  }

  function drawFireflies() {
    fireflies.forEach(f=>{
      const br=0.3+Math.sin(f.ph*3)*0.35;
      const gl=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,6*SC);
      gl.addColorStop(0,`rgba(200,255,100,${br})`);gl.addColorStop(1,'rgba(200,255,100,0)');
      ctx.fillStyle=gl;ctx.beginPath();ctx.arc(f.x,f.y,6*SC,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=`rgba(220,255,120,${br+0.15})`;ctx.beginPath();ctx.arc(f.x,f.y,1,0,Math.PI*2);ctx.fill();
    });
  }

  // ── HUD ────────────────────────────────────────
  function drawHUD() {
    if(!farmData)return;
    const s=SC,fs=Math.max(8,9*s)|0,pad=5*s;
    ctx.font=`bold ${fs}px monospace`;
    // Left stats
    const lw=95*s,lh=38*s;
    ctx.fillStyle='rgba(10,20,40,0.55)';rr2(pad,pad,lw,lh,4*s);ctx.fill();
    ctx.strokeStyle='rgba(105,240,174,0.12)';ctx.lineWidth=0.5;rr2(pad,pad,lw,lh,4*s);ctx.stroke();
    const lx=pad+5*s;ctx.textAlign='left';
    ctx.fillStyle='#69f0ae';ctx.fillText(`${(farmData.chickens||[]).length}`,lx,pad+11*s);
    ctx.fillStyle='#faf0e6';ctx.fillText(`${farmData.eggs_available||0}`,lx,pad+22*s);
    ctx.fillStyle='#fff44f';ctx.fillText(`${(farmData.chicks||[]).length}`,lx,pad+33*s);
    ctx.font=`${(fs-1)}px monospace`;ctx.fillStyle='rgba(255,255,255,0.35)';ctx.textAlign='right';const rx=pad+lw-3*s;
    ctx.fillText('hens',rx,pad+11*s);ctx.fillText('eggs',rx,pad+22*s);ctx.fillText('chicks',rx,pad+33*s);
    // Right economy
    ctx.font=`bold ${fs}px monospace`;
    const rw=88*s,rh=26*s;
    ctx.fillStyle='rgba(10,20,40,0.55)';rr2(W-rw-pad,pad,rw,rh,4*s);ctx.fill();
    ctx.strokeStyle='rgba(105,240,174,0.12)';ctx.lineWidth=0.5;rr2(W-rw-pad,pad,rw,rh,4*s);ctx.stroke();
    ctx.textAlign='right';const rrx=W-pad-3*s;
    ctx.fillStyle='#d4a040';ctx.fillText(`${(farmData.feed_balance||0).toFixed(1)}`,rrx,pad+10*s);
    ctx.fillStyle='#76f7be';ctx.fillText(`$${(farmData.balance_usdt||0).toFixed(2)}`,rrx,pad+21*s);
    ctx.font=`${(fs-1)}px monospace`;ctx.fillStyle='rgba(255,255,255,0.3)';ctx.textAlign='left';const rlx=W-rw-pad+3*s;
    ctx.fillText('feed',rlx,pad+10*s);ctx.fillText('usdt',rlx,pad+21*s);
    // Day/Night
    const hr=new Date().getHours(),isD=hr>=6&&hr<20;
    const tw=42*s;
    ctx.fillStyle='rgba(10,20,40,0.5)';rr2(W/2-tw/2,pad,tw,13*s,3*s);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=0.5;rr2(W/2-tw/2,pad,tw,13*s,3*s);ctx.stroke();
    ctx.textAlign='center';ctx.font=`bold ${(fs-1)}px monospace`;ctx.fillStyle=isD?'#ffd700':'#8888cc';
    ctx.fillText(isD?'\u2600 DAY':'\u263E NIGHT',W/2,pad+9*s);
    // Empty farm
    if(!entities.length&&!rooster){ctx.fillStyle='rgba(10,20,40,0.5)';const mw=170*s;rr2(W/2-mw/2,H/2-10*s,mw,20*s,5*s);ctx.fill();ctx.fillStyle='#a9b6d0';ctx.font=`${10*s|0}px monospace`;ctx.textAlign='center';ctx.fillText('Buy your first chicken!',W/2,H/2+3*s);}
  }

  // ── Interaction ────────────────────────────────
  function onClick(ev){const r=canvas.getBoundingClientRect(),mx=(ev.clientX-r.left),my=(ev.clientY-r.top);const h=findE(mx,my);selectedEntity=h;if(h&&onSelectCb)onSelectCb(h);}
  function onHover(ev){const r=canvas.getBoundingClientRect();canvas.style.cursor=findE(ev.clientX-r.left,ev.clientY-r.top)?'pointer':'default';}
  function findE(mx,my){const s=[...entities].sort((a,b)=>b.y-a.y);for(const e of s){const r=e.type==='egg'?6*SC:e.type==='chick'?8*SC:15*SC,dx=mx-e.x,dy=my-e.y;if(dx*dx+dy*dy<r*r)return e;}return null;}

  return { init, update };
})();
