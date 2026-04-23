// SAB — Users & roles. Reads SEED.{users,roles,userActivity}.

const ROLE_TONE   = { admin:'accent', manager:'blue', supervisor:'positive', crew:'amber', 'view-only':'ink' };
const STATUS_TONE = { active:'positive', invited:'amber', inactive:'ink' };
const PERM_COLOR  = { 'A':TOKENS.accent, 'RW':TOKENS.positive, 'R':TOKENS.blue, '—':TOKENS.ink4 };
const PERM_LABEL  = { 'A':'approve', 'RW':'edit', 'R':'view', '—':'no access' };
const MODULES = [
  { k:'projects',    label:'Projects' },
  { k:'invoices',    label:'Invoices' },
  { k:'timesheets',  label:'Timesheets' },
  { k:'procurement', label:'Procurement' },
  { k:'reports',     label:'Reports' },
  { k:'users',       label:'Users' },
];

function userById(id) { return SEED.users.find(u => u.id === id) || { name:'—', initials:'—' }; }
function roleById(id) { return SEED.roles.find(r => r.id === id) || { label:id, tone:'ink' }; }
function initialsOf(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(s => s[0].toUpperCase()).join(''); }

function Notice({ tone='positive', children, onClose }) {
  const c = TOKENS[tone] || TOKENS.positive;
  return (
    <div style={{ display:'flex', alignItems:'center', gap: 10, padding:'9px 12px', marginBottom: 14,
      background: `${c}14`, border: `1px solid ${c}55`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c, flex:'none' }}/>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && <button onClick={onClose} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>}
    </div>
  );
}

