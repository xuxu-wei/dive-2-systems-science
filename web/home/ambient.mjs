// Decorative raster facets share the atlas clock and never own input or course state.
const TAU = Math.PI * 2;
const colorPairs = [['#7296d3','#71babe'],['#bc84ab','#8778b5'],['#72b5bc','#465c94']];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// Interleave the four edges so reduced density keeps a balanced, quiet frame.
export function createFacets() {
  const rnd = random(70923);
  return Array.from({length: 20}, (_, i) => {
    const side = i % 4, along = .12 + (Math.floor(i / 4) + rnd() * .45) * .16;
    const inset = .045 + rnd() * .085, turn = 88 + rnd() * 44;
    const x = side === 0 ? inset : side === 1 ? 1-inset : along;
    const y = side === 2 ? inset : side === 3 ? 1-inset : along;
    return {x, y, side, plane: i % 5 === 0 ? 'front' : 'back', size: 19 + rnd() * 30,
      phase: rnd() * TAU, turn, breath: turn / 4, drift: turn / 3,
      travel: 64 + rnd() * 48, angle: rnd() * TAU, direction: i % 2 ? 1 : -1,
      color: i % 3, tile: i % 6, depth: .3 + rnd() * .5};
  });
}
const smooth = (a,b,value) => {const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
export function edgeVisibility(x,y,width,height) {
  if (!width || !height) return 0;
  const radius = Math.hypot((x/width-.5)/.5,(y/height-.5)/.5);
  return smooth(.66,.96,radius);
}
export function edgeResponse(pointer) {
  const strength=smooth(.45,.92,Math.max(Math.abs(pointer.x),Math.abs(pointer.y)));
  if(!strength)return {x:0,y:0,angle:0};
  return {x:-pointer.x*4*strength,y:-pointer.y*3*strength,angle:pointer.x*.075*strength};
}
export function facetPose(facet, width, height, time, pointer = {x: 0, y: 0}) {
  const phase=time*TAU/facet.drift+facet.phase, wave=Math.sin(time*TAU/facet.breath+facet.phase);
  const x=facet.x*width+Math.sin(phase)*facet.travel*.5+pointer.x*6*facet.depth;
  const y=facet.y*height+Math.cos(phase)*facet.travel*.35+pointer.y*6*facet.depth;
  return {x,y,opacity:(.24+(wave+1)*.10)*edgeVisibility(x,y,width,height),
    angle:facet.angle+time*TAU/facet.turn*facet.direction,
    tiltX:Math.sin(time*TAU/facet.turn*2+facet.phase)*12,
    tiltY:Math.cos(time*TAU/facet.turn*2+facet.phase)*18,
    colorMix:(1-Math.cos(time*TAU/(facet.turn/2)+facet.phase))*.5};
}
export function facetFrames(facet,width,height) {
  return Array.from({length:97},(_,i)=>{
    const p=facetPose(facet,width,height,i/96*facet.turn);
    return {offset:i/96,opacity:p.opacity,
      transform:`translate(${p.x-facet.x*width-facet.size}px,${p.y-facet.y*height-facet.size}px) perspective(360px) rotateZ(${p.angle}rad) rotateX(${p.tiltX}deg) rotateY(${p.tiltY}deg)`};
  });
}
export function createMotes() {
  const rnd = random(82173);
  return Array.from({length: 4}, (_, i) => ({x: [.30,.70,.40,.61][i], y: [.47,.48,.79,.78][i],
    plane: i % 2 ? 'front' : 'back', phase: rnd() * TAU, period: 16 + rnd() * 10,
    stars: Array.from({length: 4}, () => ({x: 12 + rnd() * 156, y: 12 + rnd() * 156, size: 1.8 + rnd() * 2, alpha: .55 + rnd() * .45}))}));
}
// Spatial fading clears the middle; these additional exclusions protect text and the event horizon.
export function protectedRegions(regions, nodes, center, radius, centerKind) {
  const overview = centerKind === 'universe';
  return [...regions, ...nodes.map(n => ({x:n.sx-(overview?29:45), y:n.sy+18, width:overview?58:90, height:overview?24:42})),
    ...(center && ['universe','introduction'].includes(centerKind) ?
      [{x:center.x-radius*.7, y:center.y-radius*.7, width:radius*1.4, height:radius*1.4}] : [])];
}
export function fieldPosition(item, width, height, bounds) {
  return {x:item.x*width, y:bounds ? (bounds.top+bounds.bottom)/2+(item.y-.56)*(bounds.bottom-bounds.top) : item.y*height};
}
export function clearance(x, y, size, regions) {
  let alpha = 1;
  for (const r of regions) {
    const dx = Math.max(r.x - x, 0, x - r.x - r.width), dy = Math.max(r.y - y, 0, y - r.y - r.height);
    alpha = Math.min(alpha, clamp((Math.hypot(dx, dy) - size * .5) / 28));
  }
  return alpha;
}

export class AmbientField {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.dark = true;
    this.facets = createFacets(); this.tiles = []; this.regions = []; this.quality = 1; this.slowFrames = 0; this.fastFrames = 0;
    this.layers = Object.fromEntries(['back','front'].map(plane => {
      const layer = document.createElement('div'); layer.className = `ambient-facets ambient-${plane}`;
      layer.setAttribute('aria-hidden', 'true'); this.canvas.after(layer); return [plane,layer];
    }));
    this.animations = []; this.groups = []; this.sprites = []; this.motes = createMotes(); this.motionPaused = false; this.reduced = false;
    this.pointer = {x: 0, y: 0}; this.target = {x: 0, y: 0}; this.lastSignature = '';
    this.backdrop = document.createElement('div'); this.backdrop.className = 'ambient-background'; this.backdrop.setAttribute('aria-hidden','true');
    for (const theme of ['dark','light']) {const layer=document.createElement('div');layer.className=`ambient-background-${theme}`;this.backdrop.append(layer);}
    this.canvas.before(this.backdrop);this.canvas.parentElement.classList.add('has-ambient-background');
    const rnd = random(63017);
    this.stars = Array.from({length: 240}, () => ({x: rnd(), y: rnd(), size: .3 + rnd() ** 5 * 1.05, phase: rnd() * TAU, depth: .2 + rnd() * .8}));
    const atlas = new Image(); atlas.onload = () => {this.atlas = atlas; this.prepareTiles();};
    atlas.onerror = () => {this.canvas.dataset.material = 'unavailable';};
    atlas.src = '/web/home/assets/theme/facets-atlas.png';
    this.resize();
  }
  prepareTiles() {
    if (!this.atlas || !this.ctx) return;
    this.alternateTiles = [];
    this.tiles = Array.from({length:6},(_,index) => {
      const size=160,tile=document.createElement('canvas'),alternate=document.createElement('canvas');
      tile.width=tile.height=alternate.width=alternate.height=size;
      const c=tile.getContext('2d'),ac=alternate.getContext('2d');
      c.drawImage(this.atlas,index%3*512,Math.floor(index/3)*512,512,512,0,0,size,size);
      const image=c.getImageData(0,0,size,size),d=image.data,other=ac.createImageData(size,size),ad=other.data;
      const pair=colorPairs[index%3].map(color=>[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16)));
      // Both images have one hue throughout their surface. The same grayscale
      // relief is preserved; there is no spatial rainbow, colored stripe or glint.
      for (let p=0;p<d.length;p+=4) {
        const shade=(.2126*d[p]+.7152*d[p+1]+.0722*d[p+2])/255;
        const alpha=clamp((d[p+3]-16)/239),light=.76+shade*.24;
        for(let channel=0;channel<3;channel++){d[p+channel]=pair[0][channel]*light;ad[p+channel]=pair[1][channel]*light;}
        d[p+3]=ad[p+3]=Math.round(alpha*255);
      }
      c.putImageData(image,0,0);ac.putImageData(other,0,0);this.alternateTiles.push(alternate);return tile;
    });
    this.mountSprites();this.lastSignature='';this.canvas.dataset.material='ready';
  }
  mountSprites() {
    this.animations.forEach(a => a.cancel()); this.animations = []; this.groups = [];
    Object.values(this.layers).forEach(layer => layer.replaceChildren());
    const urls = this.tiles.map(tile => tile.toDataURL()), alternates = this.alternateTiles.map(tile => tile.toDataURL());
    this.sprites = this.facets.map(facet => {
      const wrapper = document.createElement('span'), surface = document.createElement('span'), image = document.createElement('img');
      wrapper.className = 'ambient-facet'; wrapper.dataset.plane = facet.plane; wrapper.dataset.side = facet.side;
      surface.className = 'facet-surface'; image.src = urls[facet.tile]; image.alt = ''; image.draggable = false;
      wrapper.style.left = `${facet.x * 100}%`; wrapper.style.top = `${facet.y * 100}%`;
      wrapper.style.width = wrapper.style.height = `${facet.size * 2}px`;
      surface.append(image); wrapper.append(surface); this.layers[facet.plane].append(wrapper);
      const animations = [surface.animate(facetFrames(facet,this.width,this.height), {duration:facet.turn*1000, iterations:Infinity})];
      const tint = document.createElement('img'); tint.className = 'facet-tint'; tint.src = alternates[facet.tile]; tint.alt = ''; tint.draggable = false;
      surface.append(tint);
      const colors = Array.from({length:33}, (_,i) => ({offset:i/32,opacity:facetPose(facet,1,1,i/32*facet.turn/2).colorMix}));
      animations.push(tint.animate(colors, {duration:facet.turn/2*1000, iterations:Infinity}));
      this.addGroup(wrapper, animations); return wrapper;
    });
    this.moteSprites = this.motes.map(mote => {
      const wrapper = document.createElement('span'), field = document.createElement('span');
      wrapper.className = 'ambient-mote-group'; field.className = 'mote-field'; wrapper.dataset.plane = mote.plane;
      wrapper.style.left = `${mote.x*100}%`; wrapper.style.top = `${mote.y*100}%`;
      for (const star of mote.stars) {
        const point = document.createElement('i'); point.className = 'ambient-mote';
        point.style.left = `${star.x}px`; point.style.top = `${star.y}px`;
        point.style.setProperty('--mote-size', `${star.size}px`); point.style.opacity = star.alpha;
        field.append(point);
      }
      wrapper.append(field); this.layers[mote.plane].append(wrapper);
      const frames = Array.from({length:49}, (_,i) => {
        const a = i / 48 * TAU + mote.phase;
        return {offset:i/48, transform:`translate(${Math.sin(a)*32-90}px,${Math.cos(a)*24-90}px)`, opacity:.42+(Math.sin(a*2)+1)*.25};
      });
      this.addGroup(wrapper, [field.animate(frames, {duration:mote.period*1000, iterations:Infinity})]); return wrapper;
    });
    this.motionSize = ''; this.positionSprites(); this.setMotion(this.motionPaused, this.reduced); this.canvas.dataset.motion = 'compositor-edge';
  }
  setBounds(bounds) {
    this.bounds = bounds; this.positionSprites(); this.lastSignature = '';
  }
  positionSprites() {
    for (const [elements,items,bounds] of [[this.sprites,this.facets,null],[this.moteSprites||[],this.motes,this.bounds]]) {
      elements.forEach((element,i) => {
        const p=fieldPosition(items[i],this.width,this.height,bounds);
        element.style.left=`${p.x}px`;element.style.top=`${p.y}px`;
      });
    }
    const size=`${this.width}:${this.height}`;
    if(this.sprites.length&&this.motionSize!==size){
      this.sprites.forEach((_,i)=>this.groups[i].animations[0].effect.setKeyframes(facetFrames(this.facets[i],this.width,this.height)));
      this.motionSize=size;
    }
  }
  updateBackdrop() {
    if(!this.backdrop)return;
    const p=edgeResponse(this.reduced?{x:0,y:0}:this.pointer);
    const transform=`translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0) rotate(${p.angle.toFixed(3)}deg)`;
    if(this.backdropTransform!==transform){this.backdrop.style.transform=transform;this.backdropTransform=transform;}
  }
  addGroup(element, animations) {
    const group = {element, animations, visible:true, alpha:''};
    this.groups.push(group); this.animations.push(...animations); return group;
  }
  syncMotion(group) {
    for (const animation of group.animations) {
      if (this.motionPaused || this.reduced || !group.visible) animation.pause(); else animation.play();
      if (this.reduced) animation.currentTime = 0;
    }
  }
  setMotion(paused, reduced = false) {
    this.motionPaused = Boolean(paused); this.reduced = Boolean(reduced);
    for (const group of this.groups) this.syncMotion(group);
    if(reduced)this.updateBackdrop();
  }
  setVisibility(group, alpha) {
    const visible = alpha > .015;
    if (group.visible !== visible) {
      group.visible = visible; group.element.hidden = !visible; this.syncMotion(group);
    }
    const value = alpha.toFixed(2);
    if (group.alpha !== value) {group.element.style.opacity = value; group.alpha = value;}
  }
  updateSprites(nodes, center, radius, centerKind) {
    const now = performance.now();
    if (this.lastSignature && now - (this.lastSpriteUpdate || 0) < 160) return;
    this.lastSpriteUpdate = now;
    const regions = protectedRegions(this.regions, nodes, center, radius, centerKind);
    const count = Math.round(Math.min(20,Math.max(16,this.width*this.height/65000))*this.quality);
    for (let i=0;i<this.sprites.length;i++) {
      const f=this.facets[i], p=fieldPosition(f,this.width,this.height,null);
      const alpha=i<count ? clearance(p.x,p.y,f.size+f.travel*.35,regions)*(this.dark?1:.64)*(f.plane==='front'?.80:1) : 0;
      this.setVisibility(this.groups[i],alpha);
    }
    for (let i=0;i<this.motes.length;i++) {
      const f=this.motes[i], p=fieldPosition(f,this.width,this.height,this.bounds), alpha=i<Math.ceil(this.motes.length*this.quality) ? clearance(p.x,p.y,120,this.regions)*(this.dark?.82:.60) : 0;
      this.setVisibility(this.groups[this.sprites.length+i],alpha);
    }
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.dpr = Math.min(1.25, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * this.dpr)), height = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width; this.canvas.height = height;
    this.prepareStars();
    this.lastSignature = '';
  }
  prepareStars() {
    if (!this.ctx) return;
    // Cache the quiet field. Only a few bright stars twinkle in the live layer;
    // replaying hundreds of paths each frame competes with the celestial renderer.
    this.starLayers = [true, false].map(dark => {
      const layer = document.createElement('canvas'); layer.width = this.canvas.width; layer.height = this.canvas.height;
      const c = layer.getContext('2d'); c.scale(this.dpr, this.dpr);
      c.fillStyle = dark ? '#c5d2f2' : '#546390';
      for (const star of this.stars.slice(0, dark ? 240 : 58)) {
        c.globalAlpha = (star.size > .8 ? .36 : .17) * (dark ? 1 : .4);
        c.beginPath(); c.arc(star.x * this.width, star.y * this.height, star.size, 0, TAU); c.fill();
      }
      return layer;
    });
    this.twinkles = this.stars.filter(s => s.size > .8).slice(0, 24);
  }
  setTheme(dark) {this.dark = Boolean(dark); this.lastSignature = '';}
  setRegions(regions) {this.regions = regions; this.lastSignature = '';}
  track(x, y) {this.target = {x: clamp(x, -1, 1), y: clamp(y, -1, 1)};}
  advance(dt, enabled) {
    if (!enabled) return;
    const ease = 1 - Math.exp(-Math.max(0, dt) * 5);
    this.pointer.x += (this.target.x - this.pointer.x) * ease; this.pointer.y += (this.target.y - this.pointer.y) * ease;
    this.updateBackdrop();
  }
  reportFrame(milliseconds) {
    this.slowFrames = milliseconds > 32 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    this.fastFrames = milliseconds < 20 ? this.fastFrames + 1 : 0;
    if (this.slowFrames > 25 && this.quality !== .55) {this.quality = .55; this.lastSignature = '';}
    if (this.fastFrames > 180 && this.quality !== 1) {this.quality = 1; this.slowFrames = 0; this.lastSignature = '';}
  }
  draw({time = 0, nodes = [], reduced = false, center, radius = 0, centerKind = 'universe'}) {
    if (!this.ctx || !this.width || !this.height) return;
    // Lower density under load; never rewind or freeze the animation clock.
    const t = reduced ? 0 : time;
    if (this.sprites?.length) {
      this.updateSprites(nodes,center,radius,centerKind);
      if (this.lastSignature && t >= this.lastCanvasTime && t-this.lastCanvasTime < .1) return;
    }
    this.lastCanvasTime = t;
    const point = reduced ? {x: 0, y: 0} : this.pointer;
    const signature = `${t}:${this.dark}:${point.x.toFixed(3)}:${point.y.toFixed(3)}:${nodes.map(n => `${Math.round(n.sx)},${Math.round(n.sy)}`).join(';')}`;
    if (this.lastSignature === signature) return;
    this.lastSignature = signature;
    const c = this.ctx, w = this.width, h = this.height;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, w, h);
    const starLayer = this.starLayers?.[this.dark ? 0 : 1];
    if (starLayer) c.drawImage(starLayer, point.x * 2, point.y * 2, w, h);
    c.fillStyle = this.dark ? '#c5d2f2' : '#546390';
    for (const star of (this.twinkles || []).slice(0, Math.round((this.dark ? 24 : 8) * this.quality))) {
      c.globalAlpha = (.15 + .15 * Math.sin(t * 1.1 + star.phase)) * (this.dark ? 1 : .35);
      c.beginPath(); c.arc(star.x * w + point.x * 2, star.y * h + point.y * 2, star.size, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    if (!this.tiles.length || this.sprites?.length) return;
    const regions = protectedRegions(this.regions, nodes, center, radius, centerKind);
    const count = Math.min(20, Math.max(16, Math.round(w * h / 65000))) * this.quality;
    for (const facet of this.facets.slice(0, Math.floor(count))) {
      const p = facetPose(facet, w, h, t, point), size = facet.size;
      const alpha = p.opacity * (this.dark ? 1 : .64) * clearance(p.x, p.y, size, regions);
      if (alpha < .002) continue;
      c.save(); c.translate(p.x, p.y); c.rotate(p.angle); c.globalAlpha = alpha;
      // Sprite silhouettes occupy roughly half a tile; preserve their authored proportions.
      c.drawImage(this.tiles[facet.tile], -size, -size, size * 2, size * 2);
      if(this.alternateTiles?.[facet.tile]){c.globalAlpha=alpha*p.colorMix;c.drawImage(this.alternateTiles[facet.tile],-size,-size,size*2,size*2);}
      c.restore();
    }
  }
}
