from pathlib import Path
import re

# Resolve paths from the repository root, not the caller's current directory.
# This lets the repair script work from the repo root, the artifact directory,
# CI, or when invoked through a downloaded copy of this file.
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = next((p for p in [Path.cwd().resolve(), *Path.cwd().resolve().parents, SCRIPT_DIR, *SCRIPT_DIR.parents] if (p / 'artifacts/arvex-hosting/src/App.tsx').exists()), None)
if REPO_ROOT is None:
    raise SystemExit('Could not locate the arvsite repository root (artifacts/arvex-hosting/src/App.tsx).')

APP = REPO_ROOT / 'artifacts/arvex-hosting/src/App.tsx'
ORDERS = REPO_ROOT / 'artifacts/api-server/src/routes/orders.ts'

app = APP.read_text(encoding='utf-8')

# Canonical Cloud VPS catalog requested for ArveX.
plans = '''const plans = {
  vps: [
    {name:'ARX-VPS-02', price:680, currency:'LKR', cpu:'2 vCPU', ram:'2 GB RAM', disk:'40 GB NVMe SSD', transfer:'2 TB transfer'},
    {name:'ARX-VPS-04', price:1350, currency:'LKR', cpu:'4 vCPU', ram:'4 GB RAM', disk:'80 GB NVMe SSD', transfer:'4 TB transfer'},
    {name:'ARX-VPS-06', price:1950, currency:'LKR', cpu:'6 vCPU', ram:'6 GB RAM', disk:'120 GB NVMe SSD', transfer:'5 TB transfer'},
    {name:'ARX-VPS-08', price:2650, currency:'LKR', cpu:'8 vCPU', ram:'8 GB RAM', disk:'160 GB NVMe SSD', transfer:'6 TB transfer'},
    {name:'ARX-VPS-12', price:3850, currency:'LKR', cpu:'12 vCPU', ram:'12 GB RAM', disk:'240 GB NVMe SSD', transfer:'8 TB transfer'},
    {name:'ARX-VPS-16', price:5200, currency:'LKR', cpu:'16 vCPU', ram:'16 GB RAM', disk:'320 GB NVMe SSD', transfer:'10 TB transfer'},
    {name:'ARX-VPS-24', price:7250, currency:'LKR', cpu:'24 vCPU', ram:'24 GB RAM', disk:'480 GB NVMe SSD', transfer:'12 TB transfer'},
    {name:'ARX-VPS-32', price:9500, currency:'LKR', cpu:'32 vCPU', ram:'32 GB RAM', disk:'640 GB NVMe SSD', transfer:'15 TB transfer'},
    {name:'ARX-VPS-48', price:14250, currency:'LKR', cpu:'48 vCPU', ram:'48 GB RAM', disk:'960 GB NVMe SSD', transfer:'20 TB transfer'},
    {name:'ARX-VPS-64', price:18500, currency:'LKR', cpu:'64 vCPU', ram:'64 GB RAM', disk:'1.28 TB NVMe SSD', transfer:'25 TB transfer'},
    {name:'ARX-VPS-96', price:24000, currency:'LKR', cpu:'96 vCPU', ram:'96 GB RAM', disk:'1.92 TB NVMe SSD', transfer:'30 TB transfer'},
    {name:'ARX-VPS-128', price:29000, currency:'LKR', cpu:'128 vCPU', ram:'128 GB RAM', disk:'2.56 TB NVMe SSD', transfer:'40 TB transfer'},
  ],
  vds: [{name:'Forge', price:29, cpu:'4 vCPU', ram:'16 GB', disk:'240 GB NVMe', transfer:'10 TB transfer'}, {name:'Titan', price:54, cpu:'8 vCPU', ram:'32 GB', disk:'480 GB NVMe', transfer:'15 TB transfer'}, {name:'Apex', price:96, cpu:'12 vCPU', ram:'64 GB', disk:'960 GB NVMe', transfer:'20 TB transfer'}],
  'web-hosting': [{name:'Launch', price:3.5, cpu:'1 site', ram:'10 GB', disk:'50 GB NVMe', transfer:'Unmetered'}, {name:'Scale', price:7.5, cpu:'10 sites', ram:'25 GB', disk:'120 GB NVMe', transfer:'Unmetered'}, {name:'Studio', price:14, cpu:'Unlimited', ram:'50 GB', disk:'240 GB NVMe', transfer:'Unmetered'}],
  'bot-hosting': [{name:'Hatchling', price:2.9, cpu:'1 vCPU', ram:'512 MB', disk:'5 GB NVMe', transfer:'1 TB transfer'}, {name:'Operator', price:6.9, cpu:'2 vCPU', ram:'2 GB', disk:'20 GB NVMe', transfer:'3 TB transfer'}, {name:'Collective', price:12.9, cpu:'4 vCPU', ram:'4 GB', disk:'40 GB NVMe', transfer:'6 TB transfer'}],
  'game-hosting': [{name:'Scout', price:6.5, cpu:'2 vCPU', ram:'4 GB', disk:'40 GB NVMe', transfer:'Unmetered'}, {name:'Squad', price:12.5, cpu:'4 vCPU', ram:'8 GB', disk:'80 GB NVMe', transfer:'Unmetered'}, {name:'Guild', price:24.5, cpu:'6 vCPU', ram:'16 GB', disk:'160 GB NVMe', transfer:'Unmetered'}],
} as const;'''

