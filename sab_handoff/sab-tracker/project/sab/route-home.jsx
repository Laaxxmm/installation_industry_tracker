// SAB — Home dashboard

function HomeRoute({ onNav, density }) {
  const s = SEED;
  const dense = density === 'dense';
  const pad = dense ? 14 : 18;
  const gap = dense ? 12 : 16;

  return (
    <div style={{ padding: dense ? '20px 24px' : '24px 28px' }}>
      <PageHeader
        eyebrow="Operations · Overview"
        title={`Good afternoon, ${s.user.name.split(' ')[0]}`}
        description={`Portfolio · 165 projects · 42 clients · ${s.fy} · Last sync 2 min ago`}
        actions={<>
          <FyFilter/>
          <DescriptionFilter/>
          <Btn variant="outline" size="sm" icon="download">Export</Btn>
          <Btn variant="primary" size="sm" icon="plus">New project</Btn>
        </>}
      />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap }}>
        <KPI label="Portfolio PO Value" value={inr(s.kpis.poValue)} sub="165 POs · FY 25-26" trend={s.kpis.poDelta}
          spark={<Sparkline values={s.monthlyBilling} width={140} height={24}/>} onClick={() => onNav('projects')}/>
        <KPI label="Billed · FY 25-26"  value={inr(s.kpis.billed)}  sub="124 invoices issued"  trend={s.kpis.billedDelta}
          spark={<Sparkbars values={s.monthlyBilling} height={24}/>} onClick={() => onNav('invoices')}/>
        <KPI label="Outstanding billable" value={inr(s.kpis.outstanding)} sub="23 POs need billing" trend={s.kpis.outstandingDelta}
          accent onClick={() => onNav('projects')}/>
        <KPI label="Receivables" value={inr(s.kpis.receivables)} sub="14 invoices awaiting payment" trend={s.kpis.receivablesDelta}
          onClick={() => onNav('invoices')}/>
      </div>

      {/* P&L bar */}
      <div style={{ marginTop: gap, background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: pad }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>Portfolio P&amp;L · FY 25-26</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 2 }}>Revenue less direct costs and overhead, computed on-demand from invoices + ledger</div>
          </div>
          <button onClick={() => onNav('reports')} style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.accentInk, background:'transparent', border:'none', cursor:'pointer', fontWeight: 500 }}>Full P&amp;L report →</button>
        </div>
        <PnlStrip p={s.pnl}/>
      </div>

      {/* Billing trend + action items */}
      <div style={{ marginTop: gap, display:'grid', gridTemplateColumns: '2fr 1fr', gap }}>
        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: pad }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>Monthly billing · last 12 months</div>
              <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 2 }}>Sum of ISSUED + PAID invoice value by month</div>
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink3 }}>Total {inr(s.monthlyBilling.reduce((a,b)=>a+b,0))} · trailing 12M</div>
          </div>
          <BillingChart values={s.monthlyBilling} labels={s.monthLabels}/>
        </div>

        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: pad }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>Action items</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 2 }}>Where to look next</div>
          <div style={{ marginTop: 12 }}>
            {s.actions.map((a, i) => {
              const toneMap = { amber: TOKENS.amber, blue: TOKENS.blue, alert: TOKENS.alert, positive: TOKENS.positive, ink: TOKENS.ink3 };
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap: 10, padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: toneMap[a.tone], flex:'none' }}/>
                  <div style={{ flex:1, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink2 }}>{a.k}</div>
                  {a.money && <div style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink3, fontVariantNumeric:'tabular-nums' }}>{inr(a.money)}</div>}
                  <div style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: TOKENS.ink, minWidth: 28, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{a.n}</div>
                  <Icon name="chevRight" size={12} color={TOKENS.ink4}/>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Work status + top clients */}
      <div style={{ marginTop: gap, display:'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: pad }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 12 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>Work status</div>
            <button onClick={() => onNav('projects')} style={{ fontFamily: FONT.sans, fontSize: 11, color: TOKENS.accentInk, background:'transparent', border:'none', cursor:'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {s.workStatus.map((w, i) => (
            <div key={i} style={{ padding: '7px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily: FONT.sans, fontSize: 12.5 }}>
                <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: TOKENS[w.tone] || TOKENS.ink3 }}/>
                  <span style={{ color: TOKENS.ink2 }}>{w.k}</span>
                </div>
                <div style={{ display:'flex', gap: 14, alignItems:'center' }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink3 }}>{w.pct}%</span>
                  <span style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink3, minWidth: 64, textAlign:'right' }}>{inr(w.pov)}</span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: TOKENS.ink, minWidth: 24, textAlign:'right' }}>{w.n}</span>
                </div>
              </div>
              <div style={{ height: 2, background: TOKENS.rule, marginTop: 5, overflow:'hidden', borderRadius: 2 }}>
                <div style={{ width: `${w.pct * 3}%`, maxWidth:'100%', height:'100%', background: TOKENS[w.tone] || TOKENS.ink3, opacity: .8 }}/>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: pad }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TOKENS.ink }}>Top 5 clients</div>
              <div style={{ fontFamily: FONT.sans, fontSize: 11, color: TOKENS.ink3, marginTop: 1 }}>by PO value</div>
            </div>
            <button onClick={() => onNav('clients')} style={{ fontFamily: FONT.sans, fontSize: 11, color: TOKENS.accentInk, background:'transparent', border:'none', cursor:'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          {s.topClients.map((c, i) => {
            const pct = (c.billed / c.pov) * 100;
            return (
              <div key={i} style={{ padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap: 10, fontFamily: FONT.sans, fontSize: 12.5 }}>
                  <div style={{ color: TOKENS.ink, fontWeight: 500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.n}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: TOKENS.ink, fontWeight: 600, flex:'none' }}>{inr(c.pov)}</div>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, marginTop: 3 }}>
                  <span>{c.pos} POs · billed {inr(c.billed)}</span>
                  <span>out {inr(c.out)}</span>
                </div>
                <div style={{ display:'flex', height: 3, background: TOKENS.rule, marginTop: 5, borderRadius: 3, overflow:'hidden' }}>
                  <div style={{ width: `${pct}%`, background: TOKENS.positive }}/>
                  <div style={{ width: `${100-pct}%`, background: TOKENS.accent, opacity: .35 }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PnlStrip({ p }) {
  const cols = [
    { k:'Revenue',      v: p.revenue,      tone:'ink',  bold:true },
    { k:'Labor',        v: p.labor,        tone:'muted' },
    { k:'Material',     v: p.material,     tone:'muted' },
    { k:'Other',        v: p.other,        tone:'muted' },
    { k:'Contribution', v: p.contribution, tone:'positive' },
    { k:'Overhead',     v: p.overhead,     tone:'muted' },
    { k:'Net P&L',      v: p.net,          tone:'positive', bold:true, hero:true },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 3, overflow:'hidden' }}>
      {cols.map((c, i) => {
        const fg = c.tone === 'positive' ? TOKENS.positive : c.tone === 'muted' ? TOKENS.ink2 : TOKENS.ink;
        return (
          <div key={i} style={{ padding: '12px 14px', background: c.hero ? TOKENS.accentWash : TOKENS.card }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{c.k}</div>
            <div style={{ fontFamily: FONT.sans, fontSize: c.bold ? 18 : 15, fontWeight: c.bold ? 600 : 500, color: c.hero ? TOKENS.accentInk : fg, marginTop: 4, fontVariantNumeric:'tabular-nums', letterSpacing:'-0.02em' }}>{inr(c.v)}</div>
            {c.k === 'Net P&L' && <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.positive, marginTop: 2 }}>{p.marginPct}% margin</div>}
          </div>
        );
      })}
    </div>
  );
}

