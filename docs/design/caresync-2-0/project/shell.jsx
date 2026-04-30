// Shared shell + bits
const Rail = ({ active, recipient = "Margaret · Mom" }) => (
  <aside className="cs-rail">
    <div className="cs-rail-brand">
      <div className="cs-rail-brand-mark">c</div>
      <div>
        <div className="cs-rail-brand-name">CareSync</div>
        <div className="cs-rail-brand-sub">Hoffman family</div>
      </div>
    </div>
    <div className="cs-rail-section">Today</div>
    <div className={`cs-rail-item ${active === 'brief' ? 'active' : ''}`}>
      <span>◐</span> Daily brief
    </div>
    <div className={`cs-rail-item ${active === 'today' ? 'active' : ''}`}>
      <span>▤</span> Timeline <span className="cs-rail-count">7</span>
    </div>
    <div className={`cs-rail-item ${active === 'meds' ? 'active' : ''}`}>
      <span>℞</span> Medications <span className="cs-rail-count">2</span>
    </div>
    <div className={`cs-rail-item ${active === 'shifts' ? 'active' : ''}`}>
      <span>◑</span> Shifts
    </div>
    <div className="cs-rail-section">Record</div>
    <div className={`cs-rail-item ${active === 'journal' ? 'active' : ''}`}>
      <span>✎</span> Journal
    </div>
    <div className={`cs-rail-item ${active === 'profile' ? 'active' : ''}`}>
      <span>◉</span> Mom's profile
    </div>
    <div className={`cs-rail-item ${active === 'docs' ? 'active' : ''}`}>
      <span>▦</span> Documents
    </div>
    <div className={`cs-rail-item ${active === 'visits' ? 'active' : ''}`}>
      <span>+</span> Visit summaries
    </div>
    <div className="cs-rail-recipient">
      <div className="cs-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>M</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--app-shell-text)', fontWeight: 600, fontSize: 13 }}>
          Margaret H.
        </div>
        <div style={{ color: 'var(--app-shell-muted)', fontSize: 11.5, fontFamily: 'Geist Mono, monospace' }}>
          82 · Mom
        </div>
      </div>
    </div>
  </aside>
);

const TopBar = ({ title, crumb, action }) => (
  <div className="cs-topbar">
    {crumb && <div className="cs-topbar-crumb">{crumb} <span style={{ margin: '0 6px', color: 'var(--border)' }}>/</span></div>}
    <div className="cs-topbar-title">{title}</div>
    <div className="cs-search">
      <span style={{ color: 'var(--muted)' }}>⌕</span>
      <input placeholder="Search Margaret's record" />
      <span className="cs-kbd">⌘K</span>
    </div>
    {action}
  </div>
);

const TintedCard = ({ title, meta, action, children, headerExtra }) => (
  <div className="card">
    {(title || meta || action) && (
      <div className="card-header-tinted">
        {title && <div className="title">{title}</div>}
        {headerExtra}
        {meta && <div className="meta">{meta}</div>}
        {action && <div style={{ marginLeft: meta ? 12 : 'auto' }}>{action}</div>}
      </div>
    )}
    <div className="card-body">{children}</div>
  </div>
);

const Eyebrow = ({ children, color = 'var(--muted)' }) => (
  <div className="eyebrow" style={{ color }}>{children}</div>
);

const Avatar = ({ name, size = 28, hue = 0 }) => {
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

Object.assign(window, { Rail, TopBar, TintedCard, Eyebrow, Avatar });
