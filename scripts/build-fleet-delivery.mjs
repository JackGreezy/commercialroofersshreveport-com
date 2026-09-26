import fs from 'node:fs';import {optimizeFleetImages} from './optimize-fleet-images.mjs';
const repair=fs.existsSync('data/fleet-runtime-repairs.json')?(await import('./repair-runtime.mjs')).repairFleetRuntime:s=>s;
let touched=0,homeObjects=0;
for(const file of ['public/index.html','public/home.html','public/__static-pages/index.html','public/__static-pages/home.html','rendered/pages/home.html','data/rendered-pages/index.html','data/rendered-pages/home.html']){if(!fs.existsSync(file))continue;const before=fs.readFileSync(file,'utf8'),after=optimizeFleetImages(repair(before));if(before!==after){fs.writeFileSync(file,after);touched++}}

// The captured route map names the actual generated homepage file.
const routeMapHome=new Set();
for(const mapFile of ['data/route-map.json','data/routeMap.json','public/route-map.json']){if(!fs.existsSync(mapFile))continue;try{const map=JSON.parse(fs.readFileSync(mapFile,'utf8'));const home=map['/']||map.routes?.['/'];const file=typeof home==='string'?home:home?.file;if(file)for(const root of ['public/rendered-pages','public/__static-pages','rendered/pages','data/rendered-pages','public']){const candidate=root+'/'+file.replace(/^\/+/, '');if(fs.existsSync(candidate))routeMapHome.add(candidate)}}catch{}}
for(const file of routeMapHome){const before=fs.readFileSync(file,'utf8'),after=optimizeFleetImages(repair(before),true);if(before!==after){fs.writeFileSync(file,after);touched++}}
function walk(value,key=''){
 if(!value||typeof value!=='object')return;
 const isHome=key==='/'||key==='home'||['path','pathname','route','slug'].some(k=>value[k]==='/');
 if(typeof value.html==='string'){value.html=isHome?optimizeFleetImages(repair(value.html),true):repair(value.html);if(isHome)homeObjects++}
 for(const [k,v] of Object.entries(value)){
  if(k==='html')continue;
  if(k==='/'&&typeof v==='string'&&v.includes('<')){value[k]=optimizeFleetImages(repair(v),true);homeObjects++}
  else walk(v,k);
 }
}
if(fs.existsSync('data'))for(const file of fs.readdirSync('data').filter(s=>s.endsWith('.json')&&!s.startsWith('fleet-'))){const path='data/'+file,before=fs.readFileSync(path,'utf8');let value;try{value=JSON.parse(before)}catch{continue}const snapshot=JSON.stringify(value);walk(value);if(JSON.stringify(value)!==snapshot){fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');touched++}}
console.log('Fleet delivery transformed',touched,'documents; homepage objects',homeObjects);