function BillingChart({ values, labels }) {
  const max = Math.max(...values);
  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-end', gap: 6, height: 140, position:'relative' }}>
        {/* grid lines */}
        <div style={{ position:'absolute', inset: 0, pointerEvents:'none' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <div key={i} style={{ position:'absolute', left: 0, right: 0, top: `${t*100}%`, borderTop: `1px dashed ${TOKENS.rule}` }}/>
          ))}
        </div>
        {values.map((v, i) => {
          const h = (v / max) * 100;
          const last = i === values.length - 1;
          return (
            <div key={i} style={{ flex:1, position:'relative', height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
              <div style={{
                height: `${h}%`,
                background: last ? TOKENS.accent : TOKENS.ink,
                opacity: last ? 1 : 0.82,
                borderRadius: '1px 1px 0 0',
                position: 'relative',
              }}>
                {last && <div style={{ position:'absolute', top:-22, left:'50%', transform:'translateX(-50%)', fontFamily: FONT.mono, fontSize: 10, fontWeight: 600, color: TOKENS.accentInk, whiteSpace:'nowrap' }}>{inr(v)}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap: 6, marginTop: 6 }}>
        {labels.map((l, i) => (
          <div key={i} style={{ flex:1, textAlign:'center', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3 }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function FyFilter({ value, onChange }) {
  const opts = ['All FYs','FY 25-26','FY 24-25','FY 23-24','FY 22-23'];
  const [open, setOpen] = React.useState(false);
  const v = value || 'FY 25-26';
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap: 6, padding:'5px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, background: TOKENS.card, fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink2, cursor:'pointer' }}>
        <Icon name="filter" size={12}/>{v}<Icon name="chevDown" size={11}/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop: 4, zIndex: 50, background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, minWidth: 160, boxShadow:'0 6px 20px rgba(0,0,0,.08)' }}>
          {opts.map(o => (
            <button key={o} onClick={() => { onChange && onChange(o); setOpen(false); }} style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background: o===v?TOKENS.accentWash:'transparent', border:'none', cursor:'pointer', fontFamily: FONT.mono, fontSize: 11, color: o===v?TOKENS.accentInk:TOKENS.ink }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionFilter({ value, onChange }) {
  const opts = SEED.descriptions || ['All descriptions','Fire Fighting','Medical Gas','AMC','Detection','Suppression'];
  const [open, setOpen] = React.useState(false);
  const v = value || opts[0];
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap: 6, padding:'5px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, background: TOKENS.card, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2, cursor:'pointer' }}>
        {v}<Icon name="chevDown" size={11}/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, marginTop: 4, zIndex: 50, background: TOKENS.card, border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, minWidth: 200, boxShadow:'0 6px 20px rgba(0,0,0,.08)' }}>
          {opts.map(o => (
            <button key={o} onClick={() => { onChange && onChange(o); setOpen(false); }} style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 12px', background: o===v?TOKENS.accentWash:'transparent', border:'none', cursor:'pointer', fontFamily: FONT.sans, fontSize: 12, color: o===v?TOKENS.accentInk:TOKENS.ink }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { HomeRoute, PnlStrip, BillingChart, FyFilter, DescriptionFilter });
