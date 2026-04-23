// SAB — Project detail (hero screen)

function ProjectDetailRoute({ onNav }) {
  const p = SEED.projectDetail;
  const [tab, setTab] = React.useState('overview');

  return (
    <div style={{ padding: '22px 28px 48px' }}>
      {/* Breadcrumbs */}
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={() => onNav('projects')} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Projects</button>
        <Icon name="chevRight" size={11}/>
        <span>Fire Fighting</span>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{p.code}</span>
      </div>

      {/* Header block */}
      <div style={{ display:'flex', alignItems:'flex-start', gap: 24, justifyContent:'space-between', marginBottom: 18 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 8 }}>
            <Code style={{ fontSize: 13, padding:'3px 8px', background: TOKENS.accentWash, borderRadius: 3 }}>{p.code}</Code>
            <Pill tone="blue" dot>{p.status}</Pill>
            <Pill tone="ink" size="sm">Fire Fighting</Pill>
            <Pill tone="ink" size="sm">PO — {p.po}</Pill>
          </div>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 28, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0, lineHeight: 1.1 }}>{p.name}</h1>
          <div style={{ marginTop: 8, display:'flex', alignItems:'center', gap: 14, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap: 5 }}><Icon name="building" size={13}/> {p.client}</span>
            <span style={{ width:1, height: 10, background: TOKENS.rule }}/>
            <span style={{ display:'inline-flex', alignItems:'center', gap: 5 }}><Icon name="mapPin" size={13}/> {p.loc}</span>
            <span style={{ width:1, height: 10, background: TOKENS.rule }}/>
            <span style={{ display:'inline-flex', alignItems:'center', gap: 5 }}><Icon name="user" size={13}/> {p.supervisor}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8, flex:'none' }}>
          <Btn variant="outline" size="sm" icon="share">Share</Btn>
          <Btn variant="outline" size="sm" icon="download">PDF</Btn>
          <Btn variant="primary" size="sm" icon="plus">New invoice</Btn>
        </div>
      </div>

      {/* 5-col stat strip */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr 1fr', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden', marginBottom: 18 }}>
        <StatBlock label="Contract value" value={inr(p.pov)} sub={inr(p.pov, { compact:false })} wide/>
        <StatBlock label="Billed" value={inr(p.billed)} sub={`${Math.round(p.billed/p.pov*100)}% of PO`}/>
        <StatBlock label="Outstanding" value={inr(p.outstanding)} sub="awaiting invoice" accent/>
        <StatBlock label="Progress" value={`${p.progress}%`} sub="6 of 12 milestones"/>
        <StatBlock label="Timeline" value={p.end} sub={`Started ${p.start}`}/>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${TOKENS.rule}`, marginBottom: 18 }}>
        <Tabs active={tab} onChange={setTab} items={[
          { key:'overview',   label:'Overview' },
          { key:'pnl',        label:'P&L' },
          { key:'progress',   label:'Progress', count: 12 },
          { key:'ledger',     label:'Ledger', count: 48 },
          { key:'budget',     label:'Budget' },
          { key:'materials',  label:'Materials' },
          { key:'invoices',   label:'Invoices', count: 4 },
          { key:'po',         label:'PO' },
        ]}/>
      </div>

      {tab === 'overview' && <OverviewTab p={p}/>}
      {tab === 'pnl' && <PnlTab p={p}/>}
      {tab === 'progress' && <ProgressTab p={p}/>}
      {tab === 'ledger' && <LedgerTab p={p}/>}
      {tab === 'materials' && <ProjectMaterialsTab projectCode={p.code}/>}
      {(tab === 'budget' || tab === 'invoices' || tab === 'po') && <Placeholder label={tab}/>}
    </div>
  );
}

function StatBlock({ label, value, sub, wide, accent }) {
  return (
    <div style={{ padding:'14px 18px', background: accent ? TOKENS.accentWash : TOKENS.card, gridColumn: wide ? 'auto' : 'auto' }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 600, color: accent ? TOKENS.accentInk : TOKENS.ink, letterSpacing:'-0.02em', marginTop: 5, fontVariantNumeric:'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function OverviewTab({ p }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr', gap: 16 }}>
      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        {/* Stage timeline */}
        <Card title="Project stages" sub="Planned vs. actual across Survey → Handover">
          <StageTimeline stages={p.stages}/>
        </Card>
        {/* P&L */}
        <Card title="Project P&L" sub="Current FY · on-demand from ledger" action={<Btn variant="ghost" size="sm" icon="download">Export</Btn>}>
          <PnlStrip p={p.pnl}/>
          <div style={{ marginTop: 14, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
            <PnlWaterfall p={p.pnl}/>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Cost breakdown</div>
              <CostBreakdown p={p.pnl}/>
            </div>
          </div>
        </Card>
        {/* Recent ledger */}
        <Card title="Recent ledger activity" sub="Last 30 days · all ledger types" action={<button style={{ background:'transparent', border:'none', color: TOKENS.accentInk, fontFamily: FONT.sans, fontSize: 12, cursor:'pointer', fontWeight: 500 }}>View all 48 →</button>}>
          <LedgerList rows={p.ledger.slice(0, 6)}/>
        </Card>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
        <Card title="Billing progress">
          <BillingProgress p={p}/>
        </Card>
        <Card title="Site activity" sub="Live + last 7 days">
          <SiteActivity/>
        </Card>
        <Card title="Details">
          <DetailRows p={p}/>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, sub, action, children, padding = 16 }) {
  return (
    <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4 }}>
      <div style={{ padding: `14px ${padding}px`, borderBottom: `1px solid ${TOKENS.rule}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT.sans, fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{title}</div>
          {sub && <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 2 }}>{sub}</div>}
        </div>
        {action}
      </div>
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

