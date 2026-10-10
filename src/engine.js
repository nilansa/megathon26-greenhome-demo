/* Lloyds PS2 deterministic model. All scenarios are estimates, never new EPCs. */
export const SCORE_WEIGHTS=Object.freeze({energyEfficiency:.25,energyIntensity:.20,insulation:.15,heating:.15,glazing:.10,renewables:.10,smartManagement:.05});
export const EMISSIONS_2026={electricity:.13096,gas:.18231}; // DESNZ 2026 UK grid Scope2 and gross-CV natural gas Scope1
export const UNIT_RATES_2026={electricity:.2632,gas:.0797}; // Ofgem October–December 2026, £/kWh
export const RETROFITS=[
{id:'loft',label:'Loft insulation',cost:900,description:'Lower heat loss through the roof.'},
{id:'smart',label:'Smart heating controls',cost:550,description:'Optimise heating schedules.'},
{id:'glazing',label:'Double glazing',cost:12000,description:'Reduce heat loss through inefficient windows.'},
{id:'heatPump',label:'Air-source heat pump',cost:11000,description:'Replace eligible gas space heating with efficient electricity.'},
{id:'solar',label:'Rooftop solar PV',cost:6100,description:'Reduce grid electricity imports.'}
];
export const MODEL=Object.freeze({gasSpaceHeatingShare:.80,loftSpaceHeatingSaving:.15,glazingSpaceHeatingSaving:.10,controlsSpaceHeatingSaving:.07,oldBoilerEfficiency:.85,heatPumpCOP:3,solarKw:3,solarYield:850,solarSelfUse:.40});
const EPC_SCORES={'A/B':92,C:72,D:56,E:38,'F/G':16,A:100,B:85,F:24,G:8};
const bands=[[80,'Highly efficient'],[65,'Good'],[50,'Moderate'],[30,'Poor'],[0,'Very poor']];
const clamp=x=>Math.max(0,Math.min(100,x));
const rnd=x=>Math.round(x*10)/10;
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
const gasMain=p=>p?.gasMainHeat===true||p?.heatingFuel==='Gas-main';
const registeredPV=p=>p?.solarRegistered===true||p?.solarInstalled===true;
const loftScheme=p=>p?.loftSchemeRecorded===true||p?.loftInsulated===true;
const wallScheme=p=>p?.cavitySchemeRecorded===true;
function measured(p){
  const e=num(p?.electricityKwh),g=num(p?.gasKwh);
  return e!==null&&g!==null&&e>=0&&g>=0&&e+g>0?{electricity:e,gas:g,total:e+g}:null;
}
export function scoreHome(p={}){
 const components=[],caveats=[];
 const add=(id,label,subscore,source,assumed=false)=>{
   components.push({id,label,weight:SCORE_WEIGHTS[id],subscore:clamp(subscore),contribution:rnd(SCORE_WEIGHTS[id]*clamp(subscore)),source,assumed});
   if(assumed)caveats.push(label+': '+source);
 };
 const epc=EPC_SCORES[p.epc];
 add('energyEfficiency','EPC energy efficiency',epc??50,epc===undefined?'Missing EPC; neutral assumption':'Observed NEED EPC band '+p.epc+'; documented monotonic ordinal mapping'+(['/A','A/B','F/G'].includes(p.epc)?' (source is grouped)':''),epc===undefined);
 const base=measured(p),area=num(p.floorAreaM2);
 if(base&&area>0){
   const intensity=base.total/area;
   add('energyIntensity','Purchased energy intensity',clamp(100-(intensity-75)*100/275),
      '2024 observed purchased kWh / estimated floor-band midpoint '+area+'m²; not exact property area',true);
 }else add('energyIntensity','Purchased energy intensity',50,'Missing energy/area: neutral, not zero',true);
 const ins=Number(loftScheme(p))+Number(wallScheme(p));
 add('insulation','Insulation evidence',ins===2?92:ins===1?75:50,
   ins>0?'Government-scheme insulation installation recorded; complete fabric condition unknown':'No government-scheme installation recorded; absence of record does NOT mean no insulation',ins===0);
 add('heating','Heating system',50,'NEED has only meter-derived gas-main fuel, not equipment efficiency; neutral assumption',true);
 add('glazing','Windows & glazing',p.glazing==='double'?85:p.glazing==='single'?25:50,
   p.glazing?'User-provided glazing, not NEED':'Glazing not in NEED; neutral assumption',!p.glazing);
 add('renewables','Renewables',registeredPV(p)?100:45,
   registeredPV(p)?'Registered MCS/FIT rooftop PV':'No solar PV in recorded schemes; unregistered systems may exist',!registeredPV(p));
 add('smartManagement','Smart energy management',p.smartControls===true?90:p.smartControls===false?25:50,
   p.smartControls==null?'Not in NEED; neutral assumption':'User-provided smart-control status',p.smartControls==null);
 const score=Math.round(components.reduce((a,c)=>a+c.weight*c.subscore,0));
 return {score,classification:bands.find(b=>score>=b[0])[1],components,provisional:caveats.length>0,caveats};
}
export function getEligibleRetrofits(p){
 if(!p)return[];
 const items=[];
 function add(id,suitability,reason,condition){
  const measure=RETROFITS.find(x=>x.id===id);
  items.push({...measure,suitability,reason,condition,feasible:true});
 }
 if(!loftScheme(p))add('loft','Medium','No government-scheme loft installation is recorded; home may nevertheless be well insulated.','Confirm insulation depth, loft suitability, ventilation, leaks and damp.');
 if(p.smartControls!==true)add('smart','Medium','NEED does not identify heating controls.','Confirm existing thermostat, zoning and compatible heating controls.');
 if(p.glazing!=='double')add('glazing','Low','NEED does not report glazing condition.','Only upgrade if glazing survey demonstrates need; check conservation constraints.');
 if(gasMain(p)&&num(p.gasKwh)>0)add('heatPump','Medium','Gas is inferred as the main heating fuel from meter matching.','Heat-loss survey, radiator/pipe sizing, electrical capacity and installer design required.');
 if(!registeredPV(p))add('solar','Medium','No PV system recorded in MCS/FIT fields.','Check roof, shade, structural strength, permissions and whether solar is already installed.');
 return items;
}
function postEnergy(p,selected){
 const base=measured(p);if(!base)return null;
 const ids=new Set(selected);
 const heatingGas=gasMain(p)?base.gas*MODEL.gasSpaceHeatingShare:0;
 const nonHeatingGas=base.gas-heatingGas;
 let factor=1;
 if(ids.has('loft'))factor*=1-MODEL.loftSpaceHeatingSaving;
 if(ids.has('glazing'))factor*=1-MODEL.glazingSpaceHeatingSaving;
 if(ids.has('smart'))factor*=1-MODEL.controlsSpaceHeatingSaving;
 let gas=nonHeatingGas+heatingGas*factor,elec=base.electricity;
 if(ids.has('heatPump')&&heatingGas>0){
   gas=nonHeatingGas;
   elec+=heatingGas*factor*MODEL.oldBoilerEfficiency/MODEL.heatPumpCOP;
 }
 const electricityDemand=elec;
 if(ids.has('solar'))elec=Math.max(0,elec-MODEL.solarKw*MODEL.solarYield*MODEL.solarSelfUse);
 return {electricity:rnd(elec),gas:rnd(gas),total:rnd(elec+gas),
  electricityDemand:rnd(electricityDemand),solarSelfUsedKwh:rnd(electricityDemand-elec)};
}
function difference(base,after,opts={}){
 if(!base||!after)return{electricity:null,gas:null,total:null,percent:null,co2Kg:null,annualPounds:null};
 const elec=rnd(base.electricity-after.electricity),gas=rnd(base.gas-after.gas);
 return{electricity:elec,gas,total:rnd(elec+gas),percent:base.total>0?rnd(100*(elec+gas)/base.total):null,
  co2Kg:rnd(elec*EMISSIONS_2026.electricity+gas*EMISSIONS_2026.gas),
  annualPounds:Math.round(elec*(num(opts.electricityPrice)??UNIT_RATES_2026.electricity)+gas*(num(opts.gasPrice)??UNIT_RATES_2026.gas))};
}
const ORDER=['loft','glazing','smart','heatPump','solar'];
export function simulateScenario(property,selectedIds=[],opts={}){
 const base=measured(property),allowed=new Set(getEligibleRetrofits(property).filter(x=>x.feasible).map(x=>x.id));
 const ids=[...new Set(selectedIds)].filter(id=>allowed.has(id)).sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
 const after=postEnergy(property,ids),savings=difference(base,after,opts);
 const cost=ids.reduce((a,id)=>a+RETROFITS.find(x=>x.id===id).cost,0);
 let prev=base; const details=[];
 for(let i=0;i<ids.length;i++){
  const next=postEnergy(property,ids.slice(0,i+1)),entry=RETROFITS.find(x=>x.id===ids[i]);
  details.push({id:entry.id,label:entry.label,cost:entry.cost,marginalSavings:difference(prev,next,opts),after:next});
  prev=next;
 }
 const value=num(opts.value),validValue=value!==null&&value>0,upper=ids.length?1.6:0;
 const valueImpact={minPct:0,maxPct:upper,baseValue:validValue?value:null,minPounds:validValue?0:null,maxPounds:validValue?Math.round(value*upper/100):null,
  disclaimer:'Not a property-value prediction. Nationwide observed around 1.6% A/B vs D owner-occupied price association after controls; no EPC improvement or causal effect is established by this simulator. 0–1.6% is illustrative sensitivity only.'};
 return{baseline:base,after,savings,cost,details,selectedIds:ids,paybackYears:savings.annualPounds>0?rnd(cost/savings.annualPounds):null,valueImpact,unavailable:!base,
  assumptions:[
  'Observed anonymised NEED 2024 consumption is real; gas was weather-corrected; readings are rounded to nearest 100kWh.',
  '80% of gas is assumed space heating if meter-derived gas-main heating.',
  'Lloyds illustrative space-heating savings loft 15%, glazing 10%, controls 7%; compounded, not added.',
  'Heat pump assumes previous boiler 85% efficient and annual COP 3.0; electricity increases.',
  'Solar scenario 3kWp × 850kWh/kWp/yr × 40% self-consumed; reduces grid import, not demand.',
  '2026 DESNZ electricity grid scope 2=0.13096 and natural gas gross-CV scope 1=0.18231kgCO2e/kWh.',
  'Ofgem Oct–Dec 2026 Direct Debit average tariffs 26.32p electricity and 7.97p gas per kWh; standing charges unchanged.',
  'Retrofit prices use Energy Saving Trust estimates; no grant, installer quote, export credit or EPC recertification.',
  'No thermal survey, comfort measurement or causal property-value uplift is inferred.'
  ],
  conditionalMeasures:ids.map(id=>getEligibleRetrofits(property).find(x=>x.id===id)?.condition).filter(Boolean)
 };
}
export function optimiseUnderBudget(p,budget,opts={}){
 const candidates=getEligibleRetrofits(p).filter(x=>x.feasible),cap=budget===Infinity?Infinity:Math.max(0,num(budget)??0);
 let best=simulateScenario(p,[],opts),bestIds=[],explored=0;
 for(let mask=0;mask<(1<<candidates.length);mask++){
  const ids=candidates.filter((r,i)=>mask&(1<<i)).map(r=>r.id);
  if(ids.reduce((a,id)=>a+RETROFITS.find(x=>x.id===id).cost,0)>cap)continue;
  explored++;const scenario=simulateScenario(p,ids,opts);
  if(!scenario.unavailable&&(scenario.savings.total??-Infinity)>(best.savings.total??-Infinity)+.01){
   best=scenario;bestIds=ids;
  }
 }
 return{selectedIds:bestIds,scenario:best,explored,notes:'Most annual purchased kWh saved within the budget across preliminary candidates; survey-dependent, not a guarantee.'};
}
export function computeImprovementPotential(p,opts={}){
 if(!measured(p))return null;
 return optimiseUnderBudget(p,Infinity,opts).scenario.savings.percent;
}
