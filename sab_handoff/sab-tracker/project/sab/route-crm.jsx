// SAB — Clients (CRM) + Wage rates

function ClientsRoute() {
  const all = SEED.clients || [];
  const [query, setQuery]   = React.useState('');
  const [tier, setTier]     = React.useState('All');
  const [state, setState]   = React.useState('All');
  const [open, setOpen]     = React.useState(null);
  const [toast, setToast]   = React.useState(null);
  const [create, setCreate] = React.useState(false);
  const [draft, setDraft]   = React.useState({ name:'', gstin:'', state:'Karnataka', contact:'', phone:'', email:'', paymentTerms:'Net 30', tier:'Mid-market' });

  const tiers  = React.useMemo(() => Array.from(new Set(all.map(c => c.tier))).sort(), [all]);
  const states = React.useMemo(() => Array.from(new Set(all.map(c => c.state))).sort(), [all]);

  const rows = React.useMemo(() => all.filter(c => {
    if (query && ![c.name, c.contact, c.email, c.state].some(v => v && v.toLowerCase().includes(query.toLowerCase()))) return false;
    if (tier !== 'All' && c.tier !== tier) return false;
    if (state !== 'All' && c.state !== state) return false;
    return true;
  }), [all, query, tier, state]);

  const total = {
    pov:   rows.reduce((a,c) => a + c.pov, 0),
    bill:  rows.reduce((a,c) => a + c.billed, 0),
    out:   rows.reduce((a,c) => a + c.outstanding, 0),
    count: rows.length,
  };

  const exportCsv = () => {
    const head = ['ID','Name','GSTIN','State','Tier','Contact','Phone','Email','Payment terms','POs','PO Value','Billed','Outstanding','On-time pay %'];
    const body = rows.map(c => [c.id, c.name, c.gstin, c.state, c.tier, c.contact, c.phone, c.email, c.paymentTerms, c.pos, c.pov, c.billed, c.outstanding, c.onTimePayPct]);
    const csv = [head, ...body].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'clients.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    setToast({ tone:'positive', text:`Exported ${rows.length} client${rows.length===1?'':'s'} to clients.csv.` });
  };

  const saveClient = () => {
    if (!draft.name || !draft.contact || !draft.phone) {
      setToast({ tone:'amber', text:'Name, contact person and phone are required.' });
      return;
    }
    if (draft.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]$/.test(draft.gstin.replace(/\s/g,''))) {
      setToast({ tone:'amber', text:'GSTIN format looks off (expected 15 chars, e.g. 29ABCDE1234F1Z5).' });
      return;
    }
    setToast({ tone:'positive', text:`Client ${draft.name} added — ${draft.tier} tier, ${draft.paymentTerms}.` });
    setCreate(false);
    setDraft({ name:'', gstin:'', state:'Karnataka', contact:'', phone:'', email:'', paymentTerms:'Net 30', tier:'Mid-market' });
  };

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Sales" title="Clients"
        description="Master list with GSTIN, contacts and billing history. Every project, invoice and receivable rolls up here."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setCreate(true)}>New client</Btn>
        </>}/>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}

      {create && (
        <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600 }}>Add client</div>
            <button onClick={() => setCreate(false)} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 5, cursor:'pointer', color: TOKENS.ink3 }}><Icon name="x" size={12}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.3fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Client / organisation name" value={draft.name} onChange={(e) => setDraft({...draft, name:e.target.value})} placeholder="e.g. Apollo Hospitals Enterprise Ltd"/>
            <Field label="GSTIN" value={draft.gstin} onChange={(e) => setDraft({...draft, gstin:e.target.value.toUpperCase()})} placeholder="29ABCDE1234F1Z5"/>
            <FieldSelect label="State" value={draft.state} onChange={(e) => setDraft({...draft, state:e.target.value})}>
              {['Karnataka','Maharashtra','Tamil Nadu','Delhi','Haryana','Telangana','Gujarat','West Bengal','Kerala','Uttar Pradesh','Other'].map(s => <option key={s}>{s}</option>)}
            </FieldSelect>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1.5fr 1fr 1fr', gap: 10 }}>
            <Field label="Contact person" value={draft.contact} onChange={(e) => setDraft({...draft, contact:e.target.value})} placeholder="e.g. Dr. Ramesh Iyer"/>
            <Field label="Phone" value={draft.phone} onChange={(e) => setDraft({...draft, phone:e.target.value})} placeholder="+91 98452 11023"/>
            <Field label="Email" value={draft.email} onChange={(e) => setDraft({...draft, email:e.target.value})} placeholder="procurement@client.com"/>
            <FieldSelect label="Payment terms" value={draft.paymentTerms} onChange={(e) => setDraft({...draft, paymentTerms:e.target.value})}>
              <option>Net 15</option><option>Net 30</option><option>Net 45</option><option>Net 60</option><option>Advance</option>
            </FieldSelect>
            <FieldSelect label="Tier" value={draft.tier} onChange={(e) => setDraft({...draft, tier:e.target.value})}>
              <option>Enterprise</option><option>Mid-market</option><option>SME</option>
            </FieldSelect>
          </div>
          <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-end', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={() => setCreate(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={saveClient}>Save client</Btn>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Clients"            value={total.count} sub={`${tiers.length} tiers`} accent/>
        <KPI label="Total PO value"     value={inr(total.pov)} sub="lifetime, all FYs"/>
        <KPI label="Billed"             value={inr(total.bill)} sub={total.pov ? `${((total.bill/total.pov)*100).toFixed(0)}% of PO value` : '—'}/>
        <KPI label="Outstanding"        value={inr(total.out)} sub="receivables"/>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, maxWidth: 360 }}>
          <div style={{ position:'absolute', left: 10, top: 8, color: TOKENS.ink3 }}><Icon name="search" size={13}/></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, contact, email, state…" style={{
            width:'100%', padding: '6px 10px 6px 30px', borderRadius: 4, border: `1px solid ${TOKENS.ruleStrong}`, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink, outline:'none', background: TOKENS.card,
          }}/>
        </div>
        <FilterChip label="Tier"  value={tier}  active={tier !== 'All'}  options={['All', ...tiers]}  onChange={setTier}/>
        <FilterChip label="State" value={state} active={state !== 'All'} options={['All', ...states]} onChange={setState}/>
        <div style={{ flex:1 }}/>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>Showing {rows.length} of {all.length}</div>
      </div>

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom:`1px solid ${TOKENS.rule}` }}>
            {['Client','Tier','State','Contact','POs','PO value','Outstanding','On-time %',''].map((h,i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i>=4 && i<=7 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign:'center', fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>No clients match these filters.</td></tr>
            )}
            {rows.map(c => (
              <tr key={c.id} onClick={() => setOpen(c)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ fontFamily: FONT.sans, fontSize: 12.5, fontWeight: 500, color: TOKENS.ink }}>{c.name}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, marginTop: 2 }}>{c.gstin}</div>
                </td>
                <td style={{ padding:'10px 12px' }}><Pill tone={c.tier==='Enterprise'?'accent':c.tier==='Mid-market'?'blue':'ink'} size="sm">{c.tier}</Pill></td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink3, fontSize: 11.5 }}>{c.state}</td>
                <td style={{ padding:'10px 12px' }}>
                  <div style={{ color: TOKENS.ink2, fontSize: 12 }}>{c.contact}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{c.phone}</div>
                </td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink, fontWeight: 600 }}>{c.pos}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink, fontWeight: 600 }}>{inr(c.pov)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: c.outstanding>0 ? TOKENS.accentInk : TOKENS.ink3 }}>{inr(c.outstanding)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right' }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 11, color: c.onTimePayPct >= 85 ? TOKENS.positive : c.onTimePayPct >= 70 ? TOKENS.amber : TOKENS.alert, fontWeight: 600 }}>
                    {c.onTimePayPct}%
                  </span>
                </td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ClientDetail client={open} onClose={() => setOpen(null)} onAction={(msg) => setToast({ tone:'positive', text: msg })}/>
    </div>
  );
}

