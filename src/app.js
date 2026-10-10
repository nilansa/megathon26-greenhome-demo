import {SCORE_WEIGHTS,RETROFITS,scoreHome,getEligibleRetrofits,simulateScenario,optimiseUnderBudget,computeImprovementPotential} from './engine.js';

const app=document.getElementById('app');
const state={properties:[],metadata:null,currentId:null,selected:[],budget:9000,value:'',ranked:[]};
const fmt=n=>n===null||n===undefined||!Number.isFinite(n)?'—':new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(n);
const gbp=n=>n===null||n===undefined||!Number.isFinite(n)?'—':(n<0?'−':'')+'£'+fmt(Math.abs(n));
const safe=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatSaved=n=>n===null||n===undefined?'—':(n<0?'−':'')+fmt(Math.abs(n));
const getProperty=()=>state.properties.find(p=>p.id===state.currentId)||state.properties[0];
function fuelRow(label,base,after,max){
 const a=Number(base)||0,b=Number(after)||0;
 return `<div><div class="fuel-title"><span>${label}</span><span>${fmt(a)} → <b style="color:#27966f">${fmt(b)} kWh</b></span></div>
 <div class="fuel-track"><div class="before" style="width:${Math.min(100,a/max*100)}%"></div></div>
 <div class="fuel-track"><div class="after" style="width:${Math.min(100,b/max*100)}%"></div></div></div>`;
}
function componentRow(c){
 return `<div class="component-row" title="${safe(c.source)}">
 <div class="meta"><span class="name">${safe(c.label)}</span>
 <span class="numbers">${Math.round(c.subscore)}/100 · ${Math.round(c.weight*100)}% · <b>${c.contribution.toFixed(1)} pts</b></span></div>
 <div class="track"><div class="bar" style="width:${c.subscore}%"></div></div>
 <div class="source">${c.assumed?'<em>Estimated/assumed</em> · ':'Observed/recorded · '}${safe(c.source)}</div></div>`;
}
function recommendationRow(r,p){
 const selected=state.selected.includes(r.id),single=simulateScenario(p,[r.id]);
 const saving=single.savings.total;
 return `<label class="retrofit-item ${selected?'selected':''}" title="${safe(r.condition)}">
 <input type="checkbox" data-retrofit="${r.id}" ${selected?'checked':''} aria-label="Select ${safe(r.label)}">
 <div><div class="name">${safe(r.label)} <span class="pill ${r.suitability==='Low'?'amber':'green'}" style="padding:3px 7px;font-size:9px">${safe(r.suitability)} suitability</span></div>
 <div class="info">${safe(r.reason)}</div><div class="info"><b>Condition:</b> ${safe(r.condition)}</div></div>
 <div class="right">${gbp(r.cost)}<small>${saving!==null?(saving<0?'−':'')+fmt(Math.abs(saving))+' kWh/yr':'Estimate N/A'}</small></div>
 </label>`;
}
function kpi(label,value,sub,icon,extra=''){
 return `<div class="card kpi"><div class="top"><span>${label}</span><span class="sign">${icon}</span></div><strong class="${extra}">${value}</strong><div class="sub">${sub}</div></div>`;
}
function render(){
 const p=getProperty();
 if(!p){app.innerHTML='<main class="load-screen"><h2>No eligible household records</h2><p>Regenerate the dataset and verify that both 2024 reading flags are valid.</p></main>';return;}
 const s=scoreHome(p),el=getEligibleRetrofits(p),v=state.value?Number(state.value):null;
 const sc=simulateScenario(p,state.selected,{value:v}),base=sc.baseline,after=sc.after,sv=sc.savings;
 const totalRank=state.ranked.findIndex(item=>item.id===p.id)+1;
 const componentHtml=s.components.map(componentRow).join('');
 const eligHtml=el.map(r=>recommendationRow(r,p)).join('');
 const used=state.selected.length, maxEnergy=Math.max(base?.gas||1,base?.electricity||1,after?.gas||1,after?.electricity||1);
 const potential=computeImprovementPotential(p);
 const poorCount=state.properties.filter(x=>scoreHome(x).score<50).length;
 const propertyOptions=state.ranked.map((item,i)=>`<option value="${safe(item.id)}" ${p.id===item.id?'selected':''}>${safe(item.id)} · EPC ${safe(item.epc)} · ${safe(item.region)} · potential ${item.potential===null?'N/A':Math.round(item.potential)+'%'}</option>`).join('');
 const hasHeatPump=state.selected.includes('heatPump'), changeElec=sv.electricity??0;
 const relation=hasHeatPump&&changeElec<0 ? 'As expected, the heat pump reduces purchased gas while increasing electricity. The two changes are shown separately.' :
   'Green energy savings reflect modelled grid imports plus gas consumption, not just a change in demand.';
 const valueText=state.value?`<strong>${gbp((sc.valueImpact.baseValue||0)+sc.valueImpact.minPounds)} – ${gbp((sc.valueImpact.baseValue||0)+sc.valueImpact.maxPounds)}</strong>`:
   '<strong>Enter a current home valuation</strong>';
 const totalKwh=base?base.total:null;
 const status=p.gasMainHeat?'Gas inferred as main heat':'Gas not established as main heat';
 app.innerHTML=`<div class="app-shell">
 <aside class="sidebar" aria-label="Navigation">
  <div class="brand"><span class="brand-icon" aria-hidden="true">⌂</span><div>GreenHome<span class="tiny">RETROFIT LAB</span></div></div>
  <div class="side-label">Workspace</div>
  <a class="side-link active" href="#overview"><span class="ico">▦</span> Home overview</a>
  <a class="side-link" href="#retrofits"><span class="ico">◈</span> Retrofit planner</a>
  <a class="side-link" href="#impact"><span class="ico">↗</span> Energy & impact</a>
  <a class="side-link" href="#methodology"><span class="ico">◷</span> Data & methods</a>
  <div class="side-bottom"><span class="micro">Pilot-inspired insight</span><strong>Measure twice. Retrofit once.</strong>
    <p>Low energy use is not always a warm, efficient home. Lloyds’ thermal pilot highlights why better evidence can change investment decisions.</p></div>
 </aside>
 <main class="workspace" id="overview">
 <div class="topline"><div class="breadcrumb"><div class="mobile-brand"><span class="brand-icon" style="width:27px;height:27px;font-size:16px">⌂</span> GreenHome</div><span> / </span><span class="current">Household analysis</span></div>
 <div class="top-pills"><span class="pill"><span class="dot"></span> 2024 validated NEED records</span><span class="pill">Independent hackathon prototype</span></div></div>
 <div class="heading-row"><div><p class="eyebrow">Smarter homes, better decisions</p>
 <h1>Your home, explained.<br>Every upgrade, considered.</h1>
 <p class="subtitle">Explore anonymised real UK homes and test retrofit plans with transparent, fuel-by-fuel calculations. Not an official Lloyds Bank product.</p></div>
 <span class="pill dark">${state.properties.length} real anonymised records · ${poorCount} flagged poor</span></div>
 <section class="hero-grid" aria-label="Home efficiency">
  <div class="card score-card">
   <div class="score-ring" style="--pct:${s.score}"><div class="ring-inner"><strong>${s.score}</strong><small>out of 100</small></div></div>
   <div class="score-details"><span class="label">Lloyds-defined Green Home Score</span>
   <h2>${safe(s.classification)}</h2>
   <span class="pill green">Recorded EPC ${safe(p.epc)}</span><span class="pill amber">Provisional score</span>
   <p>Weighted from seven required components, using the official 25 / 20 / 15 / 15 / 10 / 10 / 5 allocation. Unknown attributes are explicitly imputed.</p></div>
  </div>
  <div class="card property-card">
   <div><div class="card-caption"><strong>Explore a home</strong><span class="pill green">Real NEED sample</span></div>
    <label for="property-select" class="label">Anonymised household ID</label>
    <div class="select-wrap" style="margin-top:7px"><select id="property-select">${propertyOptions}</select></div>
   </div>
   <div class="property-features">
    <span class="feature-tag">${safe(p.propertyType)}</span><span class="feature-tag">${safe(p.region)}</span>
    <span class="feature-tag">${safe(p.floorAreaBandLabel)} floor band</span><span class="feature-tag">${status}</span>
   </div>
   <div class="property-note">Sample ranking #${totalRank} of ${state.properties.length} by modelled improvement potential. Property ID is generated; source records contain no address.</div>
  </div>
 </section>
 <section class="summary-grid" aria-label="Key performance indicators">
 ${kpi('Observed 2024 purchased energy',fmt(totalKwh)+' kWh','Electricity + weather-adjusted gas','⚡')}
 ${kpi('Potential (feasible scenarios)',potential===null?'N/A':potential.toFixed(1)+'%','Maximum modelled annual reduction','↘')}
 ${kpi('Selected package carbon',sv.co2Kg===null?'N/A':fmt(sv.co2Kg)+' kg','Estimated annual CO₂e reduction','♻','delta')}
 ${kpi('Selected package bill saving',sv.annualPounds===null?'N/A':gbp(sv.annualPounds),'Estimated annual variable-energy cost','£','delta')}
 </section>
 <div class="section-title" id="retrofits"><div><h2>Explore your retrofit potential</h2><p>Real home characteristics, documented rules, measurable scenarios.</p></div><span class="pill">${el.length} candidates · all subject to checks</span></div>
 <div class="two-grid">
  <section class="card breakdown-card"><div class="card-head"><div><h3>Why this home scored ${s.score}</h3><div class="note">Every factor, weight and assumption is visible.</div></div><span class="pill green">7 components</span></div>
   <div class="component-list">${componentHtml}</div>
   <div class="warn"><b>Evidence warning:</b> NEED flags record participation in installation schemes, not a full building survey. A low energy bill may also reflect under-heating. This is not a certified EPC.</div>
  </section>
  <section class="card retrofit-card"><div class="card-head"><div><h3>Build your improvement plan</h3><div class="note">Select an upgrade or let the engine optimise within your budget.</div></div><span class="pill">Survey-dependent</span></div>
    <div class="budget-head"><span class="label">Available upgrade budget</span><strong id="budget-value">${gbp(state.budget)}</strong></div>
    <input id="budget" aria-label="Retrofit budget" type="range" min="0" max="30000" step="500" value="${state.budget}">
    <div class="ctlrow"><div class="small-note">Capital costs from Energy Saving Trust;<br>grants or financing not assumed.</div><button id="optimise" class="btn primary">↗ Find best plan</button></div>
    <div class="retrofit-list">${eligHtml||'<p class="muted">No supported retrofit candidates for this record.</p>'}</div>
    <div class="selected-bar"><span><b>${used} selected</b> · ordered by building dependencies</span><div><button id="clear" class="btn outline tiny" style="margin-right:8px">Clear</button><strong>${gbp(sc.cost)}</strong></div></div>
  </section>
 </div>
 <div class="section-title" id="impact"><div><h2>See the difference</h2><p>Scenarios are recalculated from a single baseline—never summed blindly.</p></div><span class="pill green">Modelled, not guaranteed</span></div>
 <div class="chart-grid">
  <section class="card energy-card">
   <div class="card-head"><div><h3>Annual energy: before vs after</h3><div class="note">Purchased grid electricity and gas, in kWh/year.</div></div><span class="pill dark">${sv.percent===null?'Unavailable':sv.percent.toFixed(1)+'% less purchased'}</span></div>
   <div class="fuel-bars">
   ${base&&after?fuelRow('Grid electricity',base.electricity,after.electricity,maxEnergy)+fuelRow('Natural gas',base.gas,after.gas,maxEnergy):'<p>Insufficient data for a fuel comparison.</p>'}
   </div><div class="legend"><span><i class="square"></i>Actual 2024 baseline</span><span><i class="square after"></i>Modeled after upgrades</span></div>
   <div class="energy-notice">${relation} <b>Electricity change: ${formatSaved(sv.electricity)} kWh saved; gas change: ${formatSaved(sv.gas)} kWh saved.</b></div>
  </section>
  <section class="card money-card">
    <div class="card-head"><div><h3>Package economics</h3><div class="note">Scenarios use official 2026 tariff and carbon factors.</div></div><span class="pill">Indicative</span></div>
    <div class="figures"><span>One-time installation cost</span><strong>${gbp(sc.cost)}</strong></div>
    <div class="figures"><span>Annual purchased energy saving</span><strong class="${sv.total>=0?'positive':'negative'}">${formatSaved(sv.total)} kWh</strong></div>
    <div class="figures"><span>Electricity saving (negative = increase)</span><strong class="${sv.electricity>=0?'positive':'negative'}">${formatSaved(sv.electricity)} kWh</strong></div>
    <div class="figures"><span>Gas saving</span><strong>${formatSaved(sv.gas)} kWh</strong></div>
    <div class="figures"><span>Annual carbon reduction</span><strong class="${sv.co2Kg>=0?'positive':'negative'}">${fmt(sv.co2Kg)} kg CO₂e</strong></div>
    <div class="figures"><span>Annual estimated variable bill saving</span><strong class="${sv.annualPounds>=0?'positive':'negative'}">${gbp(sv.annualPounds)}</strong></div>
    <div class="figures" style="border-bottom:none"><span>Simple payback (excludes finance & maintenance)</span><strong>${sc.paybackYears===null?'Not positive / unavailable':sc.paybackYears+' years'}</strong></div>
    <p>Values may vary by tariff, actual heating demand, occupant comfort, roof suitability, installer design and retrofit interactions.</p>
  </section>
 </div>
 <div class="section-title" id="value"><div><h2>Could your home become more valuable?</h2><p>Indicative market sensitivity only—there is no causal retrofit-value model in NEED.</p></div></div>
 <section class="card money-card">
  <div class="money-section">
   <div style="max-width:520px"><h3>Illustrative property-value scenario</h3><p>Enter a current valuation to see a cautious 0–1.6% price sensitivity based on Nationwide's controlled A/B vs D association. The simulator cannot establish an EPC upgrade or predict an actual sale price.</p>
    <div class="value-entry"><label for="home-value" class="label">Your independent home-value estimate (£)</label><input id="home-value" type="number" min="0" step="10000" placeholder="e.g. 280000" value="${safe(state.value)}"></div></div>
   <div style="min-width:240px"><div class="label">Illustrative possible value range</div><div style="margin:11px 0">${valueText}</div>
   <span class="pill amber">Not an appraisal or promised increase</span></div>
  </div>
 </section>
 <div class="section-title" id="methodology"><div><h2>Our evidence trail</h2><p>Clear source attribution, a reproducible model, and no invented household history.</p></div></div>
 <details class="card methods-card">
  <summary>View data sources, formulas and limitations <span class="pill green">Transparent by design</span></summary>
  <div class="method-content">
    <p><b>Observed:</b> selected anonymised UK NEED 2026 sample record with validated 2024 consumption flags V. Gas is weather corrected, and figures are rounded to 100 kWh. EPC rating groups are recorded as A/B, C, D, E, F/G; floor area is binned, not exact.</p>
    <p><b>Assumed:</b> age and region are recorded, but loft/cavity scheme flags cannot prove whether insulation exists outside those schemes. Glazing, controls, indoor comfort and value are not included. Score substitutes neutral evidence where unavailable, displayed component by component.</p>
    <p><b>Physics:</b> heating-related changes multiply baseline space-heating energy; heat pump raises electricity while lowering gas; solar offsets grid imports after changes. 2026 DESNZ factors and Ofgem tariffs are fuel-specific. Property-value sensitivity is not a regression prediction.</p>
    <p><b>Open resources:</b></p>
    <ul>
      <li><a target="_blank" rel="noopener noreferrer" href="https://www.gov.uk/government/statistics/national-energy-efficiency-data-framework-need-anonymised-data-2026">DESNZ NEED 2026 anonymised property-level data and metadata</a></li>
      <li><a target="_blank" rel="noopener noreferrer" href="https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026">DESNZ greenhouse-gas conversion factors 2026</a></li>
      <li><a target="_blank" rel="noopener noreferrer" href="https://www.ofgem.gov.uk/your-energy-supply/your-energy-bill/energy-price-cap-unit-rates-and-standing-charges">Ofgem electricity and gas tariffs Oct–Dec 2026</a></li>
      <li><a target="_blank" rel="noopener noreferrer" href="https://energysavingtrust.org.uk/retrofit-explained/">Energy Saving Trust approximate installation costs</a></li>
      <li><a target="_blank" rel="noopener noreferrer" href="https://www.nationwide.co.uk/media/hpi/reports/energy-efficiency-ratings-have-limited-impact-on-owner-occupied-house-prices-despite-increased-interest-in-going-green">Nationwide property price premium research</a></li>
      <li><a target="_blank" rel="noopener noreferrer" href="https://www.lloydsbank.com/assets/assets-business-banking/pdfs/lb-pilot-study-report-the-science-behind-the-insights.pdf">Lloyds: science behind measured retrofit insights (121-home pilot)</a></li>
    </ul>
    <p><b>Engineering:</b> small selected scenarios, deterministic JS calculations, no real customer identifiers, no background LLM estimation. Unavailable information is never silently set to zero.</p>
   </div>
 </details>
 <footer class="footer"><span>GreenHome Retrofit Lab · Built for Megathon X 2026 · Independent proof-of-concept</span>
 <span>Source: DESNZ NEED 2026 · 2024 readings · Not individual retrofit, valuation or financial advice</span></footer>
 </main></div>`;
 document.getElementById('property-select').addEventListener('change',ev=>{
   state.currentId=ev.target.value;const home=getProperty();state.selected=optimiseUnderBudget(home,state.budget,{value:Number(state.value)||null}).selectedIds;render();
 });
 document.querySelectorAll('[data-retrofit]').forEach(box=>box.addEventListener('change',ev=>{
  if(ev.target.checked)state.selected=[...new Set([...state.selected,ev.target.dataset.retrofit])];
  else state.selected=state.selected.filter(id=>id!==ev.target.dataset.retrofit);
  render();
 }));
 document.getElementById('optimise').addEventListener('click',()=>{
  state.selected=optimiseUnderBudget(getProperty(),state.budget,{value:Number(state.value)||null}).selectedIds;
  render();document.getElementById('retrofits').scrollIntoView({block:'start',behavior:'smooth'});
 });
 document.getElementById('clear').addEventListener('click',()=>{state.selected=[];render()});
 document.getElementById('budget').addEventListener('input',ev=>{
  state.budget=Number(ev.target.value);document.getElementById('budget-value').textContent=gbp(state.budget);
 });
 document.getElementById('budget').addEventListener('change',()=>render());
 document.getElementById('home-value').addEventListener('change',ev=>{state.value=ev.target.value;render()});
}
async function init(){
 try{
  const source=new URL('../data/properties.json',import.meta.url);
  const r=await fetch(source);
  if(!r.ok)throw Error('GET '+r.status+' when reading '+source);
  const json=await r.json();
  state.properties=Array.isArray(json)?json:json.properties;
  state.metadata=json.metadata||{};
  if(!Array.isArray(state.properties)||!state.properties.length)throw Error('No validated NEED properties');
  state.ranked=state.properties.map(p=>({...p,potential:computeImprovementPotential(p)})).sort((a,b)=>(b.potential??-1)-(a.potential??-1));
  const featured=state.ranked.find(p=>p.epc==='E'&&p.gasMainHeat)||state.ranked[0];
  state.currentId=featured.id;
  state.selected=optimiseUnderBudget(featured,state.budget).selectedIds;
  render();
 }catch(err){
  console.error(err);
  app.innerHTML=`<main class="load-screen"><h2>Could not load the official data subset</h2><p>${safe(err.message)}</p><p>Please serve the repository using a local HTTP server, not <code>file://</code>.</p></main>`;
 }
}
init();