function StageTimeline({ stages }) {
  return (
    <div>
      <div style={{ display:'flex', gap: 8, position:'relative' }}>
        {stages.map((s, i) => {
          const done = s.status === 'done';
          const now = s.status === 'now';
          const bg = done ? TOKENS.positive : now ? TOKENS.accent : TOKENS.paperAlt;
          const fg = done || now ? '#fff' : TOKENS.ink3;
          return (
            <div key={i} style={{ flex:1, position:'relative' }}>
              <div style={{
                padding: '10px 12px',
                background: bg,
                color: fg,
                borderRadius: 3,
                fontFamily: FONT.sans, fontSize: 12, fontWeight: 600,
                position:'relative',
                clipPath: i === stages.length - 1 ? 'none' : 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
                paddingLeft: i === 0 ? 12 : 16,
              }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing:'.08em', opacity: .85, fontWeight: 500 }}>0{i+1}</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>{s.k}</div>
              </div>
              <div style={{ padding: '6px 10px 0', fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>
                {s.start}–{s.end} · <span style={{ color: done ? TOKENS.positive : now ? TOKENS.accentInk : TOKENS.ink3, fontWeight: 600 }}>{s.pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20, padding: 12, background: TOKENS.paperAlt, borderRadius: 3, display:'flex', gap: 16, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>
        <span><span style={{ fontWeight: 600, color: TOKENS.ink }}>Now:</span> Install — 12 of 18 hydrant points wet-tested, phase 2 pipe routing in progress</span>
      </div>
    </div>
  );
}

function PnlWaterfall({ p }) {
  // simple proportional bars
  const max = p.revenue;
  const rows = [
    { k:'Revenue',      v: p.revenue,      fg: TOKENS.positive, sign: '+' },
    { k:'Labor',        v: -p.labor,       fg: TOKENS.ink2,     sign: '−' },
    { k:'Material',     v: -p.material,    fg: TOKENS.ink2,     sign: '−' },
    { k:'Other',        v: -p.other,       fg: TOKENS.ink2,     sign: '−' },
    { k:'Contribution', v: p.contribution, fg: TOKENS.positive, sign: '=' },
    { k:'Overhead',     v: -p.overhead,    fg: TOKENS.ink2,     sign: '−' },
    { k:'Net P&L',      v: p.net,          fg: TOKENS.accentInk, sign: '=' , bold:true },
  ];
  return (
    <div>
      <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>P&amp;L waterfall</div>
      {rows.map((r, i) => {
        const w = Math.abs(r.v) / max * 100;
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 8, padding: '4px 0' }}>
            <span style={{ width: 12, fontFamily: FONT.mono, fontSize: 11, color: r.fg }}>{r.sign}</span>
            <span style={{ width: 90, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2, fontWeight: r.bold ? 600 : 500 }}>{r.k}</span>
            <div style={{ flex:1, height: r.bold ? 12 : 8, background: TOKENS.paperAlt, borderRadius: 2, overflow:'hidden' }}>
              <div style={{ width: `${w}%`, height:'100%', background: r.fg, opacity: r.bold ? 1 : 0.75 }}/>
            </div>
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink, fontWeight: r.bold ? 600 : 500, minWidth: 70, textAlign:'right' }}>{inr(Math.abs(r.v))}</span>
          </div>
        );
      })}
    </div>
  );
}

function CostBreakdown({ p }) {
  const total = p.labor + p.material + p.other + p.overhead;
  const parts = [
    { k:'Material', v: p.material, c: TOKENS.accent },
    { k:'Labor',    v: p.labor,    c: TOKENS.blue },
    { k:'Overhead', v: p.overhead, c: TOKENS.ink },
    { k:'Other',    v: p.other,    c: TOKENS.amber },
  ];
  return (
    <div>
      <div style={{ display:'flex', height: 10, borderRadius: 2, overflow:'hidden', marginBottom: 10 }}>
        {parts.map((p, i) => <div key={i} style={{ width: `${p.v/total*100}%`, background: p.c }}/>)}
      </div>
      {parts.map((p, i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding: '4px 0', fontFamily: FONT.sans, fontSize: 12 }}>
          <div style={{ display:'flex', alignItems:'center', gap: 7, color: TOKENS.ink2 }}>
            <span style={{ width: 8, height: 8, background: p.c, borderRadius: 2 }}/>
            {p.k}
          </div>
          <div style={{ fontFamily: FONT.mono, color: TOKENS.ink }}>
            {inr(p.v)} <span style={{ color: TOKENS.ink3, fontSize: 10.5 }}>· {(p.v/total*100).toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LedgerList({ rows }) {
  return (
    <div>
      {rows.map((r, i) => {
        const icon = { Invoice:'invoice', 'Stock issue':'box', Timesheet:'clock', Purchase:'truck', Transfer:'arrowRight' }[r.k] || 'menu';
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap: 12, padding:'10px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 4, background: TOKENS.paperAlt, display:'flex', alignItems:'center', justifyContent:'center', color: TOKENS.ink3, flex:'none' }}>
              <Icon name={icon} size={14}/>
            </div>
            <div style={{ flex:1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink, fontWeight: 500 }}>{r.desc}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, marginTop: 1 }}>{r.k} · {r.d}</div>
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12.5, fontWeight: 600, color: r.tone === 'positive' ? TOKENS.positive : r.tone === 'alert' ? TOKENS.alert : TOKENS.ink3 }}>
              {r.amt === 0 ? '—' : (r.amt > 0 ? '+' : '') + inr(r.amt)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BillingProgress({ p }) {
  const billedPct = (p.billed / p.pov) * 100;
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>Contract progress</div>
        <div style={{ fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink, fontWeight: 600 }}>{billedPct.toFixed(1)}% billed</div>
      </div>
      <div style={{ height: 10, background: TOKENS.paperAlt, borderRadius: 2, overflow:'hidden', display:'flex' }}>
        <div style={{ width: `${billedPct}%`, background: TOKENS.positive }}/>
        <div style={{ width: `${100 - billedPct}%`, background: TOKENS.accent, opacity: .3 }}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10, marginTop: 14 }}>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Billed</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 16, fontWeight: 600, color: TOKENS.positive, fontVariantNumeric:'tabular-nums' }}>{inr(p.billed)}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>4 invoices · last 08 Apr</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>To bill</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 16, fontWeight: 600, color: TOKENS.accentInk, fontVariantNumeric:'tabular-nums' }}>{inr(p.outstanding)}</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>next milestone · 28 May</div>
        </div>
      </div>
      <Btn variant="outline" size="sm" icon="plus" style={{ marginTop: 14, width:'100%', justifyContent:'center' }}>Raise progress invoice</Btn>
    </div>
  );
}

