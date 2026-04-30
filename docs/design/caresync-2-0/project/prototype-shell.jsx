// prototype-shell.jsx — interactive Rail / TopBar / TintedCard variants

const PRail = ({ active, onNavigate, density, attentionCount, mode }) => {
  const Item = ({ id, glyph, label, count }) => (
    <div
      className={`cs-rail-item ${active === id ? 'active' : ''}`}
      onClick={() => onNavigate(id)}
      style={{ padding: density === 'compact' ? '6px 10px' : (density === 'comfy' ? '10px 12px' : '8px 10px') }}
    >
      <span style={{ width: 18, display: 'inline-block', textAlign: 'center', opacity: 0.85 }}>{glyph}</span>
      <span>{label}</span>
      {count !== undefined && <span className="cs-rail-count">{count}</span>}
    </div>
  );
  return (
    <aside className="cs-rail" style={{ width: mode === 'wide' ? 240 : (mode === 'narrow' ? 184 : 220) }}>
      <div className="cs-rail-brand">
        <div className="cs-rail-brand-mark">c</div>
        <div>
          <div className="cs-rail-brand-name">CareSync</div>
          <div className="cs-rail-brand-sub">Hoffman family</div>
        </div>
      </div>
      <div className="cs-rail-section">Today</div>
      <Item id="brief"   glyph="◐" label="Daily brief" count={attentionCount || undefined} />
      <Item id="today"   glyph="▤" label="Timeline"   count={7} />
      <Item id="meds"    glyph="℞" label="Medications" count={2} />
      <Item id="shifts"  glyph="◑" label="Shifts" />
      <div className="cs-rail-section">Record</div>
      <Item id="journal" glyph="✎" label="Journal" />
      <Item id="profile" glyph="◉" label="Mom's profile" />
      <Item id="docs"    glyph="▦" label="Documents" />
      <Item id="visits"  glyph="✚" label="Visit summaries" />
      <div className="cs-rail-recipient">
        <div className="cs-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>M</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--app-shell-text)', fontWeight: 600, fontSize: 13 }}>Margaret H.</div>
          <div style={{ color: 'var(--app-shell-muted)', fontSize: 11.5, fontFamily: 'Geist Mono, monospace' }}>82 · Mom</div>
        </div>
      </div>
    </aside>
  );
};

const PTopBar = ({ title, crumb, action, search }) => (
  <div className="cs-topbar">
    {crumb && <div className="cs-topbar-crumb">{crumb} <span style={{ margin: '0 6px', color: 'var(--border)' }}>/</span></div>}
    <div className="cs-topbar-title">{title}</div>
    {search !== false && (
      <div className="cs-search">
        <span style={{ color: 'var(--muted)' }}>⌕</span>
        <input placeholder="Search Margaret's record" />
        <span className="cs-kbd">⌘K</span>
      </div>
    )}
    {action}
  </div>
);

const PCard = ({ title, meta, action, headerExtra, headerTint, children, padding }) => (
  <div className="card">
    {(title || meta || action) && (
      <div className="card-header-tinted" style={headerTint ? { background: headerTint } : undefined}>
        {title && <div className="title">{title}</div>}
        {headerExtra}
        {meta && <div className="meta">{meta}</div>}
        {action && <div style={{ marginLeft: meta ? 12 : 'auto' }}>{action}</div>}
      </div>
    )}
    <div className="card-body" style={padding !== undefined ? { padding } : undefined}>{children}</div>
  </div>
);

const PAvatar = ({ name, size = 28, hue = 0 }) => {
  const palettes = [
    ['#f08e76','#d97706'],
    ['#a78bfa','#7c3aed'],
    ['#22c55e','#10b981'],
    ['#f59e0b','#d97706'],
    ['#ef4444','#c41a1a'],
  ];
  const [a,b] = palettes[hue % palettes.length];
  const initial = name.split(' ').map(s => s[0]).slice(0,2).join('');
  return (
    <div className="cs-avatar" style={{
      width: size, height: size, fontSize: size * 0.42,
      background: `linear-gradient(135deg, ${a}, ${b})`,
    }}>{initial}</div>
  );
};

const PEyebrow = ({ children, color = 'var(--muted)' }) => (
  <div className="eyebrow" style={{ color }}>{children}</div>
);

// Toast
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: 'var(--app-shell-text)',
      padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)', zIndex: 100,
      fontFamily: 'Geist, system-ui, sans-serif',
    }}>{msg}</div>
  );
}

Object.assign(window, { PRail, PTopBar, PCard, PAvatar, PEyebrow, Toast });
