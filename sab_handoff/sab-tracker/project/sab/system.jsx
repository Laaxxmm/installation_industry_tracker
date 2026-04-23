// SAB India Tracker — design system primitives
// Industrial Operations aesthetic: warm paper, signal orange, monospace codes.

const TOKENS = {
  paper: 'oklch(0.985 0.003 80)',
  paperAlt: 'oklch(0.975 0.004 80)',
  ink: 'oklch(0.22 0.01 60)',
  ink2: 'oklch(0.38 0.01 60)',
  ink3: 'oklch(0.55 0.01 60)',
  ink4: 'oklch(0.72 0.008 60)',
  rule: 'oklch(0.92 0.005 80)',
  ruleStrong: 'oklch(0.86 0.006 80)',
  card: '#ffffff',
  accent: 'oklch(0.68 0.16 45)',
  accentInk: 'oklch(0.42 0.14 45)',
  accentWash: 'oklch(0.965 0.022 55)',
  positive: 'oklch(0.58 0.11 155)',
  positiveWash: 'oklch(0.96 0.03 155)',
  alert: 'oklch(0.58 0.18 25)',
  alertWash: 'oklch(0.965 0.04 25)',
  amber: 'oklch(0.74 0.14 78)',
  amberWash: 'oklch(0.97 0.04 85)',
  blue: 'oklch(0.56 0.12 240)',
  blueWash: 'oklch(0.965 0.02 240)',
};

const FONT = {
  sans: '"Inter Tight", "Inter", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
};

// ─── Rupee formatting, lakh/crore native ────────────────────────
function inr(n, { compact = true, short = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(+n)) return '—';
  const abs = Math.abs(+n);
  if (compact) {
    if (abs >= 1e7) return (short ? '' : '₹') + (n/1e7).toFixed(abs >= 1e8 ? 1 : 2) + ' Cr';
    if (abs >= 1e5) return (short ? '' : '₹') + (n/1e5).toFixed(abs >= 1e6 ? 1 : 2) + ' L';
    if (abs >= 1e3) return (short ? '' : '₹') + (n/1e3).toFixed(1) + 'k';
    return (short ? '' : '₹') + Math.round(n);
  }
  // Indian grouping
  const s = Math.round(n).toString();
  const neg = s.startsWith('-') ? '-' : '';
  const d = s.replace('-','');
  let out;
  if (d.length <= 3) out = d;
  else {
    const last3 = d.slice(-3);
    const rest = d.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return '₹' + neg + out;
}

// ─── Icon system — thin stroke, 16px ────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5 }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>,
    invoice: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4"/><path d="M9 11h6M9 14h6M9 17h4"/></>,
    quote: <><path d="M4 6h16M4 11h16M4 16h10"/></>,
    box: <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5"/><path d="M12 12v9"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    report: <><path d="M4 19V5M4 19h16"/><path d="M8 15v-4M12 15V8M16 15v-6"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 6 3 7 3 7H3s3-1 3-7"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevRight: <><path d="m9 6 6 6-6 6"/></>,
    chevDown: <><path d="m6 9 6 6 6-6"/></>,
    arrowUp: <><path d="M7 17 17 7M8 7h9v9"/></>,
    arrowRight: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    filter: <><path d="M4 5h16l-6 8v6l-4 2v-8z"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    upload: <><path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/></>,
    camera: <><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="4"/></>,
    mapPin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
    check: <><path d="m5 12 5 5 9-11"/></>,
    x: <><path d="m6 6 12 12M18 6 6 18"/></>,
    flame: <><path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-9Z"/></>,
    wrench: <><path d="M14 7a5 5 0 1 1 3 6l-7 7-3-3 7-7a5 5 0 0 1 0-3Z"/></>,
    truck: <><path d="M2 7h11v10H2z"/><path d="M13 10h5l3 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></>,
    pie: <><path d="M12 3v9h9a9 9 0 1 1-9-9Z"/><path d="M14 3a7 7 0 0 1 7 7h-7z"/></>,
    trending: <><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8 11 8-4M8 13l8 4"/></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    refresh: <><path d="M4 12a8 8 0 0 1 14-5l2 2M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-14 5l-2-2M4 20v-4h4"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/></>,
    kanban: <><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r=".8"/><circle cx="4" cy="12" r=".8"/><circle cx="4" cy="18" r=".8"/></>,
    lightning: <><path d="M13 3 5 14h6l-2 7 8-11h-6z"/></>,
    shield: <><path d="M12 3 4 6v6c0 4.5 3.5 7.5 8 9 4.5-1.5 8-4.5 8-9V6z"/></>,
    medical: <><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

// ─── Wordmark ──────────────────────────────────────────────────
function Wordmark({ size = 18, tone = 'ink', showTag = true }) {
  const color = tone === 'ink' ? TOKENS.ink : '#fff';
  const muted = tone === 'ink' ? TOKENS.ink3 : 'rgba(255,255,255,.6)';
  return (
    <div style={{ display:'flex', alignItems:'center', gap: size * 0.55 }}>
      <svg width={size*1.5} height={size*1.5} viewBox="0 0 40 40" style={{ flex:'none' }}>
        <rect x="2" y="2" width="36" height="36" rx="6" fill={TOKENS.accent}/>
        <path d="M11 25c0-4 3-6 7-6s7-2 7-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
        <circle cx="11" cy="15" r="2.2" fill="#fff"/>
        <circle cx="29" cy="25" r="2.2" fill="#fff"/>
      </svg>
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, letterSpacing: '-0.01em', fontSize: size, color }}>
          SAB India <span style={{ fontWeight: 500, color: muted }}>Tracker</span>
        </div>
        {showTag && <div style={{ fontFamily: FONT.mono, fontSize: Math.max(9, size*0.52), color: muted, letterSpacing: '.04em', marginTop: 2 }}>
          Powered by <span style={{ color: TOKENS.accent, fontWeight: 600 }}>indefine</span>
        </div>}
      </div>
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────────
function Pill({ tone = 'ink', size = 'md', children, dot = false, style = {} }) {
  const map = {
    positive: { bg: TOKENS.positiveWash, fg: TOKENS.positive, dot: TOKENS.positive },
    alert:    { bg: TOKENS.alertWash,    fg: TOKENS.alert,    dot: TOKENS.alert },
    amber:    { bg: TOKENS.amberWash,    fg: 'oklch(0.5 0.14 70)', dot: TOKENS.amber },
    blue:     { bg: TOKENS.blueWash,     fg: TOKENS.blue,     dot: TOKENS.blue },
    accent:   { bg: TOKENS.accentWash,   fg: TOKENS.accentInk, dot: TOKENS.accent },
    ink:      { bg: TOKENS.paperAlt,     fg: TOKENS.ink2,     dot: TOKENS.ink3 },
  };
  const t = map[tone] || map.ink;
  const pad = size === 'sm' ? '1px 6px' : '2px 8px';
  const fs = size === 'sm' ? 10 : 11;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding: pad, borderRadius: 3,
      background: t.bg, color: t.fg,
      fontFamily: FONT.mono, fontSize: fs, fontWeight: 500,
      letterSpacing: '.03em', textTransform:'uppercase',
      border: `1px solid ${t.fg}22`,
      ...style
    }}>
      {dot && <span style={{ width:5, height:5, borderRadius:5, background: t.dot }}/>}
      {children}
    </span>
  );
}