function UsersRoute() {
  const [open, setOpen]     = React.useState(null);
  const [filter, setFilter] = React.useState('all');
  const [users, setUsers]   = React.useState(SEED.users);
  const [toast, setToast]   = React.useState(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole]   = React.useState('crew');

  if (open) {
    const live = users.find(u => u.id === open.id) || open;
    return <UserDetail user={live} onBack={() => setOpen(null)} onUpdate={(patch) => {
      setUsers(prev => prev.map(u => u.id === live.id ? { ...u, ...patch } : u));
    }}/>;
  }

  const all = users;
  const rows = filter === 'all' ? all : all.filter(u => u.role === filter);
  const active = all.filter(u => u.status === 'active').length;
  const invited = all.filter(u => u.status === 'invited').length;
  const mfaPct = Math.round(all.filter(u => u.mfa).length / all.length * 100);

  const submitInvite = () => {
    const name = inviteName.trim(); const email = inviteEmail.trim();
    if (!name || !email) { setToast({ tone:'amber', msg:'Name and email are required.' }); return; }
    const nextId = `U-${String(all.length + 1).padStart(3,'0')}`;
    const newUser = {
      id: nextId, name, email, phone:'+91 —', initials: initialsOf(name),
      role: inviteRole, status:'invited', mfa: false, projects: [],
      lastLogin:'—', joined: '22 Apr 26',
    };
    setUsers(prev => [...prev, newUser]);
    setInviteOpen(false); setInviteName(''); setInviteEmail(''); setInviteRole('crew');
    setToast({ tone:'positive', msg:`Invitation sent to ${email}. Awaiting acceptance.` });
  };

  const Filter = ({ k, label, count }) => (
    <button onClick={() => setFilter(k)} style={{
      padding:'5px 10px', borderRadius: 4, fontFamily: FONT.sans, fontSize: 12,
      background: filter === k ? TOKENS.ink : TOKENS.card,
      color: filter === k ? '#fff' : TOKENS.ink2,
      border: `1px solid ${filter === k ? TOKENS.ink : TOKENS.ruleStrong}`,
      cursor:'pointer', display:'inline-flex', alignItems:'center', gap: 6,
    }}>{label}{count !== undefined && <span style={{ fontFamily: FONT.mono, fontSize: 10, opacity: .7 }}>{count}</span>}</button>
  );

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader eyebrow="Admin" title="Users & roles" description="People with access to SAB Tracker. Roles control what each person can see, edit, or approve."
        actions={<>
          <Btn variant="outline" size="sm" icon="download" onClick={() => setToast({ tone:'positive', msg:`User list exported as CSV (${all.length} users).` })}>Export</Btn>
          <Btn variant="primary" size="sm" icon="plus" onClick={() => setInviteOpen(o => !o)}>{inviteOpen ? 'Cancel invite' : 'Invite user'}</Btn>
        </>}/>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}

      {inviteOpen && (
        <Card title="Invite a new user" sub="They'll receive an email link valid for 7 days.">
          <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1.4fr 1fr auto', gap: 10, alignItems:'end' }}>
            <div>
              <label style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Full name</label>
              <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="e.g. Priya Sharma"
                style={{ width:'100%', marginTop: 4, padding:'8px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5 }}/>
            </div>
            <div>
              <label style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Work email</label>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@sabindia.in"
                style={{ width:'100%', marginTop: 4, padding:'8px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5 }}/>
            </div>
            <div>
              <label style={{ fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Role</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                style={{ width:'100%', marginTop: 4, padding:'8px 10px', border:`1px solid ${TOKENS.ruleStrong}`, borderRadius: 4, fontFamily: FONT.sans, fontSize: 12.5, background: TOKENS.card }}>
                {SEED.roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <Btn variant="primary" size="sm" icon="check" onClick={submitInvite}>Send invite</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 14, marginBottom: 16, marginTop: inviteOpen ? 16 : 0 }}>
        <KPI label="Total users"     value={all.length}     sub={`${active} active · ${invited} invited`} accent/>
        <KPI label="Active sessions" value={5}              sub="last 24h"/>
        <KPI label="Pending invites" value={invited}        sub={invited ? 'awaiting acceptance' : 'none open'}/>
        <KPI label="MFA enabled"     value={`${mfaPct}%`}   sub="of all users"/>
      </div>

      <RoleMatrix onEdit={() => setToast({ tone:'amber', msg:'Role editor is admin-restricted. Contact arvind.kumar@sabindia.in to modify permissions.' })}/>

      <div style={{ display:'flex', gap: 6, margin: '20px 0 12px', flexWrap:'wrap' }}>
        <Filter k="all" label="All" count={all.length}/>
        {SEED.roles.map(r => <Filter key={r.id} k={r.id} label={r.label} count={r.userCount}/>)}
      </div>

      <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12.5 }}>
          <thead><tr style={{ background: TOKENS.paperAlt, borderBottom: `1px solid ${TOKENS.rule}` }}>
            {['User','Role','Status','Projects','Last login','MFA',''].map((h, i) => (
              <th key={i} style={{ padding:'8px 12px', textAlign:'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((u, i) => {
              const r = roleById(u.role);
              return (
                <tr key={i} onClick={() => setOpen(u)} style={{ borderBottom:`1px solid ${TOKENS.rule}`, cursor:'pointer' }}>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 4, background: TOKENS.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, flex:'none' }}>{u.initials}</div>
                      <div>
                        <div style={{ color: TOKENS.ink, fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:'10px 12px' }}><Pill tone={r.tone} size="sm" dot>{r.label}</Pill></td>
                  <td style={{ padding:'10px 12px' }}><Pill tone={STATUS_TONE[u.status]} size="sm" dot>{u.status}</Pill></td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink2 }}>{u.projects.length || '—'}</td>
                  <td style={{ padding:'10px 12px', fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>{u.lastLogin}</td>
                  <td style={{ padding:'10px 12px' }}>{u.mfa ? <Pill tone="positive" size="sm">on</Pill> : <Pill tone="ink" size="sm">off</Pill>}</td>
                  <td style={{ padding:'10px 8px', color: TOKENS.ink4 }}><Icon name="chevRight" size={13}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleMatrix({ onEdit }) {
  return (
    <div style={{ background: TOKENS.card, border: `1px solid ${TOKENS.rule}`, borderRadius: 4 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${TOKENS.rule}`, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: FONT.sans, fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>Role permission matrix</div>
          <div style={{ fontFamily: FONT.sans, fontSize: 11.5, color: TOKENS.ink3, marginTop: 2 }}>5 roles × 6 modules. <span style={{ color: TOKENS.positive, fontWeight: 600 }}>RW</span> can edit · <span style={{ color: TOKENS.accent, fontWeight: 600 }}>A</span> can approve · <span style={{ color: TOKENS.blue, fontWeight: 600 }}>R</span> read-only.</div>
        </div>
        <Btn variant="ghost" size="sm" onClick={onEdit}>Edit roles</Btn>
      </div>
      <div style={{ padding: 16, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontFamily: FONT.sans, fontSize: 12 }}>
          <thead><tr>
            <th style={{ padding:'8px 12px 8px 0', textAlign:'left', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, borderBottom: `1px solid ${TOKENS.rule}` }}>Role</th>
            {MODULES.map(m => (
              <th key={m.k} style={{ padding:'8px 8px', textAlign:'center', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, borderBottom: `1px solid ${TOKENS.rule}` }}>{m.label}</th>
            ))}
            <th style={{ padding:'8px 0 8px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 9.5, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, borderBottom: `1px solid ${TOKENS.rule}` }}>Users</th>
          </tr></thead>
          <tbody>
            {SEED.roles.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < SEED.roles.length - 1 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <td style={{ padding:'12px 12px 12px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
                    <Pill tone={r.tone} size="sm" dot>{r.label}</Pill>
                  </div>
                  <div style={{ fontFamily: FONT.sans, fontSize: 11, color: TOKENS.ink3, marginTop: 4, maxWidth: 280 }}>{r.desc}</div>
                </td>
                {MODULES.map(m => {
                  const v = r.perms[m.k] || '—';
                  return (
                    <td key={m.k} style={{ padding:'12px 8px', textAlign:'center' }}>
                      <span title={PERM_LABEL[v]} style={{
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        minWidth: 28, height: 22, padding:'0 6px', borderRadius: 3,
                        background: v === '—' ? TOKENS.paperAlt : `${PERM_COLOR[v]}1f`,
                        color: PERM_COLOR[v],
                        fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700, letterSpacing:'.04em',
                      }}>{v}</span>
                    </td>
                  );
                })}
                <td style={{ padding:'12px 0 12px 12px', textAlign:'right', fontFamily: FONT.mono, fontSize: 12, fontWeight: 600, color: TOKENS.ink }}>{r.userCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDetail({ user, onBack, onUpdate }) {
  const [role, setRole]         = React.useState(user.role);
  const [status, setStatus]     = React.useState(user.status);
  const [projects, setProjects] = React.useState(user.projects);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [toast, setToast]       = React.useState(null);
  const r = roleById(role);
  const activity = SEED.userActivity.filter(a => a.actor === user.id);

  const allProjectCodes = (SEED.projects || []).map(p => p.code).filter(Boolean);
  const available = allProjectCodes.filter(c => !projects.includes(c));

  const updateRole = (id) => { setRole(id); onUpdate && onUpdate({ role: id }); };
  const updateStatus = (s) => { setStatus(s); onUpdate && onUpdate({ status: s }); };
  const removeProject = (pc) => {
    const next = projects.filter(p => p !== pc);
    setProjects(next); onUpdate && onUpdate({ projects: next });
    setToast({ tone:'amber', msg:`Removed ${pc} from project access.` });
  };
  const assignProject = (pc) => {
    const next = [...projects, pc];
    setProjects(next); onUpdate && onUpdate({ projects: next });
    setAssignOpen(false);
    setToast({ tone:'positive', msg:`Assigned ${user.name} to ${pc}.` });
  };

  return (
    <div style={{ padding:'22px 28px 48px' }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8, fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background:'transparent', border:'none', color: TOKENS.ink3, cursor:'pointer', padding: 0, fontSize: 12 }}>Users & roles</button>
        <Icon name="chevRight" size={11}/>
        <span style={{ color: TOKENS.ink }}>{user.id}</span>
      </div>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap: 24, marginBottom: 18 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 6, background: TOKENS.accent, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily: FONT.sans, fontSize: 20, fontWeight: 600 }}>{user.initials}</div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 6 }}>
              <Pill tone={r.tone} dot>{r.label}</Pill>
              <Pill tone={STATUS_TONE[status]} size="sm" dot>{status}</Pill>
              {user.mfa && <Pill tone="positive" size="sm">MFA on</Pill>}
            </div>
            <h1 style={{ fontFamily: FONT.sans, fontSize: 24, fontWeight: 600, color: TOKENS.ink, letterSpacing:'-0.025em', margin: 0 }}>{user.name}</h1>
            <div style={{ marginTop: 4, fontFamily: FONT.sans, fontSize: 13, color: TOKENS.ink3, display:'flex', gap: 14 }}>
              <span>{user.email}</span><span>·</span><span>{user.phone}</span><span>·</span><span>joined {user.joined}</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <Btn variant="outline" size="sm" icon="download" onClick={() => setToast({ tone:'positive', msg:`Exported ${activity.length} activity events for ${user.name}.` })}>Export activity</Btn>
          {status === 'active'   && <Btn variant="outline" size="sm" icon="check" onClick={() => { updateStatus('inactive'); setToast({ tone:'amber', msg:`${user.name} deactivated. Sessions revoked.` }); }}>Deactivate</Btn>}
          {status === 'inactive' && <Btn variant="primary" size="sm" icon="check" onClick={() => { updateStatus('active'); setToast({ tone:'positive', msg:`${user.name} reactivated.` }); }}>Reactivate</Btn>}
          {status === 'invited'  && <Btn variant="primary" size="sm" icon="check" onClick={() => { updateStatus('active'); setToast({ tone:'positive', msg:`Invite resent to ${user.email}.` }); }}>Resend invite</Btn>}
        </div>
      </div>

      {toast && <Notice tone={toast.tone} onClose={() => setToast(null)}>{toast.msg}</Notice>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 1, background: TOKENS.rule, borderRadius: 4, overflow:'hidden', marginBottom: 18 }}>
        <StatBlock label="Role"            value={r.label}                sub={`${r.userCount} ${r.label.toLowerCase()}s total`} accent/>
        <StatBlock label="Projects"        value={user.projects.length}   sub={user.projects.length ? 'assigned' : 'no assignments'}/>
        <StatBlock label="Last login"      value={user.lastLogin}         sub={status === 'active' ? 'active session' : '—'}/>
        <StatBlock label="Account age"     value={user.joined}            sub="member since"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 16 }}>
        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <Card title="Permissions" sub={`Inherited from ${r.label} role`}>
            <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3, marginBottom: 10 }}>{r.desc}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 1, background: TOKENS.rule }}>
              {MODULES.map(m => {
                const v = r.perms[m.k] || '—';
                return (
                  <div key={m.k} style={{ padding:'10px 12px', background: TOKENS.card, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>{m.label}</span>
                    <span style={{
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      minWidth: 32, padding:'2px 7px', borderRadius: 3,
                      background: v === '—' ? TOKENS.paperAlt : `${PERM_COLOR[v]}1f`, color: PERM_COLOR[v],
                      fontFamily: FONT.mono, fontSize: 10.5, fontWeight: 700,
                    }}>{v}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600 }}>Change role</div>
            <div style={{ display:'flex', gap: 6, marginTop: 8, flexWrap:'wrap' }}>
              {SEED.roles.map(opt => (
                <button key={opt.id} onClick={() => { if (opt.id !== role) { updateRole(opt.id); setToast({ tone:'positive', msg:`${user.name} role changed to ${opt.label}.` }); } }} style={{
                  padding:'5px 10px', borderRadius: 4, fontFamily: FONT.sans, fontSize: 12,
                  background: role === opt.id ? TOKENS.ink : TOKENS.card,
                  color: role === opt.id ? '#fff' : TOKENS.ink2,
                  border: `1px solid ${role === opt.id ? TOKENS.ink : TOKENS.ruleStrong}`,
                  cursor:'pointer',
                }}>{opt.label}</button>
              ))}
            </div>
          </Card>

          <Card title="Recent activity" sub={`${activity.length} event${activity.length !== 1 ? 's' : ''} attributed to this user`}>
            {activity.length === 0 ? (
              <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No activity yet.</div>
            ) : activity.map((a, i) => (
              <div key={i} style={{ display:'flex', gap: 12, padding:'10px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <div style={{ width: 90, fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3 }}>{a.ts}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT.sans, fontSize: 12.5, color: TOKENS.ink, fontWeight: 500 }}>{a.action}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3, marginTop: 2 }}>{a.meta}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
          <Card title="Project access" sub={projects.length ? `${projects.length} active assignment${projects.length>1?'s':''}` : 'no project access'}>
            {projects.length === 0 ? (
              <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>This user is not assigned to any projects.</div>
            ) : projects.map((pc, i) => (
              <div key={pc} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderTop: i > 0 ? `1px dashed ${TOKENS.rule}` : 'none' }}>
                <Code>{pc}</Code>
                <Btn variant="ghost" size="sm" onClick={() => removeProject(pc)}>Remove</Btn>
              </div>
            ))}
            {assignOpen ? (
              <div style={{ marginTop: 14, padding: 10, background: TOKENS.paperAlt, borderRadius: 4, border:`1px solid ${TOKENS.rule}` }}>
                <div style={{ fontFamily: FONT.mono, fontSize: 10, color: TOKENS.ink3, letterSpacing:'.08em', textTransform:'uppercase', fontWeight: 600, marginBottom: 8 }}>Pick a project</div>
                {available.length === 0 ? (
                  <div style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink3 }}>No more projects available — already assigned to all.</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap: 4, maxHeight: 200, overflowY:'auto' }}>
                    {available.map(pc => (
                      <button key={pc} onClick={() => assignProject(pc)} style={{
                        textAlign:'left', padding:'7px 10px', background: TOKENS.card, border:`1px solid ${TOKENS.rule}`, borderRadius: 3,
                        fontFamily: FONT.mono, fontSize: 11, color: TOKENS.ink, cursor:'pointer',
                      }}>{pc}</button>
                    ))}
                  </div>
                )}
                <Btn variant="ghost" size="sm" onClick={() => setAssignOpen(false)} style={{ marginTop: 8, width:'100%', justifyContent:'center' }}>Cancel</Btn>
              </div>
            ) : (
              <Btn variant="outline" size="sm" icon="plus" onClick={() => setAssignOpen(true)} style={{ marginTop: 14, width:'100%', justifyContent:'center' }}>Assign to project</Btn>
            )}
          </Card>

          <Card title="Security">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0' }}>
              <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>Multi-factor auth</span>
              {user.mfa ? <Pill tone="positive" size="sm" dot>enabled</Pill> : <Pill tone="amber" size="sm" dot>not enrolled</Pill>}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderTop: `1px dashed ${TOKENS.rule}` }}>
              <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>SSO (Google Workspace)</span>
              <Pill tone="positive" size="sm" dot>linked</Pill>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderTop: `1px dashed ${TOKENS.rule}` }}>
              <span style={{ fontFamily: FONT.sans, fontSize: 12, color: TOKENS.ink2 }}>Password last changed</span>
              <span style={{ fontFamily: FONT.mono, fontSize: 10.5, color: TOKENS.ink3 }}>62 days ago</span>
            </div>
            <Btn variant="outline" size="sm" icon="check" onClick={() => setToast({ tone:'positive', msg:`Password reset link sent to ${user.email}.` })} style={{ marginTop: 14, width:'100%', justifyContent:'center' }}>Force password reset</Btn>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { UsersRoute, UserDetail, RoleMatrix, ROLE_TONE, STATUS_TONE });