function ClientDetail({ client, onClose, onAction }) {
  if (!client) return null;
  const c = client;
  const clientProjects = (SEED.projects || []).filter(p =>
    p.client === c.name || p.client.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
  );
  const clientInvoices = (SEED.invoices || []).filter(i =>
    c.name.toLowerCase().includes(String(i.client).toLowerCase()) || String(i.client).toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
  );

  return (
    <Modal open={!!client} onClose={onClose}
      eyebrow={`${c.tier.toUpperCase()} · CLIENT SINCE ${(c.since || '').slice(0,4)}`}
      title={c.name}
      width={880}
      actions={<>
        <Btn variant="outline" size="sm" icon="download" onClick={() => onAction(`Generated account statement for ${c.name}.`)}>Statement</Btn>
        <Btn variant="primary" size="sm" icon="plus" onClick={() => onAction(`Drafted follow-up: ${c.name} — ${inr(c.outstanding)} outstanding.`)}>Log follow-up</Btn>
      </>}
    >
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <Field label="GSTIN" value={c.gstin} readOnly/>
        <Field label="State" value={c.state} readOnly/>
        <Field label="Payment terms" value={c.paymentTerms} readOnly/>
        <Field label="On-time payment" value={`${c.onTimePayPct}%`} readOnly/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Field label="Primary contact" value={`${c.contact} · ${c.phone}`} readOnly/>
        <Field label="Email" value={c.email} readOnly/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        <KPI label="Active POs"    value={c.pos} sub="across projects"/>
        <KPI label="Billed"        value={inr(c.billed)} sub={c.pov ? `${((c.billed/c.pov)*100).toFixed(0)}% of PO value` : '—'}/>
        <KPI label="Outstanding"   value={inr(c.outstanding)} sub="receivable" accent/>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Active projects ({clientProjects.length})</div>
        {clientProjects.length === 0 && <div style={{ padding: 12, background: TOKENS.paperAlt, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No projects linked to this client in the current view.</div>}
        {clientProjects.map(p => (
          <div key={p.code} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px dashed ${TOKENS.rule}`, fontFamily: FONT.sans, fontSize: 12 }}>
            <div style={{ display:'flex', gap: 10, alignItems:'center', minWidth: 0 }}>
              <Code>{p.code}</Code>
              <span style={{ color: TOKENS.ink, fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
            </div>
            <div style={{ display:'flex', gap: 12, alignItems:'center', flex:'none' }}>
              <Pill tone={p.wsTone} size="sm" dot>{p.status}</Pill>
              <span style={{ fontFamily: FONT.mono, fontWeight: 600 }}>{inr(p.pov)}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Recent invoices ({clientInvoices.length})</div>
        {clientInvoices.length === 0 && <div style={{ padding: 12, background: TOKENS.paperAlt, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No invoices found for this client.</div>}
        {clientInvoices.map(iv => (
          <div key={iv.no} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px dashed ${TOKENS.rule}`, fontFamily: FONT.sans, fontSize: 12 }}>
            <div style={{ display:'flex', gap: 10, alignItems:'center', minWidth: 0 }}>
              <Code>{iv.no}</Code>
              <Pill tone="ink" size="sm">{iv.kind}</Pill>
              <span style={{ color: TOKENS.ink3, fontSize: 11 }}>{iv.issuedAt || '—'}</span>
            </div>
            <div style={{ display:'flex', gap: 12, alignItems:'center', flex:'none' }}>
              <Pill tone={(INVOICE_STATUS_TONE && INVOICE_STATUS_TONE[iv.status]) || 'ink'} size="sm" dot>{iv.status}</Pill>
              <span style={{ fontFamily: FONT.mono, fontWeight: 600 }}>{inr(iv.amt)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: 10, background: TOKENS.paperAlt, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3 }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginRight: 8 }}>Billing address</span>
        {c.billingAddr}
      </div>
    </Modal>
  );
}

function RatesRoute() {
  const sk0 = (SEED.wageRates && SEED.wageRates.skills) || [];
  const em0 = (SEED.wageRates && SEED.wageRates.employees) || [];
  const [skills, setSkills] = React.useState(sk0);
  const [emps, setEmps]     = React.useState(em0);
  const [tab, setTab]       = React.useState('skills');
  const [toast, setToast]   = React.useState(null);
  const [editSk, setEditSk] = React.useState(null);
  const [editEm, setEditEm] = React.useState(null);
  const [draftRate, setDraftRate] = React.useState('');

  const headCount = skills.reduce((a,s) => a + (s.headcount || 0), 0);
  const avg = skills.length ? Math.round(skills.reduce((a,s) => a + s.rate, 0) / skills.length) : 0;
  const overridden = emps.filter(e => e.override).length;

  const saveSkillRate = () => {
    const v = parseInt(draftRate, 10);
    if (Number.isNaN(v) || v <= 0) { setToast({ tone:'amber', text:'Enter a positive hourly rate (₹/hour).' }); return; }
    setSkills(skills.map(s => s.id === editSk.id ? { ...s, prevRate: s.rate, rate: v, lastUpdated: '23 Apr 26' } : s));
    setToast({ tone:'positive', text:`${editSk.name} rate updated to ₹${v}/hr. Propagates on next timesheet post.` });
    setEditSk(null); setDraftRate('');
  };

  const saveEmpRate = () => {
    const v = parseInt(draftRate, 10);
    if (Number.isNaN(v) || v <= 0) { setToast({ tone:'amber', text:'Enter a positive hourly rate (₹/hour).' }); return; }
    setEmps(emps.map(e => e.id === editEm.id ? { ...e, rate: v, override: v !== e.base, lastChanged: '23 Apr 26' } : e));
    setToast({ tone:'positive', text:`${editEm.name} rate set to ₹${v}/hr.` });
    setEditEm(null); setDraftRate('');
  };

  const resetEmp = (e) => {
    setEmps(emps.map(x => x.id === e.id ? { ...x, rate: x.base, override: false, lastChanged: '23 Apr 26' } : x));
    setToast({ tone:'positive', text:`${e.name} reset to skill base (₹${e.base}/hr).` });
  };

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Admin" title="Wage rates"
        description="Two-tier hourly rates: per skill base × per employee override. Timesheets multiply hours × rate → project labour cost."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={() => {
            const head = ['Scope','Identifier','Name','Base/Skill','Rate (₹/hr)','Last updated'];
            const body1 = skills.map(s => ['Skill', s.id, s.name, '', s.rate, s.lastUpdated]);
            const body2 = emps.map(e => ['Employee', e.id, e.name, e.skill, e.rate, e.lastChanged]);
            const csv = [head, ...body1, ...body2].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
            try {
              const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'wage-rates.csv';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch(e) {}
            setToast({ tone:'positive', text:'Wage rates exported.' });
          }}>Export</Btn>
          <Btn variant="primary" size="sm" icon="refresh" onClick={() => setToast({ tone:'positive', text:'Rate changes propagated to all open timesheets (23 rows updated).' })}>Propagate to timesheets</Btn>
        </>}/>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Skills on register" value={skills.length} sub={`${headCount} total crew`} accent/>
        <KPI label="Avg. hourly rate"    value={`₹${avg}`}     sub="across skills"/>
        <KPI label="Employees on roll"   value={emps.length}    sub={`${overridden} custom overrides`}/>
        <KPI label="Highest rate"        value={`₹${Math.max(...skills.map(s => s.rate))}`} sub={skills.find(s => s.rate === Math.max(...skills.map(x => x.rate))).name}/>
      </div>

      <div style={{ borderBottom:`1px solid ${TOKENS.rule}`, marginBottom: 16 }}>
        <Tabs items={[
          { key:'skills',    label:'Skill rates',    count: skills.length },
          { key:'employees', label:'Employee rates', count: emps.length },
        ]} active={tab} onChange={setTab}/>
      </div>

      {tab === 'skills' && (
        <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
            <thead><tr style={{ background: TOKENS.paperAlt, borderBottom:`1px solid ${TOKENS.rule}` }}>
              {['Skill','ID','Headcount','Previous','Current','Δ','Last updated',''].map((h,i) => (
                <th key={i} style={{ padding:'8px 12px', textAlign: i>=2 && i<=5 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {skills.map(s => {
                const delta = s.rate - s.prevRate;
                return (
                  <tr key={s.id} style={{ borderBottom:`1px solid ${TOKENS.rule}` }}>
                    <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight: 500 }}>{s.name}</td>
                    <td style={{ padding:'10px 12px' }}><Code>{s.id}</Code></td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono }}>{s.headcount}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink3 }}>₹{s.prevRate}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600, color: TOKENS.ink }}>₹{s.rate}</td>
                    <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 11, color: delta > 0 ? TOKENS.positive : delta < 0 ? TOKENS.alert : TOKENS.ink3 }}>
                      {delta === 0 ? '—' : (delta > 0 ? '+' : '') + delta}
                    </td>
                    <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{s.lastUpdated}</td>
                    <td style={{ padding:'10px 8px' }}>
                      <button onClick={() => { setEditSk(s); setDraftRate(String(s.rate)); }} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 3, padding:'3px 8px', cursor:'pointer', fontFamily: FONT.sans, fontSize: 11, color: TOKENS.ink2 }}>Edit rate</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'employees' && (
        <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
            <thead><tr style={{ background: TOKENS.paperAlt, borderBottom:`1px solid ${TOKENS.rule}` }}>
              {['Employee','ID','Skill','Skill base','Effective rate','Override','Last changed',''].map((h,i) => (
                <th key={i} style={{ padding:'8px 12px', textAlign: i>=3 && i<=4 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {emps.map(e => (
                <tr key={e.id} style={{ borderBottom:`1px solid ${TOKENS.rule}` }}>
                  <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight: 500 }}>{e.name}</td>
                  <td style={{ padding:'10px 12px' }}><Code>{e.id}</Code></td>
                  <td style={{ padding:'10px 12px', color: TOKENS.ink3, fontSize: 11.5 }}>{e.skill}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink3 }}>₹{e.base}</td>
                  <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600, color: e.override ? TOKENS.accentInk : TOKENS.ink }}>₹{e.rate}</td>
                  <td style={{ padding:'10px 12px' }}>
                    {e.override
                      ? <Pill tone="accent" size="sm" dot>Custom</Pill>
                      : <Pill tone="ink" size="sm">Skill base</Pill>}
                  </td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{e.lastChanged}</td>
                  <td style={{ padding:'10px 8px', display:'flex', gap: 6 }}>
                    <button onClick={() => { setEditEm(e); setDraftRate(String(e.rate)); }} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 3, padding:'3px 8px', cursor:'pointer', fontFamily: FONT.sans, fontSize: 11, color: TOKENS.ink2 }}>Edit</button>
                    {e.override && <button onClick={() => resetEmp(e)} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 3, padding:'3px 8px', cursor:'pointer', fontFamily: FONT.sans, fontSize: 11, color: TOKENS.ink3 }}>Reset</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editSk} onClose={() => { setEditSk(null); setDraftRate(''); }}
        eyebrow="EDIT SKILL RATE"
        title={editSk ? `${editSk.name} (${editSk.id})` : ''}
        width={480}
        actions={<>
          <Btn variant="outline" size="sm" onClick={() => { setEditSk(null); setDraftRate(''); }}>Cancel</Btn>
          <Btn variant="primary" size="sm" icon="check" onClick={saveSkillRate}>Save rate</Btn>
        </>}
      >
        <div style={{ marginBottom: 12, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink3 }}>
          Current: <span style={{ color: TOKENS.ink, fontWeight: 600 }}>₹{editSk && editSk.rate}/hr</span> · applies to <span style={{ color: TOKENS.ink, fontWeight: 600 }}>{editSk && editSk.headcount} employees</span>
        </div>
        <Field label="New hourly rate (₹)" value={draftRate} onChange={(e) => setDraftRate(e.target.value.replace(/[^0-9]/g,''))} placeholder="e.g. 450"/>
        <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>
          Change applies to new timesheet posts. Historical entries are preserved at the rate that was effective at the time.
        </div>
      </Modal>

      <Modal open={!!editEm} onClose={() => { setEditEm(null); setDraftRate(''); }}
        eyebrow="EDIT EMPLOYEE RATE"
        title={editEm ? `${editEm.name} (${editEm.id})` : ''}
        width={480}
        actions={<>
          <Btn variant="outline" size="sm" onClick={() => { setEditEm(null); setDraftRate(''); }}>Cancel</Btn>
          <Btn variant="primary" size="sm" icon="check" onClick={saveEmpRate}>Save rate</Btn>
        </>}
      >
        <div style={{ marginBottom: 12, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink3 }}>
          Skill: <span style={{ color: TOKENS.ink, fontWeight: 600 }}>{editEm && editEm.skill}</span> · Base rate: <span style={{ color: TOKENS.ink, fontWeight: 600 }}>₹{editEm && editEm.base}/hr</span>
        </div>
        <Field label="Employee rate (₹/hr)" value={draftRate} onChange={(e) => setDraftRate(e.target.value.replace(/[^0-9]/g,''))} placeholder="e.g. 480"/>
        <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>
          Setting equal to the skill base removes the override. Setting different flags the employee as <em>custom</em>.
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { ClientsRoute, ClientDetail, RatesRoute });
