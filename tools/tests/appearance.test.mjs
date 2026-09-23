import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {getTheme,applyTheme,toggleTheme} from '../../web/shared/appearance.mjs';

const source=readFileSync(new URL('../../web/shared/boot.js',import.meta.url),'utf8');
const key='systems-science:theme:v1',legacy='systems-science:home-theme:v1';
function page({home=false,store=new Map(),blocked=false}={}){
  const listeners=new Map(),events=[],frames=new Map();let frameId=0;
  const sandbox={
    document:{body:{dataset:{},classList:{contains:name=>home&&name==='home-page'}},documentElement:{dataset:{},style:{}}},
    localStorage:{getItem(k){if(blocked)throw Error('blocked');return store.get(k)??null;},setItem(k,v){if(blocked)throw Error('blocked');store.set(k,v);}},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
    addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},
    dispatchEvent(event){events.push(event);for(const listener of listeners.get(event.type)||[])listener(event);},
    requestAnimationFrame(fn){frames.set(++frameId,fn);return frameId;},
    cancelAnimationFrame(id){frames.delete(id);},
    setTimeout(){},
  };
  sandbox.window=sandbox;vm.runInNewContext(source,sandbox);
  return{...sandbox,store,events,paint(){const pending=[...frames];frames.clear();for(const [,fn] of pending)fn();},emit:(type,event)=>{for(const listener of listeners.get(type)||[])listener(event);}};
}

test('first home visit and subsequent teaching pages retain one theme',()=>{
  const store=new Map(),home=page({home:true,store});
  assert.equal(home.document.documentElement.dataset.siteTheme,'dark');
  assert.equal(home.document.body.dataset.skyTheme,'dark');
  assert.equal(page({store}).systemsScienceAppearance.getTheme(),'dark');
  home.systemsScienceAppearance.applyTheme('light');
  assert.equal(page({store}).systemsScienceAppearance.getTheme(),'light');
  assert.equal(page({home:true,store}).document.body.dataset.skyTheme,'light');
});

test('direct teaching entry defaults light and can set dark for the homepage',()=>{
  const store=new Map(),lesson=page({store});
  assert.equal(lesson.systemsScienceAppearance.getTheme(),'light');
  lesson.systemsScienceAppearance.toggleTheme();
  assert.equal(page({home:true,store}).systemsScienceAppearance.getTheme(),'dark');
});

test('legacy home preference migrates without overriding an existing site preference',()=>{
  const store=new Map([[legacy,'light']]);
  assert.equal(page({home:true,store}).systemsScienceAppearance.getTheme(),'light');
  assert.equal(store.get(key),'light');
  store.set(key,'dark');
  assert.equal(page({store}).systemsScienceAppearance.getTheme(),'dark');
});

test('blocked storage still allows local theme changes and broadcasts their value',()=>{
  const lesson=page({blocked:true});
  assert.equal(lesson.systemsScienceAppearance.applyTheme('dark'),'dark');
  assert.equal(lesson.document.documentElement.style.colorScheme,'dark');
  assert.equal(lesson.events.at(-1).type,'site-theme-change');
  assert.equal(lesson.events.at(-1).detail.theme,'dark');
});

test('storage events update another tab without rewriting the preference',()=>{
  const lesson=page();lesson.emit('storage',{key,newValue:'dark'});
  assert.equal(lesson.systemsScienceAppearance.getTheme(),'dark');
  assert.equal(lesson.store.get(key),'light');
  lesson.emit('storage',{key:'unrelated-setting',newValue:'light'});
  assert.equal(lesson.systemsScienceAppearance.getTheme(),'dark');
});

test('public module delegates to the shared controller and rejects unknown themes',t=>{
  const original=globalThis.window,lesson=page();globalThis.window=lesson;
  t.after(()=>{if(original===undefined)delete globalThis.window;else globalThis.window=original;});
  assert.equal(getTheme(),'light');assert.equal(toggleTheme(),'dark');
  assert.equal(applyTheme('light'),'light');
  assert.throws(()=>applyTheme('sepia'),/dark or light/);assert.equal(getTheme(),'light');
});

test('rapid theme choices update the live document immediately without freezing input',t=>{
  const saved={window:globalThis.window,document:globalThis.document};
  const lesson=page();globalThis.window=lesson;
  globalThis.document={startViewTransition(){assert.fail('Theme changes must not freeze the live document');}};
  t.after(()=>Object.entries(saved).forEach(([key,value])=>{if(value===undefined)delete globalThis[key];else globalThis[key]=value;}));
  toggleTheme();assert.equal(getTheme(),'dark');
  toggleTheme();assert.equal(getTheme(),'light');
  toggleTheme();assert.equal(lesson.document.documentElement.dataset.siteTheme,'dark');
  assert.equal(lesson.store.get(key),'dark');
});

test('dark controls use the approved palette with readable text in every filled state',()=>{
  const css=readFileSync(new URL('../../web/shared/appearance.css',import.meta.url),'utf8');
  const declarations=css.match(/:root\[data-site-theme=dark\]\{([\s\S]*?)\}/)[1];
  const tokens=Object.fromEntries([...declarations.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2].toLowerCase()]));
  assert.equal(tokens['--solid-primary'],'#d7dcf1');
  assert.equal(tokens['--solid-ink'],'#18203a');
  assert.equal(tokens['--ui-primary-hover'],'#e8ebfa');
  assert.equal(tokens['--ui-primary'],'#d0d9f2');
  assert.equal(tokens['--selected-surface'],'#283253');
  function luminance(color){const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
  for(const [fg,bg] of [['--solid-ink','--solid-primary'],['--solid-ink','--ui-primary-hover'],['--ui-primary','--surface'],['--ui-text','--selected-surface'],['--ui-muted','--surface-raised'],['--ui-text','--ui-background']]){
    const a=luminance(tokens[fg]),b=luminance(tokens[bg]);
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg} on ${bg}`);
  }
});

test('light text, links and filled buttons retain WCAG AA contrast',()=>{
  const css=readFileSync(new URL('../../web/shared/appearance.css',import.meta.url),'utf8');
  const declarations=css.match(/:root\[data-site-theme=light\]\{([\s\S]*?)\}/)[1];
  const tokens=Object.fromEntries([...declarations.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map(m=>[m[1],m[2]]));
  const luminance=color=>{const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  for(const [fg,bg] of [['--solid-ink','--solid-primary'],['--solid-ink','--ui-primary-hover'],['--ui-primary','--surface'],['--ui-muted','--surface-raised'],['--ui-text','--selected-surface']]){
    const a=luminance(tokens[fg]),b=luminance(tokens[bg]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${fg} on ${bg}`);
  }
});


test('theme color transitions settle without blocking or racing a later selection',()=>{
  const lesson=page({home:true}),root=lesson.document.documentElement;
  lesson.systemsScienceAppearance.toggleTheme();assert.equal(root.dataset.themeSettling,'true');
  lesson.paint();lesson.systemsScienceAppearance.toggleTheme();lesson.paint();
  assert.equal(root.dataset.siteTheme,'dark');assert.equal(root.dataset.themeSettling,'true');
  lesson.paint();assert.equal(root.dataset.themeSettling,undefined);assert.equal(lesson.store.get(key),'dark');
});
