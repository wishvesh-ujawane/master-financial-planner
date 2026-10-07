import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, CalendarDays, Check, ChevronRight, CircleHelp, Coins, Download, DownloadCloud, FileUp, Flag, House, Landmark, Leaf, LockKeyhole, LogIn, LogOut, Pencil, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, Target, Trash2, TrendingUp, UploadCloud, User, Wallet, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { blankPlan, compact, currency, effectiveReturns, effectiveReturnForYears, emptyPlan, loadPlan, normalizePlan, requiredSipAllocation, savePlan, type Goal, type Holding, type LineItem, type PlanData } from '@/lib/planner-store';
import { backupToDrive, getBackupMeta, restoreFromDrive } from '@/lib/drive-backup';
import { loadVault, saveVault, type VaultData } from '@/lib/vault-store';
import { VaultPage } from '@/components/vault-page';
import { Notice } from '@/components/notice';
import { useAuth, type AuthState } from '@/lib/use-auth';

type Kind = 'holding'|'asset'|'liability'|'goal'|'inflow'|'outflow'|'assumption';
type FormRecord = Record<string, string | number>;
const NAV = [
  { href:'/', label:'Overview', icon:Activity }, { href:'/assumptions', label:'Assumptions', icon:SlidersHorizontal },
  { href:'/cash-flow', label:'Cash flow', icon:ArrowUpRight }, { href:'/net-worth', label:'Net worth', icon:Landmark },
  { href:'/investments', label:'Investments', icon:TrendingUp }, { href:'/goals', label:'Goals', icon:Flag },
];
const CATEGORIES = [
  'All holdings',
  'Domestic stocks · Large cap','Domestic stocks · Mid cap','Domestic stocks · Small cap',
  'US equity · Index fund','US equity · ETF',
  'Mutual funds · Large cap','Mutual funds · Mid cap','Mutual funds · Small cap','Mutual funds · Flexi cap','Mutual funds · Index','Mutual funds · Debt',
  'ETF · Domestic equity','ETF · International equity','Smallcase',
  'Debt funds','Cash & deposits · Savings account','Cash & deposits · Cash','Cash & deposits · Liquid fund','Fixed deposits',
  'Government investments · EPF/PPF/VPF','Real estate','REITs',
  'Gold · SGB','Gold · Gold ETF','Gold · Jewellery','Crypto','Miscellaneous · ULIP/insurance','Miscellaneous',
];
const ITEM_GROUPS = ['Home & property','Other real estate','Jewellery','SGB','ULIP/insurance','EPF/PPF/VPF','Fixed deposit','Debt fund','Domestic equity','US equity','Mutual fund','Smallcase','Savings account','Cash','Liquid fund','Gold ETF','Crypto','REITs','Vehicle','Other'];
const GROUPS: Record<Kind,string> = { holding:'Investments',asset:'Assets',liability:'Liabilities',goal:'Goals',inflow:'Income',outflow:'Monthly expenses',assumption:'Return assumption' };
const FIELDS: Record<Kind,{key:string;label:string;type?:string;hint:string}[]> = {
  holding:[
    {key:'name',label:'Name',hint:'A short label for this holding, e.g. “HDFC Bank” or “Nifty 50 Index Fund”.'},
    {key:'category',label:'Category',hint:'The asset class this holding belongs to. Drives your allocation and net-worth breakdown.'},
    {key:'value',label:'Current value',type:'number',hint:'What this holding is worth today at current market price (₹).'},
    {key:'invested',label:'Total contributed',type:'number',hint:'Total money you have put in so far across all purchases/SIPs (₹). Used to show your gain or loss.'},
    {key:'sip',label:'Monthly SIP',type:'number',hint:'Amount you invest into this holding every month (₹). Enter 0 if it is a one-time holding.'},
    {key:'note',label:'Note',hint:'Optional reminder — account, folio number, or anything you want to remember.'},
  ],
  asset:[
    {key:'name',label:'Particular',hint:'What the asset is, e.g. “Home · Pune” or “Car”.'},
    {key:'group',label:'Type',hint:'The kind of asset. Used to group your net worth.'},
    {key:'amount',label:'Current value',type:'number',hint:'Today’s resale or market value of this asset (₹).'},
  ],
  liability:[
    {key:'name',label:'Particular',hint:'What you owe on, e.g. “Home loan” or “Credit card”.'},
    {key:'group',label:'Type',hint:'The kind of borrowing this is.'},
    {key:'amount',label:'Outstanding',type:'number',hint:'The balance still left to repay (₹), not the original loan amount.'},
  ],
  goal:[
    {key:'name',label:'What are you saving for?',hint:'The thing you are saving toward, e.g. “Child’s education” or “Retirement”.'},
    {key:'priority',label:'Priority',hint:'How important this goal is. Higher-priority goals are funded first in the plan.'},
    {key:'years',label:'Years from now',type:'number',hint:'In how many years you will need this money.'},
    {key:'current',label:'Already set aside',type:'number',hint:'Money you have already saved toward this specific goal (₹).'},
    {key:'target',label:'Today’s target',type:'number',hint:'What the goal costs in today’s prices (₹). Inflation is added on top automatically.'},
    {key:'inflation',label:'Inflation assumption (%)',type:'number',hint:'Yearly % you expect this goal’s cost to rise. 6 is a common default in India.'},
    {key:'stepUp',label:'Annual SIP step-up (%)',type:'number',hint:'Yearly % increase in your monthly SIP, e.g. as your income grows. Use 0 for a flat SIP.'},
    {key:'sip',label:'Monthly SIP today',type:'number',hint:'Amount you can invest toward this goal each month right now (₹).'},
  ],
  inflow:[
    {key:'name',label:'Income source',hint:'Where the money comes from, e.g. “Salary” or “Rent received”.'},
    {key:'group',label:'Type',hint:'The kind of income this is.'},
    {key:'amount',label:'Monthly amount',type:'number',hint:'Amount received each month (₹). Use a monthly average for variable income.'},
  ],
  outflow:[
    {key:'name',label:'Expense',hint:'What the spending is, e.g. “Rent” or “Groceries”.'},
    {key:'group',label:'Type',hint:'Essential (must-pay) or Flexible (can cut back if needed).'},
    {key:'amount',label:'Monthly amount',type:'number',hint:'Typical amount you spend on this each month (₹).'},
  ],
  assumption:[
    {key:'className',label:'Asset class',hint:'The asset class this expected return and horizon mix applies to.'},
    {key:'expectedReturn',label:'Expected return (%)',type:'number',hint:'Annual return you expect from this asset class over the long run (%).'},
    {key:'shortWeight',label:'Short-term mix (<3y, %)',type:'number',hint:'Share of a short-term goal (under 3 years) held in this asset class (%). Each horizon column should total 100 across all classes.'},
    {key:'mediumWeight',label:'Medium-term mix (3–6y, %)',type:'number',hint:'Share of a medium-term goal (3–6 years) held in this asset class (%).'},
    {key:'longWeight',label:'Long-term mix (>6y, %)',type:'number',hint:'Share of a long-term goal (over 6 years) held in this asset class (%).'},
  ],
};
function App() {
  const [startup] = useState(() => {
    try { return { plan: loadPlan(), message: '' }; }
    catch (error) { return { plan: blankPlan(), message: error instanceof Error ? error.message : 'Saved data could not be loaded.' }; }
  });
  const [plan,setPlan] = useState<PlanData>(startup.plan);
  const [vault,setVault] = useState<VaultData>(() => loadVault());
  const [canSave,setCanSave] = useState(!startup.message.startsWith('Saved planner data'));
  const [storageMessage,setStorageMessage] = useState(startup.message);
  const [modal,setModal] = useState<{kind:Kind;record?:FormRecord;id?:string}|null>(null);
  const [toast,setToast] = useState('');
  const [location] = useLocation();
  const auth = useAuth();
  useEffect(()=>{
    if(!canSave)return;
    try { savePlan(plan); setStorageMessage(''); }
    catch { setStorageMessage('Changes could not be saved in this browser. Export a backup or allow site storage before continuing.'); }
  },[plan,canSave]);
  useEffect(()=>{ saveVault(vault); },[vault]);
  useEffect(()=>{ if(!toast)return;const t=window.setTimeout(()=>setToast(''),2600);return()=>window.clearTimeout(t);},[toast]);
  const notify=(s:string)=>setToast(s);
  const updatePlan=(next:PlanData|((p:PlanData)=>PlanData))=>{setCanSave(true);setPlan(next);};
  const remove=(kind:Kind,id:string)=>{
    if(!window.confirm(`Remove this ${GROUPS[kind].toLowerCase()} entry?`)) return;
    updatePlan(p=>{
      if(kind==='holding')return {...p,sampleData:false,holdings:p.holdings.filter(x=>x.id!==id)};
      if(kind==='asset')return {...p,sampleData:false,assets:p.assets.filter(x=>x.id!==id)};
      if(kind==='liability')return {...p,sampleData:false,liabilities:p.liabilities.filter(x=>x.id!==id)};
      if(kind==='goal')return {...p,sampleData:false,goals:p.goals.filter(x=>x.id!==id)};
      if(kind==='inflow'||kind==='outflow')return {...p,sampleData:false,[kind==='inflow'?'inflows':'outflows']:p[kind==='inflow'?'inflows':'outflows'].filter(x=>x.id!==id)};
      return {...p,sampleData:false,assumptions:p.assumptions.filter((_,i)=>String(i)!==id)};
    });
    notify('Entry removed');
  };
  const persist=(kind:Kind,values:FormRecord,id?:string)=>{
    const sid=id||`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const n=(k:string)=>Number(values[k]||0);
    updatePlan(p=>{
      if(kind==='holding'){const item={id:sid,name:String(values.name||''),category:String(values.category||'Miscellaneous'),value:n('value'),invested:n('invested'),sip:n('sip'),note:String(values.note||'')};return {...p,sampleData:false,holdings:id?p.holdings.map(x=>x.id===id?item:x):[...p.holdings,item]};}
      if(kind==='goal'){const item:Goal={id:sid,name:String(values.name||''),priority:String(values.priority||'Medium'),years:n('years'),current:n('current'),target:n('target'),inflation:n('inflation'),stepUp:n('stepUp'),sip:n('sip')};return {...p,sampleData:false,goals:id?p.goals.map(x=>x.id===id?item:x):[...p.goals,item]};}
      if(kind==='assumption'){const item={className:String(values.className||''),expectedReturn:n('expectedReturn'),shortWeight:n('shortWeight'),mediumWeight:n('mediumWeight'),longWeight:n('longWeight')};const idx=id?Number(id):-1;return {...p,sampleData:false,assumptions:idx>=0?p.assumptions.map((x,i)=>i===idx?item:x):[...p.assumptions,item]};}
      const item:LineItem={id:sid,name:String(values.name||''),group:String(values.group||'Other'),amount:n('amount')};
      if(kind==='asset')return {...p,sampleData:false,assets:id?p.assets.map(x=>x.id===id?item:x):[...p.assets,item]};
      if(kind==='liability')return {...p,sampleData:false,liabilities:id?p.liabilities.map(x=>x.id===id?item:x):[...p.liabilities,item]};
      if(kind==='inflow')return {...p,sampleData:false,inflows:id?p.inflows.map(x=>x.id===id?item:x):[...p.inflows,item]};
      return {...p,sampleData:false,outflows:id?p.outflows.map(x=>x.id===id?item:x):[...p.outflows,item]};
    });
    setModal(null);notify(id?'Changes saved':'Added to your plan');
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Leaf size={21}/></div><div><div className="brand-name">Master Financial Planner</div><div className="brand-caption">Plan your money</div></div></div>
      <div className="nav-label">Your plan</div>
      {NAV.map(({href,label,icon:Icon})=><Link key={href} href={href} className={`nav-link ${location===href?'active':''}`}><span className="nav-icon"><Icon size={16}/></span>{label}</Link>)}
      <div className="nav-label">Privacy</div>
      <Link href="/vault" className={`nav-link ${location==='/vault'?'active':''}`}><span className="nav-icon"><LockKeyhole size={16}/></span>Private vault</Link>
      <Link href="/settings" className={`nav-link ${location==='/settings'?'active':''}`}><span className="nav-icon"><ShieldCheck size={16}/></span>Privacy & backup</Link>
      <div className="sidebar-bottom">{auth.user&&<Link href="/settings" className="nav-link" style={{marginBottom:8}}><span className="nav-icon">{auth.user.picture?<img src={auth.user.picture} alt="" width={18} height={18} style={{borderRadius:'50%'}} referrerPolicy="no-referrer"/>:<User size={16}/>}</span>{auth.user.name?.split(' ')[0]||'Account'}</Link>}<div className="privacy-note"><strong><LockKeyhole size={14}/>Private by default</strong>{auth.user?'Your plan lives on this device, and in your private Google Drive backup when you choose to sync.':'Your plan lives on this device. Nothing is sent to a server.'}</div></div>
    </aside>
    <div className="shell-main">
      <header className="topbar"><div className="crumb"><Link href="/" style={{color:'inherit',textDecoration:'none',cursor:'pointer'}}>Home</Link>{location!=='/'&&<><ChevronRight size={13}/><b>{NAV.find(x=>x.href===location)?.label|| (location==='/settings'?'Privacy & backup':location==='/vault'?'Private vault':'Page not found')}</b></>}</div><div className="top-actions"><span className={`pill ${storageMessage?'pill-warning':''}`} title={storageMessage||'Your changes are stored in this browser'}><i className="privacy-dot"/>{storageMessage?'Storage needs attention':'Saved on this device'}</span><Link href="/settings" className="icon-btn" aria-label="Privacy settings"><LockKeyhole size={16}/></Link></div></header>
      <main className="main-content">
        <Switch>
          <Route path="/" component={()=> <Dashboard plan={plan} userName={auth.user?.name?.split(' ')[0]||''} onAdd={()=>setModal({kind:'holding'})}/>}/>
          <Route path="/assumptions" component={()=> <Assumptions plan={plan} onAdd={()=>setModal({kind:'assumption'})} onEdit={(i)=>setModal({kind:'assumption',id:String(i),record:plan.assumptions[i] as unknown as FormRecord})} onRemove={(i)=>remove('assumption',String(i))}/>}/>
          <Route path="/cash-flow" component={()=> <CashFlow plan={plan} open={setModal} remove={remove} onProfile={(age)=>updatePlan(p=>({...p,sampleData:false,profile:{...p.profile,age}}))}/>}/>
          <Route path="/net-worth" component={()=> <NetWorth plan={plan} open={setModal} remove={remove}/>}/>
          <Route path="/investments" component={()=> <Investments plan={plan} open={setModal} remove={remove}/>}/>
          <Route path="/goals" component={()=> <Goals plan={plan} open={setModal} remove={remove}/>}/>
           <Route path="/vault" component={()=> <VaultPage auth={auth} vault={vault} setVault={setVault} notify={notify}/>}/>
           <Route path="/settings" component={()=> <Settings plan={plan} setPlan={updatePlan} notify={notify} storageMessage={storageMessage} auth={auth}/>}/>
          <Route component={()=> <NotFound/>}/>
        </Switch>
      </main>
    </div>
    <nav className="mobile-nav">{[...NAV,{href:'/vault',label:'Vault',icon:LockKeyhole},{href:'/settings',label:'Privacy',icon:ShieldCheck}].map(({href,label,icon:Icon})=><Link key={href} href={href} className={location===href?'active':''}><Icon/><span>{label}</span></Link>)}</nav>
    {modal&&<EntryModal kind={modal.kind} record={modal.record} onClose={()=>setModal(null)} onSave={(v)=>persist(modal.kind,v,modal.id)}/>}
    {toast&&<div className="toast" role="status"><Check size={15} style={{verticalAlign:'middle',marginRight:7}}/>{toast}</div>}
  </div>;
}

function Heading({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle:string;action?:ReactNode}) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function Panel({title,subtitle,action,children}:{title:string;subtitle?:string;action?:ReactNode;children:ReactNode}) {
  return <section className="card"><div className="card-head"><div><h2 className="card-title">{title}</h2>{subtitle&&<div className="card-kicker">{subtitle}</div>}</div>{action}</div>{children}</section>;
}
function Empty({title,copy,action}:{title:string;copy:string;action?:ReactNode}) {
  return <div className="empty"><div className="empty-mark"><Sparkles size={19}/></div><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
function Stat({label,value,foot,icon:Icon}:{label:string;value:string;foot:string;icon:typeof Wallet}) {
  return <div className="card"><div className="stat-label">{label}<span className="stat-icon"><Icon size={16}/></span></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>;
}
const MIX_COLORS = ['#4f7f62','#dfa077','#84aaba','#c8b66c','#bc8391','#718e89','#9b826c'];
function assetClassFor(category:string) {
  const value=category.toLowerCase();
  if(value.includes('miscellaneous')||value.includes('ulip'))return 'Miscellaneous';
  if(value.includes('debt')||value.includes('deposit')||value.includes('cash')||value.includes('government')||value.includes('fixed'))return 'Debt';
  if(value.includes('domestic stocks')||value.includes('domestic equity')||value.includes('mutual fund')||value.includes('etf · domestic')||value==='smallcase')return 'Domestic Equity';
  if(value.includes('us equity')||value.includes('international equity'))return 'US Equity';
  if(value.includes('real estate')||value.includes('reit'))return 'Real Estate/REITs';
  if(value.includes('gold')||value.includes('jewell')||value==='sgb')return 'Gold (SGB/ETF)';
  if(value.includes('crypto'))return 'Crypto';
  return 'Other';
}
function isLiquidCategory(category:string) {
  const value=category.toLowerCase();
  return !(value==='real estate'||value.includes('government investments')||value.includes('gold · sgb')||value.includes('gold · jewellery')||value.includes('ulip'));
}
function isLiquidAssetGroup(group:string,name='') {
  const value=`${group} ${name}`.toLowerCase();
  return !/(home|house|property|real estate|jewell|sgb|sovereign gold bond|ulip|insurance|epf|ppf|vpf|vehicle|car|bike|two.wheeler|scooter|motorcycle)/.test(value);
}
function uniqueHoldings(plan:PlanData) {
  return plan.holdings.filter(holding=>!plan.assets.some(asset=>asset.name.trim().toLowerCase()===holding.name.trim().toLowerCase()));
}
function assetRows(plan:PlanData) {
  return [
    ...plan.assets.map(item=>({name:item.name,group:item.group,value:item.amount})),
    ...uniqueHoldings(plan).map(item=>({name:item.name,group:item.category,value:item.value})),
  ];
}
function goalType(years:number) { return years<3?'Short term':years<=6?'Medium term':'Long term'; }
function goalReturn(assumptions:PlanData['assumptions'],years:number) {
  return effectiveReturnForYears(assumptions,years);
}
function goalProjection(goal:Goal,annualReturn:number) {
  const future=goal.target*Math.pow(1+goal.inflation/100,goal.years);
  const months=Math.max(0,Math.floor(goal.years*12));
  const monthlyRate=Math.pow(1+annualReturn/100,1/12)-1;
  const currentAtGoal=goal.current*Math.pow(1+annualReturn/100,goal.years);
  const needed=Math.max(0,future-currentAtGoal);
  let factor=0;
  for(let month=0;month<months;month++) {
    factor+=Math.pow(1+goal.stepUp/100,Math.floor(month/12))*Math.pow(1+monthlyRate,months-month-1);
  }
  return {future,months,annualReturn,currentAtGoal,needed,monthly:months?needed/(factor||1):0};
}
function MixDonut({title,data,mode}:{title:string;data:{name:string;value:number}[];mode:'money'|'percent'}) {
  const active=data.filter(item=>item.value>0);
  const total=active.reduce((sum,item)=>sum+item.value,0);
  let position=0;
  const gradientStops=active.map((item,index)=>{
    const start=position/total*100;
    position+=item.value;
    return `${MIX_COLORS[index%MIX_COLORS.length]} ${start}% ${position/total*100}%`;
  });
  return <div className="mix-donut">
    <div className="mix-title">{title}</div>
    <div className="mix-chart">
      {total>0?<div className="mix-ring" role="img" aria-label={`${title} allocation: ${active.map(item=>`${item.name} ${mode==='money'?Math.round(item.value/total*100):item.value}%`).join(', ')}`} style={{background:`conic-gradient(${gradientStops.join(',')})`}}><div className="mix-ring-center"><b>{mode==='money'?compact(total):`${total}%`}</b><span>{mode==='money'?'held':'target'}</span></div></div>:<div className="empty-mix">Add holdings</div>}
    </div>
    <div className="mix-legend">{active.map((item,i)=><div className="mix-legend-row" key={item.name}><span><i className="dot" style={{background:MIX_COLORS[i%MIX_COLORS.length]}}/>{item.name}</span><b>{mode==='money'?(total?Math.round(item.value/total*100):0):item.value}%</b></div>)}</div>
  </div>;
}
function AllocationPanel({plan}:{plan:PlanData}) {
  const investable=plan.holdings.filter(item=>isLiquidCategory(item.category));
  const currentMap=new Map<string,number>();
  for(const holding of investable) {
    const name=assetClassFor(holding.category);
    currentMap.set(name,(currentMap.get(name)||0)+holding.value);
  }
  for(const item of plan.assets.filter(item=>isLiquidAssetGroup(item.group,item.name)&&!plan.holdings.some(holding=>holding.name.trim().toLowerCase()===item.name.trim().toLowerCase()))) {
    const name=assetClassFor(item.group);
    currentMap.set(name,(currentMap.get(name)||0)+item.amount);
  }
  const current=[...currentMap].map(([name,value])=>({name,value}));
  const requiredRaw=requiredSipAllocation(plan.goals,plan.assumptions);
  const requiredTotal=requiredRaw.reduce((sum,item)=>sum+item.value,0);
  const required=requiredRaw.map(item=>({name:item.className,value:requiredTotal?Math.round(item.value/requiredTotal*100):0}));
  return <Panel title="Your investment mix" subtitle="What you hold now vs. what your goals need">
    <div className="allocation-donuts"><MixDonut title="Now" data={current} mode="money"/><MixDonut title="Needed" data={required} mode="percent"/></div>
  </Panel>;
}
function AssetRing({items,total}:{items:{name:string;value:number}[];total:number}) {
  let position=0;
  const stops=items.filter(item=>item.value>0).map((item,index)=>{
    const start=position/total*100;
    position+=item.value;
    return `${MIX_COLORS[index%MIX_COLORS.length]} ${start}% ${position/total*100}%`;
  });
  return <div className="asset-summary-chart">{total>0&&<div className="asset-ring" role="img" aria-label={`Asset composition: ${items.map(item=>`${item.name} ${Math.round(item.value/total*100)}%`).join(', ')}`} style={{background:`conic-gradient(${stops.join(',')})`}}><div className="asset-ring-center"><b>{compact(total)}</b><span>total assets</span></div></div>}</div>;
}
function Dashboard({plan,onAdd,userName}:{plan:PlanData;onAdd:()=>void;userName?:string}) {
  const rows=assetRows(plan);
  const totalAssets=rows.reduce((sum,item)=>sum+item.value,0);
  const investable=plan.holdings.filter(item=>isLiquidCategory(item.category));
  const portfolio=investable.reduce((sum,item)=>sum+item.value,0);
  const networth=totalAssets-plan.liabilities.reduce((sum,item)=>sum+item.amount,0);
  const surplus=plan.inflows.reduce((sum,item)=>sum+item.amount,0)-plan.outflows.reduce((sum,item)=>sum+item.amount,0);
  const saved=plan.holdings.reduce((sum,item)=>sum+item.sip,0);
  const maxSIP=Math.max(0,surplus);
  const sipHeadroom=Math.max(0,maxSIP-saved);
  const totalFutureGoals=plan.goals.reduce((sum,goal)=>sum+goalProjection(goal,goalReturn(plan.assumptions,goal.years)).future,0);
  const liquidAssets=plan.assets.filter(item=>isLiquidAssetGroup(item.group,item.name)).reduce((sum,item)=>sum+item.amount,0)+uniqueHoldings(plan).filter(item=>isLiquidCategory(item.category)).reduce((sum,item)=>sum+item.value,0);
  const liquidAfterGoals=Math.max(0,liquidAssets-plan.goals.reduce((sum,goal)=>sum+goal.current,0));
  const chartData=useMemo(()=>{const buckets=new Map<string,{name:string;value:number;invested:number}>();plan.holdings.forEach(x=>{const name=x.category.split(' · ')[0],old=buckets.get(name)||{name,value:0,invested:0};old.value+=x.value;old.invested+=x.invested;buckets.set(name,old)});return [...buckets.values()].map(x=>({...x,value:x.value/100000,invested:x.invested/100000}));},[plan.holdings]);
  return <>
    <Heading eyebrow={`${new Intl.DateTimeFormat('en-IN',{weekday:'long',month:'long',day:'numeric'}).format(new Date())} · Overview`} title={userName?`Hi ${userName}`:'Your money at a glance'} subtitle="See where your money stands and what to do next." action={<Link href="/investments" className="btn btn-primary">View investments <ArrowRight size={15}/></Link>}/>
    {plan.sampleData&&<Notice><Sparkles size={16} style={{flexShrink:0}}/><span><b style={{color:'#395947'}}>This is sample data.</b> These numbers aren't yours. Edit or replace them with your own.</span></Notice>}
    <div className="cards stats-grid">
      <Stat label="Net worth" value={compact(networth)} foot="What you own minus what you owe" icon={Landmark}/>
      <Stat label="Money invested" value={compact(portfolio)} foot="Liquid holdings you can rebalance" icon={TrendingUp}/>
      <Stat label="Can invest monthly" value={currency(maxSIP)} foot={`${currency(sipHeadroom)} left after current SIPs`} icon={Wallet}/>
      <Stat label="Goals add up to" value={compact(totalFutureGoals)} foot="Adjusted for inflation" icon={CalendarDays}/>
    </div>
    <div className="split-grid">
      <Panel title="Value vs. amount invested" subtitle="By asset type · ₹ lakhs"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:6,right:6,left:-15,bottom:0}} barGap={3}><CartesianGrid stroke="#e9e7dc" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:9,fill:'#929a92'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:'#929a92'}}/><Tooltip formatter={(v)=>[`₹${Number(v).toFixed(2)} L`]} contentStyle={{borderRadius:9,borderColor:'#e5e1d4',fontSize:12}}/><Bar dataKey="invested" name="Contributed" fill="#d8c8a9" radius={[4,4,0,0]}/><Bar dataKey="value" name="Current value" fill="#57836d" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></Panel>
      <AllocationPanel plan={plan}/>
    </div>
    <div className="content-grid">
      <Panel title="Your goals" subtitle="Next on your list" action={<Link href="/goals" className="btn btn-quiet">All goals <ArrowRight size={14}/></Link>}>
        {plan.goals.length?plan.goals.slice(0,3).map((g,i)=><GoalPreview key={g.id} goal={g} shade={i}/>):<Empty title="No goals yet" copy="Add a goal with a name, amount and date." action={<Link className="btn" href="/goals">Add a goal</Link>}/>}
      </Panel>
      <Panel title="Your monthly money" subtitle="Income, spending and surplus"><div className="setting-row"><div><div className="setting-title">Money coming in</div><div className="setting-desc">Monthly income</div></div><strong className="amount">{currency(plan.inflows.reduce((a,x)=>a+x.amount,0))}</strong></div><div className="setting-row"><div><div className="setting-title">Money going out</div><div className="setting-desc">Monthly spending</div></div><strong className="amount">{currency(plan.outflows.reduce((a,x)=>a+x.amount,0))}</strong></div><div className="setting-row"><div><div className="setting-title">Left to invest</div><div className="setting-desc">Income minus spending</div></div><strong className="amount" style={{color:'#4e775b'}}>{currency(maxSIP)}</strong></div><div className="setting-row"><div><div className="setting-title">Spare cash after goals</div><div className="setting-desc">{currency(liquidAssets)} cash today · {currency(plan.goals.reduce((a,g)=>a+g.current,0))} set aside for goals</div></div><strong className="amount">{currency(liquidAfterGoals)}</strong></div><Link href="/cash-flow" className="btn" style={{width:'100%',marginTop:12}}>Edit cash flow <ArrowRight size={14}/></Link></Panel>
    </div>
  </>;
}
function GoalPreview({goal,shade}:{goal:Goal;shade:number}) {
  const future=goal.target*Math.pow(1+goal.inflation/100,goal.years);
  return <div className="setting-row"><div style={{display:'flex',alignItems:'center',gap:11}}><div className="stat-icon" style={{background:shade===0?'#eee5d7':'#e5eee7',color:shade===0?'#a2744e':'#477459'}}><Target size={15}/></div><div><div className="setting-title">{goal.name}</div><div className="setting-desc">{goal.years} years · {goal.priority} priority</div></div></div><strong className="amount">{compact(future)}</strong></div>;
}
function Assumptions({plan,onAdd,onEdit,onRemove}:{plan:PlanData;onAdd:()=>void;onEdit:(i:number)=>void;onRemove:(i:number)=>void}) {
  const eff=effectiveReturns(plan.assumptions);
  const sumShort=plan.assumptions.reduce((sum,item)=>sum+item.shortWeight,0);
  const sumMedium=plan.assumptions.reduce((sum,item)=>sum+item.mediumWeight,0);
  const sumLong=plan.assumptions.reduce((sum,item)=>sum+item.longWeight,0);
  const okColor=(total:number)=>Math.round(total)===100?'#537c5d':'#a45d53';
  return <><Heading eyebrow="Your estimates" title="Return estimates" subtitle="Set the return you expect from each asset type, and how much to hold for short, medium and long-term goals. These are estimates, not guarantees." action={<button className="btn btn-primary" onClick={onAdd}><Plus size={15}/> Add row</button>}/>
    <Notice><CircleHelp size={16} style={{flexShrink:0,marginTop:1}}/>These are your own estimates. Effective returns combine your expected returns with the mix you set for each time horizon. Real returns will vary.</Notice>
    <div className="cards stats-grid" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))'}}><Stat label="Short-term return" value={`${eff.short.toFixed(1)}%`} foot="For goals under 3 years" icon={TrendingUp}/><Stat label="Medium-term return" value={`${eff.medium.toFixed(1)}%`} foot="For goals 3–6 years" icon={TrendingUp}/><Stat label="Long-term return" value={`${eff.long.toFixed(1)}%`} foot="For goals over 6 years" icon={TrendingUp}/><Stat label="Your age" value={`${plan.profile.age} years`} foot="Used for guidance" icon={CalendarDays}/></div>
    <Panel title="Returns and mix" subtitle="Expected return per asset type, and how much to hold for each time horizon."><div className="table-wrap"><table><thead><tr><th>Asset class</th><th>Expected return</th><th>Short · &lt;3y</th><th>Medium · 3–6y</th><th>Long · &gt;6y</th><th></th></tr></thead><tbody>{plan.assumptions.map((x,i)=><tr key={`${x.className}-${i}`}><td><span className="dot" style={{background:MIX_COLORS[i%MIX_COLORS.length]}}/>{x.className}</td><td className="amount">{x.expectedReturn}%</td><td className="amount">{x.shortWeight}%</td><td className="amount">{x.mediumWeight}%</td><td className="amount">{x.longWeight}%</td><td><button className="icon-btn" onClick={()=>onEdit(i)} aria-label={`Edit ${x.className}`}><Pencil size={14}/></button><button className="icon-btn" onClick={()=>onRemove(i)} aria-label={`Remove ${x.className}`}><Trash2 size={14}/></button></td></tr>)}</tbody>{plan.assumptions.length>0&&<tfoot><tr><td>Allocation total</td><td className="amount">—</td><td className="amount" style={{color:okColor(sumShort)}}>{sumShort}%</td><td className="amount" style={{color:okColor(sumMedium)}}>{sumMedium}%</td><td className="amount" style={{color:okColor(sumLong)}}>{sumLong}%</td><td></td></tr><tr><td><b>Effective return</b></td><td className="amount">—</td><td className="amount"><b>{eff.short.toFixed(1)}%</b></td><td className="amount"><b>{eff.medium.toFixed(1)}%</b></td><td className="amount"><b>{eff.long.toFixed(1)}%</b></td><td></td></tr></tfoot>}</table>{!plan.assumptions.length&&<Empty title="No estimates yet" copy="Add an expected return and mix for each asset type."/>}</div><p className="setting-desc" style={{marginTop:12}}>Each time-horizon column should add up to 100% across all asset types. These feed your goal projections and the mix your goals need.</p></Panel>
  </>;
}
function CashFlow({plan,open,remove,onProfile}:{plan:PlanData;open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void;onProfile:(n:number)=>void}) {
  const inTotal=plan.inflows.reduce((a,x)=>a+x.amount,0),outTotal=plan.outflows.reduce((a,x)=>a+x.amount,0),available=inTotal-outTotal,sips=plan.holdings.reduce((a,x)=>a+x.sip,0);
  return <><Heading eyebrow="Cash flow" title="Your monthly cash flow" subtitle="See what comes in, what goes out, and what's left to invest."/>
    <div className="cards stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><Stat label="Income each month" value={currency(inTotal)} foot={`${plan.inflows.length} sources`} icon={ArrowDownRight}/><Stat label="Spending each month" value={currency(outTotal)} foot={`${plan.outflows.length} items`} icon={ArrowUpRight}/><Stat label="Left to invest" value={currency(available)} foot={`${currency(sips)} already going to SIPs`} icon={Wallet}/></div>
    <div className="split-grid">
      <Panel title="Money coming in" subtitle="Monthly, after tax" action={<button className="btn" onClick={()=>open({kind:'inflow'})}><Plus size={14}/> Add income</button>}>{plan.inflows.length?<EditableList items={plan.inflows} kind="inflow" open={open} remove={remove}/>:<Empty title="Add your income" copy="Salary, freelance, rent — add what you get in a typical month." action={<button className="btn" onClick={()=>open({kind:'inflow'})}>Add income</button>}/>}</Panel>
      <Panel title="Money going out" subtitle="A realistic monthly average" action={<button className="btn" onClick={()=>open({kind:'outflow'})}><Plus size={14}/> Add expense</button>}>{plan.outflows.length?<EditableList items={plan.outflows} kind="outflow" open={open} remove={remove}/>:<Empty title="Add your expenses" copy="Add your regular bills and spending, not just the obvious ones." action={<button className="btn" onClick={()=>open({kind:'outflow'})}>Add expense</button>}/>}</Panel>
    </div>
    <div className="content-grid"><Panel title="What's left for goals" subtitle="After your current SIPs"><div style={{font:'500 31px var(--app-font-serif)',color:'#315741',margin:'8px 0'}}>{currency(available-sips)}<span style={{font:'12px var(--app-font-sans)',color:'#829087'}}> / month free</span></div><div className="track" style={{height:10,margin:'14px 0'}}><div className="track-fill" style={{width:`${inTotal?Math.min(100,Math.max(0,outTotal/inTotal*100)):0}%`}}/></div><div className="setting-desc">Your SIPs use {inTotal?Math.round(sips/inTotal*100):0}% of your income. The rest is free for goals and savings.</div><Link href="/goals" className="btn" style={{marginTop:16}}>Plan your goals <ArrowRight size={14}/></Link></Panel>
    <Panel title="About you" subtitle="Helps tailor the guidance"><div className="field" style={{maxWidth:230}}><label htmlFor="profile-age">Your current age</label><input id="profile-age" type="number" min="18" max="100" value={plan.profile.age} onChange={e=>onProfile(Number(e.target.value))}/></div><p className="setting-desc" style={{marginTop:12}}>Used only for the age-based suggestion in your goal planner. Stays in this browser.</p></Panel></div>
  </>;
}
function EditableList({items,kind,open,remove}:{items:LineItem[];kind:'inflow'|'outflow';open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void}) {
  return <div>{items.map(x=><div className="setting-row" key={x.id}><div><div className="setting-title">{x.name}</div><div className="setting-desc">{x.group}</div></div><div style={{display:'flex',alignItems:'center',gap:7}}><strong className="amount">{currency(x.amount)}</strong><button className="icon-btn" aria-label={`Edit ${x.name}`} onClick={()=>open({kind,id:x.id,record:x as unknown as FormRecord})}><Pencil size={14}/></button><button className="icon-btn" aria-label={`Remove ${x.name}`} onClick={()=>remove(kind,x.id)}><Trash2 size={14}/></button></div></div>)}</div>;
}
function NetWorth({plan,open,remove}:{plan:PlanData;open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void}) {
  const investmentItems=uniqueHoldings(plan).map(x=>({id:x.id,name:x.name,amount:x.value,group:x.category}));
  const rows=assetRows(plan);
  const totalAssets=rows.reduce((sum,item)=>sum+item.value,0);
  const debts=plan.liabilities.reduce((sum,item)=>sum+item.amount,0);
  const liquid=plan.assets.filter(item=>isLiquidAssetGroup(item.group,item.name)).reduce((sum,item)=>sum+item.amount,0)+uniqueHoldings(plan).filter(item=>isLiquidCategory(item.category)).reduce((sum,item)=>sum+item.value,0);
  const goalReserved=plan.goals.reduce((sum,goal)=>sum+goal.current,0);
  const monthlyOutflow=plan.outflows.reduce((sum,item)=>sum+item.amount,0);
  const emergencyTarget=monthlyOutflow*6;
  const assetGroups=new Map<string,number>();
  for(const item of rows)assetGroups.set(item.group,(assetGroups.get(item.group)||0)+item.value);
  const assetSummary=[...assetGroups].map(([name,value])=>({name,value}));
  return <><Heading eyebrow="Net worth" title="What you own and owe" subtitle="All your assets, investments and debts in one place."/>
    <div className="cards stats-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))'}}><Stat label="Total assets" value={compact(totalAssets)} foot="Investments and things you own" icon={House}/><Stat label="Total debts" value={compact(debts)} foot="Loans and amounts owed" icon={Banknote}/><Stat label="Net worth" value={compact(totalAssets-debts)} foot="What you own minus debts" icon={Landmark}/><Stat label="Cash you can invest" value={compact(liquid)} foot="Cash and holdings you can move" icon={Wallet}/><Stat label="Cash after goals" value={compact(Math.max(0,liquid-goalReserved))} foot={`${currency(goalReserved)} set aside for goals`} icon={Target}/><Stat label="Emergency fund target" value={compact(emergencyTarget)} foot={emergencyTarget?`${currency(monthlyOutflow)}/mo × 6 · ${liquid>=emergencyTarget?'covered by your cash':compact(Math.max(0,emergencyTarget-liquid))+' short'}`:'Add monthly spending to size this'} icon={ShieldCheck}/></div>
    <div className="split-grid"><Panel title="Assets" subtitle="Your investments are included — don't add the same item twice" action={<button className="btn" onClick={()=>open({kind:'asset'})}><Plus size={14}/> Add asset</button>}>{plan.assets.length||investmentItems.length?<div className="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>Value</th><th></th></tr></thead><tbody>{plan.assets.map(x=><ItemRow key={x.id} item={x} kind="asset" open={open} remove={remove}/>)}{investmentItems.map(x=><tr key={`holding-${x.id}`}><td><span className="dot" style={{background:'#83a496'}}/>{x.name}</td><td>{x.group}</td><td className="amount">{currency(x.amount)}</td><td><span className="pill">From investments</span></td></tr>)}</tbody></table></div>:<Empty title="What do you own?" copy="Add a home, a vehicle, or another asset."/ >}</Panel>
      <Panel title="Asset summary" subtitle="Share of total by type"><AssetRing items={assetSummary} total={totalAssets}/><div className="table-wrap"><table><thead><tr><th>Asset type</th><th>Value</th><th>Share</th></tr></thead><tbody>{assetSummary.map((item,i)=><tr key={item.name}><td><span className="dot" style={{background:MIX_COLORS[i%MIX_COLORS.length]}}/>{item.name}</td><td className="amount">{currency(item.value)}</td><td>{totalAssets?`${(item.value/totalAssets*100).toFixed(1)}%`:'0%'}</td></tr>)}<tr><td><b>Total assets</b></td><td className="amount"><b>{currency(totalAssets)}</b></td><td>100%</td></tr></tbody></table></div></Panel>
    <Panel title="Liabilities" subtitle="Amounts owed today" action={<button className="btn" onClick={()=>open({kind:'liability'})}><Plus size={14}/> Add debt</button>}>{plan.liabilities.length?<div className="table-wrap"><table><thead><tr><th>Item</th><th>Type</th><th>Owed</th><th></th></tr></thead><tbody>{plan.liabilities.map(x=><ItemRow key={x.id} item={x} kind="liability" open={open} remove={remove}/>)}</tbody></table></div>:<Empty title="No debts added" copy="Add loans and other amounts you owe." action={<button className="btn" onClick={()=>open({kind:'liability'})}>Add a debt</button>}/>}</Panel></div>
  </>;
}
function ItemRow({item,kind,open,remove}:{item:LineItem;kind:'asset'|'liability';open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void}) {
  return <tr><td><span className="dot"/>{item.name}</td><td>{item.group}</td><td className="amount">{currency(item.amount)}</td><td><button className="icon-btn" onClick={()=>open({kind,id:item.id,record:item as unknown as FormRecord})} aria-label={`Edit ${item.name}`}><Pencil size={14}/></button><button className="icon-btn" onClick={()=>remove(kind,item.id)} aria-label={`Remove ${item.name}`}><Trash2 size={14}/></button></td></tr>;
}
function Investments({plan,open,remove}:{plan:PlanData;open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void}) {
  const [category,setCategory]=useState('All holdings');
  const holdings=category==='All holdings'?plan.holdings:plan.holdings.filter(x=>x.category===category);
  const total=holdings.reduce((a,x)=>a+x.value,0),invested=holdings.reduce((a,x)=>a+x.invested,0),sip=holdings.reduce((a,x)=>a+x.sip,0);
  return <><Heading eyebrow="Investments" title="Your investments" subtitle="Track your holdings, what you've put in, and what you add each month." action={<button className="btn btn-primary" onClick={()=>open({kind:'holding'})}><Plus size={15}/> Add holding</button>}/>
    <div className="cards stats-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))'}}><Stat label="Current value" value={compact(total)} foot={`${holdings.length} holdings`} icon={TrendingUp}/><Stat label="Amount put in" value={compact(invested)} foot={total-invested>=0?`${compact(total-invested)} growth`:`${compact(invested-total)} below what you put in`} icon={Coins}/><Stat label="Added each month" value={currency(sip)} foot="SIPs and regular deposits" icon={CalendarDays}/></div>
    <Panel title="Your holdings" subtitle="Filter by type"><div className="segmented">{CATEGORIES.map(c=><button className={`segment ${c===category?'active':''}`} key={c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      {holdings.length?<div className="table-wrap"><table><thead><tr><th>Holding</th><th>Current value</th><th>Put in</th><th>Monthly SIP</th><th>Change</th><th></th></tr></thead><tbody>{holdings.map(x=><tr key={x.id}><td><span className="dot"/>{x.name}<div className="setting-desc" style={{marginLeft:16}}>{x.category}</div></td><td className="amount">{currency(x.value)}</td><td className="amount">{currency(x.invested)}</td><td className="amount">{currency(x.sip)}</td><td style={{color:x.value>=x.invested?'#537c5d':'#a45d53'}}>{x.invested?`${((x.value-x.invested)/x.invested*100).toFixed(1)}%`:'—'}</td><td><button className="icon-btn" aria-label={`Edit ${x.name}`} onClick={()=>open({kind:'holding',id:x.id,record:x as unknown as FormRecord})}><Pencil size={14}/></button><button className="icon-btn" aria-label={`Remove ${x.name}`} onClick={()=>remove('holding',x.id)}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>:<Empty title={category==='All holdings'?'No holdings yet':'Nothing here yet'} copy={category==='All holdings'?'Add the investments you want to track.':'Add a holding here, or pick another type.'} action={<button className="btn" onClick={()=>open({kind:'holding'})}>Add a holding</button>}/>}
    </Panel><Notice style={{marginTop:16}}><ShieldCheck size={16}/>You enter these values yourself and they stay on this device. This app doesn't connect to brokers, exchanges or banks.</Notice>
  </>;
}
function Goals({plan,open,remove}:{plan:PlanData;open:(x:{kind:Kind;record?:FormRecord;id?:string}|null)=>void;remove:(kind:Kind,id:string)=>void}) {
  const age=plan.profile.age;
  const equity=age<35?'80–90%':age<45?'70–80%':age<55?'55–70%':'35–55%';
  const monthlySurplus=plan.inflows.reduce((a,x)=>a+x.amount,0)-plan.outflows.reduce((a,x)=>a+x.amount,0);
  const currentSips=plan.holdings.reduce((a,x)=>a+x.sip,0);
  const affordable=Math.max(0,monthlySurplus-currentSips);
  const projections=plan.goals.map(goal=>goalProjection(goal,goalReturn(plan.assumptions,goal.years)));
  const futureTotal=projections.reduce((sum,item)=>sum+item.future,0);
  const availableToday=plan.goals.reduce((sum,goal)=>sum+goal.current,0);
  const goalSipTotal=projections.reduce((sum,item)=>sum+item.monthly,0);
  return <><Heading eyebrow="Goals" title="Your goals" subtitle="Turn your plans into a monthly savings target. Estimates, not advice." action={<button className="btn btn-primary" onClick={()=>open({kind:'goal'})}><Plus size={15}/> Add a goal</button>}/>
    <Notice><Target size={17} style={{flexShrink:0}}/><span><b style={{color:'#395947'}}>Rough guide for age {age}:</b> keep about {equity} in growth assets and the rest in safer ones. It's just a rule of thumb — your goals, comfort with risk and time frame matter more.</span></Notice>
    <div className="cards stats-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(165px,1fr))',marginBottom:18}}><Stat label="Total goal amount" value={compact(futureTotal)} foot="Adjusted for inflation" icon={Target}/><Stat label="Set aside so far" value={compact(availableToday)} foot="Amounts you've marked for goals" icon={Wallet}/><Stat label="Monthly SIP needed" value={currency(goalSipTotal)} foot="Across all your goals" icon={CalendarDays}/><Stat label="Extra you can invest" value={currency(affordable)} foot={`${currency(currentSips)} already planned`} icon={TrendingUp}/></div>
    {plan.goals.length?<div style={{display:'grid',gap:14}}>{plan.goals.map(g=><GoalCard key={g.id} goal={g} annualReturn={goalReturn(plan.assumptions,g.years)} assumptions={plan.assumptions} open={()=>open({kind:'goal',id:g.id,record:g as unknown as FormRecord})} remove={()=>remove('goal',g.id)}/>)}</div>:<Panel title="Start with one goal"><Empty title="No goals yet" copy="Add a goal — a home, a trip, retirement. Be specific so you can plan for it." action={<button className="btn btn-primary" onClick={()=>open({kind:'goal'})}><Plus size={14}/> Add your first goal</button>}/></Panel>}
    {plan.goals.length>0&&<div style={{marginTop:16}}><SipAllocatorPanel plan={plan}/></div>}
    <p className="setting-desc" style={{marginTop:18}}>Projections use your expected return for each goal's time frame, inflation and yearly SIP increases. Estimates only, not advice.</p>
  </>;
}
function GoalCard({goal:g,annualReturn,assumptions,open,remove}:{goal:Goal;annualReturn:number;assumptions:PlanData['assumptions'];open:()=>void;remove:()=>void}) {
  const {future,months,currentAtGoal,monthly}=goalProjection(g,annualReturn);
  const affordable=monthly<=g.sip;
  const split=requiredSipAllocation([g],assumptions).filter(item=>item.value>0);
  return <section className="card" style={{padding:22}}><div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'flex-start'}}><div><div style={{display:'flex',gap:8,alignItems:'center'}}><h2 className="card-title">{g.name}</h2><span className="pill">{g.priority} priority</span></div><div className="card-kicker" style={{marginTop:8}}>{g.years} years away · {g.inflation}% inflation · {g.stepUp}% annual step-up</div></div><div><button className="icon-btn" aria-label={`Edit ${g.name}`} onClick={open}><Pencil size={15}/></button><button className="icon-btn" aria-label={`Remove ${g.name}`} onClick={remove}><Trash2 size={15}/></button></div></div>
    <div className="goal-tags"><span>{goalType(g.years)} goal</span><span>{annualReturn.toFixed(1)}% expected return</span></div>
    <div className="content-grid" style={{marginTop:21}}><div><div className="stat-label">Future cost with inflation</div><div className="stat-value" style={{fontSize:25}}>{compact(future)}</div><div className="setting-desc">Costs {currency(g.target)} today · {currency(g.current)} set aside</div></div><div style={{borderLeft:'1px solid #e9e5d8',paddingLeft:20}}><div className="stat-label">Monthly SIP needed</div><div className="stat-value" style={{fontSize:25}}>{months?currency(monthly):'—'}</div><div className="setting-desc">{months===0?'This goal is due now; change the date or fund it directly.':affordable?'Within the SIP you’ve set.':'Your planned SIP is '+currency(g.sip)+'. Try a bigger step-up or a later date.'}</div></div></div>
    <div style={{display:'flex',justifyContent:'space-between',marginTop:18,fontSize:11,color:'#7b877e'}}><span>Funded so far</span><span>{Math.round(Math.min(100,future?currentAtGoal/future*100:0))}% of future cost</span></div><div className="track" style={{height:8,marginTop:7}}><div className="track-fill" style={{width:`${Math.min(100,future?currentAtGoal/future*100:0)}%`}}/></div>
    {split.length>0&&<div style={{marginTop:16}}><div className="stat-label" style={{marginBottom:8}}>Your {currency(g.sip)} SIP splits into</div><div className="goal-tags">{split.map(item=><span key={item.className}>{item.className}: {currency(item.value)}</span>)}</div></div>}
  </section>;
}
function SipAllocatorPanel({plan}:{plan:PlanData}) {
  const allocation=requiredSipAllocation(plan.goals,plan.assumptions).filter(item=>item.value>0);
  const total=allocation.reduce((sum,item)=>sum+item.value,0);
  const surplus=plan.inflows.reduce((sum,item)=>sum+item.amount,0)-plan.outflows.reduce((sum,item)=>sum+item.amount,0);
  const over=total>surplus;
  if(!allocation.length)return null;
  return <Panel title="Where your SIPs go" subtitle="How your goal SIPs split across asset types">
    <div className="table-wrap"><table><thead><tr><th>Asset type</th><th>Monthly SIP</th><th>Share</th></tr></thead><tbody>{allocation.map((item,i)=><tr key={item.className}><td><span className="dot" style={{background:MIX_COLORS[i%MIX_COLORS.length]}}/>{item.className}</td><td className="amount">{currency(item.value)}</td><td>{total?`${(item.value/total*100).toFixed(1)}%`:'0%'}</td></tr>)}<tr><td><b>Total</b></td><td className="amount"><b>{currency(total)}</b></td><td>100%</td></tr></tbody></table></div>
    <div className="setting-row" style={{marginTop:4}}><div><div className="setting-title">Money free each month</div><div className="setting-desc">Income minus spending</div></div><strong className="amount" style={{color:over?'#a45d53':'#4e775b'}}>{currency(surplus)}</strong></div>
    {over&&<Notice style={{marginTop:12}}><ArrowUpRight size={16} style={{flexShrink:0}}/><span><b style={{color:'#8a4b43'}}>Not enough to cover this.</b> Your goal SIPs add up to {currency(total)} but only {currency(surplus)} is free each month. Earn more, spend less, or lower some SIPs.</span></Notice>}
  </Panel>;
}
function Settings({plan,setPlan,notify,storageMessage,auth}:{plan:PlanData;setPlan:(v:PlanData|((p:PlanData)=>PlanData))=>void;notify:(s:string)=>void;storageMessage:string;auth:AuthState}) {
  const file=useRef<HTMLInputElement>(null);
  const [working,setWorking]=useState(false);
  const [lastBackup,setLastBackup]=useState('');
  useEffect(()=>{if(!auth.user)return;let active=true;auth.getToken().then(getBackupMeta).then(m=>{if(active&&m)setLastBackup(m.modifiedTime);}).catch(()=>{});return()=>{active=false;};},[auth.user]);
  const signIn=async()=>{try{await auth.signIn();notify('Signed in with Google');}catch(e){notify(e instanceof Error?e.message:'Google sign-in failed');}};
  const signOut=async()=>{try{await auth.signOut();setLastBackup('');notify('Signed out of Google');}catch{notify('Could not sign out');}};
  const backupNow=async()=>{setWorking(true);try{const token=await auth.getToken();const meta=await backupToDrive(token,plan);setLastBackup(meta.modifiedTime);notify('Backed up to Google Drive');}catch(e){notify(e instanceof Error?e.message:'Backup to Google Drive failed');}finally{setWorking(false);}};
  const restoreNow=async()=>{setWorking(true);try{const token=await auth.getToken();const envelope=await restoreFromDrive(token);if(!envelope){notify('No backup was found in your Google Drive');return;}const candidate=normalizePlan((envelope as {plan?:unknown}).plan??envelope);if(!candidate){notify('That Google Drive backup is not in a valid format');return;}if(window.confirm('Replace all Master Financial Planner data on this device with your Google Drive backup? This cannot be undone.')){setPlan(candidate);notify('Restored from Google Drive');}}catch(e){notify(e instanceof Error?e.message:'Restore from Google Drive failed');}finally{setWorking(false);}};
  const exportData=()=>{const blob=new Blob([JSON.stringify({schema:'goodmeasure/v2',exportedAt:new Date().toISOString(),plan},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`goodmeasure-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Your backup file is ready');};
  const restore=(e:FormEvent<HTMLInputElement>)=>{const target=e.currentTarget;const f=target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result)) as {schema?:string;plan?:unknown};const candidate=normalizePlan(parsed.plan||parsed);if(!candidate){notify('That file does not match the Master Financial Planner backup format');return;}if(window.confirm('Replace all Master Financial Planner data on this device with this backup? This cannot be undone.')){setPlan(candidate);notify('Backup restored successfully');}}catch{notify('Could not read that JSON file. Nothing was changed.')}finally{target.value='';}};reader.readAsText(f);};
  const reset=()=>{if(window.confirm('Replace your current plan with a fresh sample notebook? This will remove your edits from this browser.')){setPlan(blankPlan());notify('Fresh notebook restored');}};
  const clearAll=()=>{if(window.confirm('Clear ALL planner data on this device? This empties your notebook — profile, income, expenses, assets, liabilities, holdings and goals. Your private vault is kept separate and is NOT affected. This cannot be undone.')){setPlan(emptyPlan());notify('All planner data cleared');}};
  return <><Heading eyebrow="Privacy & backup" title="Privacy & backup" subtitle="No account, no server. Your plan lives in this browser."/>
    <div className="card" style={{padding:22,marginBottom:17,background:storageMessage?'#f6e9e5':'#eff2e8'}}><div style={{display:'flex',gap:14,alignItems:'center'}}><div className="stat-icon" style={{width:42,height:42}}><LockKeyhole size={20}/></div><div><h2 className="card-title">{storageMessage?'Local storage needs attention':'Local-only storage is active'}</h2><div className="card-kicker">{storageMessage||'Your plan is saved in this browser. Other people on this device may access this browser profile, so keep your device protected.'}</div></div><span className={`pill ${storageMessage?'pill-warning':''}`} style={{marginLeft:'auto',whiteSpace:'nowrap'}}>{storageMessage?'Not confirmed':'On this device'}</span></div></div>
     <div className="content-grid"><Panel title="Back up your data" subtitle="Save a copy as a file"><div className="setting-row"><div><div className="setting-title">Download a backup</div><div className="setting-desc">Creates a JSON file containing your current plan.</div></div><button className="btn btn-primary" onClick={exportData}><Download size={15}/> Export JSON</button></div><div className="setting-row"><div><div className="setting-title">Restore from a backup</div><div className="setting-desc">Checks the schema and asks before replacing your current plan.</div></div><input ref={file} type="file" accept="application/json,.json" onChange={restore} style={{display:'none'}}/><button className="btn" onClick={()=>file.current?.click()}><FileUp size={15}/> Choose file</button></div></Panel>
    <Panel title="Google Drive backup" subtitle={auth.user?`Signed in as ${auth.user.email}`:'Sign in to keep a private copy in your Google Drive'}>{!auth.configured?<div className="setting-row"><div><div className="setting-title">Not available in this build</div><div className="setting-desc">Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID to enable Drive backup and restore.</div></div><span className="pill" style={{background:'#eee9dd',color:'#89795f'}}>Disabled</span></div>:auth.user?<><div className="setting-row"><div style={{display:'flex',gap:12,alignItems:'center'}}>{auth.user.picture?<img src={auth.user.picture} alt="" width={40} height={40} style={{borderRadius:'50%'}} referrerPolicy="no-referrer"/>:<span className="stat-icon" style={{width:40,height:40}}><User size={18}/></span>}<div><div className="setting-title">{auth.user.name||auth.user.email}</div><div className="setting-desc">{auth.user.email}</div></div></div><button className="btn" onClick={signOut} disabled={auth.busy}><LogOut size={15}/> Sign out</button></div><div className="setting-row"><div><div className="setting-title">Back up to Drive</div><div className="setting-desc">Saves your current plan to a private app folder in your Google Drive, visible only to this app.{lastBackup?` Last backup ${new Date(lastBackup).toLocaleString()}.`:''}</div></div><button className="btn btn-primary" onClick={backupNow} disabled={working}><UploadCloud size={15}/> {working?'Working…':'Back up now'}</button></div><div className="setting-row"><div><div className="setting-title">Restore from Drive</div><div className="setting-desc">Pulls your latest Drive backup and replaces the plan on this device after confirmation.</div></div><button className="btn" onClick={restoreNow} disabled={working}><DownloadCloud size={15}/> Restore</button></div></>:<div className="setting-row"><div><div className="setting-title">Connect Google Drive</div><div className="setting-desc">Sign in with Google to enable private cloud backup and restore. Your plan stays on this device until you back it up.</div></div><button className="btn btn-primary" onClick={signIn} disabled={auth.busy}><LogIn size={15}/> Sign in with Google</button></div>}</Panel>
    <Panel title="Financial accounts" subtitle="No integrations are active"><div className="setting-row"><div><div className="setting-title">Bank, broker & exchange links</div><div className="setting-desc">No connections. Every entry in your plan is added manually.</div></div><span className="pill">Private</span></div></Panel></div>
    <Panel title="Reset" subtitle="Start over or clear everything"><div className="setting-row"><div><div className="setting-title">Restore sample data</div><div className="setting-desc">Replace edits with the original example entries. Your export is a good idea first.</div></div><button className="btn btn-danger" onClick={reset}><RotateCcw size={14}/> Restore sample</button></div><div className="setting-row"><div><div className="setting-title">Clear all data</div><div className="setting-desc">Empties your entire planner notebook on this device. Your private vault is kept separate and is not affected. Export a backup first.</div></div><button className="btn btn-danger" onClick={clearAll}><Trash2 size={14}/> Clear all data</button></div></Panel>
     <Notice style={{marginTop:17}}><ShieldCheck size={16}/>Master Financial Planner does not transmit your personal finance data. Clearing browser storage or using a different browser profile can remove or hide your notebook — export backups periodically.</Notice>
  </>;
}
function EntryModal({kind,record,onClose,onSave}:{kind:Kind;record?:FormRecord;onClose:()=>void;onSave:(x:FormRecord)=>void}) {
  const [values,setValues]=useState<FormRecord>(()=>{const init:FormRecord={...(record||{})};if(kind==='holding'&&!init.category)init.category='Domestic stocks · Large cap';if(kind==='asset'&&!init.group)init.group='Other';if(kind==='liability'&&!init.group)init.group='Other borrowing';if(kind==='assumption'){if(!init.className)init.className='Domestic Equity';for(const field of ['expectedReturn','shortWeight','mediumWeight','longWeight'])if(init[field]===undefined)init[field]=0;}if(kind==='goal'){if(!init.priority)init.priority='Medium';if(init.inflation===undefined)init.inflation=6;if(init.stepUp===undefined)init.stepUp=8;}return init;});
  const first=useRef<HTMLInputElement>(null);
  useEffect(()=>{first.current?.focus();},[]);
  const submit=(e:FormEvent)=>{e.preventDefault();onSave(values);};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><div className="eyebrow">{record?'Edit your plan':'Add to your plan'}</div><h2 className="modal-title" id="modal-title">{record?'Update':'New'} {GROUPS[kind].toLowerCase().replace(/s$/,'')}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={18}/></button></div>
    <form onSubmit={submit}><div className="form-grid">{FIELDS[kind].map((f,i)=><div className={`field ${f.key==='note'?'full':''}`} key={f.key}><label htmlFor={`entry-${f.key}`}>{f.label}<span className="hint" title={f.hint} tabIndex={0} role="img" aria-label={f.hint}><CircleHelp size={13}/></span></label>{f.key==='category'?<select id={`entry-${f.key}`} value={String(values[f.key]||'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}>{CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}</select>:f.key==='priority'?<select id={`entry-${f.key}`} value={String(values[f.key]||'Medium')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}>{['High','Medium','Low'].map(c=><option key={c}>{c}</option>)}</select>:f.key==='group'&&(kind==='asset'||kind==='liability')?<select id={`entry-${f.key}`} value={String(values[f.key]||'')} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))}>{[...new Set([String(values[f.key]||''),...(kind==='asset'?ITEM_GROUPS:['Home loan','Education loan','Credit card','Personal loan','Plot loan','Other borrowing'])])].filter(Boolean).map(option=><option key={option}>{option}</option>)}</select>:<input ref={i===0?first:undefined} id={`entry-${f.key}`} type={f.type||'text'} min={f.type==='number'?0:undefined} step={f.type==='number'?'any':undefined} required={f.key!=='note'} value={values[f.key]===undefined?'':String(values[f.key])} onChange={e=>setValues(v=>({...v,[f.key]:e.target.value}))} placeholder={f.type==='number'?'0':''}/>}</div>)}</div>
      <div className="modal-foot"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary"><Check size={14}/>{record?'Save changes':'Add entry'}</button></div>
    </form></section></div>;
}
function NotFound() {
  return <><Heading eyebrow="Not found" title="Page not found" subtitle="Pick a page below to get back to your plan."/><div className="cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>{NAV.map(x=><Link className="card" href={x.href} key={x.href} style={{textDecoration:'none',color:'#314b3e'}}><x.icon size={20}/><h2 className="card-title" style={{marginTop:12}}>{x.label}</h2></Link>)}</div></>;
}
export default App;
