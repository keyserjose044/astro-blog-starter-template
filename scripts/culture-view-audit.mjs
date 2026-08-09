import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://lifeloggerz.com';
const OUT = path.resolve('culture-view-audit');
const targets = {
  '/books/': ['List','Quilt','World','Timeline','Calendar','Authors','Records'],
  '/music/albums/': ['List','Quilt','World','Timeline','Calendar','Artists','Records','Listening Log'],
  '/music/composers/': ['Overview','Composers','Works','Calendar','Journey','World','Records','Favorites'],
  '/art/': ['Gallery','List','Artists','Timeline','World Map'],
};
const devices = [
  {name:'desktop', width:1440, height:900, touch:false},
  {name:'mobile', width:390, height:844, touch:true},
];

const norm = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug = (s) => norm(s).replace(/\s+/g,'-') || 'view';

async function clickView(page, label) {
  const wanted = norm(label);
  return page.evaluate((wanted) => {
    const norm = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const selectors = [
      '#book-view-toggle button', '#album-view-toggle button', '#art-view-toggle button',
      '.albums-view-toggle button', '.classical-view-toggle button', '.view-toggle button',
      'main [role="group"] button', 'main [role="tab"]', 'main button[aria-pressed]'
    ];
    const candidates = [...new Set(selectors.flatMap((s)=>[...document.querySelectorAll(s)]))];
    const visible = (el) => { const r=el.getBoundingClientRect(), st=getComputedStyle(el); return r.width>0&&r.height>0&&st.display!=='none'&&st.visibility!=='hidden'; };
    const exact = candidates.find((el)=>visible(el) && norm(el.textContent)===wanted);
    const starts = candidates.find((el)=>visible(el) && norm(el.textContent).startsWith(wanted+' '));
    const el = exact || starts;
    if (!el) return {ok:false, candidates:candidates.filter(visible).map((x)=>norm(x.textContent)).filter(Boolean).slice(0,80)};
    el.click();
    return {ok:true, text:norm(el.textContent)};
  }, wanted);
}

async function inspect(page) {
  return page.evaluate(() => {
    const visible=(el)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'};
    const vw=innerWidth, sw=Math.max(document.documentElement.scrollWidth,document.body?.scrollWidth||0);
    const broken=[...document.images].filter(visible).filter(i=>i.complete&&i.naturalWidth===0).slice(0,50).map(i=>({src:i.currentSrc||i.src,alt:i.alt||''}));
    const headings=[...document.querySelectorAll('h1,h2')].filter(visible).map(h=>(h.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,20);
    return {overflowPx:Math.max(0,sw-vw),brokenImages:broken,headings,scrollY:Math.round(scrollY),height:Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0)};
  });
}

await fs.rm(OUT,{recursive:true,force:true});
await fs.mkdir(OUT,{recursive:true});
const report=[];
const browser=await chromium.launch({headless:true});
try {
  for (const device of devices) {
    const dir=path.join(OUT,device.name); await fs.mkdir(dir,{recursive:true});
    for (const [route, views] of Object.entries(targets)) {
      for (const view of views) {
        const context=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:device.touch,hasTouch:device.touch,deviceScaleFactor:1});
        const page=await context.newPage();
        const errors=[]; page.on('pageerror',(e)=>errors.push(String(e.message||e)));
        const consoleErrors=[]; page.on('console',(m)=>{if(m.type()==='error')consoleErrors.push(m.text())});
        let navError=''; let clickResult=null; let meta=null;
        try {
          await page.goto(new URL(route,BASE).toString(),{waitUntil:'domcontentloaded',timeout:25000});
          await page.waitForTimeout(650);
          clickResult=await clickView(page,view);
          if (clickResult.ok) {
            await page.waitForTimeout(view==='Artists'||view==='Authors'||view==='Composers'?1000:750);
            await page.evaluate(()=>{ if (scrollY > 1400) scrollTo(0,0); });
            await page.waitForTimeout(100);
            meta=await inspect(page);
            const file=`${route.split('/').filter(Boolean).join('-')||'home'}--${slug(view)}.jpg`;
            await page.screenshot({path:path.join(dir,file),type:'jpeg',quality:72,fullPage:false,timeout:20000});
          }
        } catch(e) { navError=String(e.message||e); }
        report.push({device:device.name,route,view,clickResult,navError,meta,pageErrors:[...new Set(errors)].slice(0,10),consoleErrors:[...new Set(consoleErrors)].slice(0,10)});
        console.log(`[culture] ${device.name} ${route} ${view}: ${clickResult?.ok?'ok':'MISS'} ${navError?'ERR':''}`);
        await context.close();
      }
    }
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(OUT,'report.json'),JSON.stringify(report,null,2));
const misses=report.filter(x=>!x.clickResult?.ok||x.navError);
console.log(`captures=${report.length} misses=${misses.length} overflow=${report.filter(x=>(x.meta?.overflowPx||0)>3).length}`);
if(misses.length) console.log(JSON.stringify(misses,null,2));
