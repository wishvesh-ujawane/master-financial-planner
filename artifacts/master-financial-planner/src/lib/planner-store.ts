export type Holding = { id: string; name: string; category: string; value: number; invested: number; sip: number; note?: string };
export type Goal = { id: string; name: string; priority: string; years: number; current: number; target: number; inflation: number; stepUp: number; sip: number };
export type LineItem = { id: string; name: string; amount: number; group: string };
// Mirrors the Excel model: one expected return per class + allocation weight (%) for each goal horizon.
export type Assumption = { className: string; expectedReturn: number; shortWeight: number; mediumWeight: number; longWeight: number };
export type PlanData = {
  sampleData: boolean;
  profile: { age: number; monthlyIncome: number; monthlyExpenses: number };
  holdings: Holding[]; assets: LineItem[]; liabilities: LineItem[]; goals: Goal[];
  inflows: LineItem[]; outflows: LineItem[];
  assumptions: Assumption[];
};
const seed: PlanData = {
  sampleData: true,
  profile: { age: 32, monthlyIncome: 185000, monthlyExpenses: 98500 },
  holdings: [
    { id: 'h1', name: 'HDFC Bank', category: 'Domestic stocks · Large cap', value: 425000, invested: 352000, sip: 0 },
    { id: 'h2', name: 'Nifty 50 Index Fund', category: 'Mutual funds · Index', value: 865000, invested: 724000, sip: 18000 },
    { id: 'h3', name: 'PPF', category: 'Government investments', value: 382000, invested: 310000, sip: 12500 },
    { id: 'h4', name: 'Emergency savings', category: 'Cash & deposits', value: 240000, invested: 240000, sip: 0 },
    { id: 'h5', name: 'Sovereign Gold Bond', category: 'Gold · SGB', value: 148000, invested: 125000, sip: 0 },
  ],
  assets: [{ id:'a1',name:'Home · Pune',amount:4200000,group:'Home & property' },{id:'a3',name:'Two-wheeler',amount:95000,group:'Vehicle'}],
  liabilities: [{ id:'l1',name:'Home loan',amount:2710000,group:'Loan' },{id:'l2',name:'Education loan',amount:184000,group:'Loan'}],
  goals: [
    { id:'g1',name:'A home of my own',priority:'High',years:8,current:650000,target:3200000,inflation:6,stepUp:8,sip:22000 },
    { id:'g2',name:'A little more freedom',priority:'Medium',years:22,current:0,target:12000000,inflation:6,stepUp:8,sip:12000 },
  ],
  inflows: [{id:'i1',name:'Monthly take-home',amount:185000,group:'Salary'},{id:'i2',name:'Freelance income',amount:12000,group:'Other'}],
  outflows: [{id:'o1',name:'Home & utilities',amount:36000,group:'Essential'},{id:'o2',name:'Everyday living',amount:28500,group:'Essential'},{id:'o3',name:'Family & care',amount:14000,group:'Essential'},{id:'o4',name:'Lifestyle',amount:20000,group:'Flexible'}],
  assumptions: [
    {className:'Domestic Equity',expectedReturn:12,shortWeight:0,mediumWeight:40,longWeight:60},
    {className:'US Equity',expectedReturn:12,shortWeight:0,mediumWeight:0,longWeight:10},
    {className:'Debt',expectedReturn:6,shortWeight:100,mediumWeight:50,longWeight:15},
    {className:'Gold (SGB/ETF)',expectedReturn:6,shortWeight:0,mediumWeight:10,longWeight:5},
    {className:'Crypto',expectedReturn:20,shortWeight:0,mediumWeight:0,longWeight:5},
    {className:'Real Estate/REITs',expectedReturn:10,shortWeight:0,mediumWeight:0,longWeight:5},
  ],
};
const KEY = 'goodmeasure-plan-v2';
const LEGACY_KEY = 'quiet-ledger-plan-v1';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string';
const validLineItems = (value: unknown): value is LineItem[] =>
  Array.isArray(value) && value.every((item) => isRecord(item) && text(item.id) && text(item.name) && text(item.group) && finite(item.amount));
