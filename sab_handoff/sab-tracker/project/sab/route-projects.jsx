// SAB — Projects list with live filters

function ProjectsRoute({ onNav, onOpen }) {
  const all = SEED.projects;
  const [query, setQuery]       = React.useState('');
  const [status, setStatus]     = React.useState('All');
  const [supervisor, setSup]    = React.useState('All');
  const [needsBilling, setNB]   = React.useState(false);
  const [desc, setDesc]         = React.useState('All descriptions');
  const [fy, setFy]             = React.useState('FY 25-26');
  const [view, setView]         = React.useState('list');
  const [toast, setToast]       = React.useState(null);

  const supervisors = React.useMemo(() => Array.from(new Set(all.map(r => r.sup).filter(s => s && s !== '—'))).sort(), [all]);
  const statuses    = React.useMemo(() => Array.from(new Set(all.map(r => r.status))).sort(), [all]);
  const fyMatches = (code, fyLabel) => {
    if (fyLabel === 'All FYs') return true;
    const m = fyLabel.match(/(\d{2})-(\d{2})/);
    if (!m) return true;
    const yy = m[1];
    return code.startsWith(`SAB-${yy}-`);
  };

  const rows = React.useMemo(() => all.filter(r => {
    if (query) {
      const q = query.toLowerCase();
      if (![r.code, r.name, r.client, r.loc, r.sup].some(v => v && v.toLowerCase().includes(q))) return false;
    }
    if (status !== 'All' && r.status !== status) return false;
    if (supervisor !== 'All' && r.sup !== supervisor) return false;
    if (needsBilling && r.billed >= r.pov) return false;
    if (desc !== 'All descriptions' && r.desc !== desc) return false;
    if (!fyMatches(r.code, fy)) return false;
    return true;
  }), [all, query, status, supervisor, needsBilling, desc, fy]);

  const totalPo = rows.reduce((a,r)=>a+r.pov,0);
  const totalBilled = rows.reduce((a,r)=>a+r.billed,0);
  const outstanding = totalPo - totalBilled;
  const needBill = rows.filter(r => r.billed < r.pov).length;

  const exportCsv = () => {
    const head = ['Code','Project','Client','Description','Location','PO Value','Billed','Progress','Status','PO Date','Supervisor'];
    const body = rows.map(r => [r.code, r.name, r.client, r.desc, r.loc, r.pov, r.billed, r.progress+'%', r.status, r.pod, r.sup]);
    const csv = [head, ...body].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    setToast({ tone:'positive', text:`Exported ${rows.length} projects to projects-${fy.replace(/\s/g,'')}.csv (preview).` });
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `projects-${fy.replace(/\s/g,'')}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) { /* preview env may block download — toast still shows */ }
    }
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        description="165 total · 117 with PO issued · 48 with outstanding billable · filters scope every card and row below"
        actions={<>
          <FyFilter value={fy} onChange={setFy}/>
          <DescriptionFilter value={desc} onChange={setDesc}/>
          <Btn variant="outline" size="sm" icon="download" onClick={exportCsv}>Export XLSX</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setToast({ tone:'amber', text:'New project wizard — connect to BoQ + client master in production.' })}>New project</Btn>
        </>}
      />

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.text}</Notice>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <KPI label="Total PO Value" value={inr(totalPo)} sub={`${rows.length} POs · inc GST`} accent/>
        <KPI label="Billed" value={inr(totalBilled)} sub={totalPo ? `${((totalBilled/totalPo)*100).toFixed(1)}% of PO value` : '—'}/>
        <KPI label="Outstanding billable" value={inr(outstanding)} sub={`${needBill} POs need billing`}/>
        <KPI label="Adj. billable" value={inr(4_20_00_000)} sub="Scope-change adjustments"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label:'PO Status', rows:[
            { k:'Issued',    n: 117, tone:'positive' },
            { k:'Draft',     n: 31,  tone:'amber' },
            { k:'Cancelled', n: 5,   tone:'alert' },
            { k:'Not set',   n: 12,  tone:'ink' },
          ]},
          { label:'Description', rows:[
            { k:'Fire Fighting', n: 72, tone:'accent' },
            { k:'Medical Gas',   n: 48, tone:'blue' },
            { k:'AMC',           n: 28, tone:'positive' },
            { k:'Detection',     n: 17, tone:'amber' },
          ]},
          { label:'Top 3 clients', rows: SEED.topClients.slice(0,3).map(c => ({ k:c.n, n:c.pos, sub: inr(c.pov) })) },
          { label:'Response owner', rows:[
            { k:'R. Naidu',   n: 38 },
            { k:'S. Iyer',    n: 29 },
            { k:'K. Pillai',  n: 22 },
            { k:'M. Varma',   n: 19 },
          ]},
          { label:'Financial Year', rows:[
            { k:'FY 25-26', n: 42, sub: inr(142_60_00_000) },
            { k:'FY 24-25', n: 68, sub: inr(188_20_00_000) },
            { k:'FY 23-24', n: 41, sub: inr(102_40_00_000) },
            { k:'FY 22-23', n: 14, sub: inr(48_20_00_000) },
          ]},
        ].map((c, ci) => (
          <div key={ci} style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 14 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>{c.label}</div>
            {c.rows.map((r, ri) => (
              <div key={ri} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '5px 0', borderTop: ri > 0 ? `1px dashed ${TOKENS.rule}` : 'none', fontFamily: FONT.sans, fontSize: 12 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 7, minWidth: 0 }}>
                  {r.tone && <span style={{ width: 5, height: 5, borderRadius: 5, background: TOKENS[r.tone] || TOKENS.ink3, flex:'none' }}/>}
                  <span style={{ color: TOKENS.ink2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.k}</span>
                </div>
                <div style={{ display:'flex', gap: 8, alignItems:'center', flex:'none' }}>
                  {r.sub && <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{r.sub}</span>}
                  <span style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: TOKENS.ink, minWidth: 18, textAlign:'right' }}>{r.n}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 10, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, maxWidth: 360 }}>
          <div style={{ position:'absolute', left: 10, top: 8, color: TOKENS.ink3 }}><Icon name="search" size={13}/></div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by code, client, location…" style={{
            width:'100%', padding: '6px 10px 6px 30px', borderRadius: 4, border: `1px solid ${TOKENS.ruleStrong}`, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink, outline:'none', background: TOKENS.card,
          }}/>
        </div>
        <PillFilter label="Status" value={status} options={['All', ...statuses]} onChange={setStatus} active={status !== 'All'}/>
        <PillFilter label="Supervisor" value={supervisor} options={['All', ...supervisors]} onChange={setSup} active={supervisor !== 'All'}/>
        <PillFilter label="Needs billing" value={needsBilling ? 'Yes' : 'No'} options={['No','Yes']} onChange={(v) => setNB(v === 'Yes')} active={needsBilling}/>
        <div style={{ flex:1 }}/>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>Showing {rows.length} of {all.length}</div>
        <div style={{ display:'flex', border: `1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, overflow:'hidden' }}>
          <button onClick={() => setView('list')} style={{ padding: '6px 9px', border:'none', background: view==='list' ? TOKENS.card : TOKENS.paperAlt, borderRight: `1px solid ${TOKENS.rule}`, color: view==='list' ? TOKENS.ink : TOKENS.ink3, cursor:'pointer' }}><Icon name="list" size={13}/></button>
          <button onClick={() => setView('kanban')} style={{ padding: '6px 9px', border:'none', background: view==='kanban' ? TOKENS.card : TOKENS.paperAlt, color: view==='kanban' ? TOKENS.ink : TOKENS.ink3, cursor:'pointer' }}><Icon name="kanban" size={13}/></button>
        </div>
      </div>

      {view === 'list' && (
        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
                {['Code','Project','Client','Description','Location','PO Value','Billed','Progress','Status','PO Date','Supervisor',''].map((h,i) => (
                  <th key={i} style={{ padding: '8px 10px', textAlign: i >= 5 && i <= 7 ? 'right' : 'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={12} style={{ padding: 32, textAlign:'center', fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>No projects match these filters. <button onClick={() => { setQuery(''); setStatus('All'); setSup('All'); setNB(false); setDesc('All descriptions'); setFy('All FYs'); }} style={{ marginLeft: 8, background:'transparent', border:'none', color: TOKENS.accentInk, cursor:'pointer', fontFamily:'inherit', fontSize:'inherit', textDecoration:'underline' }}>Reset filters</button></td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} onClick={() => onOpen && onOpen(r.code)} style={{ borderBottom: `1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                  <td style={{ padding:'10px 10px' }}><Code>{r.code}</Code></td>
                  <td style={{ padding:'10px 10px', color: TOKENS.ink, fontWeight: 500 }}>{r.name}</td>
                  <td style={{ padding:'10px 10px', color: TOKENS.ink2, maxWidth: 200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.client}</td>
                  <td style={{ padding:'10px 10px' }}>
                    <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, padding: '1px 6px', border: `1px solid ${TOKENS.rule}`, borderRadius: 3 }}>{r.desc}</span>
                  </td>
                  <td style={{ padding:'10px 10px', color: TOKENS.ink3, fontSize: 11.5 }}>{r.loc}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right', fontFamily: FONT.mono, fontWeight: 600, color: TOKENS.ink, fontVariantNumeric:'tabular-nums' }}>{inr(r.pov)}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right', fontFamily: FONT.mono, color: TOKENS.ink2, fontVariantNumeric:'tabular-nums' }}>{inr(r.billed)}</td>
                  <td style={{ padding:'10px 10px', textAlign:'right', minWidth: 90 }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 7, justifyContent:'flex-end' }}>
                      <div style={{ width: 44, height: 3, background: TOKENS.rule, borderRadius: 3, overflow:'hidden' }}>
                        <div style={{ width: `${r.progress}%`, height:'100%', background: r.progress === 100 ? TOKENS.positive : TOKENS.accent }}/>
                      </div>
                      <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, minWidth: 26 }}>{r.progress}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'10px 10px' }}><Pill tone={r.wsTone === 'amber' ? 'amber' : r.wsTone === 'blue' ? 'blue' : r.wsTone === 'positive' ? 'positive' : r.wsTone === 'alert' ? 'alert' : 'ink'} size="sm" dot>{r.status}</Pill></td>
                  <td style={{ padding:'10px 10px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.pod}</td>
                  <td style={{ padding:'10px 10px', color: TOKENS.ink3, fontSize: 11.5 }}>{r.sup}</td>
                  <td style={{ padding:'10px 6px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap: 10 }}>
          {['Awaiting PO','Material ready','In progress','On hold','Commissioned','Handover done'].map(col => {
            const items = rows.filter(r => r.status === col);
            return (
              <div key={col} style={{ background: TOKENS.paperAlt, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 10, minHeight: 200 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 8 }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{col}</div>
                  <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{items.length}</span>
                </div>
                {items.map(r => (
                  <div key={r.code} onClick={() => onOpen && onOpen(r.code)} style={{ background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 3, padding: 8, marginBottom: 6, cursor:'pointer' }}>
                    <Code>{r.code}</Code>
                    <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink, fontWeight: 500, marginTop: 3 }}>{r.name}</div>
                    <div style={{ fontFamily: FONT.sans, fontSize: 10.5, color: TOKENS.ink3, marginTop: 2 }}>{r.client}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop: 5, fontFamily: FONT.mono, fontSize: 10 }}>
                      <span style={{ color: TOKENS.ink3 }}>{r.progress}%</span>
                      <span style={{ color: TOKENS.ink, fontWeight:600 }}>{inr(r.pov)}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 10, display:'flex', justifyContent:'space-between', fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>
        <span>Full billed ledger: {inr(totalBilled, { compact:false })}  ·  Outstanding billable: {inr(outstanding, { compact:false })}</span>
        <span>Click any row to open project →</span>
      </div>
    </div>
  );
}

function PillFilter({ label, value, active = false, options, onChange }) {
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
      <button onClick={() => setOpen(v => !v)} style={{
        display:'inline-flex', alignItems:'center', gap: 6,
        padding:'5px 10px',
        border:`1px solid ${active ? TOKENS.accent : TOKENS.ruleStrong}`,
        background: active ? TOKENS.accentWash : TOKENS.card,
        borderRadius: 4,
        fontFamily: FONT.sans, fontSize: 12,
        color: active ? TOKENS.accentInk : TOKENS.ink2,
        cursor:'pointer',
      }}>
        <span style={{ color: TOKENS.ink3, fontWeight: 500 }}>{label}:</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
        <Icon name="chevDown" size={11}/>
      </button>
      {open && options && (
        <div style={{
          position:'absolute', top:'100%', left: 0, marginTop: 4, zIndex: 50,
          background: TOKENS.card, border: `1px solid ${TOKENS.ruleStrong}`, borderRadius: 4,
          minWidth: 200, maxHeight: 280, overflowY:'auto',
          boxShadow: '0 6px 20px rgba(0,0,0,.08)'
        }}>
          {options.map(o => (
            <button key={o} onClick={() => { onChange && onChange(o); setOpen(false); }} style={{
              display:'block', width:'100%', textAlign:'left',
              padding:'7px 12px', background: o === value ? TOKENS.accentWash : 'transparent',
              border:'none', cursor:'pointer',
              fontFamily: FONT.sans, fontSize: 12,
              color: o === value ? TOKENS.accentInk : TOKENS.ink,
            }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProjectsRoute, PillFilter });
