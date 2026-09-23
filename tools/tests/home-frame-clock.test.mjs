import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameClock} from '../../web/home/frame-clock.mjs';

test('50 Hz and 60 Hz displays do not accidentally halve the render cadence',()=>{
  for(const hz of [50,60]){
    const clock=new FrameClock();let rendered=0;
    for(let frame=0;frame<=hz*4;frame++)if(clock.step(frame*1000/hz,60)!==null)rendered++;
    assert.ok(rendered>=hz*4);
  }
});
test('30 fps compatibility mode carries fractional budgets on a 50 Hz display',()=>{
  const clock=new FrameClock();let rendered=0;
  for(let frame=0;frame<=200;frame++)if(clock.step(frame*20,30)!==null)rendered++;
  assert.ok(rendered>=119&&rendered<=122);
});
test('pause, resume and background reset do not introduce a time jump',()=>{
  const clock=new FrameClock();clock.step(0);assert.equal(clock.step(20),.02);
  assert.equal(clock.step(30,8),.01);assert.equal(clock.step(60,8),null);
  assert.equal(clock.step(70,60),.04);
  clock.reset();assert.equal(clock.step(70000),0);assert.equal(clock.step(70020),.02);
});