// ─── Code chip ─────────────────────────────────────────────────
function Code({ children, style={} }) {
  return <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 500, color: TOKENS.accentInk, letterSpacing:'.01em', ...style }}>{children}</span>;
}

// ─── KPI card ──────────────────────────────────────────────────
function KPI({ label, value, sub, trend, accent = false, spark, onClick, active=false }) {
  return (
    <div onClick={onClick} style={{
      background: accent ? TOKENS.accentWash : TOKENS.card,
      border: `1px solid ${active ? TOKENS.accent : TOKENS.rule}`,
      borderRadius: 4,
      padding: '14px 16px',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
      transition: 'border-color .15s',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 9.5, fontWeight: 600, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase' }}>{label}</div>
        {trend !== undefined && (
          <div style={{ fontFamily: FONT.mono, fontSize: 10, color: trend >= 0 ? TOKENS.positive : TOKENS.alert, fontWeight: 600 }}>
            {trend >= 0 ? '+' : ''}{trend}%
          </div>
        )}
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.02em', marginTop: 6, fontVariantNumeric:'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 3 }}>{sub}</div>}
      {spark && <div style={{ marginTop: 10 }}>{spark}</div>}
    </div>
  );
}

// ─── Sparkline / bars ──────────────────────────────────────────
function Sparkbars({ values, height = 28, color = TOKENS.accent, gap = 2 }) {
  const max = Math.max(1, ...values);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap, height }}>
      {values.map((v,i) => (
        <div key={i} style={{
          flex:1, height: `${Math.max(2, (v/max)*100)}%`,
          background: color, opacity: 0.35 + (v/max)*0.65,
          borderRadius: '1px 1px 0 0'
        }}/>
      ))}
    </div>
  );
}

