// SAB — Procurement routes: Vendors, Purchase orders, Goods receipts, Vendor bills
// Plus project-scoped Materials tab. Reads SEED.{vendors,purchaseOrders,grns,vendorBills} on first mount,
// then maintains local React state so demo create / approve / match interactions actually feel live.

const PO_TONE  = { draft:'ink', 'pending-approval':'amber', approved:'blue', sent:'blue', 'partially-received':'accent', received:'positive', closed:'positive', cancelled:'alert' };
const GRN_TONE = { draft:'ink', accepted:'positive', 'partially-accepted':'amber', rejected:'alert' };
const BILL_TONE= { draft:'ink', 'pending-match':'amber', matched:'blue', discrepancy:'alert', approved:'accent', paid:'positive', overdue:'alert' };

function approvalTierFor(total) {
  if (total <= 1_00_000)  return 'auto';
  if (total <= 10_00_000) return 'pm';
  return 'director';
}

function vendorById(id, list)   { return (list || SEED.vendors).find(v => v.id === id) || { name: '—', state: '—', gstin: '—' }; }
function poById(id, list)       { return (list || SEED.purchaseOrders).find(p => p.id === id); }
function grnById(id, list)      { return (list || SEED.grns).find(g => g.id === id); }

// ─── shared toast + form primitives (scoped to procurement block) ────────────
function Notice({ tone='positive', children, onClose }) {
  const c = TOKENS[tone] || TOKENS.positive;
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10, padding:'9px 12px', marginBottom: 14,
      background: `${c}14`, border: `1px solid ${c}55`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, flex:'none' }}/>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && <button onClick={onClose} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>}
    </div>
  );
}

function Field({ label, ...rest }) {
  const { style, ...inputRest } = rest;
  return (
    <div>
      <label style={{ display:'block', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <input {...inputRest} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, background: TOKENS.card, ...(style||{}) }}/>
    </div>
  );
}

function FieldSelect({ label, children, ...rest }) {
  const { style, ...selectRest } = rest;
  return (
    <div>
      <label style={{ display:'block', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</label>
      <select {...selectRest} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, background: TOKENS.card, ...(style||{}) }}>{children}</select>
    </div>
  );
}

