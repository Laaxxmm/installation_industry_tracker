// SAB — Desktop app wrapper

function DesktopApp({ startRoute = 'home' }) {
  const [route, setRoute] = React.useState(startRoute);
  const [collapsed, setCollapsed] = React.useState(false);
  const [openProject, setOpenProject] = React.useState(null);

  const titles = {
    home: 'Operations overview',
    projects: 'Projects',
    projectDetail: `${SEED.projectDetail.code} — Fire hydrant system`,
    invoices: 'Tax invoices',
    quotes: 'Quotes',
    clients: 'Clients',
    inventory: 'Inventory',
    timesheets: 'Timesheets',
    overhead: 'Overhead',
    reports: 'Reports',
    vendors: 'Vendors',
    'purchase-orders': 'Purchase orders',
    grns: 'Goods receipts',
    'vendor-bills': 'Vendor bills',
    users: 'Users & roles',
    rates: 'Wage rates',
  };

  const effective = openProject ? 'projectDetail' : route;

  return (
    <div style={{
      width:'100%', height:'100%', display:'flex',
      background: TOKENS.paper, color: TOKENS.ink,
      fontFamily: FONT.sans, overflow:'hidden',
    }}>
      <Sidebar
        current={route}
        onNav={(k) => { setOpenProject(null); setRoute(k); }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth: 0 }}>
        <TopBar title={titles[effective]}/>
        <div style={{ flex:1, overflowY:'auto', background: TOKENS.paper }}>
          {effective === 'home'        && <HomeRoute onNav={setRoute}/>}
          {effective === 'projects'    && <ProjectsRoute onNav={setRoute} onOpen={(c) => setOpenProject(c)}/>}
          {effective === 'projectDetail' && <ProjectDetailRoute onNav={(k) => { setOpenProject(null); setRoute(k); }}/>}
          {effective === 'invoices'    && <InvoicesRoute/>}
          {effective === 'quotes'      && <QuotesRoute/>}
          {effective === 'inventory'   && <InventoryRoute/>}
          {effective === 'timesheets'  && <TimesheetsRoute/>}
          {effective === 'reports'     && <ReportsRoute/>}
          {effective === 'vendors'         && <VendorsRoute/>}
          {effective === 'purchase-orders' && <PurchaseOrdersRoute/>}
          {effective === 'grns'            && <GRNsRoute/>}
          {effective === 'vendor-bills'    && <VendorBillsRoute/>}
          {effective === 'clients'     && <ClientsRoute/>}
          {effective === 'overhead'    && <SimpleRoute title="Overhead" desc="Rent, salaries, utilities — allocated by revenue share"/>}
          {effective === 'users'       && <UsersRoute/>}
          {effective === 'rates'       && <RatesRoute/>}
        </div>
      </div>
    </div>
  );
}

// Login screen
function LoginScreen() {
  return (
    <div style={{
      width:'100%', height:'100%', display:'flex',
      background: TOKENS.paper, fontFamily: FONT.sans,
    }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding: 40 }}>
        <div style={{ width: 360 }}>
          <Wordmark size={20}/>
          <h1 style={{ fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', marginTop: 32, marginBottom: 4 }}>Sign in</h1>
          <div style={{ fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3 }}>Use your SAB India work email.</div>
          <div style={{ marginTop: 24 }}>
            <label style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>Work email</label>
            <input defaultValue="arvind.kumar@sabindia.in" style={{ width:'100%', marginTop: 6, padding:'10px 12px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 13 }}/>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.1em', textTransform:'uppercase', fontWeight: 600 }}>Password</label>
            <input type="password" defaultValue="••••••••••" style={{ width:'100%', marginTop: 6, padding:'10px 12px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 13 }}/>
          </div>
          <button style={{ width:'100%', marginTop: 20, padding:'11px', background: TOKENS.accent, color:'#fff', border:'none', borderRadius: 4, fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, cursor:'pointer' }}>Sign in →</button>
          <div style={{ textAlign:'center', marginTop: 18, fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>
            or use <span style={{ color: TOKENS.accentInk, fontWeight: 600 }}>SSO · Google Workspace</span>
          </div>
          <div style={{ marginTop: 48, fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em' }}>
            Powered by <span style={{ color: TOKENS.accent, fontWeight: 600 }}>indefine</span> · v3.2 · © 2026
          </div>
        </div>
      </div>
      <div style={{ flex: 1.1, background: TOKENS.ink, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 30% 20%, oklch(0.32 0.06 45) 0, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.3 0.04 60) 0, transparent 40%)' }}/>
        <div style={{ position:'absolute', inset: 0, padding: 48, display:'flex', flexDirection:'column', justifyContent:'space-between', color:'#fff' }}>
          <div>
            <div style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing:'.16em', textTransform:'uppercase', opacity: .6, fontWeight: 600 }}>Internal tool · SAB India</div>
            <div style={{ fontFamily: FONT.sans, fontSize: 32, fontWeight: 600, letterSpacing:'-0.03em', marginTop: 16, lineHeight: 1.1, maxWidth: 440 }}>
              Every project, invoice, crew hour and stock issue — in one place.
            </div>
            <div style={{ fontFamily: FONT.sans, fontSize: 14, opacity: .65, marginTop: 12, maxWidth: 420, lineHeight: 1.5 }}>
              Replaces spreadsheets and WhatsApp threads with a single ledger. Supervisors punch in from site, admins raise invoices, finance pulls clean P&amp;L reports.
            </div>
          </div>
          <div style={{ display:'flex', gap: 32, fontFamily: FONT.mono, fontSize: 10.5, opacity: .55 }}>
            <div><div style={{ fontSize: 20, fontWeight: 600, opacity: 1, fontFamily: FONT.sans, letterSpacing:'-0.02em' }}>165</div>active projects</div>
            <div><div style={{ fontSize: 20, fontWeight: 600, opacity: 1, fontFamily: FONT.sans, letterSpacing:'-0.02em' }}>₹14.2Cr</div>portfolio value · FY</div>
            <div><div style={{ fontSize: 20, fontWeight: 600, opacity: 1, fontFamily: FONT.sans, letterSpacing:'-0.02em' }}>42</div>client organizations</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopApp, LoginScreen });
