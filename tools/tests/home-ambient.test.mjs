import test from 'node:test';
import assert from 'node:assert/strict';
import {createFacets,createMotes,facetPose,facetFrames,edgeVisibility,edgeResponse,fieldPosition,protectedRegions,clearance,AmbientField} from '../../web/home/ambient.mjs';

test('decorative motion stays reproducible and bounded as the viewport changes',()=>{
  const facets=createFacets();assert.deepEqual(facets,createFacets());
  for(const f of facets)for(const [w,h] of [[1280,800],[2226,1185]])for(const t of [0,1,10,200,600]){
    const p=facetPose(f,w,h,t,{x:1,y:-1});
    assert.ok(Math.abs(p.x-f.x*w)<=f.travel*.5+6);
    assert.ok(Math.abs(p.y-f.y*h)<=f.travel*.35+6);
    assert.ok(p.opacity>=0&&p.opacity<=.44000001);
    assert.ok(Math.abs(p.tiltX)<=12&&Math.abs(p.tiltY)<=18);
    assert.ok(p.colorMix>=0&&p.colorMix<=1);
  }
});

test('HUD exclusion keeps facets clear of reading regions',()=>{
  const protectedArea=[{x:200,y:100,width:560,height:130}];
  assert.equal(clearance(450,160,40,protectedArea),0);
  assert.equal(clearance(190,160,40,protectedArea),0);
  assert.equal(clearance(100,160,40,protectedArea),1);
  assert.ok(clearance(165,160,40,protectedArea)>0&&clearance(165,160,40,protectedArea)<1);
});

test('pause freezes parallax and sustained slow frames reduce only ambient quality',()=>{
  const field=Object.create(AmbientField.prototype);
  Object.assign(field,{pointer:{x:.1,y:.2},target:{x:1,y:1},quality:1,slowFrames:0,fastFrames:0});
  field.advance(10,false);assert.deepEqual(field.pointer,{x:.1,y:.2});
  field.advance(.1,true);assert.ok(field.pointer.x>.1&&field.pointer.x<1);
  for(let i=0;i<28;i++)field.reportFrame(45);
  assert.equal(field.quality,.55);
  const point={...field.pointer};field.reportFrame(10);assert.deepEqual(field.pointer,point);
});


test('peripheral facets still visibly drift while the scene remains quiet',()=>{
  const facets=createFacets(), changes=facets.map(f=>{
    const a=facetPose(f,1440,900,2),b=facetPose(f,1440,900,4);
    return {travel:Math.hypot(a.x-b.x,a.y-b.y),alpha:Math.abs(a.opacity-b.opacity)};
  });
  assert.ok(changes.filter(p=>p.travel>=6).length>=6);
  assert.ok(changes.filter(p=>p.alpha>=.015).length>=4);
});

test('quality reduction keeps time advancing, and sustained recovery restores density',()=>{
  const field=Object.create(AmbientField.prototype),images=[];
  Object.assign(field,{width:1440,height:900,dpr:1,dark:true,quality:.55,slowFrames:28,fastFrames:0,
    pointer:{x:0,y:0},regions:[],stars:[],facets:createFacets(),tiles:[1,1,1,1,1,1],
    ctx:{setTransform(){},clearRect(){},save(){},restore(){},translate(x,y){images.push([x,y]);},rotate(){},drawImage(){}}});
  field.draw({time:20});const first=JSON.stringify(images);images.length=0;
  field.draw({time:22});assert.notEqual(JSON.stringify(images),first);
  const stopped=field.lastSignature;field.draw({time:22});assert.equal(field.lastSignature,stopped);
  for(let i=0;i<181;i++)field.reportFrame(10);
  assert.equal(field.quality,1);
  field.draw({time:25,reduced:true});const staticState=field.lastSignature;
  field.draw({time:100,reduced:true});assert.equal(field.lastSignature,staticState);
});


test('composited facets honor the same pause and reduced-motion controls',()=>{
  const field=Object.create(AmbientField.prototype);
  const animations=Array.from({length:4},()=>({currentTime:1234,state:'running',pause(){this.state='paused'},play(){this.state='running'}}));
  field.groups=[{visible:true,animations:animations.slice(0,2)},{visible:false,animations:animations.slice(2)}];
  field.setMotion(true);assert.ok(animations.every(a=>a.state==='paused'&&a.currentTime===1234));
  field.setMotion(false);assert.ok(animations.slice(0,2).every(a=>a.state==='running'));
  assert.ok(animations.slice(2).every(a=>a.state==='paused'));
  field.groups[1].visible=true;field.syncMotion(field.groups[1]);assert.ok(animations.every(a=>a.state==='running'));
  field.setMotion(false,true);assert.ok(animations.every(a=>a.state==='paused'&&a.currentTime===0));
});


test('balanced edge placement and both depth planes survive reduced density',()=>{
  const facets=createFacets();assert.equal(facets.length,20);
  for(const f of facets)assert.ok(Math.min(f.x,1-f.x,f.y,1-f.y)<.14);
  for(const subset of [facets,facets.slice(0,10)]){
    assert.equal(new Set(subset.map(f=>f.side)).size,4);
    assert.equal(new Set(subset.map(f=>f.plane)).size,2);
  }
});