function CreateCard({ title, children, onCancel, onSubmit, submitLabel='Create' }) {
  return (
    <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.accent}66`, borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <div style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>{title}</div>
        <button onClick={onCancel} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      {children}
      <div style={{ display:'flex', gap: 8, marginTop: 14, justifyContent:'flex-end' }}>
        <Btn variant="outline" size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" size="sm" icon="check" onClick={onSubmit}>{submitLabel}</Btn>
      </div>
    </div>
  );
}

// ─── VENDORS ──────────────────────────────────────────────────────────────────
function VendorsRoute() {
  const [vendors, setVendors] = React.useState(SEED.vendors);
  const [open, setOpen] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({ name:'', gstin:'', state:'Karnataka', category:'Pipes', contact:'', phone:'', email:'', paymentTerms:'Net 30' });

  if (open) return <VendorDetail vendor={open} onBack={() => setOpen(null)}/>;

  const addVendor = () => {
    if (!draft.name.trim()) { setToast({ tone:'amber', msg:'Vendor name is required.' }); return; }
    const nextId = `V-${1041 + vendors.length}`;
    const v = {
      id: nextId, name: draft.name.trim(), gstin: draft.gstin || '—',
      state: draft.state, msme: false, category: draft.category,
      contact: draft.contact, phone: draft.phone, email: draft.email,
      paymentTerms: draft.paymentTerms, creditLimit: 500000, outstanding: 0,
      rating: 0, onTimePct: 0, lastSupplied: '—',
    };
    setVendors([...vendors, v]);
    setFormOpen(false);
    setDraft({ name:'', gstin:'', state:'Karnataka', category:'Pipes', contact:'', phone:'', email:'', paymentTerms:'Net 30' });
    setToast({ tone:'positive', msg:`${v.name} added as ${nextId}.` });
  };

  const exportCsv = () => setToast({ tone:'positive', msg:`Exported ${vendors.length} vendors to vendors_${new Date().toISOString().slice(0,10)}.csv.` });

  const totalPayables = vendors.reduce((a, v) => a + v.outstanding, 0);
  const avgOnTime = Math.round(vendors.reduce((a, v) => a + v.onTimePct, 0) / vendors.length);
  const msmeShare = Math.round(vendors.filter(v => v.msme).length / vendors.length * 100);

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader eyebrow="Procurement" title="Vendors" description="Master file of approved suppliers — GSTIN, payment terms, performance, outstanding payables."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setFormOpen(true)}>New vendor</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      {formOpen && (
        <CreateCard title="New vendor" submitLabel="Add vendor" onCancel={() => setFormOpen(false)} onSubmit={addVendor}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Vendor name" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Hindustan Pipes & Fittings"/>
            <Field label="GSTIN" value={draft.gstin} onChange={e => setDraft({...draft, gstin: e.target.value})} placeholder="27ABCDE1234F1Z5"/>
            <FieldSelect label="State" value={draft.state} onChange={e => setDraft({...draft, state: e.target.value})}>
              {['Karnataka','Maharashtra','Tamil Nadu','Telangana','Kerala','Gujarat','Delhi'].map(s => <option key={s}>{s}</option>)}
            </FieldSelect>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 10 }}>
            <FieldSelect label="Category" value={draft.category} onChange={e => setDraft({...draft, category: e.target.value})}>
              {['Pipes','Fittings','Pumps','Valves','Sprinklers','Tools','Consumables'].map(c => <option key={c}>{c}</option>)}
            </FieldSelect>
            <Field label="Contact" value={draft.contact} onChange={e => setDraft({...draft, contact: e.target.value})}/>
            <Field label="Phone" value={draft.phone} onChange={e => setDraft({...draft, phone: e.target.value})}/>
            <FieldSelect label="Payment terms" value={draft.paymentTerms} onChange={e => setDraft({...draft, paymentTerms: e.target.value})}>
              {['Net 15','Net 30','Net 45','Net 60','Advance'].map(t => <option key={t}>{t}</option>)}
            </FieldSelect>
          </div>
        </CreateCard>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Active vendors"        value={vendors.length}        sub={`${vendors.filter(v=>v.msme).length} MSME registered`} accent/>
        <KPI label="Outstanding payables"  value={inr(totalPayables)} sub="across all vendors"/>
        <KPI label="Avg. on-time delivery" value={`${avgOnTime}%`}    sub="rolling 90 days"/>
        <KPI label="MSME share"            value={`${msmeShare}%`}    sub="protected payment SLA"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['Vendor','Category','State','GSTIN','Outstanding','Rating','Last supplied',''].map((h, i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i===4 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {vendors.map((v, i) => (
              <tr key={i} onClick={() => setOpen(v)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ color: TOKENS.ink, fontWeight:600 }}>{v.name}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{v.id} · {v.contact || '—'}</div>
                </td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink2 }}>{v.category}</td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink2 }}>
                  {v.state}
                  {v.msme && <Pill tone="accent" size="sm" style={{ marginLeft: 6 }}>MSME</Pill>}
                </td>
                <td style={{ padding:'10px 12px' }}><Code>{v.gstin}</Code></td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: v.outstanding > 0 ? TOKENS.ink : TOKENS.ink3 }}>{v.outstanding > 0 ? inr(v.outstanding) : '—'}</td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, color: TOKENS.ink2 }}>{v.rating > 0 ? `★ ${v.rating} · ${v.onTimePct}%` : 'new'}</td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{v.lastSupplied}</td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorDetail({ vendor, onBack }) {
  const v = vendor;
  const [toast, setToast] = React.useState(null);
  const pos = SEED.purchaseOrders.filter(p => p.vendorId === v.id);
  const bills = SEED.vendorBills.filter(b => b.vendorId === v.id);
  const totalSpend = pos.reduce((a, p) => a + p.total, 0);

  const downloadStatement = () => setToast({ tone:'positive', msg:`Statement for ${v.name} (${pos.length} POs · ${bills.length} bills) queued for download as PDF.` });
  const newPo = () => setToast({ tone:'positive', msg:`Open Procurement → Purchase orders → New PO and pre-select ${v.name}.` });

  return (
    <div style={{ padding:'22px 28px 48px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Vendors</button>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{v.id}</span>
      </div>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 24, marginBottom: 18 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Code style={{ fontSize: 13, padding:'3px 8px', background: TOKENS.accentWash, borderRadius: 3 }}>{v.id}</Code>
            {v.msme && <Pill tone="accent" dot>MSME</Pill>}
            <Pill tone="ink" size="sm">{v.category}</Pill>
            <Pill tone="ink" size="sm">{v.paymentTerms}</Pill>
          </div>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0 }}>{v.name}</h1>
          <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3, display:'flex', gap: 14 }}>
            <span>{v.contact}</span><span>·</span><span>{v.phone}</span><span>·</span><span>{v.email}</span><span>·</span><span>{v.state}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="outline" size="sm" icon="download" onClick={downloadStatement}>Statement</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={newPo}>New PO</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden', marginBottom: 18 }}>
        <StatBlock label="GSTIN"             value={v.gstin}              sub={v.state}/>
        <StatBlock label="Credit limit"      value={inr(v.creditLimit)}   sub={`${v.paymentTerms}`}/>
        <StatBlock label="Outstanding"       value={inr(v.outstanding)}   sub={v.creditLimit ? `${Math.round(v.outstanding/v.creditLimit*100)}% of limit` : '—'} accent/>
        <StatBlock label="Total spend · FY"  value={inr(totalSpend)}      sub={`${pos.length} POs`}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap: 16 }}>
        <Card title="Purchase orders" sub={`${pos.length} orders, ${pos.filter(p => p.status==='received'||p.status==='closed').length} closed`}>
          {pos.length === 0 ? (
            <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No POs raised against this vendor yet.</div>
          ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
            <tbody>
              {pos.map((p, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                  <td style={{ padding:'8px 0' }}><Code>{p.id}</Code></td>
                  <td style={{ padding:'8px 0', color: TOKENS.ink2 }}>{p.issueDate}</td>
                  <td style={{ padding:'8px 0' }}><Pill tone={PO_TONE[p.status]} size="sm" dot>{p.status.replace('-',' ')}</Pill></td>
                  <td style={{ padding:'8px 0', textAlign:'right', fontFamily: FONT.mono, fontWeight:600 }}>{inr(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </Card>
        <Card title="Performance">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Rating</div>
              <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 600, color: TOKENS.positive }}>★ {v.rating}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>composite score</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>On-time</div>
              <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 600, color: TOKENS.ink }}>{v.onTimePct}%</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>last 90 days</div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Recent bills</div>
          {bills.length === 0 && <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginTop: 6 }}>No bills on record yet.</div>}
          {bills.slice(0,4).map((b, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none', fontFamily: FONT.sans, fontSize: 12 }}>
              <span><Code>{b.id}</Code></span>
              <Pill tone={BILL_TONE[b.status]} size="sm" dot>{b.status.replace('-',' ')}</Pill>
              <span style={{ fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(b.total)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── PURCHASE ORDERS ──────────────────────────────────────────────────────────
function PurchaseOrdersRoute() {
  const [orders, setOrders] = React.useState(SEED.purchaseOrders);
  const [open, setOpen] = React.useState(null);
  const [filter, setFilter] = React.useState('all');
  const [toast, setToast] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    vendorId: SEED.vendors[0]?.id || '',
    projectId: SEED.projects[0]?.code || '',
    expectedDate: '',
    sku: '', desc: '', qty: 0, uom: 'm', rate: 0, gstPct: 18,
  });

  if (open) {
    return <PurchaseOrderDetail
      po={open}
      onBack={() => setOpen(null)}
      onUpdate={(updated) => {
        setOrders(orders.map(p => p.id === updated.id ? updated : p));
        setOpen(updated);
      }}/>;
  }

  const rows = filter === 'all' ? orders : orders.filter(p => p.status === filter);
  const open_ = orders.filter(p => !['received','closed','cancelled'].includes(p.status));
  const pendingApproval = orders.filter(p => p.status === 'pending-approval');
  const awaitingReceipt = orders.filter(p => ['sent','approved','partially-received'].includes(p.status));
  const monthValue = orders.filter(p => p.issueDate.includes('Apr 26')).reduce((a,p)=>a+p.total,0);

  const exportCsv = () => setToast({ tone:'positive', msg:`Exported ${rows.length} POs (${filter === 'all' ? 'all statuses' : filter}) to purchase_orders.csv.` });

  const submitPo = () => {
    const qty = +draft.qty, rate = +draft.rate, gstPct = +draft.gstPct;
    if (!draft.sku.trim() || !draft.desc.trim()) { setToast({ tone:'amber', msg:'SKU and description are required.' }); return; }
    if (qty <= 0 || rate <= 0)                    { setToast({ tone:'amber', msg:'Qty and rate must be greater than zero.' }); return; }
    const subtotal = qty * rate;
    const gstAmount = Math.round(subtotal * gstPct / 100);
    const total = subtotal + gstAmount;
    const tier = approvalTierFor(total);
    const status = tier === 'auto' ? 'approved' : 'pending-approval';
    const seq = String(118 + orders.length).padStart(4, '0');
    const nextId = `SAB/PO/26/${seq}`;
    const today = new Date();
    const issueDate = today.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' });
    const po = {
      id: nextId, vendorId: draft.vendorId, projectId: draft.projectId,
      issueDate, expectedDate: draft.expectedDate || '—',
      status, approvalTier: tier,
      approvedBy: tier === 'auto' ? 'Auto · under ₹1L' : null,
      approvedAt: tier === 'auto' ? today.toISOString() : null,
      lines: [{ sku: draft.sku.trim(), desc: draft.desc.trim(), qty, uom: draft.uom, rate, gstPct }],
      subtotal, gstAmount, total, receivedQty: 0, billedAmount: 0,
    };
    setOrders([po, ...orders]);
    setFormOpen(false);
    setDraft({ ...draft, sku:'', desc:'', qty:0, rate:0, expectedDate:'' });
    setToast({ tone:'positive', msg:`${nextId} created · ${inr(total)} · ${tier === 'auto' ? 'auto-approved' : `awaiting ${tier} approval`}.` });
  };

  const Filter = ({ k, label }) => (
    <button onClick={() => setFilter(k)} style={{
      padding:'5px 10px', borderRadius: 4, fontFamily: FONT.sans, fontSize: 12,
      background: filter === k ? TOKENS.ink : TOKENS.card,
      color: filter === k ? '#fff' : TOKENS.ink2,
      border: `1px solid ${filter === k ? TOKENS.ink : TOKENS.ruleStrong}`,
      cursor:'pointer',
    }}>{label}</button>
  );

  const subtotalPreview = (+draft.qty || 0) * (+draft.rate || 0);
  const totalPreview = subtotalPreview + Math.round(subtotalPreview * (+draft.gstPct || 0) / 100);
  const tierPreview = approvalTierFor(totalPreview);

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader eyebrow="Procurement" title="Purchase orders" description="Outbound POs SAB issues to vendors. Threshold approval (₹1L · ₹10L), 3-way match downstream."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setFormOpen(true)}>New PO</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      {formOpen && (
        <CreateCard title="New purchase order" submitLabel="Create PO" onCancel={() => setFormOpen(false)} onSubmit={submitPo}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <FieldSelect label="Vendor" value={draft.vendorId} onChange={e => setDraft({...draft, vendorId: e.target.value})}>
              {SEED.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Project" value={draft.projectId} onChange={e => setDraft({...draft, projectId: e.target.value})}>
              {SEED.projects.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
            </FieldSelect>
            <Field label="Expected date" value={draft.expectedDate} onChange={e => setDraft({...draft, expectedDate: e.target.value})} placeholder="e.g. 25 Apr 26"/>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Line item</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 0.6fr 0.6fr 0.8fr 0.6fr', gap: 8 }}>
            <Field label="SKU" value={draft.sku} onChange={e => setDraft({...draft, sku: e.target.value})} placeholder="PIPE-CS-150"/>
            <Field label="Description" value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} placeholder="150NB CS pipe SCH40"/>
            <Field label="Qty" type="number" value={draft.qty} onChange={e => setDraft({...draft, qty: e.target.value})}/>
            <FieldSelect label="UoM" value={draft.uom} onChange={e => setDraft({...draft, uom: e.target.value})}>
              {['m','no','kg','set','lot','bag'].map(u => <option key={u}>{u}</option>)}
            </FieldSelect>
            <Field label="Rate (₹)" type="number" value={draft.rate} onChange={e => setDraft({...draft, rate: e.target.value})}/>
            <FieldSelect label="GST %" value={draft.gstPct} onChange={e => setDraft({...draft, gstPct: e.target.value})}>
              {[0,5,12,18,28].map(g => <option key={g} value={g}>{g}%</option>)}
            </FieldSelect>
          </div>
          {subtotalPreview > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: TOKENS.paperAlt, borderRadius: 3, display:'flex', justifyContent:'space-between', fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>
              <span>Subtotal {inr(subtotalPreview)} · GST {inr(Math.round(subtotalPreview * (+draft.gstPct || 0) / 100))}</span>
              <span style={{ fontWeight: 600, color: TOKENS.ink }}>Total {inr(totalPreview)} · {tierPreview === 'auto' ? 'auto-approved' : `${tierPreview} approval needed`}</span>
            </div>
          )}
        </CreateCard>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Open POs"           value={open_.length}            sub={`${inr(open_.reduce((a,p)=>a+p.total,0))} value`} accent/>
        <KPI label="Awaiting approval"  value={pendingApproval.length}  sub={`${inr(pendingApproval.reduce((a,p)=>a+p.total,0))}`}/>
        <KPI label="Awaiting receipt"   value={awaitingReceipt.length}  sub="GRN pending"/>
        <KPI label="Issued · this month" value={inr(monthValue)}        sub={`${orders.filter(p=>p.issueDate.includes('Apr 26')).length} POs · Apr 26`}/>
      </div>
      <div style={{ display:'flex', gap: 6, marginBottom: 12 }}>
        <Filter k="all" label="All"/>
        <Filter k="pending-approval" label="Pending approval"/>
        <Filter k="sent" label="Sent"/>
        <Filter k="partially-received" label="Partially received"/>
        <Filter k="received" label="Received"/>
        <Filter k="closed" label="Closed"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['PO #','Vendor','Project','Issued','Expected','Status','Approval','Total',''].map((h, i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i===7 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((p, i) => {
              const v = vendorById(p.vendorId);
              return (
                <tr key={i} onClick={() => setOpen(p)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                  <td style={{ padding:'10px 12px' }}><Code>{p.id}</Code></td>
                  <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{v.name}</td>
                  <td style={{ padding:'10px 12px' }}><Code style={{ color: TOKENS.ink3 }}>{p.projectId}</Code></td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{p.issueDate}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{p.expectedDate}</td>
                  <td style={{ padding:'10px 12px' }}><Pill tone={PO_TONE[p.status]} size="sm" dot>{p.status.replace(/-/g,' ')}</Pill></td>
                  <td style={{ padding:'10px 12px' }}><Pill tone="ink" size="sm">{p.approvalTier}</Pill></td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(p.total)}</td>
                  <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseOrderDetail({ po, onBack, onUpdate }) {
  const [status, setStatus] = React.useState(po.status);
  const [approvedBy, setApprovedBy] = React.useState(po.approvedBy);
  const [toast, setToast] = React.useState(null);
  const v = vendorById(po.vendorId);
  const grns = SEED.grns.filter(g => g.poId === po.id);
  const bills = SEED.vendorBills.filter(b => b.poId === po.id);
  const tier = approvalTierFor(po.total);

  const propagate = (next) => { if (onUpdate) onUpdate({ ...po, ...next }); };

  const approve = () => {
    setStatus('approved');
    setApprovedBy('Anita Rao');
    propagate({ status:'approved', approvedBy:'Anita Rao', approvedAt: new Date().toISOString() });
    setToast({ tone:'positive', msg:`${po.id} approved by Anita Rao. Ready to send to ${v.name}.` });
  };

  const sendBack = () => {
    setStatus('draft');
    propagate({ status:'draft' });
    setToast({ tone:'amber', msg:`${po.id} returned to draft for revisions.` });
  };

  const downloadPdf = () => setToast({ tone:'positive', msg:`${po.id}.pdf queued for download.` });

  return (
    <div style={{ padding:'22px 28px 48px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Purchase orders</button>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{po.id}</span>
      </div>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 24, marginBottom: 18 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Code style={{ fontSize: 13, padding:'3px 8px', background: TOKENS.accentWash, borderRadius: 3 }}>{po.id}</Code>
            <Pill tone={PO_TONE[status]} dot>{status.replace(/-/g,' ')}</Pill>
            <Pill tone="ink" size="sm">{tier} approval</Pill>
            <Pill tone="ink" size="sm">{po.projectId}</Pill>
          </div>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0 }}>{v.name}</h1>
          <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>
            Issued {po.issueDate} · expected {po.expectedDate}{approvedBy ? ` · approved by ${approvedBy}` : ''}
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="outline" size="sm" icon="download" onClick={downloadPdf}>PDF</Btn>
          {status === 'pending-approval' && tier !== 'auto' && (
            <>
              <Btn variant="outline" size="sm" onClick={sendBack}>Send back</Btn>
              <Btn variant="primary" size="sm" icon="check" onClick={approve}>Approve</Btn>
            </>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden', marginBottom: 18 }}>
        <StatBlock label="Subtotal"   value={inr(po.subtotal)}   sub={`${po.lines.length} line${po.lines.length>1?'s':''}`}/>
        <StatBlock label="GST (18%)"  value={inr(po.gstAmount)}  sub={v.state === 'Karnataka' ? 'CGST + SGST' : 'IGST'}/>
        <StatBlock label="Total"      value={inr(po.total)}      sub="invoice value" accent/>
        <StatBlock label="Received"   value={`${po.receivedQty} / ${po.lines.reduce((a,l)=>a+l.qty,0)}`} sub={grns.length ? `${grns.length} GRN${grns.length>1?'s':''}` : 'no GRN yet'}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap: 16 }}>
        <Card title="Line items">
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
            <thead><tr style={{ borderBottom: `1px solid ${TOKENS.rule}` }}>
              {['SKU','Description','Qty','Rate','GST','Amount'].map((h, i) => (
                <th key={i} style={{ padding:'8px 0', textAlign: i>=2?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {po.lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}>
                  <td style={{ padding:'10px 0' }}><Code>{l.sku}</Code></td>
                  <td style={{ padding:'10px 0', color: TOKENS.ink }}>{l.desc}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono }}>{l.qty} {l.uom}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono }}>{inr(l.rate, { compact:false })}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink3 }}>{l.gstPct}%</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600 }}>{inr(l.qty * l.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <Card title="Goods receipts" sub={grns.length ? `${grns.length} GRN${grns.length>1?'s':''}` : 'awaiting receipt'}>
            {grns.length === 0 && <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No goods received yet.</div>}
            {grns.map((g, i) => (
              <div key={i} style={{ padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <Code>{g.id}</Code>
                  <Pill tone={GRN_TONE[g.status]} size="sm" dot>{g.status.replace('-',' ')}</Pill>
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, marginTop: 3 }}>{g.receivedDate} · {g.vehicleNo}</div>
              </div>
            ))}
          </Card>
          <Card title="Vendor bills" sub={bills.length ? `${bills.length} bill${bills.length>1?'s':''}` : 'no bills yet'}>
            {bills.length === 0 && <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>Awaiting vendor invoice.</div>}
            {bills.map((b, i) => (
              <div key={i} style={{ padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily: FONT.sans, fontSize: 12 }}>
                <Code>{b.id}</Code>
                <Pill tone={BILL_TONE[b.status]} size="sm" dot>{b.status.replace('-',' ')}</Pill>
                <span style={{ fontFamily: FONT.mono, fontWeight: 600 }}>{inr(b.total)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── GRNs ─────────────────────────────────────────────────────────────────────
function GRNsRoute() {
  const [grns, setGrns] = React.useState(SEED.grns);
  const [open, setOpen] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    poId: SEED.purchaseOrders[0]?.id || '',
    receivedDate: '',
    vehicleNo: '',
    invoiceRef: '',
    receivedBy: 'Site Eng. - Vikram',
    receivedQty: 0,
    rejectedQty: 0,
    remarks: '',
  });

  if (open) return <GRNDetail grn={open} onBack={() => setOpen(null)}/>;

  const exportCsv = () => setToast({ tone:'positive', msg:`Exported ${grns.length} GRNs to goods_receipts.csv.` });

  const submitGrn = () => {
    const po = SEED.purchaseOrders.find(p => p.id === draft.poId);
    if (!po)                                   { setToast({ tone:'amber', msg:'Select a valid PO.' }); return; }
    if (!draft.receivedDate || !draft.vehicleNo) { setToast({ tone:'amber', msg:'Received date and vehicle number are required.' }); return; }
    const recv = +draft.receivedQty, rej = +draft.rejectedQty;
    const line = po.lines[0];
    if (recv <= 0 || recv > line.qty) { setToast({ tone:'amber', msg:`Received qty must be between 1 and ${line.qty} ${line.uom}.` }); return; }
    const acceptedQty = Math.max(0, recv - rej);
    const status = rej === recv ? 'rejected' : recv < line.qty || rej > 0 ? 'partially-accepted' : 'accepted';
    const seq = String(91 + grns.length).padStart(4, '0');
    const nextId = `SAB/GRN/26/${seq}`;
    const grn = {
      id: nextId, poId: draft.poId, vendorId: po.vendorId,
      receivedDate: draft.receivedDate, receivedBy: draft.receivedBy,
      status,
      lines: [{
        sku: line.sku, orderedQty: line.qty,
        receivedQty: recv, acceptedQty, rejectedQty: rej,
        remarks: draft.remarks || (recv < line.qty ? `${line.qty - recv} ${line.uom} short` : 'OK'),
      }],
      vehicleNo: draft.vehicleNo, invoiceRef: draft.invoiceRef || '—',
    };
    setGrns([grn, ...grns]);
    setFormOpen(false);
    setDraft({ ...draft, receivedDate:'', vehicleNo:'', invoiceRef:'', receivedQty:0, rejectedQty:0, remarks:'' });
    setToast({ tone:'positive', msg:`${nextId} recorded for ${draft.poId} · ${status.replace('-',' ')}.` });
  };

  const partial = grns.filter(g => g.status === 'partially-accepted').length;
  const rejects = grns.filter(g => g.status === 'rejected').length;

  const selectedPo = SEED.purchaseOrders.find(p => p.id === draft.poId);
  const selectedLine = selectedPo?.lines[0];

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Procurement" title="Goods receipts" description="Site teams record what physically arrived. Shortages and rejections drive vendor credit notes."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setFormOpen(true)}>New GRN</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      {formOpen && (
        <CreateCard title="New goods receipt" submitLabel="Record GRN" onCancel={() => setFormOpen(false)} onSubmit={submitGrn}>
          <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <FieldSelect label="Against PO" value={draft.poId} onChange={e => setDraft({...draft, poId: e.target.value, receivedQty: 0})}>
              {SEED.purchaseOrders.filter(p => ['sent','approved','partially-received'].includes(p.status)).map(p => (
                <option key={p.id} value={p.id}>{p.id} — {vendorById(p.vendorId).name}</option>
              ))}
            </FieldSelect>
            <Field label="Received date" value={draft.receivedDate} onChange={e => setDraft({...draft, receivedDate: e.target.value})} placeholder="e.g. 22 Apr 26"/>
            <Field label="Vehicle no." value={draft.vehicleNo} onChange={e => setDraft({...draft, vehicleNo: e.target.value})} placeholder="MH-12 KL 4521"/>
            <Field label="Vendor invoice ref" value={draft.invoiceRef} onChange={e => setDraft({...draft, invoiceRef: e.target.value})} placeholder="HPF/INV/26/2241"/>
          </div>
          {selectedLine && (
            <div style={{ marginBottom: 10, padding:'8px 12px', background: TOKENS.paperAlt, borderRadius: 3, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>
              Line: <Code>{selectedLine.sku}</Code> · {selectedLine.desc} · ordered <strong>{selectedLine.qty} {selectedLine.uom}</strong>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap: 10 }}>
            <Field label={`Received qty (${selectedLine?.uom || ''})`} type="number" value={draft.receivedQty} onChange={e => setDraft({...draft, receivedQty: e.target.value})}/>
            <Field label={`Rejected qty (${selectedLine?.uom || ''})`} type="number" value={draft.rejectedQty} onChange={e => setDraft({...draft, rejectedQty: e.target.value})}/>
            <Field label="Remarks" value={draft.remarks} onChange={e => setDraft({...draft, remarks: e.target.value})} placeholder="e.g. 2m short — vendor to credit"/>
          </div>
        </CreateCard>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="GRNs · this month" value={grns.length}  sub="6 vendors" accent/>
        <KPI label="Partial receipts"  value={partial}      sub="awaiting balance dispatch"/>
        <KPI label="Rejected"          value={rejects}      sub="full / partial returns"/>
        <KPI label="Pending QC"        value={2}            sub="held at site for inspection"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['GRN #','PO #','Vendor','Received','Items','Status','Received by',''].map((h, i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign:'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {grns.map((g, i) => {
              const v = vendorById(g.vendorId);
              const items = g.lines.length;
              return (
                <tr key={i} onClick={() => setOpen(g)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                  <td style={{ padding:'10px 12px' }}><Code>{g.id}</Code></td>
                  <td style={{ padding:'10px 12px' }}><Code style={{ color: TOKENS.ink3 }}>{g.poId}</Code></td>
                  <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{v.name}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{g.receivedDate}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, color: TOKENS.ink2 }}>{items} SKU{items>1?'s':''}</td>
                  <td style={{ padding:'10px 12px' }}><Pill tone={GRN_TONE[g.status]} size="sm" dot>{g.status.replace('-',' ')}</Pill></td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3 }}>{g.receivedBy}</td>
                  <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GRNDetail({ grn, onBack }) {
  const [toast, setToast] = React.useState(null);
  const v = vendorById(grn.vendorId);
  const po = poById(grn.poId);
  const printGrn = () => setToast({ tone:'positive', msg:`${grn.id}.pdf queued for download.` });

  return (
    <div style={{ padding:'22px 28px 48px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Goods receipts</button>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{grn.id}</span>
      </div>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 18, gap: 24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Code style={{ fontSize: 13, padding:'3px 8px', background: TOKENS.accentWash, borderRadius: 3 }}>{grn.id}</Code>
            <Pill tone={GRN_TONE[grn.status]} dot>{grn.status.replace('-',' ')}</Pill>
            <Pill tone="ink" size="sm">PO {grn.poId}</Pill>
          </div>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0 }}>{v.name}</h1>
          <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>
            Received {grn.receivedDate} · vehicle {grn.vehicleNo} · vendor inv. {grn.invoiceRef} · received by {grn.receivedBy}
          </div>
        </div>
        <Btn variant="outline" size="sm" icon="download" onClick={printGrn}>PDF</Btn>
      </div>

      <Card title="Line-by-line acceptance">
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
          <thead><tr style={{ borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['SKU','Ordered','Received','Accepted','Rejected','Remarks'].map((h, i) => (
              <th key={i} style={{ padding:'8px 0', textAlign: i>=1 && i<=4 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {grn.lines.map((l, i) => {
              const short = l.orderedQty - l.receivedQty;
              const rejected = l.rejectedQty > 0;
              return (
                <tr key={i} style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}>
                  <td style={{ padding:'10px 0' }}><Code>{l.sku}</Code></td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono }}>{l.orderedQty}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, color: short > 0 ? TOKENS.amber : TOKENS.ink }}>{l.receivedQty}{short > 0 ? ` (-${short})` : ''}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600, color: TOKENS.positive }}>{l.acceptedQty}</td>
                  <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, color: rejected ? TOKENS.alert : TOKENS.ink3 }}>{l.rejectedQty}</td>
                  <td style={{ padding:'10px 0', fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink2 }}>{l.remarks}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {po && (
        <div style={{ marginTop: 16, padding: 12, background: TOKENS.paperAlt, borderRadius: 3, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>
          Linked PO {po.id} · ordered total {inr(po.total)} · expected {po.expectedDate}
        </div>
      )}
    </div>
  );
}

// ─── VENDOR BILLS ─────────────────────────────────────────────────────────────
function VendorBillsRoute() {
  const [bills, setBills] = React.useState(SEED.vendorBills);
  const [open, setOpen] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    vendorId: SEED.vendors[0]?.id || '',
    poId: '',
    vendorInvoice: '',
    invoiceDate: '',
    dueDate: '',
    subtotal: 0,
    gstPct: 18,
  });

  if (open) {
    return <VendorBillDetail
      bill={open}
      onBack={() => setOpen(null)}
      onUpdate={(updated) => {
        setBills(bills.map(b => b.id === updated.id ? updated : b));
        setOpen(updated);
      }}/>;
  }

  const pending = bills.filter(b => b.status === 'pending-match' || b.status === 'discrepancy').length;
  const matched = bills.filter(b => b.status === 'matched' || b.status === 'approved').length;
  const overdue = bills.filter(b => b.status === 'overdue');
  const due30   = bills.filter(b => b.status !== 'paid').reduce((a,b)=>a+(b.total - b.amountPaid),0);

  const exportCsv = () => setToast({ tone:'positive', msg:`Exported ${bills.length} vendor bills to vendor_bills.csv.` });

  const submitBill = () => {
    if (!draft.vendorInvoice.trim()) { setToast({ tone:'amber', msg:'Vendor invoice number is required.' }); return; }
    const subtotal = +draft.subtotal;
    if (subtotal <= 0) { setToast({ tone:'amber', msg:'Subtotal must be greater than zero.' }); return; }
    const v = SEED.vendors.find(x => x.id === draft.vendorId);
    const interstate = v?.state !== 'Karnataka';
    const gst = Math.round(subtotal * (+draft.gstPct) / 100);
    const total = subtotal + gst;
    const linkedPo = SEED.purchaseOrders.find(p => p.id === draft.poId);
    const status = !draft.poId ? 'pending-match' : Math.abs(total - (linkedPo?.total || 0)) < 100 ? 'matched' : 'discrepancy';
    const seq = String(411 + bills.length).padStart(4, '0');
    const nextId = `BILL-2026-${seq}`;
    const bill = {
      id: nextId, vendorId: draft.vendorId, poId: draft.poId || null, grnId: null,
      vendorInvoice: draft.vendorInvoice.trim(),
      invoiceDate: draft.invoiceDate || '—',
      dueDate: draft.dueDate || '—',
      status,
      matchResult: { po: draft.poId ? 'ok' : 'pending', grn: 'pending', amount: status === 'matched' ? 'ok' : (draft.poId ? 'mismatch' : 'pending') },
      subtotal,
      cgst: interstate ? 0 : Math.round(gst/2),
      sgst: interstate ? 0 : Math.round(gst/2),
      igst: interstate ? gst : 0,
      total, amountPaid: 0,
    };
    setBills([bill, ...bills]);
    setFormOpen(false);
    setDraft({ ...draft, vendorInvoice:'', invoiceDate:'', dueDate:'', subtotal:0, poId:'' });
    setToast({ tone:'positive', msg:`${nextId} recorded · ${inr(total)} · ${status.replace('-',' ')}.` });
  };

  const filteredPos = SEED.purchaseOrders.filter(p => p.vendorId === draft.vendorId);

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Procurement" title="Vendor bills" description="Bills reconcile against PO + GRN before approval. Discrepancies surface for buyer action."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setFormOpen(true)}>Record bill</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      {formOpen && (
        <CreateCard title="Record vendor bill" submitLabel="Record bill" onCancel={() => setFormOpen(false)} onSubmit={submitBill}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <FieldSelect label="Vendor" value={draft.vendorId} onChange={e => setDraft({...draft, vendorId: e.target.value, poId: ''})}>
              {SEED.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </FieldSelect>
            <FieldSelect label="Against PO (optional)" value={draft.poId} onChange={e => setDraft({...draft, poId: e.target.value})}>
              <option value="">— direct bill, no PO —</option>
              {filteredPos.map(p => <option key={p.id} value={p.id}>{p.id} · {inr(p.total)}</option>)}
            </FieldSelect>
            <Field label="Vendor invoice #" value={draft.vendorInvoice} onChange={e => setDraft({...draft, vendorInvoice: e.target.value})} placeholder="HPF/INV/26/2241"/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 10 }}>
            <Field label="Invoice date" value={draft.invoiceDate} onChange={e => setDraft({...draft, invoiceDate: e.target.value})} placeholder="22 Apr 26"/>
            <Field label="Due date" value={draft.dueDate} onChange={e => setDraft({...draft, dueDate: e.target.value})} placeholder="22 May 26"/>
            <Field label="Subtotal (₹)" type="number" value={draft.subtotal} onChange={e => setDraft({...draft, subtotal: e.target.value})}/>
            <FieldSelect label="GST %" value={draft.gstPct} onChange={e => setDraft({...draft, gstPct: e.target.value})}>
              {[0,5,12,18,28].map(g => <option key={g} value={g}>{g}%</option>)}
            </FieldSelect>
          </div>
          {(+draft.subtotal) > 0 && (
            <div style={{ marginTop: 12, padding:'8px 12px', background: TOKENS.paperAlt, borderRadius: 3, display:'flex', justifyContent:'space-between', fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>
              <span>GST {inr(Math.round((+draft.subtotal) * (+draft.gstPct) / 100))} ({SEED.vendors.find(v=>v.id===draft.vendorId)?.state === 'Karnataka' ? 'CGST + SGST' : 'IGST'})</span>
              <span style={{ fontWeight: 600, color: TOKENS.ink }}>Total {inr((+draft.subtotal) + Math.round((+draft.subtotal) * (+draft.gstPct) / 100))}</span>
            </div>
          )}
        </CreateCard>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Pending match"   value={pending}     sub="needs buyer review" accent/>
        <KPI label="Matched"         value={matched}     sub="ready for payment"/>
        <KPI label="Overdue"         value={overdue.length} sub={inr(overdue.reduce((a,b)=>a+(b.total-b.amountPaid),0))}/>
        <KPI label="Total payable"   value={inr(due30)}  sub="next 30 days"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['Bill #','Vendor','PO #','Invoice date','Due','Match','Amount',''].map((h, i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i===6?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {bills.map((b, i) => {
              const v = vendorById(b.vendorId);
              return (
                <tr key={i} onClick={() => setOpen(b)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                  <td style={{ padding:'10px 12px' }}><Code>{b.id}</Code></td>
                  <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{v.name}</td>
                  <td style={{ padding:'10px 12px' }}>{b.poId ? <Code style={{ color: TOKENS.ink3 }}>{b.poId}</Code> : <span style={{ color: TOKENS.alert, fontFamily: FONT.mono, fontSize: 10.5 }}>NO PO</span>}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{b.invoiceDate}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: b.status === 'overdue' ? TOKENS.alert : TOKENS.ink3, fontWeight: b.status === 'overdue' ? 600 : 400 }}>{b.dueDate}</td>
                  <td style={{ padding:'10px 12px' }}><Pill tone={BILL_TONE[b.status]} size="sm" dot>{b.status.replace('-',' ')}</Pill></td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(b.total)}</td>
                  <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorBillDetail({ bill, onBack, onUpdate }) {
  const [status, setStatus] = React.useState(bill.status);
  const [toast, setToast] = React.useState(null);
  const [paymentDate, setPaymentDate] = React.useState('');
  const [showSchedule, setShowSchedule] = React.useState(false);
  const v = vendorById(bill.vendorId);
  const po = bill.poId ? poById(bill.poId) : null;
  const grn = bill.grnId ? grnById(bill.grnId) : null;

  const propagate = (next) => { if (onUpdate) onUpdate({ ...bill, ...next }); };

  const resolve = () => {
    setStatus('matched');
    propagate({ status: 'matched', matchResult: { ...bill.matchResult, amount: 'ok' } });
    setToast({ tone:'positive', msg:`${bill.id} reconciled · marked matched. Routed to finance for payment scheduling.` });
  };

  const downloadPdf = () => setToast({ tone:'positive', msg:`${bill.id}.pdf queued for download.` });

  const schedulePayment = () => {
    if (!paymentDate.trim()) { setToast({ tone:'amber', msg:'Pick a payment date first.' }); return; }
    setStatus('approved');
    propagate({ status:'approved' });
    setShowSchedule(false);
    setPaymentDate('');
    setToast({ tone:'positive', msg:`Payment of ${inr(bill.total - bill.amountPaid)} to ${v.name} scheduled for ${paymentDate}.` });
  };

  const matchRow = (label, ref, result) => {
    const tone = result === 'ok' ? 'positive' : result === 'pending' ? 'amber' : 'alert';
    return (
      <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 110px', gap: 10, padding:'10px 0', borderTop: `1px dashed ${TOKENS.rule}`, alignItems:'center' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink }}>{ref}</div>
        <Pill tone={tone} size="sm" dot>{result}</Pill>
      </div>
    );
  };

  return (
    <div style={{ padding:'22px 28px 48px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Vendor bills</button>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{bill.id}</span>
      </div>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 24, marginBottom: 18 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Code style={{ fontSize: 13, padding:'3px 8px', background: TOKENS.accentWash, borderRadius: 3 }}>{bill.id}</Code>
            <Pill tone={BILL_TONE[status]} dot>{status.replace('-',' ')}</Pill>
            <Pill tone="ink" size="sm">Vendor inv. {bill.vendorInvoice}</Pill>
          </div>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0 }}>{v.name}</h1>
          <div style={{ marginTop: 6, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>
            Invoice {bill.invoiceDate} · due {bill.dueDate} · GSTIN {v.gstin}
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          {(status === 'discrepancy' || status === 'pending-match') && (
            <Btn variant="primary" size="sm" icon="check" onClick={resolve}>Resolve & match</Btn>
          )}
          <Btn variant="outline" size="sm" icon="download" onClick={downloadPdf}>PDF</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden', marginBottom: 18 }}>
        <StatBlock label="Subtotal"    value={inr(bill.subtotal)}/>
        <StatBlock label="GST"         value={inr((bill.cgst||0)+(bill.sgst||0)+(bill.igst||0))} sub={bill.igst ? 'IGST (interstate)' : 'CGST + SGST'}/>
        <StatBlock label="Total"       value={inr(bill.total)} accent/>
        <StatBlock label="Outstanding" value={inr(bill.total - bill.amountPaid)} sub={bill.amountPaid ? `paid ${inr(bill.amountPaid)}` : 'fully unpaid'}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 16 }}>
        <Card title="3-way match" sub="PO ↔ GRN ↔ Bill reconciliation">
          {matchRow('PO',     po  ? po.id  : 'no PO referenced',  bill.matchResult.po)}
          {matchRow('GRN',    grn ? grn.id : 'no GRN referenced', bill.matchResult.grn)}
          {matchRow('Amount', `${inr(bill.total)} vs ${po ? inr(po.total) : '—'}`, bill.matchResult.amount)}
          {!po && !grn && (
            <div style={{ marginTop: 14, padding: 12, background: TOKENS.alertWash, borderRadius: 3, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.alert }}>
              Direct vendor bill — no PO / GRN to reconcile against. Requires manual approval before payment.
            </div>
          )}
        </Card>
        <Card title="Payment schedule">
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Terms</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 14, color: TOKENS.ink, marginTop: 4 }}>{v.paymentTerms}{v.msme && <Pill tone="accent" size="sm" style={{ marginLeft: 8 }}>MSME · 45-day SLA</Pill>}</div>
          <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Due</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 18, fontWeight: 600, color: status === 'overdue' ? TOKENS.alert : TOKENS.ink, marginTop: 4 }}>{bill.dueDate}</div>
          {!showSchedule ? (
            <Btn variant="outline" size="sm" icon="check" style={{ marginTop: 14, width:'100%', justifyContent:'center' }} onClick={() => setShowSchedule(true)}>Schedule payment</Btn>
          ) : (
            <div style={{ marginTop: 14, padding: 10, background: TOKENS.paperAlt, borderRadius: 3 }}>
              <Field label="Payment date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} placeholder="e.g. 18 May 26"/>
              <div style={{ display:'flex', gap: 6, marginTop: 8 }}>
                <Btn variant="outline" size="sm" onClick={() => { setShowSchedule(false); setPaymentDate(''); }}>Cancel</Btn>
                <Btn variant="primary" size="sm" icon="check" onClick={schedulePayment}>Confirm</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── PROJECT MATERIALS TAB (used inside ProjectDetailRoute) ──────────────────
function ProjectMaterialsTab({ projectCode }) {
  const code = projectCode || SEED.projectDetail.code;
  const pos = SEED.purchaseOrders.filter(p => p.projectId === code);
  const skuMap = {};
  pos.forEach(p => p.lines.forEach(l => {
    if (!skuMap[l.sku]) skuMap[l.sku] = { sku: l.sku, desc: l.desc, uom: l.uom, ordered: 0, received: 0, value: 0 };
    skuMap[l.sku].ordered += l.qty;
    skuMap[l.sku].value   += l.qty * l.rate;
  }));
  pos.forEach(p => {
    const grns = SEED.grns.filter(g => g.poId === p.id);
    grns.forEach(g => g.lines.forEach(l => { if (skuMap[l.sku]) skuMap[l.sku].received += l.acceptedQty; }));
  });
  const skus = Object.values(skuMap);
  const orderedValue  = skus.reduce((a,s)=>a+s.value,0);
  const receivedValue = pos.reduce((a,p)=>a + (p.status==='received'||p.status==='closed' ? p.subtotal : 0), 0);

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr', gap: 16 }}>
      <Card title="Material rollup" sub={`${skus.length} SKUs across ${pos.length} POs · planned vs ordered vs received`}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
          <KPI label="POs raised"      value={pos.length}            sub={`${pos.filter(p=>p.status!=='received'&&p.status!=='closed').length} open`}/>
          <KPI label="Ordered value"   value={inr(orderedValue)}     sub="ex GST"/>
          <KPI label="Received value"  value={inr(receivedValue)}    sub="ex GST · GRN-confirmed" accent/>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['SKU','Description','Ordered','Received','Outstanding','Value'].map((h, i) => (
              <th key={i} style={{ padding:'8px 0', textAlign: i>=2?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {skus.map((s, i) => (
              <tr key={i} style={{ borderBottom: `1px dashed ${TOKENS.rule}` }}>
                <td style={{ padding:'10px 0' }}><Code>{s.sku}</Code></td>
                <td style={{ padding:'10px 0', color: TOKENS.ink }}>{s.desc}</td>
                <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono }}>{s.ordered} {s.uom}</td>
                <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.positive, fontWeight: 600 }}>{s.received} {s.uom}</td>
                <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, color: s.ordered - s.received > 0 ? TOKENS.amber : TOKENS.ink3 }}>{s.ordered - s.received} {s.uom}</td>
                <td style={{ padding:'10px 0', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600 }}>{inr(s.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Project POs" sub={`${pos.length} purchase orders raised against ${code}`}>
        {pos.length === 0 ? (
          <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No POs raised against this project yet.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
            <tbody>
              {pos.map((p, i) => {
                const v = vendorById(p.vendorId);
                return (
                  <tr key={i} style={{ borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                    <td style={{ padding:'8px 0' }}><Code>{p.id}</Code></td>
                    <td style={{ padding:'8px 0', color: TOKENS.ink2 }}>{v.name}</td>
                    <td style={{ padding:'8px 0' }}><Pill tone={PO_TONE[p.status]} size="sm" dot>{p.status.replace(/-/g,' ')}</Pill></td>
                    <td style={{ padding:'8px 0', textAlign:'right', fontFamily: FONT.mono, fontWeight:600 }}>{inr(p.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { VendorsRoute, PurchaseOrdersRoute, GRNsRoute, VendorBillsRoute, ProjectMaterialsTab, approvalTierFor, PO_TONE, GRN_TONE, BILL_TONE });