const validHoldings = (value: unknown): value is Holding[] =>
  Array.isArray(value) && value.every((item) => isRecord(item) && text(item.id) && text(item.name) && text(item.category) && finite(item.value) && finite(item.invested) && finite(item.sip) && (item.note === undefined || text(item.note)));
const validGoals = (value: unknown): value is Goal[] =>
  Array.isArray(value) && value.every((item) => isRecord(item) && text(item.id) && text(item.name) && text(item.priority) && finite(item.years) && finite(item.current) && finite(item.target) && finite(item.inflation) && finite(item.stepUp) && finite(item.sip));
const ASSUMPTION_ALIASES: Record<string, string> = {
  'indian equities': 'Domestic Equity',
  'domestic equity': 'Domestic Equity',
  'international equities': 'US Equity',
  'us equity': 'US Equity',
  'debt & fixed income': 'Debt',
  'cash & deposits': 'Debt',
  gold: 'Gold (SGB/ETF)',
  crypto: 'Crypto',
  'real estate': 'Real Estate/REITs',
  'real estate/reits': 'Real Estate/REITs',
};
function canonicalizeAssumptions(rows: Assumption[]): Assumption[] {
  const byClass = new Map<string, Assumption>();
  for (const row of rows) {
    const key = row.className.trim().toLowerCase();
    const className = ASSUMPTION_ALIASES[key] ?? row.className.trim();
    const existing = byClass.get(className);
    if (existing) {
      existing.shortWeight += row.shortWeight;
      existing.mediumWeight += row.mediumWeight;
      existing.longWeight += row.longWeight;
    } else {
      byClass.set(className, { className, expectedReturn: row.expectedReturn, shortWeight: row.shortWeight, mediumWeight: row.mediumWeight, longWeight: row.longWeight });
    }
  }
  const result = seed.assumptions.map((defaultItem) =>
    byClass.get(defaultItem.className) ?? { ...defaultItem, shortWeight: 0, mediumWeight: 0, longWeight: 0 });
  for (const [className, row] of byClass) {
    if (!seed.assumptions.some(item => item.className === className)) result.push(row);
  }
  return result;
}
function legacyToWeights(className: string): Pick<Assumption, 'shortWeight' | 'mediumWeight' | 'longWeight'> {
  const match = seed.assumptions.find(item => item.className === className);
  return { shortWeight: match?.shortWeight ?? 0, mediumWeight: match?.mediumWeight ?? 0, longWeight: match?.longWeight ?? 0 };
}
function migrateLegacyAssumptions(value: unknown): Assumption[] | null {
  if (!Array.isArray(value)) return null;
  if (value.every((item) => isRecord(item) && text(item.className) && finite(item.expectedReturn) && finite(item.shortWeight) && finite(item.mediumWeight) && finite(item.longWeight))) {
    return canonicalizeAssumptions(value as Assumption[]);
  }
  if (value.every((item) => isRecord(item) && text(item.className) && finite(item.shortTerm) && finite(item.mediumTerm) && finite(item.longTerm) && finite(item.target))) {
    const rows = (value as { className: string; shortTerm: number; mediumTerm: number; longTerm: number }[]).map((item) => {
      const className = ASSUMPTION_ALIASES[item.className.trim().toLowerCase()] ?? item.className.trim();
      return { className, expectedReturn: item.longTerm, ...legacyToWeights(className) };
    });
    return canonicalizeAssumptions(rows);
  }
  if (!value.every((item) => isRecord(item) && text(item.className) && text(item.horizon) && finite(item.expected) && finite(item.target))) return null;
  const sourceRows = new Map<string, { className: string; returns: number[] }>();
  for (const raw of value) {
    const item = raw as { className: string; horizon: string; expected: number };
    const key = item.className.trim().toLowerCase();
    const className = ASSUMPTION_ALIASES[key] ?? item.className.trim();
    const source = sourceRows.get(className) ?? { className, returns: [] };
    source.returns.push(item.expected);
    sourceRows.set(className, source);
  }
  const rows = [...sourceRows.values()].map((source) => ({
    className: source.className,
    expectedReturn: source.returns.length ? source.returns.reduce((sum, value) => sum + value, 0) / source.returns.length : 0,
    ...legacyToWeights(source.className),
  }));
  return canonicalizeAssumptions(rows);
}