test('turn, drift, spatial fading and uniform hue cycles join without a seam',()=>{
  for(const f of createFacets()){
    const a=facetPose(f,1440,900,0), b=facetPose(f,1440,900,f.turn);
    for(const key of ['x','y','opacity','tiltX','tiltY','colorMix']) assert.ok(Math.abs(a[key]-b[key])<1e-8,key);
    assert.ok(Math.abs(Math.abs(a.angle-b.angle)-2*Math.PI)<1e-8);
    const middle=facetPose(f,1440,900,f.turn/8);
    assert.ok(Math.abs(a.colorMix-middle.colorMix)>.01);
  }
});

test('planetary surfaces allow foreground glass while labels and the event horizon remain protected',()=>{
  const node={sx:500,sy:400}, center={x:500,y:400};
  const planet=protectedRegions([],[],center,50,'chapter');
  assert.equal(clearance(500,400,10,planet),1);
  const horizon=protectedRegions([],[],center,50,'universe');
  assert.equal(clearance(500,400,10,horizon),0);
  const label=protectedRegions([],[node],center,50,'chapter');
  assert.equal(clearance(500,428,10,label),0);
});

test('white drifting motes use a bounded number of groups in both planes',()=>{
  const motes=createMotes();assert.deepEqual(motes,createMotes());
  assert.equal(motes.length,4);assert.equal(motes.flatMap(m=>m.stars).length,16);
  assert.equal(new Set(motes.map(m=>m.plane)).size,2);
  assert.ok(motes.every(m=>m.period>=16&&m.period<=26));
});

test('hidden decorations release their animations without overriding a global pause on reentry',()=>{
  const field=Object.create(AmbientField.prototype), animation={state:'running',pause(){this.state='paused'},play(){this.state='running'}};
  const group={visible:true,element:{hidden:false,style:{}},animations:[animation],alpha:''};
  field.groups=[group];field.motionPaused=false;
  field.setVisibility(group,0);assert.equal(group.element.hidden,true);assert.equal(animation.state,'paused');
  field.setMotion(true);field.setVisibility(group,.8);assert.equal(group.element.hidden,false);assert.equal(animation.state,'paused');
  field.setMotion(false);assert.equal(animation.state,'running');
});


test('central white motes follow the measured scene while colorful shards stay on the viewport edges',()=>{
  const bounds={top:320,bottom:720};
  assert.deepEqual(fieldPosition({x:.5,y:.56},1440,900,bounds),{x:720,y:520});
  assert.ok(Math.abs(fieldPosition({x:.5,y:.56},1440,900,null).y-504)<1e-8);
  for(const f of createMotes()){
    const p=fieldPosition(f,1440,900,bounds);assert.ok(p.y>bounds.top&&p.y<bounds.bottom);
  }
});


test('colorful shards fade to zero before entering the central reading field at every tested size',()=>{
  for(const [w,h] of [[1000,760],[1440,900],[1920,1080]]){
    assert.equal(edgeVisibility(w*.5,h*.5,w,h),0);
    assert.equal(edgeVisibility(w*.27,h*.5,w,h),0);
    assert.equal(edgeVisibility(w*.02,h*.5,w,h),1);
    assert.ok(edgeVisibility(w*.1,h*.5,w,h)>0&&edgeVisibility(w*.1,h*.5,w,h)<1);
    for(const f of createFacets())for(let i=0;i<=96;i++){
      const p=facetPose(f,w,h,f.turn*i/96),r=Math.hypot((p.x/w-.5)/.5,(p.y/h-.5)/.5);
      if(r<=.66)assert.equal(p.opacity,0);
    }
  }
  const f={...createFacets()[0],x:.16,y:.5,travel:160,phase:0};
  assert.equal(facetPose(f,1000,800,f.drift/4).opacity,0);
  assert.ok(facetPose(f,1000,800,f.drift*3/4).opacity>.1);
});

test('resizing recomputes spatial fading without changing the animation clock or loop endpoints',()=>{
  const f={...createFacets()[0],x:.16,y:.5,travel:160,phase:0};
  const narrow=facetFrames(f,1000,760),wide=facetFrames(f,2200,1185);
  assert.equal(narrow.length,wide.length);
  assert.ok(narrow.some((frame,i)=>Math.abs(frame.opacity-wide[i].opacity)>.03));
  assert.ok(Math.abs(narrow[0].opacity-narrow.at(-1).opacity)<1e-8);
  const animation={currentTime:14000,effect:{setKeyframes(frames){this.frames=frames;}}};
  const field=Object.create(AmbientField.prototype);
  Object.assign(field,{width:2200,height:1185,facets:[f],sprites:[{style:{}}],motes:[],groups:[{animations:[animation]}]});
  field.positionSprites();assert.equal(animation.currentTime,14000);assert.ok(animation.effect.frames.length>0);
});

test('background folds respond only near the edge, are bounded, and settle to neutral at the center',()=>{
  assert.deepEqual(edgeResponse({x:0,y:0}),{x:0,y:0,angle:0});
  for(const x of [-1,-.5,0,.5,1])for(const y of [-1,-.5,0,.5,1]){
    const p=edgeResponse({x,y});assert.ok(Math.abs(p.x)<=4&&Math.abs(p.y)<=3&&Math.abs(p.angle)<=.075);
  }
  assert.ok(Math.abs(edgeResponse({x:.95,y:.6}).x)>3);
  assert.ok(Math.abs(edgeResponse({x:.2,y:.2}).x)===0);
});
