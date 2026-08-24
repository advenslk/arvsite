from pathlib import Path
import re

APP = Path('artifacts/arvex-hosting/src/App.tsx')
ORDERS = Path('artifacts/api-server/src/routes/orders.ts')

app = APP.read_text()

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

product_page = '''function ProductPage({kind}:{kind:keyof typeof plans}) {
  const service=services.find(s=>s.slug===kind)!;
  const [billing,setBilling]=useState<'monthly'|'yearly'>('monthly');
  const [selected,setSelected]=useState<any>(null);
  return <PublicShell><main className="page">
    <div className="container product-hero"><div>
      <p className="eyebrow"><span className="eyebrow-dot"/> {service.sub.toUpperCase()}</p>
      <h1>{service.title}<br/><em>without limits.</em></h1>
      <p>{service.desc} Built for people who care about the details and have better things to do than babysit a server.</p>
      <div className="product-points"><span><Check size={15}/> Instant activation</span><span><Check size={15}/> Cancel anytime</span><span><Check size={15}/> Human support</span></div>
    </div><div className="product-art grid-atmosphere"><div className="art-ring"/><div className="art-icon"><service.icon size={52}/></div><span className="mono">ARVEX / {kind.toUpperCase()}</span></div></div>
    <div className="container plans-section"><div className="plans-heading"><div><p className="eyebrow"><span className="eyebrow-dot"/> FIND YOUR CONFIGURATION</p><h2>Simple plans. Serious headroom.</h2></div>
      <div className="billing-toggle"><button className={billing==='monthly'?'active':''} onClick={()=>setBilling('monthly')} data-testid="button-billing-monthly">Monthly</button><button className={billing==='yearly'?'active':''} onClick={()=>setBilling('yearly')} data-testid="button-billing-yearly">Yearly <b>−20%</b></button></div>
    </div><div className="plans-grid">{plans[kind].map((p,i)=>{const price=billing==='yearly'?Math.round(Number(p.price)*0.8):Number(p.price);return <PlanCard key={p.name} plan={{...p,price}} featured={i===1} onSelect={()=>setSelected({...p,kind,price})}/>})}</div></div>
    <section className="container product-bottom"><div><Activity size={20}/><b>Designed for your workload</b><p>{kind==='game-hosting'?'Modpack-ready, low-latency servers with a control panel your whole clan will understand.':'A clean deployment surface, predictable resources and access that gets out of your way.'}</p></div><ArrowLink href="/support">Need a custom setup?</ArrowLink></section>
  </main>{selected&&<OrderModal plan={selected} onClose={()=>setSelected(null)}/>}</PublicShell>;
}

function OrderModal({plan,onClose}:{plan:any;onClose:()=>void}) {
  const [,setLocation]=useLocation();
  const isLkr=plan.currency==='LKR';
  const display=isLkr?`LKR ${Math.round(Number(plan.price)).toLocaleString('en-LK')}`:`$${Number(plan.price).toFixed(2)}`;
  const checkout=()=>{const params=new URLSearchParams({plan:String(plan.name),service:String(plan.kind),price:String(plan.price),currency:plan.currency||'USD'});setLocation(`/checkout?${params.toString()}`)};
  return <div className="modal-backdrop"><div className="order-modal"><button className="modal-close" onClick={onClose} data-testid="button-close-modal"><X size={18}/></button><p className="eyebrow">CONFIGURATION READY</p><h2>{plan.name} is a good place to start.</h2><p>Continue to checkout to choose a region, operating system and billing cycle.</p><div className="modal-summary"><span>{String(plan.kind).replaceAll('-',' ').toUpperCase()}</span><strong>{display} <small>/ month</small></strong></div><Button onClick={checkout} data-testid="button-continue-checkout">Continue to checkout <ArrowRight size={16}/></Button></div></div>;
}

'''
app, n = re.subn(r"function ProductPage\(.*?function DomainsPage", product_page + "function DomainsPage", app, count=1, flags=re.S)
assert n == 1, 'Could not replace ProductPage/OrderModal'

# Keep the public footer year current.
app = app.replace('© 2025 ArveX Hosting', '© 2026 ArveX Hosting')

