// SAB — Invoice PDF (A4, print-ready) + public share page

function InvoicePDF() {
  const items = [
    { d:'Fire hydrant point installation — Block A (Level 1-4)',   qty: 12, unit:'nos', rate: 48_200,   amt: 5_78_400 },
    { d:'Fire hydrant point installation — Block B (Level 1-4)',   qty: 10, unit:'nos', rate: 48_200,   amt: 4_82_000 },
    { d:'MS galvanized pipe 150mm — welded install with supports', qty: 240,unit:'mtr', rate: 3_840,    amt: 9_21_600 },
    { d:'Pump house fitouts — 2 jockey + 1 main + panel',          qty: 1,  unit:'set', rate: 18_40_000,amt: 18_40_000 },
    { d:'Hydrostatic testing & commissioning — Block A',           qty: 1,  unit:'lot', rate: 3_80_000, amt: 3_80_000 },
    { d:'Site supervision & labor (Mar-Apr 26)',                   qty: 1,  unit:'lot', rate: 6_40_000, amt: 6_40_000 },
  ];
  const sub = items.reduce((a,r)=>a+r.amt,0);
  const cgst = Math.round(sub * 0.09);
  const sgst = Math.round(sub * 0.09);
  const total = sub + cgst + sgst;

  return (
    <div style={{
      width: 794, minHeight: 1123,
      background: '#fff', color: TOKENS.ink,
      fontFamily: FONT.sans, fontSize: 11,
      padding: 48, boxSizing:'border-box',
      position:'relative', overflow:'hidden',
    }}>
      {/* top band */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height: 6, background: TOKENS.accent }}/>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 28 }}>
        <div>
          <Wordmark size={18}/>
          <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, marginTop: 10, lineHeight: 1.6 }}>
            SAB India Services Pvt. Ltd.<br/>
            No. 48, 3rd Main, HAL 2nd Stage, Indiranagar<br/>
            Bengaluru — 560038, Karnataka<br/>
            GSTIN 29AABCS1234M1Z5 · CIN U74999KA2008PTC047281<br/>
            accounts@sabindia.in · +91 80 4567 8900
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.15em', textTransform:'uppercase', fontWeight: 600 }}>Tax invoice</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 600, letterSpacing:'-0.02em', color: TOKENS.ink, marginTop: 4 }}>SAB/26-27/0042</div>
          <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, lineHeight: 1.7 }}>
            <div><span style={{ color: TOKENS.ink4 }}>Issued</span> &nbsp; 18 Apr 2026</div>
            <div><span style={{ color: TOKENS.ink4 }}>Due</span> &nbsp;&nbsp;&nbsp;&nbsp; 18 May 2026</div>
            <div><span style={{ color: TOKENS.ink4 }}>Terms</span> &nbsp; Net 30</div>
          </div>
        </div>
      </div>

      {/* Bill-to and project */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 0, border: `1px solid ${TOKENS.rule}`, borderRadius: 3, marginBottom: 24 }}>
        {[
          { l:'Bill to', c: <>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.ink }}>Apollo Hospitals Enterprise Ltd.</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, marginTop: 4, lineHeight: 1.55 }}>
              154/11, Bannerghatta Main Road<br/>Bengaluru — 560076<br/>GSTIN 29AAACA1234F1Z6
            </div>
          </>},
          { l:'Project', c: <>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: TOKENS.accentInk, fontWeight: 600 }}>SAB-26-0041</div>
            <div style={{ fontSize: 11.5, color: TOKENS.ink, marginTop: 4, fontWeight: 500 }}>Fire hydrant system — Block A &amp; B</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, marginTop: 4 }}>PO: APL/PO/26/0847 dated 12 Mar 26</div>
          </>},
          { l:'Invoice type', c: <>
            <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.ink }}>Progress invoice</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, marginTop: 4 }}>Milestone 3 of 5 · 65% of contract<br/>Cumulative billed: ₹1,60,00,000</div>
          </>},
        ].map((b, i) => (
          <div key={i} style={{ padding: '12px 14px', borderLeft: i > 0 ? `1px solid ${TOKENS.rule}` : 'none' }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.14em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>{b.l}</div>
            {b.c}
          </div>
        ))}
      </div>

      {/* Line items */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom: 0 }}>
        <thead>
          <tr style={{ background: TOKENS.paperAlt }}>
            <th style={{ padding: '10px 12px', textAlign:'left', fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600, borderTop:`1px solid ${TOKENS.rule}`, borderBottom:`1px solid ${TOKENS.rule}`, width: 30 }}>#</th>
            <th style={{ padding: '10px 12px', textAlign:'left', fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600, borderTop:`1px solid ${TOKENS.rule}`, borderBottom:`1px solid ${TOKENS.rule}` }}>Description</th>
            {['Qty','Unit','Rate','Amount'].map((h, i) => (
              <th key={i} style={{ padding: '10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600, borderTop:`1px solid ${TOKENS.rule}`, borderBottom:`1px solid ${TOKENS.rule}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${TOKENS.rule}` }}>
              <td style={{ padding: '10px 12px', fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{String(i+1).padStart(2,'0')}</td>
              <td style={{ padding: '10px 12px', fontSize: 11, color: TOKENS.ink }}>{r.d}</td>
              <td style={{ padding: '10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 10.5, fontVariantNumeric:'tabular-nums' }}>{r.qty}</td>
              <td style={{ padding: '10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{r.unit}</td>
              <td style={{ padding: '10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 10.5, fontVariantNumeric:'tabular-nums' }}>{inr(r.rate, { compact:false })}</td>
              <td style={{ padding: '10px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, fontVariantNumeric:'tabular-nums' }}>{inr(r.amt, { compact:false })}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display:'grid', gridTemplateColumns: '1fr 320px', marginTop: 24, gap: 24 }}>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.14em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Bank details</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink2, lineHeight: 1.7 }}>
            Acct: SAB India Services Pvt. Ltd.<br/>
            A/c No: 007912345678 (current)<br/>
            IFSC: HDFC0000079 · HDFC Bank, Indiranagar<br/>
            UPI: sabindia@hdfcbank
          </div>
          <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: 8.5, color: TOKENS.ink3, letterSpacing:'.14em', textTransform:'uppercase', fontWeight: 600, marginBottom: 6 }}>Notes</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 10.5, color: TOKENS.ink3, lineHeight: 1.55, maxWidth: 360 }}>
            Payment due within 30 days of invoice date. Please quote the invoice number on all remittances. Interest @ 1.5% per month will be charged on overdue amounts.
          </div>
        </div>
        <div>
          {[
            ['Subtotal', sub],
            ['CGST @ 9%', cgst],
            ['SGST @ 9%', sgst],
          ].map((r, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding: '6px 0', borderBottom: i < 2 ? `1px dashed ${TOKENS.rule}` : 'none', fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink2 }}>
              <span>{r[0]}</span>
              <span style={{ fontFamily: FONT.mono, fontVariantNumeric:'tabular-nums' }}>{inr(r[1], { compact:false })}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding: '14px 14px', marginTop: 10, background: TOKENS.ink, color:'#fff', borderRadius: 3 }}>
            <div>
              <div style={{ fontFamily: FONT.mono, fontSize: 8.5, letterSpacing:'.14em', textTransform:'uppercase', opacity: .7, fontWeight: 600 }}>Total due</div>
              <div style={{ fontFamily: FONT.mono, fontSize: 9, opacity: .55, marginTop: 2 }}>INR — incl. GST</div>
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 600, letterSpacing:'-0.02em', fontVariantNumeric:'tabular-nums' }}>{inr(total, { compact:false })}</div>
          </div>
        </div>
      </div>

      {/* Sign + footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop: 36, paddingTop: 20, borderTop: `1px solid ${TOKENS.rule}` }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 9, color: TOKENS.ink3, letterSpacing:'.1em' }}>
          Generated by SAB Tracker · Powered by <span style={{ color: TOKENS.accent, fontWeight: 600 }}>indefine</span> · Page 1 of 1
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontFamily: 'Brush Script MT, cursive', fontSize: 22, color: TOKENS.ink2, letterSpacing:'-0.01em' }}>A. Kumar</div>
          <div style={{ borderTop:`1px solid ${TOKENS.ink3}`, marginTop: 4, paddingTop: 4, fontFamily: FONT.mono, fontSize: 9, color: TOKENS.ink3 }}>Authorized signatory</div>
        </div>
      </div>
    </div>
  );
}

function ClientShareView() {
  const p = SEED.projectDetail;
  return (
    <div style={{ width:'100%', height:'100%', background: TOKENS.paper, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Minimal top bar */}
      <div style={{ padding: '14px 24px', background: TOKENS.card, borderBottom:`1px solid ${TOKENS.rule}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <Wordmark size={13}/>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase' }}>Shared with</span>
          <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink, fontWeight: 500 }}>procurement@apollohospitals.com</span>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'24px 32px' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>Project summary · view-only</div>
        <div style={{ display:'flex', alignItems:'center', gap: 10, marginTop: 8, marginBottom: 6 }}>
          <Code style={{ fontSize: 13 }}>{p.code}</Code>
          <Pill tone="blue" dot>{p.status}</Pill>
        </div>
        <h1 style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.02em', margin: 0 }}>{p.name}</h1>
        <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink3, marginTop: 4 }}>For {p.client} · {p.loc}</div>

        <div style={{ marginTop: 20, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden' }}>
          <StatBlock label="Contract" value={inr(p.pov)}/>
          <StatBlock label="Billed" value={inr(p.billed)} sub={`${Math.round(p.billed/p.pov*100)}%`}/>
          <StatBlock label="Progress" value={`${p.progress}%`}/>
          <StatBlock label="Expected handover" value={p.end}/>
        </div>

        <div style={{ marginTop: 20, background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 16 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, marginBottom: 12, color: TOKENS.ink }}>Stage progress</div>
          <StageTimeline stages={p.stages}/>
        </div>

        <div style={{ marginTop: 16, display:'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 14 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>Invoices issued</div>
            {[
              { n:'SAB/26-27/0042', d:'18 Apr 26', a: 48_20_000, s:'ISSUED' },
              { n:'SAB/26-27/0038', d:'02 Apr 26', a: 1_12_00_000, s:'PAID' },
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <div>
                  <Code>{r.n}</Code>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, marginTop: 2 }}>{r.d}</div>
                </div>
                <div style={{ display:'flex', gap: 10, alignItems:'center' }}>
                  <Pill tone={r.s === 'PAID' ? 'positive' : 'blue'} size="sm" dot>{r.s}</Pill>
                  <span style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 600 }}>{inr(r.a)}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 14 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>Site updates</div>
            <div style={{ fontSize: 12, color: TOKENS.ink2, lineHeight: 1.5 }}>
              <div style={{ padding:'6px 0' }}><span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>20 Apr · </span>12 of 18 hydrant points pressure-tested. All passing at 12 bar.</div>
              <div style={{ padding:'6px 0', borderTop:`1px dashed ${TOKENS.rule}` }}><span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>15 Apr · </span>Block B pipe routing complete. Painting scheduled for 24 Apr.</div>
              <div style={{ padding:'6px 0', borderTop:`1px dashed ${TOKENS.rule}` }}><span style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>08 Apr · </span>Pump room fitout 60%. Jockey pump & panel positioned.</div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, textAlign:'center' }}>
          Shared by SAB India · This view updates in real time · Link expires 22 May 2026
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { InvoicePDF, ClientShareView });
