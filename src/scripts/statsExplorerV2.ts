import { getDailyMeta, getYears } from '../utils/dailyData';
import {
  METRICS, YEAR_COLORS, iso, fmt, prettyDate, shortDate, waitFor, setText, sum, average,
  calendarBounds, seriesFor, measured, rollingBest, streaks,
  drawTimeline, drawHeatmap, lifetimeReference,
} from './statsExplorerV2Core';
import type { MetricKey, ViewKey, RangeKey, Series, Point } from './statsExplorerV2Core';

async function init(){
  const section=await waitFor('#graphs');
  if(!section||section.querySelector('.stats-explorer-v2'))return;
  const status=document.createElement('p');
  status.className='sev2-status';
  status.textContent='Loading the unified archive explorer…';
  section.append(status);
  try{
    const meta=await getDailyMeta();
    const records=await getYears(meta.availableYears);
    status.remove();
    const old=section.querySelector('.canonical-explorer');
    const shell=document.createElement('div');
    shell.className='stats-explorer-v2';
    shell.innerHTML=`
      <div class="sev2-toolbar">
        <div><span class="sev2-label">Metric</span><div class="sev2-metrics">${Object.values(METRICS).map((metric,index)=>`<button class="sev2-button ${index===0?'is-active':''}" data-sev2-metric="${metric.key}" aria-pressed="${index===0}">${metric.icon} ${metric.label}</button>`).join('')}</div></div>
        <div class="sev2-controls">
          <div><span class="sev2-label">View</span><div class="sev2-views">${['daily','weekly','monthly','cumulative'].map((view,index)=>`<button class="sev2-button ${index===2?'is-active':''}" data-sev2-view="${view}" aria-pressed="${index===2}">${view[0].toUpperCase()+view.slice(1)}</button>`).join('')}</div></div>
          <label class="sev2-field">Period<select data-sev2-range><option value="year">Calendar year</option><option value="ytd">Year to date</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="lifetime">Lifetime</option><option value="custom">Custom range</option></select></label>
          <label class="sev2-field">Year<select data-sev2-year>${meta.availableYears.slice().reverse().map(year=>`<option value="${year}">${year}</option>`).join('')}</select></label>
          <label class="sev2-field">Compare<select data-sev2-compare><option value="">No comparison</option><option value="prior">Prior year</option><option value="all">All years</option>${meta.availableYears.slice().reverse().map(year=>`<option value="${year}">${year}</option>`).join('')}</select></label>
          <label class="sev2-field">Reference<select data-sev2-reference><option value="none">No reference</option><option value="period">Period average</option><option value="lifetime">Lifetime average</option></select></label>
        </div>
        <div class="sev2-custom" data-sev2-custom><label class="sev2-field">Start date<input type="date" data-sev2-start></label><label class="sev2-field">End date<input type="date" data-sev2-end></label></div>
        <div class="sev2-actions"><div data-sev2-chart-style><button class="sev2-button is-active" data-sev2-style="timeline">Timeline</button><button class="sev2-button" data-sev2-style="heatmap">Heatmap</button></div><button class="sev2-button sev2-reset" data-sev2-reset>Reset view</button></div>
      </div>
      <div class="sev2-summary"><article><span data-sev2-primary-label>Selected total</span><strong data-sev2-total>—</strong></article><article><span>Average interval</span><strong data-sev2-average>—</strong></article><article><span>Peak interval</span><strong data-sev2-peak>—</strong></article><article><span data-sev2-active-label>Active / measured</span><strong data-sev2-active>—</strong></article></div>
      <div class="sev2-chart-panel"><div class="sev2-chart-head"><div><strong data-sev2-title>Archive chart</strong><span data-sev2-subtitle></span></div><span data-sev2-unit></span></div><div class="sev2-chart" data-sev2-chart></div></div>
      <div class="sev2-insights"><article><span data-sev2-current-label>Current active streak</span><strong data-sev2-current>—</strong></article><article><span data-sev2-longest-label>Longest active streak</span><strong data-sev2-longest>—</strong></article><article><span data-sev2-best7-label>Best 7-day window</span><strong data-sev2-best7>—</strong></article><article><span data-sev2-best30-label>Best 30-day window</span><strong data-sev2-best30>—</strong></article></div>
      <div class="sev2-footer"><div class="sev2-series-legend" data-sev2-series></div><div class="sev2-legend"><span><i class="sev2-swatch" style="--swatch:#cbd5e1"></i>Before tracking</span><span><i class="sev2-swatch" style="--swatch:#e2e8f0"></i>Missing</span><span><i class="sev2-swatch" style="--swatch:#94a3b8"></i>Recorded zero</span><span><i class="sev2-swatch" style="--swatch:#f59e0b"></i>Partial day/period</span><span><i class="sev2-swatch" style="--swatch:#f1f5f9"></i>Future</span></div><div data-sev2-coverage></div><details class="sev2-details"><summary>How to read this graph</summary><p>Daily values are the source of truth. Weekly and monthly activity values are totaled, while average-based metrics such as sleep are averaged. Cumulative is a running total for activity metrics and a running average for average-based metrics. Recorded zero remains distinct from missing data, and dates before a metric began are not treated as zero.</p></details></div>`;
    old?.after(shell);
    if(!old)section.append(shell);

    const params=new URL(location.href).searchParams;
    let metricKey=(params.get('metric') as MetricKey)||'guitar';
    if(!METRICS[metricKey])metricKey='guitar';
    let view=(params.get('view') as ViewKey)||'monthly';
    if(!['daily','weekly','monthly','cumulative'].includes(view))view='monthly';
    let range=(params.get('range') as RangeKey)||'year';
    if(!['year','ytd','30','90','lifetime','custom'].includes(range))range='year';
    let style=params.get('chart')==='heatmap'?'heatmap':'timeline';

    const yearSelect=shell.querySelector('[data-sev2-year]') as HTMLSelectElement;
    const rangeSelect=shell.querySelector('[data-sev2-range]') as HTMLSelectElement;
    const compareSelect=shell.querySelector('[data-sev2-compare]') as HTMLSelectElement;
    const referenceSelect=shell.querySelector('[data-sev2-reference]') as HTMLSelectElement;
    const startInput=shell.querySelector('[data-sev2-start]') as HTMLInputElement;
    const endInput=shell.querySelector('[data-sev2-end]') as HTMLInputElement;
    const custom=shell.querySelector('[data-sev2-custom]') as HTMLElement;
    const chartHost=shell.querySelector('[data-sev2-chart]') as HTMLElement;
    const latestYear=Number((meta.latestCompleteDate||meta.dataThrough||'').slice(0,4))||meta.availableYears.at(-1)!;
    yearSelect.value=meta.availableYears.includes(Number(params.get('year')))?String(params.get('year')):String(latestYear);
    rangeSelect.value=range;
    compareSelect.value=params.get('compare')||'';
    referenceSelect.value=params.get('ref')||'none';
    const first=`${Math.min(...meta.availableYears)}-01-01`;
    const last=meta.dataThrough||iso(new Date());
    startInput.min=first;startInput.max=last;endInput.min=first;endInput.max=last;
    startInput.value=params.get('start')||first;endInput.value=params.get('end')||last;

    const updateButtons=()=>{
      shell.querySelectorAll<HTMLElement>('[data-sev2-metric]').forEach(button=>{const active=button.dataset.sev2Metric===metricKey;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
      shell.querySelectorAll<HTMLElement>('[data-sev2-view]').forEach(button=>{const active=button.dataset.sev2View===view;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
      custom.classList.toggle('is-visible',range==='custom');
      const comparable=['year','ytd'].includes(range);
      compareSelect.disabled=!comparable;
      yearSelect.disabled=!['year','ytd'].includes(range);
      const heatmapAllowed=view==='daily'&&['year','ytd'].includes(range)&&!compareSelect.value;
      if(!heatmapAllowed)style='timeline';
      shell.querySelectorAll<HTMLElement>('[data-sev2-style]').forEach(button=>button.classList.toggle('is-active',button.dataset.sev2Style===style));
      (shell.querySelector('[data-sev2-chart-style]') as HTMLElement).style.display=heatmapAllowed?'flex':'none';
      referenceSelect.disabled=view==='cumulative'||style==='heatmap';
    };

    const render=()=>{
      updateButtons();
      const metric=METRICS[metricKey];
      const year=Number(yearSelect.value);
      const bounds=calendarBounds(year,range,metric,meta,startInput.value,endInput.value);
      if(bounds.start>bounds.end){const swap=bounds.start;bounds.start=bounds.end;bounds.end=swap;}
      let years:number[]=[year];
      if(!compareSelect.disabled&&compareSelect.value==='all')years=meta.availableYears.slice().sort((a,b)=>a-b);
      else if(!compareSelect.disabled&&compareSelect.value==='prior'&&meta.availableYears.includes(year-1))years=[year,year-1];
      else if(!compareSelect.disabled&&Number(compareSelect.value)&&Number(compareSelect.value)!==year)years=[year,Number(compareSelect.value)];
      const comparison=years.length>1;
      const series:Series[]=years.map((itemYear,index)=>{
        let itemBounds=bounds;
        if(comparison){const mode=range==='ytd'?'ytd':'year';itemBounds=calendarBounds(itemYear,mode,metric,meta,startInput.value,endInput.value);}
        return{year:itemYear,color:itemYear===year?'#2563eb':YEAR_COLORS[(index+1)%YEAR_COLORS.length],selected:itemYear===year,dashed:itemYear!==year&&years.length===2,points:seriesFor(records,metric,view,itemBounds,meta)};
      });
      const selected=series.find(item=>item.selected)??series[0];
      const selectedMeasured=measured(selected.points);
      const total=view==='cumulative'
        ?[...selectedMeasured].reverse()[0]?.value??null
        :metric.aggregate==='average'
          ?average(selectedMeasured.map(point=>point.value))
          :sum(selectedMeasured.map(point=>point.value));
      const mean=average(selectedMeasured.map(point=>point.value));
      const peak=selectedMeasured.reduce<Point|null>((winner,point)=>!winner||(point.value??-Infinity)>(winner.value??-Infinity)?point:winner,null);
      setText(shell,'[data-sev2-primary-label]',metric.aggregate==='average'?(view==='cumulative'?'Running average':'Selected average'):'Selected total');
      setText(shell,'[data-sev2-active-label]',metric.aggregate==='average'?'Measured intervals':'Active / measured');
      setText(shell,'[data-sev2-current-label]',metric.aggregate==='average'?'Current recorded streak':'Current active streak');
      setText(shell,'[data-sev2-longest-label]',metric.aggregate==='average'?'Longest recorded streak':'Longest active streak');
      setText(shell,'[data-sev2-best7-label]',metric.aggregate==='average'?'Best 7-day average':'Best 7-day window');
      setText(shell,'[data-sev2-best30-label]',metric.aggregate==='average'?'Best 30-day average':'Best 30-day window');
      setText(shell,'[data-sev2-total]',`${fmt(total,metric.digits)} ${metric.unit}`);
      setText(shell,'[data-sev2-average]',`${fmt(mean,metric.digits)} ${metric.unit}`);
      setText(shell,'[data-sev2-peak]',peak?`${peak.label} · ${fmt(peak.value,metric.digits)} ${metric.unit}`:'No data');
      setText(shell,'[data-sev2-active]',metric.aggregate==='average'?`${selectedMeasured.length}`:`${selectedMeasured.filter(point=>(point.value??0)>0).length} / ${selectedMeasured.length}`);
      setText(shell,'[data-sev2-title]',`${metric.icon} ${metric.label} · ${range==='year'||range==='ytd'?year:'selected range'}`);
      setText(shell,'[data-sev2-subtitle]',`${view[0].toUpperCase()+view.slice(1)} values · ${prettyDate(bounds.start)}–${prettyDate(bounds.end)}`);
      setText(shell,'[data-sev2-unit]',metric.unit);
      setText(shell,'[data-sev2-coverage]',`Tracked since ${prettyDate(metric.start)}. Public daily coverage currently begins ${prettyDate(first)}; dates before that may require a historical baseline.`);

      const daily=seriesFor(records,metric,'daily',bounds,meta);
      const streak=streaks(daily);
      const best7=rollingBest(daily,7,metric),best30=rollingBest(daily,30,metric);
      setText(shell,'[data-sev2-current]',`${streak.current} day${streak.current===1?'':'s'}`);
      setText(shell,'[data-sev2-longest]',`${streak.longest} day${streak.longest===1?'':'s'}`);
      setText(shell,'[data-sev2-best7]',best7.value===null?'No data':`${fmt(best7.value,metric.digits)} ${metric.unit}${best7.start?` · ${shortDate(best7.start)}`:''}`);
      setText(shell,'[data-sev2-best30]',best30.value===null?'No data':`${fmt(best30.value,metric.digits)} ${metric.unit}${best30.start?` · ${shortDate(best30.start)}`:''}`);

      let reference:number|null=null,referenceLabel='';
      if(referenceSelect.value==='period'){reference=mean;referenceLabel=`Period avg ${fmt(reference,metric.digits)}`;}
      else if(referenceSelect.value==='lifetime'){reference=lifetimeReference(records,metric,view,meta);referenceLabel=`Lifetime avg ${fmt(reference,metric.digits)}`;}
      if(style==='heatmap')drawHeatmap(chartHost,daily,metric,year);
      else drawTimeline(chartHost,series,metric,view,reference,referenceLabel);
      const legend=shell.querySelector('[data-sev2-series]');
      if(legend)legend.innerHTML=series.map(item=>`<span><i class="sev2-swatch" style="--swatch:${item.color}"></i>${item.year??'Range'}${item.selected?' selected':''}</span>`).join('');

      const url=new URL(location.href);
      url.searchParams.set('metric',metricKey);url.searchParams.set('view',view);url.searchParams.set('range',range);url.searchParams.set('year',String(year));url.searchParams.set('chart',style);
      if(compareSelect.value&&!compareSelect.disabled)url.searchParams.set('compare',compareSelect.value);else url.searchParams.delete('compare');
      if(referenceSelect.value!=='none')url.searchParams.set('ref',referenceSelect.value);else url.searchParams.delete('ref');
      if(range==='custom'){url.searchParams.set('start',startInput.value);url.searchParams.set('end',endInput.value);}else{url.searchParams.delete('start');url.searchParams.delete('end');}
      history.replaceState({},'',url);
    };

    shell.querySelectorAll<HTMLElement>('[data-sev2-metric]').forEach(button=>button.addEventListener('click',()=>{metricKey=button.dataset.sev2Metric as MetricKey;render();}));
    shell.querySelectorAll<HTMLElement>('[data-sev2-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.sev2View as ViewKey;render();}));
    shell.querySelectorAll<HTMLElement>('[data-sev2-style]').forEach(button=>button.addEventListener('click',()=>{style=button.dataset.sev2Style==='heatmap'?'heatmap':'timeline';render();}));
    rangeSelect.addEventListener('change',()=>{range=rangeSelect.value as RangeKey;render();});
    [yearSelect,compareSelect,referenceSelect,startInput,endInput].forEach(control=>control.addEventListener('change',render));
    shell.querySelector('[data-sev2-reset]')?.addEventListener('click',()=>{metricKey='guitar';view='monthly';range='year';style='timeline';yearSelect.value=String(latestYear);rangeSelect.value='year';compareSelect.value='';referenceSelect.value='none';startInput.value=first;endInput.value=last;render();});
    render();
  }catch(error){
    status.textContent=error instanceof Error?error.message:'The archive explorer could not load.';
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else void init();
