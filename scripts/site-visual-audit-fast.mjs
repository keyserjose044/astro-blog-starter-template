import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const OUT = path.resolve('audit-output-fast');
const BASE_URL = process.env.AUDIT_BASE_URL || 'https://lifeloggerz.com';
const TARGET_SHA = process.env.AUDIT_SITE_SHA || 'unknown';
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, touch: false },
  { name: 'mobile', width: 390, height: 844, touch: true },
];
const STATE_ROUTES = new Set(['/books/','/music/albums/','/music/composers/','/art/','/stats/','/day/','/pursuits/']);
const STATE_LABELS = ['list','quilt','world','timeline','calendar','authors','records','artists','overview','works','composers','journey','favorites','explore'];

const slug = (s) => (String(s).replace(/^https?:\/\/[^/]+/,'').replace(/[?#].*$/,'').replace(/^\/+|\/+$/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase() || 'home');
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

async function routesFromDist() {
  const files=[];
  async function walk(dir){
    for (const e of await fs.readdir(dir,{withFileTypes:true})) {
      const p=path.join(dir,e.name);
      if(e.isDirectory()) await walk(p); else if(e.name.endsWith('.html')) files.push(p);
    }
  }
  await walk(DIST);
  return files.map((f)=>{
    let r=path.relative(DIST,f).split(path.sep).join('/');
    if(r==='index.html') return '/';
    if(r.endsWith('/index.html')) return `/${r.slice(0,-10)}/`;
    return `/${r}`;
  }).sort();
}

async function visibleSampleScroll(page) {
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
  const maxY = Math.max(0, height - (await page.evaluate(() => innerHeight)));
  const points = [...new Set([0,.12,.27,.43,.59,.75,.9,1].map((f)=>Math.round(maxY*f)))];
  for (const y of points) {
    await page.evaluate((v)=>scrollTo(0,v),y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.waitForTimeout(100);
  return height;
}

async function inspect(page, device) {
  return page.evaluate((deviceName) => {
    const visible=(el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'};
    const desc=(el)=>`${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${[...el.classList].slice(0,2).map(c=>'.'+c).join('')} “${(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60)}”`;
    const vw=innerWidth, sw=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
    const offscreen=[...document.querySelectorAll('main *, article *, section *')].filter(visible).map(el=>({el,r:el.getBoundingClientRect()})).filter(x=>x.r.right>vw+4||x.r.left<-4).slice(0,25).map(x=>({element:desc(x.el),left:Math.round(x.r.left),right:Math.round(x.r.right),width:Math.round(x.r.width)}));
    const broken=[...document.images].filter(visible).filter(i=>i.complete&&i.naturalWidth===0).slice(0,30).map(i=>({src:i.currentSrc||i.src,alt:i.alt||''}));
    const small=deviceName==='mobile'?[...document.querySelectorAll('button,summary,input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"],[aria-pressed]')].filter(visible).map(el=>({el,r:el.getBoundingClientRect()})).filter(x=>x.r.width<40||x.r.height<40).slice(0,40).map(x=>({element:desc(x.el),width:Math.round(x.r.width),height:Math.round(x.r.height)})):[];
    const links=[...document.querySelectorAll('a[href]')].map(a=>a.href).filter(Boolean).filter(h=>{try{return new URL(h).origin===location.origin}catch{return false}});
    return {title:document.title,h1:[...document.querySelectorAll('h1')].filter(visible).map(h=>(h.textContent||'').trim()),height:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0),viewportWidth:vw,scrollWidth:sw,overflowPx:Math.max(0,sw-vw),offscreen,brokenImages:broken,smallTargets:small,internalLinks:links};
  }, device);
}

async function screenshots(page, route, device, height, folder='screenshots') {
  const dir=path.join(OUT,folder,device.name); await fs.mkdir(dir,{recursive:true});
  const files=[];
  if(height<=14000){
    const file=`${slug(route)}.jpg`; await page.screenshot({path:path.join(dir,file),type:'jpeg',quality:62,fullPage:true}); files.push(`${folder}/${device.name}/${file}`); return files;
  }
  const maxY=Math.max(0,height-device.height);
  const pts=[['top',0],['quarter',Math.round(maxY*.25)],['middle',Math.round(maxY*.5)],['three-quarter',Math.round(maxY*.75)],['bottom',maxY]];
  for(const [label,y] of pts){await page.evaluate(v=>scrollTo(0,v),y);await page.waitForTimeout(90);const file=`${slug(route)}--${label}.jpg`;await page.screenshot({path:path.join(dir,file),type:'jpeg',quality:65,fullPage:false});files.push(`${folder}/${device.name}/${file}`)}
  await page.evaluate(()=>scrollTo(0,0));
  return files;
}

async function stateControls(page) {
  return page.evaluate((labels)=>{
    const n=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const els=[...document.querySelectorAll('main button,main [role="tab"],main [aria-pressed],#book-view-toggle button,.view-toggle button,.view-switcher button')];
    const seen=new Set(),out=[];
    for(const el of els){const r=el.getBoundingClientRect();if(!r.width||!r.height||el.closest('header,nav,dialog,[role="dialog"]'))continue;const text=n(el.textContent);const key=labels.find(l=>text===l||text.startsWith(l+' '));if(!key||seen.has(key))continue;seen.add(key);out.push({key,raw:(el.textContent||'').replace(/\s+/g,' ').trim()})}
    return out.slice(0,10);
  },STATE_LABELS);
}

async function clickState(page,key){return page.evaluate((wanted)=>{const n=(s)=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();for(const el of document.querySelectorAll('main button,main [role="tab"],main [aria-pressed],#book-view-toggle button,.view-toggle button,.view-switcher button')){if(el.closest('header,nav,dialog,[role="dialog"]'))continue;const t=n(el.textContent);if(t===wanted||t.startsWith(wanted+' ')){el.click();return true}}return false},key)}

async function auditRoute(browser,route,device,report,allLinks){
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:device.touch,hasTouch:device.touch,deviceScaleFactor:1});
  const page=await context.newPage();
  const consoleErrors=[],pageErrors=[],badResponses=[];
  page.on('console',m=>{if(m.type()==='error') consoleErrors.push(m.text().slice(0,500))});
  page.on('pageerror',e=>pageErrors.push(String(e.message||e).slice(0,500)));
  page.on('response',r=>{if(r.status()>=400)badResponses.push({status:r.status(),url:r.url()})});
  const url=new URL(route,BASE_URL).toString(); let nav=''; let base=null; let shots=[]; const states=[];
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:20000}); await page.waitForTimeout(450);
    const height=await visibleSampleScroll(page); base=await inspect(page,device.name); base.internalLinks.forEach(x=>allLinks.add(x)); shots=await screenshots(page,route,device,height);
    const canonicalRoute=new URL(page.url()).pathname;
    if(STATE_ROUTES.has(canonicalRoute)){
      for(const control of await stateControls(page)){
        if(!await clickState(page,control.key))continue; await page.waitForTimeout(450); await page.evaluate(()=>scrollTo(0,0)); const meta=await inspect(page,device.name); meta.internalLinks.forEach(x=>allLinks.add(x));
        const dir=path.join(OUT,'states',device.name);await fs.mkdir(dir,{recursive:true});const file=`${slug(route)}--${slug(control.key)}.jpg`;await page.screenshot({path:path.join(dir,file),type:'jpeg',quality:65,fullPage:false});states.push({label:control.raw,key:control.key,screenshot:`states/${device.name}/${file}`,inspection:meta});
      }
    }
  }catch(e){nav=String(e.message||e)}
  report.pages.push({device:device.name,route,url,finalUrl:page.url(),screenshots:shots,navigationError:nav,inspection:base,consoleErrors:[...new Set(consoleErrors)].slice(0,30),pageErrors:[...new Set(pageErrors)].slice(0,30),badResponses:badResponses.slice(0,40),states});
  await context.close();
}

