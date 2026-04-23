// SAB — Invoices, Quotes, Inventory, Timesheets, Reports routes (compact)

const INVOICE_STATUS_TONE = { ISSUED:'blue', PAID:'positive', DRAFT:'ink', OVERDUE:'alert' };
const QUOTE_STATUS_TONE   = { DRAFT:'ink', SENT:'blue', NEGOTIATING:'amber', CHANGES_REQUESTED:'amber', ACCEPTED:'positive', CONVERTED:'positive', LOST:'alert' };

function FilterChip({ label, value, active, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display:'inline-flex', alignItems:'center', gap: 6, padding:'5px 10px',
        border:`1px solid ${active ? TOKENS.accent : TOKENS.ruleStrong}`,
        background: active ? TOKENS.accentWash : TOKENS.card,
        borderRadius: 4, fontFamily: FONT.sans, fontSize: 12,
        color: active ? TOKENS.accentInk : TOKENS.ink2, cursor:'pointer',
      }}>
        <span style={{ color: TOKENS.ink3, fontWeight: 500 }}>{label}:</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
        <Icon name="chevDown" size={11}/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop: 4, zIndex: 50, background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, minWidth: 180, maxHeight: 280, overflowY:'auto', boxShadow:'0 6px 20px rgba(0,0,0,.08)' }}>
          {options.map(o => (
            <button key={o} onClick={() => { onChange && onChange(o); setOpen(false); }} style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background: o===value?TOKENS.accentWash:'transparent', border:'none', cursor:'pointer', fontFamily: FONT.sans, fontSize: 12, color: o===value?TOKENS.accentInk:TOKENS.ink }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoicesRoute() {
  const all = SEED.invoices;
  const [query, setQuery]   = React.useState('');
  const [status, setStatus] = React.useState('All');
  const [kind, setKind]     = React.useState('All');
  const [open, setOpen]     = React.useState(null);
  const [toast, setToast]   = React.useState(null);
  const [draft, setDraft]   = React.useState(false);
  const [draftRow, setDraftRow] = React.useState({ client:'', pc:'', kind:'PROGRESS', amt:'' });

  const statuses = React.useMemo(() => Array.from(new Set(all.map(r => r.status))).sort(), [all]);
  const kinds    = React.useMemo(() => Array.from(new Set(all.map(r => r.kind))).sort(), [all]);

  const rows = React.useMemo(() => all.filter(r => {
    if (query && ![r.no, r.client, r.pc].some(v => v && v.toLowerCase().includes(query.toLowerCase()))) return false;
    if (status !== 'All' && r.status !== status) return false;
    if (kind !== 'All' && r.kind !== kind) return false;
    return true;
  }), [all, query, status, kind]);

  const totals = {
    issued: rows.filter(r=>r.status==='ISSUED').reduce((a,r)=>a+r.amt,0),
    paid:   rows.filter(r=>r.status==='PAID').reduce((a,r)=>a+r.amt,0),
    draft:  rows.filter(r=>r.status==='DRAFT').reduce((a,r)=>a+r.amt,0),
  };

  const exportCsv = () => {
    const head = ['Invoice','Type','Client','Project','Amount','Status','Issued','Due'];
    const body = rows.map(r => [r.no, r.kind, r.client, r.pc, r.amt, r.status, r.issuedAt, r.due]);
    const csv = [head, ...body].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `invoices.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    setToast({ tone:'positive', text:`Exported ${rows.length} invoice${rows.length===1?'':'s'} to invoices.csv.` });
  };

  const submitDraft = () => {
    if (!draftRow.client || !draftRow.pc || !draftRow.amt) {
      setToast({ tone:'amber', text:'Client, project code and amount are required to save a draft.' });
      return;
    }
    setToast({ tone:'positive', text:`Draft invoice saved for ${draftRow.client} (${inr(Number(draftRow.amt) || 0)}). It will appear once the local store sync runs.` });
    setDraft(false);
    setDraftRow({ client:'', pc:'', kind:'PROGRESS', amt:'' });
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader eyebrow="Billing" title="Tax invoices"
        description="Generate from PO, stamp with invoice number, hand to client. All invoices are GST compliant."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setDraft(true)}>New invoice</Btn>
        </>}/>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}

      {draft && (
        <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>New tax invoice — draft</div>
            <button onClick={() => setDraft(false)} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 5, cursor:'pointer', color: TOKENS.ink3 }}><Icon name="x" size={12}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.4fr 1fr 1fr', gap: 10 }}>
            <Field label="Client name"      value={draftRow.client} onChange={(e) => setDraftRow({...draftRow, client:e.target.value})} placeholder="e.g. Apollo Hospitals"/>
            <Field label="Project code"     value={draftRow.pc}     onChange={(e) => setDraftRow({...draftRow, pc:e.target.value})}     placeholder="SAB-26-XXXX"/>
            <FieldSelect label="Type" value={draftRow.kind}        onChange={(e) => setDraftRow({...draftRow, kind:e.target.value})}>
              <option>PROGRESS</option><option>ADVANCE</option><option>FINAL</option><option>ADHOC</option>
            </FieldSelect>
            <Field label="Amount (₹)"       value={draftRow.amt}    onChange={(e) => setDraftRow({...draftRow, amt:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="e.g. 4820000"/>
          </div>
          <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-end', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={() => setDraft(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={submitDraft}>Save draft</Btn>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Issued (awaiting payment)" value={inr(totals.issued)} sub={`${rows.filter(r=>r.status==='ISSUED').length} invoices`} accent/>
        <KPI label="Paid this FY" value={inr(totals.paid)} sub={`${rows.filter(r=>r.status==='PAID').length} invoices`}/>
        <KPI label="Drafts" value={inr(totals.draft)} sub={`${rows.filter(r=>r.status==='DRAFT').length} invoices`}/>
        <KPI label="Avg. collection time" value="38 days" sub="↓ 4 days vs. last FY" trend={-4}/>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, maxWidth: 360 }}>
          <div style={{ position:'absolute', left: 10, top: 8, color: TOKENS.ink3 }}><Icon name="search" size={13}/></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice #, client, project…" style={{
            width:'100%', padding: '6px 10px 6px 30px', borderRadius: 4, border: `1px solid ${TOKENS.ruleStrong}`, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink, outline:'none', background: TOKENS.card,
          }}/>
        </div>
        <FilterChip label="Status" value={status} active={status!=='All'} options={['All', ...statuses]} onChange={setStatus}/>
        <FilterChip label="Type"   value={kind}   active={kind!=='All'}   options={['All', ...kinds]}   onChange={setKind}/>
        <div style={{ flex:1 }}/>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>Showing {rows.length} of {all.length}</div>
      </div>

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['Invoice #','Type','Client','Project','Amount','Status','Issued','Due',''].map((h,i)=>(
              <th key={i} style={{ padding:'8px 12px', textAlign: i===4?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign:'center', fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>No invoices match these filters.</td></tr>
            )}
            {rows.map((r,i)=>(
              <tr key={i} onClick={() => setOpen(r)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                <td style={{ padding:'10px 12px' }}><Code>{r.no}</Code></td>
                <td style={{ padding:'10px 12px' }}><Pill tone="ink" size="sm">{r.kind}</Pill></td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{r.client}</td>
                <td style={{ padding:'10px 12px' }}><Code style={{ color: TOKENS.ink3 }}>{r.pc}</Code></td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(r.amt)}</td>
                <td style={{ padding:'10px 12px' }}><Pill tone={INVOICE_STATUS_TONE[r.status]} size="sm" dot>{r.status}</Pill></td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.issuedAt}</td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.due}</td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InvoiceDetail invoice={open} onClose={() => setOpen(null)} onAction={(msg) => setToast({ tone:'positive', text: msg })}/>
    </div>
  );
}

function InvoiceDetail({ invoice, onClose, onAction }) {
  if (!invoice) return null;
  const r = invoice;
  const subtotal = Math.round(r.amt / 1.18);
  const cgst = Math.round((r.amt - subtotal) / 2);
  const sgst = (r.amt - subtotal) - cgst;
  const lines = [
    { d:'Material — pipes, fittings, valves', q: 1, u:'lot', rate: Math.round(subtotal*0.62), amt: Math.round(subtotal*0.62) },
    { d:'Installation labour & supervision',  q: 1, u:'lot', rate: Math.round(subtotal*0.28), amt: Math.round(subtotal*0.28) },
    { d:'Commissioning & testing',            q: 1, u:'lot', rate: subtotal - Math.round(subtotal*0.62) - Math.round(subtotal*0.28), amt: subtotal - Math.round(subtotal*0.62) - Math.round(subtotal*0.28) },
  ];

  return (
    <Modal open={!!invoice} onClose={onClose}
      eyebrow={`${r.kind} INVOICE · ${r.status}`}
      title={r.no}
      width={780}
      actions={<>
        <Btn variant="outline" size="sm" icon="download" onClick={() => onAction(`Generated PDF for ${r.no} — saved to downloads (preview).`)}>PDF</Btn>
        <Btn variant="outline" size="sm" icon="share"    onClick={() => { try { navigator.clipboard.writeText(`https://sabindia.in/share/${r.no}`); } catch(e) {} onAction(`Public share link copied: sabindia.in/share/${r.no}`); }}>Share link</Btn>
        {r.status === 'ISSUED' && <Btn variant="primary" size="sm" icon="check" onClick={() => onAction(`Marked ${r.no} as PAID. Posted ${inr(r.amt)} to project ledger.`)}>Mark paid</Btn>}
        {r.status === 'DRAFT'  && <Btn variant="primary" size="sm" icon="upload" onClick={() => onAction(`Issued ${r.no} to ${r.client}. Email + WhatsApp sent.`)}>Issue invoice</Btn>}
      </>}
    >
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <Field label="Bill to" value={r.client} readOnly/>
        <Field label="Project" value={r.pc} readOnly/>
        <Field label="Issued"  value={r.issuedAt} readOnly/>
        <Field label="Due"     value={r.due} readOnly/>
      </div>

      <div style={{ border:`1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden', marginBottom: 14 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom:`1px solid ${TOKENS.rule}` }}>
            {['Description','Qty','UoM','Rate','Amount'].map((h,i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i>=1?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.map((l,i) => (
              <tr key={i} style={{ borderBottom: i<lines.length-1?`1px solid ${TOKENS.rule}`:'none' }}>
                <td style={{ padding:'9px 12px', color: TOKENS.ink }}>{l.d}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono }}>{l.q}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink3 }}>{l.u}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono }}>{inr(l.rate)}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600 }}>{inr(l.amt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <div style={{ minWidth: 280, fontFamily: FONT.sans, fontSize: 12.5 }}>
          {[
            { l:'Subtotal', v: inr(subtotal) },
            { l:'CGST 9%',  v: inr(cgst) },
            { l:'SGST 9%',  v: inr(sgst) },
          ].map((row,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', color: TOKENS.ink2 }}>
              <span>{row.l}</span><span style={{ fontFamily: FONT.mono }}>{row.v}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', borderTop:`1px solid ${TOKENS.rule}`, marginTop: 6, fontWeight: 600, color: TOKENS.ink }}>
            <span>Total</span><span style={{ fontFamily: FONT.mono }}>{inr(r.amt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function QuotesRoute() {
  const all = SEED.quotes;
  const [query, setQuery]   = React.useState('');
  const [status, setStatus] = React.useState('All');
  const [open, setOpen]     = React.useState(null);
  const [toast, setToast]   = React.useState(null);
  const [draft, setDraft]   = React.useState(false);
  const [draftRow, setDraftRow] = React.useState({ title:'', client:'', amt:'' });

  const statuses = React.useMemo(() => Array.from(new Set(all.map(r => r.status))).sort(), [all]);

  const rows = React.useMemo(() => all.filter(r => {
    if (query && ![r.no, r.title, r.client].some(v => v && v.toLowerCase().includes(query.toLowerCase()))) return false;
    if (status !== 'All' && r.status !== status) return false;
    return true;
  }), [all, query, status]);

  const exportCsv = () => {
    const head = ['Quote','Title','Client','Amount','Status','Valid until'];
    const body = rows.map(r => [r.no, r.title, r.client, r.amt, r.status, r.valid]);
    const csv = [head, ...body].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    try {
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'quotes.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e) {}
    setToast({ tone:'positive', text:`Exported ${rows.length} quote${rows.length===1?'':'s'} to quotes.csv.` });
  };

  const submitDraft = () => {
    if (!draftRow.title || !draftRow.client || !draftRow.amt) {
      setToast({ tone:'amber', text:'Title, client and amount are required.' });
      return;
    }
    setToast({ tone:'positive', text:`Draft quote created for ${draftRow.client} (${inr(Number(draftRow.amt) || 0)}). Open it to add line items.` });
    setDraft(false);
    setDraftRow({ title:'', client:'', amt:'' });
  };

  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Sales" title="Quotes"
        description="Draft → Sent → Negotiating → Accepted → Converted to PO. All lineage tracked."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setDraft(true)}>New quote</Btn>
        </>}/>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}

      {draft && (
        <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, padding: 16, marginBottom: 14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600 }}>New quote — draft</div>
            <button onClick={() => setDraft(false)} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 5, cursor:'pointer', color: TOKENS.ink3 }}><Icon name="x" size={12}/></button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr', gap: 10 }}>
            <Field label="Title"     value={draftRow.title}  onChange={(e) => setDraftRow({...draftRow, title:e.target.value})}  placeholder="e.g. Fire hydrant — Tower 4 & 5"/>
            <Field label="Client"    value={draftRow.client} onChange={(e) => setDraftRow({...draftRow, client:e.target.value})} placeholder="e.g. Brigade Enterprises"/>
            <Field label="Amount (₹)" value={draftRow.amt}    onChange={(e) => setDraftRow({...draftRow, amt:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="48000000"/>
          </div>
          <div style={{ marginTop: 12, display:'flex', justifyContent:'flex-end', gap: 8 }}>
            <Btn variant="outline" size="sm" onClick={() => setDraft(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="check" onClick={submitDraft}>Save draft</Btn>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        <KPI label="Open pipeline" value={inr(rows.filter(r=>['SENT','NEGOTIATING','CHANGES_REQUESTED'].includes(r.status)).reduce((a,r)=>a+r.amt,0))} sub={`${rows.filter(r=>['SENT','NEGOTIATING','CHANGES_REQUESTED'].includes(r.status)).length} quotes active`}/>
        <KPI label="Accepted · FY"  value={inr(rows.filter(r=>r.status==='ACCEPTED').reduce((a,r)=>a+r.amt,0))} sub={`${rows.filter(r=>r.status==='ACCEPTED').length} quotes`} trend={22}/>
        <KPI label="Converted · FY" value={inr(rows.filter(r=>r.status==='CONVERTED').reduce((a,r)=>a+r.amt,0))} sub="→ PO · 18 projects"/>
        <KPI label="Win rate · 12M" value="68%" sub="+5 pts vs. prior" trend={8} accent/>
        <KPI label="Avg. cycle"     value="14 days" sub="Quote → PO"/>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, maxWidth: 360 }}>
          <div style={{ position:'absolute', left: 10, top: 8, color: TOKENS.ink3 }}><Icon name="search" size={13}/></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quote #, title, client…" style={{
            width:'100%', padding: '6px 10px 6px 30px', borderRadius: 4, border: `1px solid ${TOKENS.ruleStrong}`, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink, outline:'none', background: TOKENS.card,
          }}/>
        </div>
        <FilterChip label="Status" value={status} active={status!=='All'} options={['All', ...statuses]} onChange={setStatus}/>
        <div style={{ flex:1 }}/>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>Showing {rows.length} of {all.length}</div>
      </div>

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['Quote #','Title','Client','Amount','Status','Valid until',''].map((h,i)=>(
              <th key={i} style={{ padding:'8px 12px', textAlign: i===3?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign:'center', fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>No quotes match these filters.</td></tr>
            )}
            {rows.map((r,i)=>(
              <tr key={i} onClick={() => setOpen(r)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                <td style={{ padding:'10px 12px' }}><Code>{r.no}</Code></td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{r.title}</td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink2 }}>{r.client}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(r.amt)}</td>
                <td style={{ padding:'10px 12px' }}><Pill tone={QUOTE_STATUS_TONE[r.status]} size="sm" dot>{r.status.replace('_',' ')}</Pill></td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.valid}</td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <QuoteDetail quote={open} onClose={() => setOpen(null)} onAction={(msg) => setToast({ tone:'positive', text: msg })}/>
    </div>
  );
}

function QuoteDetail({ quote, onClose, onAction }) {
  if (!quote) return null;
  const r = quote;
  const subtotal = Math.round(r.amt / 1.18);
  const gst = r.amt - subtotal;
  const lines = [
    { d:'Material supply (per BoQ)',          q: 1, u:'lot', rate: Math.round(subtotal*0.65), amt: Math.round(subtotal*0.65) },
    { d:'Installation, testing, commissioning', q: 1, u:'lot', rate: Math.round(subtotal*0.30), amt: Math.round(subtotal*0.30) },
    { d:'Documentation & handover',           q: 1, u:'lot', rate: subtotal - Math.round(subtotal*0.65) - Math.round(subtotal*0.30), amt: subtotal - Math.round(subtotal*0.65) - Math.round(subtotal*0.30) },
  ];

  return (
    <Modal open={!!quote} onClose={onClose}
      eyebrow={`${r.status.replace('_',' ')} QUOTE`}
      title={`${r.no} · ${r.title}`}
      width={780}
      actions={<>
        <Btn variant="outline" size="sm" icon="download" onClick={() => onAction(`Generated PDF for ${r.no}.`)}>PDF</Btn>
        <Btn variant="outline" size="sm" icon="share" onClick={() => { try { navigator.clipboard.writeText(`https://sabindia.in/quote/${r.no}`); } catch(e) {} onAction(`Quote link copied to clipboard.`); }}>Share link</Btn>
        {r.status === 'DRAFT'        && <Btn variant="primary" size="sm" icon="upload" onClick={() => onAction(`Quote ${r.no} sent to ${r.client}.`)}>Send to client</Btn>}
        {r.status === 'ACCEPTED'     && <Btn variant="primary" size="sm" icon="check" onClick={() => onAction(`Converted ${r.no} → new project ledger created.`)}>Convert to PO</Btn>}
        {r.status === 'NEGOTIATING'  && <Btn variant="primary" size="sm" icon="refresh" onClick={() => onAction(`Revision started — clone created as ${r.no}-R1.`)}>Revise</Btn>}
      </>}
    >
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
        <Field label="Client"        value={r.client} readOnly/>
        <Field label="Status"        value={r.status.replace('_',' ')} readOnly/>
        <Field label="Valid until"   value={r.valid} readOnly/>
        <Field label="Quote total"   value={inr(r.amt)} readOnly/>
      </div>

      <div style={{ border:`1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden', marginBottom: 14 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom:`1px solid ${TOKENS.rule}` }}>
            {['Description','Qty','UoM','Rate','Amount'].map((h,i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign: i>=1?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.map((l,i) => (
              <tr key={i} style={{ borderBottom: i<lines.length-1?`1px solid ${TOKENS.rule}`:'none' }}>
                <td style={{ padding:'9px 12px', color: TOKENS.ink }}>{l.d}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono }}>{l.q}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink3 }}>{l.u}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono }}>{inr(l.rate)}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600 }}>{inr(l.amt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <div style={{ minWidth: 280, fontFamily: FONT.sans, fontSize: 12.5 }}>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', color: TOKENS.ink2 }}><span>Subtotal</span><span style={{ fontFamily: FONT.mono }}>{inr(subtotal)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', color: TOKENS.ink2 }}><span>GST 18%</span><span style={{ fontFamily: FONT.mono }}>{inr(gst)}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0 0', borderTop:`1px solid ${TOKENS.rule}`, marginTop: 6, fontWeight: 600, color: TOKENS.ink }}>
            <span>Total</span><span style={{ fontFamily: FONT.mono }}>{inr(r.amt)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, ...rest }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <input {...rest} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, background: rest.readOnly ? TOKENS.paperAlt : TOKENS.card, outline:'none' }}/>
    </div>
  );
}

function FieldSelect({ label, children, ...rest }) {
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <select {...rest} style={{ width:'100%', padding:'7px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, background: TOKENS.card, outline:'none' }}>
        {children}
      </select>
    </div>
  );
}

function InventoryRoute() {
  const rows = SEED.inventory;
  const totalVal = rows.reduce((a,r)=>a+r.val,0);
  const low = rows.filter(r=>r.low).length;
  const [toast, setToast] = React.useState(null);
  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Operations" title="Inventory" description="Stock on hand · issue to project, transfer between projects, receive purchases"
        actions={<>
          <Btn variant="outline" size="sm" icon="upload" onClick={() => setToast({ tone:'positive', text:'Receive flow opens GRN module — see Procurement → Goods receipts.' })}>Receive</Btn>
          <Btn variant="outline" size="sm" icon="arrowRight" onClick={() => setToast({ tone:'positive', text:'Stock issue posted to project ledger.' })}>Issue</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setToast({ tone:'amber', text:'New SKU form — connect to inventory master in production.' })}>New SKU</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="Stock value" value={inr(totalVal)} sub={`${rows.length} SKUs`} accent/>
        <KPI label="Low stock" value={low} sub={`${low} SKUs below threshold`}/>
        <KPI label="Issued this FY" value={inr(18_40_00_000)} sub="to 48 projects"/>
        <KPI label="Purchases FY" value={inr(29_60_00_000)} sub="direct + store"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['SKU','Description','Unit','On hand','Cost','Value',''].map((h,i)=>(
              <th key={i} style={{ padding:'8px 12px', textAlign: i>=3?'right':'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${TOKENS.rule}` }}>
                <td style={{ padding:'10px 12px' }}><Code>{r.sku}</Code></td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>
                  {r.name}
                  {r.low && <Pill tone="alert" size="sm" style={{ marginLeft: 8 }} dot>LOW</Pill>}
                </td>
                <td style={{ padding:'10px 12px', color: TOKENS.ink3, fontFamily: FONT.mono, fontSize: 11 }}>{r.unit}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: r.low ? TOKENS.alert : TOKENS.ink, fontVariantNumeric:'tabular-nums' }}>{r.onHand.toLocaleString('en-IN')}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink2 }}>{inr(r.cost)}</td>
                <td style={{ padding:'10px 12px', textAlign:'right', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{inr(r.val)}</td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="more" size={14}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimesheetsRoute() {
  const rows = SEED.timesheets;
  const tone = { OPEN:'positive', SUBMITTED:'amber', APPROVED:'blue', REJECTED:'alert' };
  const [toast, setToast] = React.useState(null);
  const pending = rows.filter(r => r.status === 'SUBMITTED').length;
  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Operations" title="Timesheets" description="Clock-in/out from mobile with geo-stamp. Supervisors approve. Approved entries post to project ledger."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={() => setToast({ tone:'positive', text:`Exported ${rows.length} timesheet rows for this week.` })}>Export week</Btn>
          <Btn variant="primary" size="sm" icon="check" onClick={() => setToast({ tone:'positive', text:`Approved ${pending} submitted timesheets — posted to project ledgers.` })}>Approve {pending} pending</Btn>
        </>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
        <KPI label="On site — now" value="4" sub="live punches" accent/>
        <KPI label="Pending approval" value={pending} sub="across 5 projects"/>
        <KPI label="Hours · this week" value="342h" sub="18 crew"/>
        <KPI label="Labor cost · week" value={inr(2_80_000)} sub="pulled from wage rates"/>
      </div>
      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['Employee','Project','Clock in','Clock out','Hours','Photos','Geo-stamp','Status',''].map((h,i)=>(
              <th key={i} style={{ padding:'8px 12px', textAlign:'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${TOKENS.rule}` }}>
                <td style={{ padding:'10px 12px', color: TOKENS.ink, fontWeight:500 }}>{r.emp}</td>
                <td style={{ padding:'10px 12px' }}><Code>{r.pc}</Code></td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, color: TOKENS.ink2 }}>{r.clockIn}</td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, color: TOKENS.ink2 }}>{r.clockOut}</td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontWeight:600, color: TOKENS.ink }}>{r.hrs}</td>
                <td style={{ padding:'10px 12px' }}><span style={{ display:'inline-flex', alignItems:'center', gap: 5, fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink3 }}><Icon name="camera" size={12}/>{r.photos}</span></td>
                <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.loc}</td>
                <td style={{ padding:'10px 12px' }}><Pill tone={tone[r.status]} size="sm" dot>{r.status}</Pill></td>
                <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsRoute() {
  const [toast, setToast] = React.useState(null);
  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Analytics" title="Reports" description="Pre-built reports assembled from the underlying ledger. Every report is exportable and filterable by FY, client, project description."
        actions={<><FyFilter/><Btn variant="primary" size="sm" icon="plus" onClick={() => setToast({ tone:'amber', text:'Custom report builder — choose dimensions, metrics, then save.' })}>New report</Btn></>}/>
      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 14 }}>
        {[
          { g:'Finance',   t:'Portfolio P&L',            d:'Revenue, contribution, net margin. By client / description.', ic:'pie' },
          { g:'Finance',   t:'Receivables ageing',       d:'Outstanding invoices bucketed 0-30, 30-60, 60-90, 90+.', ic:'clock' },
          { g:'Finance',   t:'Cashflow · 90 day',        d:'Projected collections vs. expected outflows.', ic:'trending' },
          { g:'Operations',t:'Crew utilization',         d:'Hours booked vs. calendar. By supervisor & project.', ic:'user' },
          { g:'Operations',t:'Project burn vs. budget',  d:'Actual spend against budget line-items.', ic:'flame' },
          { g:'Operations',t:'Materials movement',       d:'Receipts, issues, transfers. By SKU.', ic:'box' },
          { g:'Sales',     t:'Quote win-rate',           d:'Accepted / converted by client and description.', ic:'arrowUp' },
          { g:'Sales',     t:'Client ranking',           d:'Top by PO value, margin, on-time payment.', ic:'building' },
          { g:'Compliance',t:'GST output register',      d:'All issued invoices, GSTIN split, month-wise.', ic:'shield' },
        ].map((r,i)=>(
          <div key={i} onClick={() => setToast({ tone:'positive', text:`Opening ${r.t} — assembling from ledger…` })} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 16, cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 4, background: TOKENS.accentWash, color: TOKENS.accentInk, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon name={r.ic} size={16}/>
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>{r.g}</div>
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink, marginBottom: 4 }}>{r.t}</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, lineHeight: 1.45 }}>{r.d}</div>
            <div style={{ marginTop: 12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>Last run 2d ago</span>
              <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.accentInk, fontWeight: 500 }}>Open →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleRoute({ title, desc }) {
  return (
    <div style={{ padding:'24px 28px' }}>
      <PageHeader eyebrow="Section" title={title} description={desc}/>
      <div style={{ background: TOKENS.card, border:`1px dashed ${TOKENS.ruleStrong}`, borderRadius: 4, padding: 64, textAlign:'center' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>Layout available</div>
        <div style={{ fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3, marginTop: 6 }}>Included in full build — other routes demonstrate the same table / KPI / detail patterns.</div>
      </div>
    </div>
  );
}

Object.assign(window, { InvoicesRoute, QuotesRoute, InventoryRoute, TimesheetsRoute, ReportsRoute, SimpleRoute, FilterChip, Field, FieldSelect, INVOICE_STATUS_TONE, QUOTE_STATUS_TONE });