export function normalizePlan(value: unknown): PlanData | null {
  if (!isRecord(value) || typeof value.sampleData !== 'boolean' || !isRecord(value.profile) ||
      !finite(value.profile.age) || !finite(value.profile.monthlyIncome) || !finite(value.profile.monthlyExpenses) ||
      !validHoldings(value.holdings) || !validLineItems(value.assets) || !validLineItems(value.liabilities) ||
      !validGoals(value.goals) || !validLineItems(value.inflows) || !validLineItems(value.outflows)) return null;
  const assumptions = migrateLegacyAssumptions(value.assumptions);
  if (!assumptions) return null;
  const holdings = value.holdings.map((holding) => {
    if (holding.category !== 'Gold') return holding;
    const name = holding.name.toLowerCase();
    const category = name.includes('bond') || name.includes('sgb') ? 'Gold · SGB' : name.includes('jewell') ? 'Gold · Jewellery' : 'Gold · Gold ETF';
    return { ...holding, category };
  });
  return { ...value, profile: value.profile as PlanData['profile'], holdings, assets: value.assets, liabilities: value.liabilities, goals: value.goals, inflows: value.inflows, outflows: value.outflows, assumptions } as PlanData;
}

export function validatePlan(value: unknown): value is PlanData {
  return normalizePlan(value) !== null;
}
export type Horizon = 'short' | 'medium' | 'long';
export function horizonForYears(years: number): Horizon {
  return years < 3 ? 'short' : years <= 6 ? 'medium' : 'long';
}
const WEIGHT_KEY: Record<Horizon, 'shortWeight' | 'mediumWeight' | 'longWeight'> = { short: 'shortWeight', medium: 'mediumWeight', long: 'longWeight' };
export function effectiveReturns(assumptions: Assumption[]) {
  const dot = (key: 'shortWeight' | 'mediumWeight' | 'longWeight') =>
    assumptions.reduce((sum, item) => sum + item.expectedReturn * item[key] / 100, 0);
  const short = dot('shortWeight');
  // Excel blends the medium-horizon mix 40/60 with the short-term effective return.
  const medium = dot('mediumWeight') * 0.4 + short * 0.6;
  return { short, medium, long: dot('longWeight') };
}
export function effectiveReturnForYears(assumptions: Assumption[], years: number) {
  return effectiveReturns(assumptions)[horizonForYears(years)];
}
export function requiredSipAllocation(goals: Goal[], assumptions: Assumption[]) {
  const totals = new Map<string, number>();
  for (const goal of goals) {
    const key = WEIGHT_KEY[horizonForYears(goal.years)];
    for (const item of assumptions) {
      totals.set(item.className, (totals.get(item.className) || 0) + goal.sip * item[key] / 100);
    }
  }
  return assumptions.map(item => ({ className: item.className, value: totals.get(item.className) || 0 }));
}
export function loadPlan(): PlanData {
  const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
  if (!raw) return blankPlan();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Saved planner data could not be read. Restore a backup before replacing it.'); }
  const normalized = normalizePlan(parsed);
  if (!normalized) throw new Error('Saved planner data is not valid. Export or restore a backup before replacing it.');
  return normalized;
}
export function savePlan(plan: PlanData) { localStorage.setItem(KEY, JSON.stringify(plan)); }
export function blankPlan(): PlanData { return JSON.parse(JSON.stringify(seed)) as PlanData; }
export function emptyPlan(): PlanData {
  const empty = normalizePlan({ sampleData: false, profile: { age: 0, monthlyIncome: 0, monthlyExpenses: 0 }, holdings: [], assets: [], liabilities: [], goals: [], inflows: [], outflows: [], assumptions: [] });
  return empty ?? blankPlan();
}
export function currency(n: number) {
  if (!Number.isFinite(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', { style:'currency',currency:'INR',maximumFractionDigits:0 }).format(n);
}
export function compact(n:number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(2)} L`;
  return currency(n);
}
