// SAB — Mobile punch app (iOS-style, for site crew)

function MobilePunchApp({ state = 'ready' }) {
  // states: ready, punchedIn, submit
  const [s, setS] = React.useState(state);
  const [elapsed, setElapsed] = React.useState(4 * 3600 + 18 * 60 + 22);

  React.useEffect(() => {
    if (s !== 'punchedIn') return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [s]);

  const fmt = (sec) => {
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), ss = sec%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const isLive = s === 'punchedIn';

  return (
    <div style={{
      width: '100%', height:'100%',
      display:'flex', flexDirection:'column',
      background: isLive ? TOKENS.ink : TOKENS.paper,
      fontFamily: FONT.sans, color: isLive ? '#fff' : TOKENS.ink,
      position:'relative', overflow:'hidden',
    }}>
      {/* Top brand bar */}
      <div style={{ padding: '16px 20px 12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 5, background: TOKENS.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="18" height="18" viewBox="0 0 40 40">
              <path d="M11 25c0-4 3-6 7-6s7-2 7-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="11" cy="15" r="2.2" fill="#fff"/>
              <circle cx="29" cy="25" r="2.2" fill="#fff"/>
            </svg>
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing:'-0.01em' }}>SAB Tracker</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9, opacity: .6, letterSpacing:'.05em' }}>SITE · v3.2</div>
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 36, background: isLive ? 'rgba(255,255,255,.15)' : TOKENS.paperAlt, color: isLive ? '#fff' : TOKENS.ink, display:'flex', alignItems:'center', justifyContent:'center', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600 }}>RN</div>
      </div>

      {/* Greeting */}
      <div style={{ padding: '4px 20px 16px' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing:'.12em', textTransform:'uppercase', opacity: .55, fontWeight: 600 }}>
          {isLive ? 'On site · live' : 'Tuesday · 22 Apr 26'}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing:'-0.025em', marginTop: 4 }}>
          {isLive ? 'Punched in, Rakesh' : 'Good morning, Rakesh'}
        </div>
      </div>

      {/* Main card — live timer or start */}
      <div style={{ padding: '0 16px', flex: 'none' }}>
        {isLive ? (
          <div style={{ padding: 20, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap: 6, fontFamily: FONT.mono, fontSize: 10, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, background: TOKENS.accent, animation:'sabPulse 1.4s infinite' }}/> Elapsed
              </span>
              <span style={{ fontFamily: FONT.mono, fontSize: 11, opacity: .6 }}>in @ 09:10</span>
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 56, fontWeight: 500, letterSpacing:'-0.03em', fontVariantNumeric:'tabular-nums', lineHeight: 1 }}>
              {fmt(elapsed)}
            </div>
            <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,.08)' }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing:'.1em', textTransform:'uppercase', opacity: .55, fontWeight: 600, marginBottom: 6 }}>Project</div>
              <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                <Code style={{ color: TOKENS.accent, background:'rgba(217,119,87,.2)', padding:'2px 6px', borderRadius: 3 }}>SAB-26-0041</Code>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, opacity: .5 }}>Apollo · Block A&B</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, marginTop: 6, letterSpacing:'-0.01em' }}>Fire hydrant system — Block A &amp; B</div>
              <div style={{ marginTop: 10, display:'flex', gap: 14, fontFamily: FONT.mono, fontSize: 10.5, opacity: .65 }}>
                <span style={{ display:'inline-flex', alignItems:'center', gap: 4 }}><Icon name="mapPin" size={11} color="#fff"/> 12.9716, 77.5946</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap: 4 }}><Icon name="camera" size={11} color="#fff"/> 3 photos</span>
              </div>
            </div>
            <button onClick={() => setS('submit')} style={{
              width: '100%', marginTop: 18, padding: '14px', borderRadius: 10,
              border: 'none', background: TOKENS.accent, color: '#fff',
              fontFamily: FONT.sans, fontSize: 15, fontWeight: 600, letterSpacing:'-0.01em',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
            }}>
              <Icon name="x" size={16} color="#fff"/> Punch out
            </button>
            <button style={{
              width:'100%', marginTop: 8, padding: '11px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,.18)', background:'transparent', color:'#fff',
              fontFamily: FONT.sans, fontSize: 13, fontWeight: 500, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
            }}>
              <Icon name="camera" size={14} color="#fff"/> Add progress photo
            </button>
          </div>
        ) : (
          <div style={{ padding: 20, borderRadius: 14, background: TOKENS.card, border: `1px solid ${TOKENS.rule}` }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600, marginBottom: 10 }}>Today's assignment</div>
            <Code style={{ fontSize: 12, padding:'3px 7px', background: TOKENS.accentWash, borderRadius: 3 }}>SAB-26-0041</Code>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 8, letterSpacing:'-0.015em' }}>Fire hydrant system — Block A &amp; B</div>
            <div style={{ fontSize: 12.5, color: TOKENS.ink3, marginTop: 4 }}>Apollo Hospitals · Marathahalli, BLR</div>
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 6, background: TOKENS.paperAlt, display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink2 }}>
              <Icon name="mapPin" size={12} color={TOKENS.accent}/>
              <span>You're <span style={{ color: TOKENS.ink, fontWeight: 600 }}>on site</span> · 18m from geofence centre</span>
            </div>
            <button onClick={() => setS('punchedIn')} style={{
              width: '100%', marginTop: 16, padding: '15px', borderRadius: 10, border: 'none',
              background: TOKENS.accent, color: '#fff', fontFamily: FONT.sans, fontSize: 15, fontWeight: 600,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap: 8, letterSpacing:'-0.01em',
            }}>
              <Icon name="check" size={17} color="#fff"/> Punch in
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: '18px 20px 10px' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing:'.12em', textTransform:'uppercase', opacity: .55, fontWeight: 600, marginBottom: 10 }}>Quick actions</div>
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[
            { i:'camera', l:'Site photo' },
            { i:'box',    l:'Material' },
            { i:'wrench', l:'Issue' },
            { i:'report', l:'Note' },
          ].map((q,i) => (
            <button key={i} style={{
              padding:'12px 6px', borderRadius: 10,
              background: isLive ? 'rgba(255,255,255,.08)' : TOKENS.card,
              border: `1px solid ${isLive ? 'rgba(255,255,255,.12)' : TOKENS.rule}`,
              color: isLive ? '#fff' : TOKENS.ink,
              display:'flex', flexDirection:'column', alignItems:'center', gap: 6,
              fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, cursor:'pointer',
            }}>
              <Icon name={q.i} size={18} color={isLive ? '#fff' : TOKENS.ink2}/>{q.l}
            </button>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div style={{ flex:1, padding: '8px 20px 20px', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 9.5, letterSpacing:'.12em', textTransform:'uppercase', opacity: .55, fontWeight: 600 }}>This week</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 10, opacity: .55 }}>42h 18m</div>
        </div>
        {[
          { d:'Mon 21', p:'SAB-26-0041', h:'9h 42m', status:'APPROVED' },
          { d:'Sat 19', p:'SAB-26-0038', h:'8h 15m', status:'APPROVED' },
          { d:'Fri 18', p:'SAB-26-0041', h:'9h 05m', status:'SUBMITTED' },
          { d:'Thu 17', p:'SAB-26-0041', h:'8h 58m', status:'APPROVED' },
          { d:'Wed 16', p:'SAB-25-0198', h:'6h 18m', status:'APPROVED' },
        ].map((e, i) => (
          <div key={i} style={{
            padding:'10px 0', borderTop: `1px solid ${isLive ? 'rgba(255,255,255,.08)' : TOKENS.rule}`,
            display:'flex', alignItems:'center', gap: 12,
          }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 10.5, opacity: .6, width: 44 }}>{e.d}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Code style={{ color: isLive ? TOKENS.accent : TOKENS.accentInk }}>{e.p}</Code>
              <div style={{ fontFamily: FONT.mono, fontSize: 10, opacity: .55, marginTop: 2 }}>{e.status}</div>
            </div>
            <div style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 600 }}>{e.h}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{
        padding: '8px 16px 28px',
        background: isLive ? 'rgba(255,255,255,.04)' : TOKENS.card,
        borderTop: `1px solid ${isLive ? 'rgba(255,255,255,.08)' : TOKENS.rule}`,
        display:'flex', justifyContent:'space-around',
      }}>
        {[
          { i:'home',   l:'Today',  active:true },
          { i:'folder', l:'Jobs' },
          { i:'clock',  l:'Time' },
          { i:'user',   l:'Me' },
        ].map((t,i) => (
          <button key={i} style={{
            background:'transparent', border:'none', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap: 3,
            color: t.active ? (isLive ? TOKENS.accent : TOKENS.accentInk) : (isLive ? 'rgba(255,255,255,.5)' : TOKENS.ink3),
            fontFamily: FONT.sans, fontSize: 10, fontWeight: t.active ? 600 : 500,
            padding: '6px 10px',
          }}>
            <Icon name={t.i} size={19} color={t.active ? (isLive ? TOKENS.accent : TOKENS.accentInk) : (isLive ? 'rgba(255,255,255,.5)' : TOKENS.ink3)}/>
            {t.l}
          </button>
        ))}
      </div>

      <style>{`@keyframes sabPulse { 0%,100% { opacity: 1 } 50% { opacity: .3 } }`}</style>
    </div>
  );
}

Object.assign(window, { MobilePunchApp });
