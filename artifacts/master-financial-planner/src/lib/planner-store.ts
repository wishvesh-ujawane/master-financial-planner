export type Holding = { id: string; name: string; category: string; value: number; invested: number; sip: number; note?: string };
export type Goal = { id: string; name: string; priority: string; years: number; current: number; target: number; inflation: number; stepUp: number; sip: number };
export type LineItem = { id: string; name: string; amount: number; group: string };
export type Assumption = { className: string; shortTerm: number; mediumTerm: number; longTerm: number; target: number };
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
    {className:'Domestic Equity',shortTerm:7,mediumTerm:10,longTerm:12,target:45},
    {className:'US Equity',shortTerm:6,mediumTerm:9,longTerm:11,target:10},
    {className:'Debt',shortTerm:5,mediumTerm:6,longTerm:7,target:25},
    {className:'Gold (SGB/ETF)',shortTerm:5,mediumTerm:6,longTerm:7,target:8},
    {className:'Crypto',shortTerm:0,mediumTerm:0,longTerm:0,target:0},
    {className:'Real Estate/REITs',shortTerm:4,mediumTerm:6,longTerm:8,target:12},
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
  const merged = new Map<string, { target: number; weighted: [number, number, number]; weights: [number, number, number]; sums: [number, number, number]; count: number }>();
  for (const row of rows) {
    const key = row.className.trim().toLowerCase();
    const className = ASSUMPTION_ALIASES[key] ?? row.className.trim();
    const aggregate = merged.get(className) ?? { target: 0, weighted: [0, 0, 0], weights: [0, 0, 0], sums: [0, 0, 0], count: 0 };
    const returns = [row.shortTerm, row.mediumTerm, row.longTerm] as const;
    aggregate.target += row.target;
    aggregate.count++;
    returns.forEach((value, index) => {
      aggregate.sums[index] += value;
      aggregate.weighted[index] += value * row.target;
      aggregate.weights[index] += row.target;
    });
    merged.set(className, aggregate);
  }
  const result = seed.assumptions.map((defaultItem) => {
    const aggregate = merged.get(defaultItem.className);
    if (!aggregate) return { ...defaultItem, target: 0 };
    return {
      className: defaultItem.className,
      shortTerm: aggregate.weights[0] ? aggregate.weighted[0] / aggregate.weights[0] : aggregate.sums[0] / aggregate.count,
      mediumTerm: aggregate.weights[1] ? aggregate.weighted[1] / aggregate.weights[1] : aggregate.sums[1] / aggregate.count,
      longTerm: aggregate.weights[2] ? aggregate.weighted[2] / aggregate.weights[2] : aggregate.sums[2] / aggregate.count,
      target: aggregate.target,
    };
  });
  for (const [className, aggregate] of merged) {
    if (seed.assumptions.some(item => item.className === className)) continue;
    result.push({
      className,
      shortTerm: aggregate.weights[0] ? aggregate.weighted[0] / aggregate.weights[0] : aggregate.sums[0] / aggregate.count,
      mediumTerm: aggregate.weights[1] ? aggregate.weighted[1] / aggregate.weights[1] : aggregate.sums[1] / aggregate.count,
      longTerm: aggregate.weights[2] ? aggregate.weighted[2] / aggregate.weights[2] : aggregate.sums[2] / aggregate.count,
      target: aggregate.target,
    });
  }
  return result;
}
function migrateLegacyAssumptions(value: unknown): Assumption[] | null {
  if (!Array.isArray(value)) return null;
  if (value.every((item) => isRecord(item) && text(item.className) && finite(item.shortTerm) && finite(item.mediumTerm) && finite(item.longTerm) && finite(item.target))) {
    return canonicalizeAssumptions(value as Assumption[]);
  }
  if (!value.every((item) => isRecord(item) && text(item.className) && text(item.horizon) && finite(item.expected) && finite(item.target))) return null;
  const sourceRows = new Map<string, { className: string; target: number; short: number[]; medium: number[]; long: number[]; fallback: number[] }>();
  for (const raw of value) {
    const item = raw as { className: string; horizon: string; expected: number; target: number };
    const key = item.className.trim().toLowerCase();
    const source = sourceRows.get(key) ?? { className: ASSUMPTION_ALIASES[key] ?? item.className.trim(), target: item.target, short: [], medium: [], long: [], fallback: [] };
    const horizon = item.horizon.toLowerCase();
    if (horizon.includes('short')) source.short.push(item.expected);
    else if (horizon.includes('medium')) source.medium.push(item.expected);
    else if (horizon.includes('long')) source.long.push(item.expected);
    else source.fallback.push(item.expected);
    sourceRows.set(key, source);
  }
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const merged = new Map<string, { target: number; weighted: [number, number, number]; weights: [number, number, number] }>();
  for (const source of sourceRows.values()) {
    const fallback = average(source.fallback) ?? average([...source.short, ...source.medium, ...source.long]) ?? 0;
    const returns = [
      average(source.short) ?? fallback,
      average(source.medium) ?? fallback,
      average(source.long) ?? fallback,
    ] as const;
    const aggregate = merged.get(source.className) ?? { target: 0, weighted: [0, 0, 0], weights: [0, 0, 0] };
    aggregate.target += source.target;
    returns.forEach((value, index) => {
      aggregate.weighted[index] += value * source.target;
      aggregate.weights[index] += source.target;
    });
    merged.set(source.className, aggregate);
  }
  const assumptions=seed.assumptions.map((defaultItem) => {
    const aggregate = merged.get(defaultItem.className);
    if (!aggregate) return { ...defaultItem, target: 0 };
    return {
      className: defaultItem.className,
      shortTerm: aggregate.weights[0] ? aggregate.weighted[0] / aggregate.weights[0] : defaultItem.shortTerm,
      mediumTerm: aggregate.weights[1] ? aggregate.weighted[1] / aggregate.weights[1] : defaultItem.mediumTerm,
      longTerm: aggregate.weights[2] ? aggregate.weighted[2] / aggregate.weights[2] : defaultItem.longTerm,
      target: aggregate.target,
    };
  }).concat([...merged.entries()].filter(([name]) => !seed.assumptions.some(item => item.className === name)).map(([className, aggregate]) => ({
    className,
    shortTerm: aggregate.weights[0] ? aggregate.weighted[0] / aggregate.weights[0] : 0,
    mediumTerm: aggregate.weights[1] ? aggregate.weighted[1] / aggregate.weights[1] : 0,
    longTerm: aggregate.weights[2] ? aggregate.weighted[2] / aggregate.weights[2] : 0,
    target: aggregate.target,
  })));
  return canonicalizeAssumptions(assumptions);
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
export function currency(n: number) {
  if (!Number.isFinite(n)) return '₹0';
  return new Intl.NumberFormat('en-IN', { style:'currency',currency:'INR',maximumFractionDigits:0 }).format(n);
}
export function compact(n:number) {
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(2)} L`;
  return currency(n);
}