checkout = '''function Checkout(){
  const {user,isAuthenticated,isLoading,login}=useAuth();
  const params=new URLSearchParams(window.location.search);
  const serviceKey=params.get('service')||'vps';
  const planName=params.get('plan')||'ARX-VPS-02';
  const currency=params.get('currency')||'LKR';
  const parsedPrice=Number(params.get('price'));
  const fallbackPlan=(plans as any)[serviceKey]?.find((p:any)=>p.name===planName) || (plans as any).vps[0];
  const price=Number.isFinite(parsedPrice)&&parsedPrice>0?parsedPrice:Number(fallbackPlan.price);
  const actualPlan=fallbackPlan.name===planName?fallbackPlan:{...fallbackPlan,name:planName};
  const isLkr=currency==='LKR';
  const formatMoney=(value:number)=>isLkr?`LKR ${Math.round(value).toLocaleString('en-LK')}`:`$${value.toFixed(2)}`;
  const [step,setStep]=useState(1); const [coupon,setCoupon]=useState(''); const [couponMsg,setCouponMsg]=useState(''); const [done,setDone]=useState(false); const [submitting,setSubmitting]=useState(false); const [error,setError]=useState(''); const [orderId,setOrderId]=useState('');
  const discount=coupon.toUpperCase()==='ARVEX10'?price*0.1:0;
  const total=Math.max(0,price-discount);
  const placeOrder=async()=>{setSubmitting(true);setError('');try{const response=await fetch('/api/orders',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({plan:actualPlan.name,service:serviceKey,region:'Frankfurt, Germany',total,currency})});const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Could not place your order.');setOrderId(payload.orderId);setDone(true)}catch(err){setError(err instanceof Error?err.message:'Could not place your order.')}finally{setSubmitting(false)}};
  if(isLoading)return <PublicShell><main className="checkout-page complete"><p className="eyebrow">SECURE CHECKOUT</p><h1>Checking your<br/><em>account.</em></h1></main></PublicShell>;
  if(!isAuthenticated)return <PublicShell><main className="checkout-page complete"><div className="complete-mark"><LockKeyhole size={31}/></div><p className="eyebrow">ACCOUNT REQUIRED</p><h1>Sign in to<br/><em>continue.</em></h1><p>Create or access your real ArveX account before ordering a service.</p><Button onClick={login} className="btn-large" data-testid="button-checkout-login">Sign in to order <ArrowRight size={16}/></Button></main></PublicShell>;
  if(done)return <PublicShell><main className="checkout-page complete"><div className="complete-mark"><Check size={31}/></div><p className="eyebrow">ORDER CONFIRMED / {orderId}</p><h1>Welcome to the<br/><em>network.</em></h1><p>Your order was received for {user?.email}. We sent the order details to the ArveX operations channel.</p><Link href="/dashboard" className="btn btn-primary btn-large" data-testid="link-checkout-dashboard">Open client portal <ArrowRight size={16}/></Link></main></PublicShell>;
  return <PublicShell><main className="checkout-page"><div className="container checkout-wrap"><div className="checkout-head"><Link href="/services" className="back-link" data-testid="link-back-services"><ChevronRight size={15} style={{transform:'rotate(180deg)'}}/> Back to services</Link><div className="checkout-steps">{[1,2,3].map(n=><span className={step>=n?'active':''} key={n}><i>{step>n?<Check size={12}/>:n}</i><small>{['Configure','Details','Confirm'][n-1]}</small></span>)}</div></div>
  <div className="checkout-grid"><section className="checkout-form">
    {step===1&&<><p className="eyebrow">STEP 01 / CONFIGURE</p><h1>Make it yours.</h1><p className="checkout-intro">You’re setting up <b>{actualPlan.name} / {serviceKey.replaceAll('-',' ')}</b>. Adjust the defaults or keep moving.</p><label>REGION<select defaultValue="Frankfurt, Germany" data-testid="select-checkout-region"><option>Frankfurt, Germany</option><option>Helsinki, Finland</option><option>Ashburn, United States</option></select></label><label>OPERATING SYSTEM<select defaultValue="Ubuntu 24.04 LTS" data-testid="select-checkout-os"><option>Ubuntu 24.04 LTS</option><option>Debian 12</option><option>AlmaLinux 9</option></select></label><Button onClick={()=>setStep(2)} data-testid="button-checkout-step-2">Continue <ArrowRight size={16}/></Button></>}
    {step===2&&<><p className="eyebrow">STEP 02 / YOUR DETAILS</p><h1>Almost there.</h1><p className="checkout-intro">We’ll use the email on your authenticated account: <b>{user?.email}</b>.</p><label>PAYMENT METHOD<div className="payment-box"><CreditCard size={18}/><span>Payment provider setup required</span><BadgeCheck size={16}/></div></label><div className="checkout-nav"><Button variant="ghost" onClick={()=>setStep(1)} data-testid="button-checkout-back">Back</Button><Button onClick={()=>setStep(3)} data-testid="button-checkout-step-3">Review order <ArrowRight size={16}/></Button></div></>}
    {step===3&&<><p className="eyebrow">STEP 03 / CONFIRM</p><h1>Ready to run.</h1><p className="checkout-intro">Review your order before provisioning begins.</p><div className="review-box"><p><span>{actualPlan.name}</span><b>{formatMoney(price)} / month</b></p>{discount>0&&<p><span>ARVEX10 discount</span><b>−{formatMoney(discount)}</b></p>}<hr/><p><span>Total today</span><strong>{formatMoney(total)}</strong></p></div><div className="coupon"><input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Have a coupon?" data-testid="input-coupon"/><Button variant="line" onClick={()=>setCouponMsg(coupon.toUpperCase()==='ARVEX10'?'10% discount applied':'That code isn’t valid')} data-testid="button-apply-coupon">Apply</Button></div>{couponMsg&&<p className={`coupon-msg ${couponMsg.includes('applied')?'good':''}`}>{couponMsg}</p>}{error&&<p className="coupon-msg">{error}</p>}<div className="checkout-nav"><Button variant="ghost" onClick={()=>setStep(2)} data-testid="button-review-back">Back</Button><Button onClick={placeOrder} disabled={submitting} data-testid="button-place-order">{submitting?'Sending order…':'Send order request'} <Rocket size={16}/></Button></div></>}
  </section><aside className="order-summary"><div className="summary-top"><span className="mono">ORDER SUMMARY</span><span className="status-pill"><i/> SECURE</span></div><div className="summary-product"><div className="summary-icon"><Cloud size={20}/></div><div><b>{serviceKey.replaceAll('-',' ')}</b><small>{actualPlan.name} · Frankfurt</small></div><strong>{formatMoney(price)}<small>/ month</small></strong></div><div className="summary-lines"><p><span>Plan</span><b>{formatMoney(price)}</b></p>{discount>0&&<p><span>Discount</span><b>−{formatMoney(discount)}</b></p>}<p><span>Tax</span><b>Calculated at checkout</b></p></div><div className="summary-total"><span>Due today</span><strong>{formatMoney(total)}</strong></div><div className="secure-note"><ShieldCheck size={16}/><span>Secure order request<br/><small>No hidden plan-price changes</small></span></div></aside></div></div></main></PublicShell>;
}

'''
app, n = re.subn(r"function Checkout\(\).*?function Admin", checkout + "function Admin", app, count=1, flags=re.S)
assert n == 1, 'Could not replace Checkout'