app, n = re.subn(r"const plans = \{.*?\n\} as const;", plans, app, count=1, flags=re.S)
assert n == 1, 'Could not locate plans catalog'

plan_card = '''function PlanCard({plan, featured=false,onSelect}:{plan:any;featured?:boolean;onSelect:()=>void}) {
  const isLkr = plan.currency === 'LKR';
  const price = isLkr ? `LKR ${Math.round(Number(plan.price)).toLocaleString('en-LK')}` : `$${Number(plan.price).toFixed(2)}`;
  return <div className={`plan-card ${featured?'featured':''}`}>
    {featured&&<span className="plan-badge">MOST POPULAR</span>}
    <div className="plan-top"><span className="plan-dot"/><span className="mono">{plan.name.toUpperCase()}</span></div>
    <div className="plan-price"><strong>{price}</strong><span>/ mo</span>{isLkr&&<small className="plan-usd-price">≈ ${(Number(plan.price) / 3890).toFixed(2)} USD</small>}</div>
    <div className="plan-specs"><span><CpuIcon/> {plan.cpu}</span><span><MemoryIcon/> {plan.ram}</span><span><Database size={15}/> {plan.disk}</span><span><Network size={15}/> {plan.transfer}</span></div>
    <Button variant={featured?'primary':'line'} className="plan-button" onClick={onSelect} data-testid={`button-select-${plan.name.toLowerCase()}`}>Select {plan.name} <ArrowRight size={15}/></Button>
  </div>;
}
function CpuIcon(){return <Settings size={15}/>} function MemoryIcon(){return <Box size={15}/>}
'''
app, n = re.subn(r"function PlanCard\(.*?function ProductPage", plan_card + "function ProductPage", app, count=1, flags=re.S)
assert n == 1, 'Could not replace PlanCard'

# Keep the checkout flow consistent with the canonical plan catalog.
# The checkout request carries the billing cycle so the API can validate the
# exact monthly/yearly price instead of trusting a client-supplied total.
app = app.replace(
    "const checkout=()=>{const params=new URLSearchParams({plan:String(plan.name),service:String(plan.kind),price:String(plan.price),currency:plan.currency||'USD'});setLocation(`/checkout?${params.toString()}`)};",
    "const checkout=()=>{const params=new URLSearchParams({plan:String(plan.name),service:String(plan.kind),price:String(plan.price),currency:plan.currency||'USD',billing:'monthly'});setLocation(`/checkout?${params.toString()}`)};"
)

# Make the checkout request explicit about the billing cycle and prevent the
# 20% yearly display price from being rejected by the server.
app = app.replace(
    "const currency=params.get('currency')||'LKR';\n  const parsedPrice=Number(params.get('price'));",
    "const currency=(params.get('currency')||'LKR').toUpperCase();\n  const billing=params.get('billing')==='yearly'?'yearly':'monthly';\n  const parsedPrice=Number(params.get('price'));"
)
app = app.replace(
    "const response=await fetch('/api/orders',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({plan:actualPlan.name,service:serviceKey,region:'Frankfurt, Germany',total,currency})});",
    "const response=await fetch('/api/orders',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({plan:actualPlan.name,service:serviceKey,region:'Frankfurt, Germany',total,currency,billingCycle:billing})});"
)

APP.write_text(app, encoding='utf-8')

orders = ORDERS.read_text(encoding='utf-8')
orders = orders.replace(
    "    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : 'USD';\n    if (service === 'vps') {\n      const expected = VPS_PRICES[plan];\n      if (!expected || currency !== 'LKR' || Math.abs(total - expected) > 0.01) {\n        return res.status(400).json({ message: 'Invalid VPS plan or price.' });\n      }\n    }",
    "    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : 'USD';\n    const billingCycle = req.body?.billingCycle === 'yearly' ? 'yearly' : 'monthly';\n    if (service === 'vps') {\n      const monthlyPrice = VPS_PRICES[plan];\n      const expected = billingCycle === 'yearly' ? Math.round(monthlyPrice * 0.8) : monthlyPrice;\n      if (!monthlyPrice || currency !== 'LKR' || Math.abs(total - expected) > 0.01) {\n        return res.status(400).json({ message: 'Invalid VPS plan, billing cycle or price.' });\n      }\n    }"
)
ORDERS.write_text(orders, encoding='utf-8')
print(f'Repaired {APP} and {ORDERS}')