function Sparkline({ values, width=120, height=28, color = TOKENS.accent, fill = true }) {
  if (!values || !values.length) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v,i) => {
    const x = (i/(values.length-1)) * width;
    const y = height - ((v - min)/range) * height;
    return [x, y];
  });
  const path = pts.map((p,i) => (i===0?'M':'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display:'block' }}>
      {fill && <path d={area} fill={color} opacity=".12"/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

// ─── Button ────────────────────────────────────────────────────
function Btn({ variant='default', size='md', children, onClick, icon, style={}, disabled=false }) {
  const base = {
    display:'inline-flex', alignItems:'center', gap: 6,
    fontFamily: FONT.sans, fontWeight: 500,
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 10px' : '7px 14px',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all .12s',
    border: '1px solid transparent',
    letterSpacing:'-0.005em',
    opacity: disabled ? 0.5 : 1,
    ...style
  };
  const variants = {
    default:  { background: TOKENS.ink, color: '#fff', borderColor: TOKENS.ink },
    primary:  { background: TOKENS.accent, color: '#fff', borderColor: TOKENS.accent },
    outline:  { background: TOKENS.card, color: TOKENS.ink, borderColor: TOKENS.ruleStrong },
    ghost:    { background: 'transparent', color: TOKENS.ink2, borderColor: 'transparent' },
    subtle:   { background: TOKENS.paperAlt, color: TOKENS.ink, borderColor: TOKENS.rule },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 14}/>}
      {children}
    </button>
  );
}

// ─── Page header ───────────────────────────────────────────────
function PageHeader({ eyebrow, title, description, actions, tabs }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 24 }}>
        <div>
          {eyebrow && <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 6 }}>{eyebrow}</div>}
          <h1 style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0, lineHeight: 1.15 }}>{title}</h1>
          {description && <div style={{ fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3, marginTop: 6, maxWidth: 640 }}>{description}</div>}
        </div>
        {actions && <div style={{ display:'flex', alignItems:'center', gap: 8, flex:'none' }}>{actions}</div>}
      </div>
      {tabs && <div style={{ marginTop: 20, borderBottom: `1px solid ${TOKENS.rule}` }}>{tabs}</div>}
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────
function Tabs({ items, active, onChange }) {
  return (
    <div style={{ display:'flex', gap: 2 }}>
      {items.map(it => {
        const isActive = it.key === active;
        return (
          <button key={it.key} onClick={() => onChange && onChange(it.key)} style={{
            padding: '10px 14px',
            fontFamily: FONT.sans, fontSize: 13, fontWeight: isActive ? 600 : 500,
            color: isActive ? TOKENS.ink : TOKENS.ink3,
            background: 'transparent', border: 'none',
            borderBottom: `2px solid ${isActive ? TOKENS.accent : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer',
            display:'inline-flex', alignItems:'center', gap: 7,
          }}>
            {it.label}
            {it.count !== undefined && (
              <span style={{ fontFamily: FONT.mono, fontSize: 10, padding:'1px 6px', borderRadius: 3, background: isActive ? TOKENS.accentWash : TOKENS.paperAlt, color: isActive ? TOKENS.accentInk : TOKENS.ink3 }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline notice / toast ─────────────────────────────────────
function Notice({ tone='positive', children, onClose }) {
  const c = TOKENS[tone] || TOKENS.positive;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 10,
      padding:'9px 12px', marginBottom: 14,
      background: `color-mix(in oklch, ${c} 8%, ${TOKENS.card})`,
      border: `1px solid color-mix(in oklch, ${c} 35%, ${TOKENS.rule})`,
      borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, flex:'none' }}/>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" style={{
          background:'transparent', border:'none', cursor:'pointer',
          color: TOKENS.ink3, fontSize: 16, lineHeight: 1, padding: 0,
        }}>×</button>
      )}
    </div>
  );
}

// ─── Modal shell ───────────────────────────────────────────────
function Modal({ open, onClose, title, eyebrow, actions, children, width = 720 }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset: 0, background:'rgba(20,18,14,.45)', zIndex: 100,
      display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'48px 24px', overflowY:'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: TOKENS.card, borderRadius: 6, width:'100%', maxWidth: width,
        boxShadow:'0 24px 60px rgba(0,0,0,.25)', overflow:'hidden',
      }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${TOKENS.rule}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 16 }}>
          <div>
            {eyebrow && <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600, marginBottom: 4 }}>{eyebrow}</div>}
            <div style={{ fontFamily: FONT.sans, fontSize: 18, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.02em' }}>{title}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
            {actions}
            <button onClick={onClose} style={{ background:'transparent', border:`1px solid ${TOKENS.rule}`, borderRadius: 4, padding: 6, cursor:'pointer', color: TOKENS.ink3 }}><Icon name="x" size={14}/></button>
          </div>
        </div>
        <div style={{ padding:'20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}

Object.assign(window, { TOKENS, FONT, Icon, Wordmark, Pill, Code, KPI, Sparkbars, Sparkline, Btn, PageHeader, Tabs, inr, Notice, Modal });