APP.write_text(app)

orders = ORDERS.read_text()
# Validate the public VPS catalog server-side so clients cannot change the price in the request.
anchor = 'const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;'
catalog = '''const VPS_PRICES: Record<string, number> = {
  'ARX-VPS-02': 680, 'ARX-VPS-04': 1350, 'ARX-VPS-06': 1950, 'ARX-VPS-08': 2650,
  'ARX-VPS-12': 3850, 'ARX-VPS-16': 5200, 'ARX-VPS-24': 7250, 'ARX-VPS-32': 9500,
  'ARX-VPS-48': 14250, 'ARX-VPS-64': 18500, 'ARX-VPS-96': 24000, 'ARX-VPS-128': 29000,
};'''
if 'const VPS_PRICES' not in orders:
    orders = orders.replace(anchor, anchor + '\n\n' + catalog)

old = '''    const total = Number(req.body?.total);'''
new = '''    const total = Number(req.body?.total);
    const currency = typeof req.body?.currency === 'string' ? req.body.currency.toUpperCase() : 'USD';
    if (service === 'vps') {
      const expected = VPS_PRICES[plan];
      if (!expected || currency !== 'LKR' || Math.abs(total - expected) > 0.01) {
        return res.status(400).json({ message: 'Invalid VPS plan or price.' });
      }
    }'''
assert old in orders
orders = orders.replace(old, new, 1)
orders = orders.replace('{ name: "Total", value: `$${total.toFixed(2)} / month`, inline: true },', '{ name: "Total", value: `${currency} ${total.toFixed(2)} / month`, inline: true },')
ORDERS.write_text(orders)

print('ArveX repair applied')
