// SAB Tracker — Desktop shell (sidebar + topbar + content)

const NAV = [
  { k:'home',       label:'Home',          icon:'home' },
  { k:'projects',   label:'Projects',      icon:'folder',    count: 165 },
  { sep: 'Sales' },
  { k:'clients',    label:'Clients',       icon:'building' },
  { k:'quotes',     label:'Quotes',        icon:'quote',     count: 38 },
  { k:'invoices',   label:'Tax invoices',  icon:'invoice',   count: 124 },
  { sep: 'Operations' },
  { k:'timesheets', label:'Timesheets',    icon:'clock',     count: 8, badge:true },
  { k:'inventory',  label:'Inventory',     icon:'box' },
  { k:'overhead',   label:'Overhead',      icon:'briefcase' },
  { k:'reports',    label:'Reports',       icon:'report' },
  { sep: 'Procurement' },
  { k:'vendors',          label:'Vendors',          icon:'building' },
  { k:'purchase-orders',  label:'Purchase orders',  icon:'invoice', count: 10 },
  { k:'grns',             label:'Goods receipts',   icon:'truck' },
  { k:'vendor-bills',     label:'Vendor bills',     icon:'invoice', count: 7, badge:true },
  { sep: 'Admin' },
  { k:'users',      label:'Users & roles', icon:'user' },
  { k:'rates',      label:'Wage rates',    icon:'pie' },
];

function Sidebar({ current, onNav, collapsed, onToggle, dark }) {
  const bg = dark ? 'oklch(0.23 0.01 60)' : TOKENS.card;
  const border = dark ? 'oklch(0.3 0.01 60)' : TOKENS.rule;
  const inkColor = dark ? '#e6e2d8' : TOKENS.ink;
  const muted = dark ? 'rgba(230,226,216,.55)' : TOKENS.ink3;

  return (
    <aside style={{
      width: collapsed ? 60 : 236,
      flex:'none',
      background: bg,
      borderRight: `1px solid ${border}`,
      display:'flex', flexDirection:'column',
      transition:'width .15s',
      height: '100%',
    }}>
      <div style={{ padding: collapsed ? '16px 12px' : '16px 18px', borderBottom: `1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {collapsed ? (
          <div style={{ width:32, height:32, borderRadius:6, background: TOKENS.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 40 40">
              <path d="M11 25c0-4 3-6 7-6s7-2 7-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="11" cy="15" r="2.2" fill="#fff"/>
              <circle cx="29" cy="25" r="2.2" fill="#fff"/>
            </svg>
          </div>
        ) : <Wordmark size={14} tone={dark ? 'dark' : 'ink'}/>}
        <button onClick={onToggle} style={{ background:'transparent', border:'none', cursor:'pointer', color: muted, padding: 4, display: collapsed ? 'none' : 'flex' }}>
          <Icon name="menu" size={14}/>
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ position:'relative' }}>
            <div style={{ position:'absolute', left: 10, top: 9, color: muted }}><Icon name="search" size={13}/></div>
            <input placeholder="Search or jump to…" style={{
              width:'100%', padding:'7px 10px 7px 30px', borderRadius: 4,
              border: `1px solid ${border}`, background: dark ? 'oklch(0.2 0.01 60)' : TOKENS.paperAlt,
              fontFamily: FONT.sans, fontSize: 12, color: inkColor, outline:'none',
            }}/>
            <div style={{ position:'absolute', right: 8, top: 7, fontFamily: FONT.mono, fontSize: 10, color: muted, padding:'1px 5px', border:`1px solid ${border}`, borderRadius: 3 }}>⌘K</div>
          </div>
        </div>
      )}

      <nav style={{ flex:1, overflowY:'auto', padding: '4px 8px 12px' }}>
        {NAV.map((n, i) => {
          if (n.sep) return !collapsed ? (
            <div key={'s'+i} style={{ fontFamily: FONT.mono, fontSize: 9.5, color: muted, letterSpacing:'.12em', textTransform:'uppercase', fontWeight: 600, padding: '14px 10px 6px' }}>{n.sep}</div>
          ) : <div key={'s'+i} style={{ height: 12 }}/>;
          const active = current === n.k;
          const activeBg = dark ? 'oklch(0.3 0.02 45)' : TOKENS.accentWash;
          const activeFg = dark ? '#fff' : TOKENS.accentInk;
          return (
            <button key={n.k} onClick={() => onNav(n.k)} title={collapsed ? n.label : ''} style={{
              display:'flex', alignItems:'center', gap: 10,
              width:'100%', padding: collapsed ? '8px 9px' : '7px 10px',
              fontFamily: FONT.sans, fontSize: 13, fontWeight: active ? 600 : 500,
              color: active ? activeFg : (dark ? '#d7d1c3' : TOKENS.ink2),
              background: active ? activeBg : 'transparent',
              border: 'none', borderRadius: 4, cursor:'pointer',
              textAlign:'left', marginBottom: 1,
              borderLeft: active ? `2px solid ${TOKENS.accent}` : '2px solid transparent',
            }}>
              <Icon name={n.icon} size={15} color={active ? activeFg : (dark ? muted : TOKENS.ink3)}/>
              {!collapsed && <>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.count !== undefined && (
                  <span style={{
                    fontFamily: FONT.mono, fontSize: 10, padding:'1px 5px', borderRadius: 3,
                    background: n.badge ? TOKENS.accent : (dark ? 'oklch(0.3 0.01 60)' : TOKENS.paperAlt),
                    color: n.badge ? '#fff' : (dark ? '#d7d1c3' : TOKENS.ink3),
                  }}>{n.count}</span>
                )}
              </>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: 12, borderTop: `1px solid ${border}`, display:'flex', alignItems:'center', gap: 10 }}>
          <div style={{ width:30, height:30, borderRadius: 4, background: TOKENS.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600 }}>AK</div>
          <div style={{ flex:1, lineHeight:1.2, minWidth:0 }}>
            <div style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: inkColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Arvind Kumar</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 9.5, color: muted, letterSpacing:'.08em', textTransform:'uppercase' }}>ADMIN · FY 25-26</div>
          </div>
        </div>
      )}
    </aside>
  );
}

function TopBar({ title, dark }) {
  const bg = dark ? 'oklch(0.23 0.01 60)' : TOKENS.card;
  const border = dark ? 'oklch(0.3 0.01 60)' : TOKENS.rule;
  const muted = dark ? 'rgba(230,226,216,.55)' : TOKENS.ink3;
  const inkColor = dark ? '#e6e2d8' : TOKENS.ink;
  return (
    <div style={{
      height: 48, flex:'none',
      borderBottom: `1px solid ${border}`,
      background: bg,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding: '0 20px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: muted, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>SAB India</div>
        <div style={{ width: 1, height: 14, background: border }}/>
        <div style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 500, color: inkColor }}>{title}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6, padding:'5px 10px', border: `1px solid ${border}`, borderRadius: 4, fontFamily: FONT.mono, fontSize: 11, color: inkColor, background: dark ? 'oklch(0.2 0.01 60)' : TOKENS.paperAlt }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: TOKENS.positive }}/>
          FY 25-26
        </div>
        <button style={{ padding: 7, background:'transparent', border:`1px solid ${border}`, borderRadius: 4, cursor:'pointer', color: muted, position:'relative' }}>
          <Icon name="bell" size={14}/>
          <span style={{ position:'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 6, background: TOKENS.accent }}/>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, TopBar });