async function checkLinks(links){const out=[];for(const raw of [...links]){try{const u=new URL(raw);u.hash='';if(u.origin!==new URL(BASE_URL).origin)continue;const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(8000)});if(r.status>=400)out.push({status:r.status,url:u.toString()})}catch(e){out.push({status:0,url:raw,error:String(e.message||e)})}}return out.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i)}

await fs.rm(OUT,{recursive:true,force:true});await fs.mkdir(OUT,{recursive:true});
const routes=await routesFromDist();const report={targetSha:TARGET_SHA,generatedAt:new Date().toISOString(),baseUrl:BASE_URL,routes,pages:[],brokenInternalLinks:[]};const links=new Set();const browser=await chromium.launch({headless:true});
try{for(const device of DEVICES){for(const route of routes){console.log(`[audit-fast] ${device.name} ${route}`);await auditRoute(browser,route,device,report,links)}}}finally{await browser.close()}
report.brokenInternalLinks=await checkLinks(links);
report.summary={routes:routes.length,captures:report.pages.length,stateCaptures:report.pages.reduce((s,p)=>s+p.states.length,0),navigationErrors:report.pages.filter(p=>p.navigationError).length,horizontalOverflow:report.pages.filter(p=>(p.inspection?.overflowPx||0)>3).length,brokenImagePages:report.pages.filter(p=>p.inspection?.brokenImages?.length).length,consoleErrorPages:report.pages.filter(p=>p.consoleErrors.length).length,pageErrorPages:report.pages.filter(p=>p.pageErrors.length).length,smallTargetPages:report.pages.filter(p=>p.inspection?.smallTargets?.length).length,brokenInternalLinks:report.brokenInternalLinks.length};
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await fs.writeFile(path.join(OUT,'routes.txt'),routes.join('\n')+'\n');await fs.writeFile(path.join(OUT,'REPORT.md'),`# LifeLoggerz live audit\n\nFrozen UI marker: ${TARGET_SHA}\n\n\`\`\`json\n${JSON.stringify(report.summary,null,2)}\n\`\`\`\n\nBroken internal links:\n${report.brokenInternalLinks.map(x=>`- ${x.status} ${x.url}`).join('\n')}\n`);console.log(JSON.stringify(report.summary,null,2));