function SiteActivity() {
  const rows = [
    { emp:'R. Naidu',  status:'on-site', dur:'4h 18m', dot: TOKENS.positive },
    { emp:'P. Rao',    status:'on-site', dur:'3h 05m', dot: TOKENS.positive },
    { emp:'S. Iyer',   status:'punched out', dur:'9h 42m', dot: TOKENS.ink3 },
    { emp:'M. Varma',  status:'punched out', dur:'8h 10m', dot: TOKENS.ink3 },
  ];
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: '7px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: 7, background: r.dot }}/>
            <div>
              <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, fontWeight: 500 }}>{r.emp}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{r.status}</div>
            </div>
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: TOKENS.ink2, fontWeight: 500 }}>{r.dur}</div>
        </div>
      ))}
    </div>
  );
}

function DetailRows({ p }) {
  const rows = [
    ['Project code', p.code],
    ['Client PO', p.po],
    ['PO date', p.poDate],
    ['Start → End', `${p.start} → ${p.end}`],
    ['Site supervisor', p.supervisor],
    ['Created', '10 Mar 26 · 14:22 IST'],
    ['Last updated', '22 Apr 26 · 09:15 IST'],
  ];
  return (
    <dl style={{ margin: 0 }}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding: '7px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
          <dt style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, letterSpacing:'.05em', textTransform:'uppercase' }}>{k}</dt>
          <dd style={{ margin: 0, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, fontWeight: 500 }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PnlTab({ p }) {
  return <div>
    <PnlStrip p={p.pnl}/>
    <div style={{ marginTop: 16, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16 }}>
      <Card title="Waterfall"><PnlWaterfall p={p.pnl}/></Card>
      <Card title="Cost breakdown"><CostBreakdown p={p.pnl}/></Card>
    </div>
  </div>;
}

function ProgressTab({ p }) {
  return <Card title="Milestones & stages" sub="12 milestones across 5 stages"><StageTimeline stages={p.stages}/></Card>;
}

function LedgerTab({ p }) {
  return <Card title="All ledger activity" sub="48 entries · invoices, stock, labor, purchases, transfers" action={<Btn variant="outline" size="sm" icon="download">CSV</Btn>}><LedgerList rows={p.ledger}/></Card>;
}

function Placeholder({ label }) {
  return <div style={{ background: TOKENS.card, border: `1px dashed ${TOKENS.ruleStrong}`, borderRadius: 4, padding: 48, textAlign:'center', color: TOKENS.ink3, fontFamily: FONT.sans, fontSize: 13 }}>
    <div style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, color: TOKENS.ink3 }}>{label} tab</div>
    <div style={{ marginTop: 6 }}>Additional detail layout available — click Overview to see the hero.</div>
  </div>;
}

Object.assign(window, { ProjectDetailRoute, Card });
