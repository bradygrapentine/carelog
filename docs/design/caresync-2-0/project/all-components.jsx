// Combined components — single Babel script for guaranteed scope

// === shell.jsx ===
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
    ['#d27a5e','#b8543a'],
    ['#8a5478','#6b3f5e'],
    ['#7a8a5a','#566640'],
    ['#c89030','#a8741a'],
    ['#a85040','#7a3328'],
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


// === screen-brief.jsx ===
// Screen 1 — Daily Brief (the editorial moment)
const ScreenBrief = () => (
  <div className="cs-frame">
    <Rail active="brief" />
    <div className="cs-main">
      <TopBar
        title="Daily brief"
        crumb="Today"
        action={
          <button className="btn btn-outline">
            <span>↻</span> Refresh
          </button>
        }
      />
      <div className="cs-body" style={{ padding: 0 }}>
        {/* Hero */}
        <div style={{ padding: '40px 56px 32px', maxWidth: 880 }}>
          <Eyebrow>Today's brief · auto-generated 7:02a · Wednesday, Apr 29</Eyebrow>
          <h1 className="headline-display" style={{ fontSize: 'clamp(2rem, 2.4vw + 1rem, 2.75rem)', margin: '14px 0 0' }}>
            Mom slept <em>poorly</em>. Three med doses <em>missed</em> in the gap between Sarah's shift and yours.
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, color: 'var(--text-secondary)', fontSize: 14 }}>
            <Avatar name="Sarah Reed" size={28} hue={2} />
            <span>Sarah was on 6p–6a · handing off to <strong style={{ color: 'var(--text-primary)' }}>you</strong> at 8a</span>
          </div>
        </div>

        {/* What needs attention */}
        <div style={{ padding: '0 56px 32px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          <div className="col">
            <TintedCard
              title="What needs your attention this morning"
              meta="3 items"
            >
              <div className="col" style={{ gap: 0 }}>
                {[
                  { icon: '℞', label: 'Donepezil 10mg', sub: 'Missed at 9p, 10p, 6a · last taken yesterday 7a', tag: 'Catch up after breakfast', tagClass: 'badge-amber' },
                  { icon: '☎', label: 'Dr. Patel — return call', sub: 'Left voicemail 4:18p yesterday about Friday\'s neuro f/u', tag: 'Office opens 8:30a', tagClass: 'badge-violet' },
                  { icon: '◔', label: 'Aide schedule confirmation', sub: 'Maria switched Thursday to evening · needs Sarah\'s nod', tag: 'Awaiting Sarah', tagClass: 'badge-neutral' },
                ].map((it, i) => (
                  <div key={i} style={{
                    padding: '12px 0',
                    borderTop: i ? '1px solid var(--border)' : 0,
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: 'var(--primary-subtle)', color: 'var(--primary)',
                      display: 'grid', placeItems: 'center', fontSize: 14,
                    }}>{it.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{it.label}</div>
                      <div className="secondary-text" style={{ fontSize: 12.5 }}>{it.sub}</div>
                    </div>
                    <span className={`badge ${it.tagClass}`}>{it.tag}</span>
                  </div>
                ))}
              </div>
            </TintedCard>

            {/* The night, in Sarah's words */}
            <TintedCard
              title="The night, in Sarah's words"
              meta="written 5:48a"
              action={<span className="badge badge-difficult"><span className="dot"></span>Difficult</span>}
            >
              <div className="mood-border-difficult" style={{ paddingLeft: 14 }}>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  Up four times. She didn't recognize me at 2a, asked for Dad. I sat with her until she settled,
                  about 20 minutes. No falls. Refused the 9p donepezil and the 10p calcium; I didn't push it.
                  Bowels normal. She's asleep now, finally — let her go until she wakes on her own.
                </p>
                <div className="row" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>
                  <span className="mono">SLEEP 4h 20m</span>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="mono">3 WAKES</span>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="mono">2 REFUSED DOSES</span>
                </div>
              </div>
            </TintedCard>

            {/* Coming up */}
            <TintedCard title="Coming up today" meta="Wed Apr 29">
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', columnGap: 16, rowGap: 0 }}>
                {[
                  { time: '8:00a', evt: 'Handoff with Sarah', sub: 'Right here · 10 min', who: 'Sarah → You' },
                  { time: '10:30a', evt: 'PT — Marcus (in-home)', sub: 'Knee strengthening, 45 min', who: 'Confirmed' },
                  { time: '12:00p', evt: 'Lunch + lorazepam if needed', sub: 'Use only if agitated', who: 'PRN' },
                  { time: '2:00p', evt: 'Maria arrives', sub: 'Aide · until 6p', who: 'Confirmed' },
                  { time: '5:30p', evt: 'Family group call', sub: 'You, David, Joanne · weekly', who: '3 people' },
                ].map((row, i) => (
                  <React.Fragment key={i}>
                    <div className="mono" style={{ color: 'var(--muted)', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0 }}>{row.time}</div>
                    <div style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{row.evt}</div>
                      <div className="secondary-text" style={{ fontSize: 12.5 }}>{row.sub}</div>
                    </div>
                    <div style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0, color: 'var(--text-secondary)', fontSize: 12.5, alignSelf: 'center' }}>{row.who}</div>
                  </React.Fragment>
                ))}
              </div>
            </TintedCard>
          </div>

          {/* Right rail */}
          <div className="col">
            <div className="card">
              <div className="card-header-tinted" style={{ background: 'var(--secondary-subtle)' }}>
                <div className="title">Pattern this week</div>
                <span className="badge badge-amber">Worth noting</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  Sleep got worse on the 3 nights after she switched to the new donepezil schedule.
                  Worth flagging to Dr. Patel on Friday.
                </div>
                {/* tiny chart */}
                <svg viewBox="0 0 280 70" style={{ width: '100%', height: 70, marginTop: 14 }}>
                  {[0,1,2,3,4,5,6].map(i => {
                    const heights = [60, 55, 48, 30, 28, 22, 25];
                    const x = i * 40 + 6;
                    const h = heights[i];
                    const isWorse = i >= 3;
                    return (
                      <g key={i}>
                        <rect x={x} y={70 - h} width={28} height={h} rx={4}
                          fill={isWorse ? 'var(--secondary)' : 'var(--primary-subtle)'} />
                        <text x={x + 14} y={66} textAnchor="middle" fontSize="9"
                          fontFamily="Geist Mono, monospace" fill="var(--muted)">
                          {['Th','Fr','Sa','Su','Mo','Tu','We'][i]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="row" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
                  <span className="mono">HOURS SLEPT · LAST 7 NIGHTS</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header-tinted">
                <div className="title">On shift now</div>
              </div>
              <div className="card-body" style={{ padding: '8px 0' }}>
                {[
                  { name: 'Sarah Reed', role: 'Sister · overnight', status: 'Off in 58 min', hue: 2 },
                  { name: 'You (Anna)', role: 'Primary · daytime', status: 'Starts 8:00a', hue: 1 },
                  { name: 'Maria Lopez', role: 'Paid aide · afternoon', status: '2:00p–6:00p', hue: 0 },
                  { name: 'David Hoffman', role: 'Brother · supporting', status: 'Joining 5:30p call', hue: 3 },
                ].map((p, i) => (
                  <div key={i} style={{
                    padding: '10px 16px',
                    borderTop: i ? '1px solid var(--border)' : 0,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <Avatar name={p.name} size={32} hue={p.hue} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                      <div className="secondary-text" style={{ fontSize: 12 }}>{p.role}</div>
                    </div>
                    <div className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{p.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.ScreenBrief = ScreenBrief;


// === screen-today.jsx ===
// Screen 2 — Today / Timeline
const ScreenToday = () => {
  const items = [
    { time: '6:00a', kind: 'shift', label: 'Sarah\'s overnight ended', sub: '6p–6a · 4h 20m sleep, 3 wakes', tag: 'Logged' },
    { time: '6:48a', kind: 'sleep', label: 'Mom woke up', sub: 'Asked for coffee, oriented x3' },
    { time: '7:02a', kind: 'brief', label: 'Daily brief generated', sub: 'Auto · review and edit before group call' },
    { time: '7:15a', kind: 'med', label: 'Levothyroxine 50mcg', sub: 'On time · taken with water', tag: 'Done', tagClass: 'badge-good' },
    { time: '7:30a', kind: 'meal', label: 'Breakfast — half eaten', sub: 'Oatmeal, banana. Refused eggs.' },
    { time: '8:00a', kind: 'now', label: 'Handoff — you take over', sub: 'Sarah → Anna · 10 min standup' },
    { time: '9:00a', kind: 'med', label: 'Donepezil 10mg', sub: 'Catch-up dose · missed last 3 windows', tag: 'Catch up', tagClass: 'badge-amber' },
    { time: '10:30a', kind: 'visit', label: 'Marcus, in-home PT', sub: '45 min · knee strengthening' },
    { time: '12:00p', kind: 'meal', label: 'Lunch', sub: 'Soft foods preferred lately' },
    { time: '2:00p', kind: 'shift', label: 'Maria arrives', sub: 'Paid aide · until 6p' },
  ];

  const iconFor = {
    shift: '◑', sleep: '☾', brief: '◐', med: '℞', meal: '⊕', now: '●', visit: '✚',
  };

  return (
    <div className="cs-frame">
      <Rail active="today" />
      <div className="cs-main">
        <TopBar
          title="Wednesday, Apr 29"
          crumb="Timeline"
          action={
            <div className="row">
              <button className="btn btn-outline btn-sm">◀</button>
              <button className="btn btn-outline btn-sm">Today</button>
              <button className="btn btn-outline btn-sm">▶</button>
              <button className="btn btn-primary"><span>+</span> Log</button>
            </div>
          }
        />
        <div className="cs-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
            <div className="col">
              <TintedCard title="Today, in order" meta="10 events · 4 logged · 6 upcoming" >
                <div style={{ position: 'relative', paddingLeft: 92 }}>
                  {/* spine */}
                  <div style={{
                    position: 'absolute', left: 78, top: 8, bottom: 8,
                    width: 1, background: 'var(--border)',
                  }} />
                  {items.map((it, i) => {
                    const isNow = it.kind === 'now';
                    return (
                      <div key={i} style={{ position: 'relative', padding: '10px 0' }}>
                        <div className="mono" style={{
                          position: 'absolute', left: -92, top: 12, width: 64, textAlign: 'right',
                          color: isNow ? 'var(--primary)' : 'var(--muted)',
                          fontWeight: isNow ? 600 : 400,
                        }}>{it.time}</div>
                        <div style={{
                          position: 'absolute', left: -22, top: 12,
                          width: 28, height: 28, borderRadius: 999,
                          background: isNow ? 'var(--primary)' : 'var(--surface)',
                          border: '1px solid ' + (isNow ? 'var(--primary)' : 'var(--border)'),
                          color: isNow ? '#fff' : 'var(--text-secondary)',
                          display: 'grid', placeItems: 'center', fontSize: 13,
                          boxShadow: isNow ? '0 0 0 6px rgba(124,58,237,0.12)' : 'none',
                        }}>{iconFor[it.kind] || '·'}</div>
                        <div style={{
                          padding: '10px 14px',
                          background: isNow ? 'var(--primary-subtle)' : 'transparent',
                          borderRadius: 12,
                          display: 'flex', gap: 12, alignItems: 'center',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13.5, fontWeight: isNow ? 600 : 500 }}>{it.label}</div>
                            <div className="secondary-text" style={{ fontSize: 12.5 }}>{it.sub}</div>
                          </div>
                          {it.tag && <span className={`badge ${it.tagClass || 'badge-neutral'}`}>{it.tag}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TintedCard>
            </div>

            <div className="col">
              <TintedCard title="Quick log" meta="⌘L">
                <div className="col" style={{ gap: 8 }}>
                  {[
                    ['℞', 'Medication'],
                    ['☾', 'Sleep / wake'],
                    ['⊕', 'Meal'],
                    ['☎', 'Call / message'],
                    ['◔', 'Mood note'],
                    ['✚', 'Visit / appointment'],
                  ].map(([ic, lab]) => (
                    <button key={lab} className="btn btn-outline" style={{ height: 36, justifyContent: 'flex-start', width: '100%' }}>
                      <span style={{ width: 22, color: 'var(--primary)' }}>{ic}</span> {lab}
                    </button>
                  ))}
                </div>
              </TintedCard>

              <TintedCard title="Filter">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['All', 'Meds', 'Meals', 'Sleep', 'Mood', 'Visits', 'Calls'].map((f, i) => (
                    <span key={f} className={`badge ${i === 0 ? 'badge-violet' : 'badge-neutral'}`} style={{ cursor: 'pointer' }}>{f}</span>
                  ))}
                </div>
              </TintedCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ScreenToday = ScreenToday;


// === screen-meds.jsx ===
// Screen 3 — Medications
const ScreenMeds = () => {
  const meds = [
    { name: 'Donepezil', dose: '10 mg', why: 'For memory · take in evening', schedule: '9:00p daily', adherence: 71, status: 'Behind', tagClass: 'badge-amber', last: 'Yesterday 7:14a' },
    { name: 'Levothyroxine', dose: '50 mcg', why: 'Thyroid · empty stomach', schedule: '7:00a daily', adherence: 96, status: 'On track', tagClass: 'badge-good', last: 'Today 7:15a' },
    { name: 'Lisinopril', dose: '5 mg', why: 'Blood pressure', schedule: '8:00a daily', adherence: 88, status: 'On track', tagClass: 'badge-good', last: 'Today 7:58a' },
    { name: 'Calcium + D3', dose: '600 mg', why: 'Bone health', schedule: '10:00p daily', adherence: 64, status: 'Often skipped', tagClass: 'badge-neutral', last: '2 days ago' },
    { name: 'Lorazepam', dose: '0.5 mg', why: 'PRN agitation · max 2/day', schedule: 'As needed', adherence: null, status: 'PRN', tagClass: 'badge-violet', last: 'Sun 11:40p' },
  ];

  return (
    <div className="cs-frame">
      <Rail active="meds" />
      <div className="cs-main">
        <TopBar
          title="Medications"
          crumb="Mom's record"
          action={<button className="btn btn-primary"><span>+</span> Add medication</button>}
        />
        <div className="cs-body">
          <div className="col">
            {/* Adherence header */}
            <TintedCard title="This week" meta="Apr 23 – Apr 29">
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 24 }}>
                <div>
                  <Eyebrow>Adherence · 7 days</Eyebrow>
                  <div className="headline-display" style={{ fontSize: 36, marginTop: 6 }}>
                    82<span style={{ fontSize: 18, color: 'var(--muted)' }}>%</span>
                  </div>
                  <div className="secondary-text" style={{ fontSize: 12.5 }}>Down 6 points from last week</div>
                </div>
                <div>
                  <Eyebrow>Doses missed</Eyebrow>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {[1,1,2,0,1,3,0].map((c, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{
                          height: 36 + c * 8, borderRadius: 6,
                          background: c === 0 ? 'var(--success-subtle)' : c >= 3 ? 'var(--secondary)' : 'var(--secondary-subtle)',
                          marginBottom: 4,
                        }} />
                        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{['Th','Fr','Sa','Su','Mo','Tu','We'][i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Eyebrow>Most-missed</Eyebrow>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Donepezil 10mg</div>
                    <div className="secondary-text" style={{ fontSize: 12.5 }}>4 of last 7 evening doses missed. Likely the shift gap.</div>
                  </div>
                </div>
              </div>
            </TintedCard>

            {/* Med list */}
            <TintedCard title="Active medications" meta="5 total · 1 PRN" action={<button className="btn btn-ghost btn-sm">Print list</button>}>
              <div>
                {meds.map((m, i) => (
                  <div key={i} style={{
                    padding: '14px 0',
                    borderTop: i ? '1px solid var(--border)' : 0,
                    display: 'grid',
                    gridTemplateColumns: '40px 1.4fr 1fr 1fr 110px 70px',
                    gap: 16,
                    alignItems: 'center',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'var(--primary-subtle)', color: 'var(--primary)',
                      display: 'grid', placeItems: 'center', fontSize: 16,
                    }}>℞</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{m.dose}</span></div>
                      <div className="secondary-text" style={{ fontSize: 12.5 }}>{m.why}</div>
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.schedule}</div>
                      <div className="secondary-text" style={{ fontSize: 12 }}>Last: {m.last}</div>
                    </div>
                    <div>
                      {m.adherence !== null ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{m.adherence}% adherence</div>
                          <div style={{ height: 4, background: 'var(--border)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
                            <div style={{ width: `${m.adherence}%`, height: '100%', background: m.adherence >= 85 ? 'var(--mood-good)' : m.adherence >= 70 ? 'var(--mood-okay)' : 'var(--mood-difficult)' }} />
                          </div>
                        </>
                      ) : (
                        <div className="secondary-text" style={{ fontSize: 12.5 }}>As needed</div>
                      )}
                    </div>
                    <span className={`badge ${m.tagClass}`}>{m.status}</span>
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-end' }}>Log →</button>
                  </div>
                ))}
              </div>
            </TintedCard>

            {/* Today's schedule strip */}
            <TintedCard title="Today's schedule">
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
                {[
                  { t: '7:00a', m: 'Levothyroxine', state: 'done' },
                  { t: '8:00a', m: 'Lisinopril', state: 'done' },
                  { t: '9:00a', m: 'Donepezil (catch-up)', state: 'now' },
                  { t: '12:00p', m: 'Lorazepam (PRN)', state: 'soft' },
                  { t: '6:00p', m: 'Dinner', state: 'meal' },
                  { t: '9:00p', m: 'Donepezil', state: 'upcoming' },
                  { t: '10:00p', m: 'Calcium + D3', state: 'upcoming' },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: '1 0 150px',
                    padding: 12,
                    borderRadius: 12,
                    background: s.state === 'now' ? 'var(--primary-subtle)' :
                                s.state === 'done' ? 'var(--success-subtle)' :
                                s.state === 'meal' ? 'var(--surface-muted)' :
                                'var(--surface-muted)',
                    border: s.state === 'now' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{s.t}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{s.m}</div>
                    <div style={{ marginTop: 8, fontSize: 11.5, color: s.state === 'done' ? 'var(--mood-good)' : s.state === 'now' ? 'var(--primary)' : 'var(--muted)', fontFamily: 'Geist Mono, monospace' }}>
                      {s.state === 'done' ? '✓ taken' : s.state === 'now' ? '● due now' : s.state === 'meal' ? 'with food' : 'upcoming'}
                    </div>
                  </div>
                ))}
              </div>
            </TintedCard>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ScreenMeds = ScreenMeds;


// === screen-journal.jsx ===
// Screen 4 — Journal
const ScreenJournal = () => {
  const entries = [
    { date: 'Tonight', time: '11:42p', author: 'Anna (you)', hue: 1, mood: 'okay', text: 'Mom told me about the trip to Estes Park, the one in 1978. Whole story, beginning to end. She was lucid for almost an hour. I want to remember this. Then she asked when Dad was coming home and I said soon, the way we do.', extras: ['Note for the family', 'Photo: 2 of us at dinner'] },
    { date: 'Tuesday', time: '4:18p', author: 'Sarah Reed', hue: 2, mood: 'difficult', text: 'Bad afternoon. She didn\'t know me for about ten minutes after her nap. I stayed quiet and just made tea. By the time the tea was ready she was back. Marking this so we can tell Dr. Patel.', extras: [] },
    { date: 'Tuesday', time: '9:30a', author: 'Maria Lopez', hue: 0, mood: 'good', text: 'Walked to the corner and back, twice. Ate all of breakfast. Liked the new lavender hand cream Anna left out. Smiled when I put it on her hands.', extras: [] },
    { date: 'Sunday', time: '8:00p', author: 'David H.', hue: 3, mood: 'crisis', text: 'Called the on-call line tonight. She was inconsolable for about 90 minutes. Lorazepam 0.5mg at 7:30, settled by 9. First crisis dose since March. Sarah, please look at the log when you come on.', extras: ['On-call: Dr. Patel ack 7:55p'] },
  ];

  return (
    <div className="cs-frame">
      <Rail active="journal" />
      <div className="cs-main">
        <TopBar
          title="Journal"
          crumb="Mom's record"
          action={<button className="btn btn-primary"><span>+</span> Write entry</button>}
        />
        <div className="cs-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
            <div className="col">
              {/* Compose */}
              <TintedCard title="Quick entry" meta="visible to family">
                <div style={{
                  border: '1px solid var(--border)', borderRadius: 12,
                  padding: 14, background: 'var(--surface)',
                }}>
                  <div className="secondary-text" style={{ fontSize: 14 }}>How is Mom right now? Write a sentence or two — anyone in the family can read it.</div>
                  <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
                    <span className="eyebrow" style={{ marginRight: 4 }}>Mood:</span>
                    {[
                      ['Good', 'badge-good', 'mood-good'],
                      ['Okay', 'badge-okay', 'mood-okay'],
                      ['Difficult', 'badge-difficult', 'mood-difficult'],
                      ['Crisis', 'badge-crisis', 'mood-crisis'],
                    ].map(([n, c]) => (
                      <span key={n} className={`badge ${c}`} style={{ cursor: 'pointer' }}>{n}</span>
                    ))}
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>Save entry</button>
                  </div>
                </div>
              </TintedCard>

              {/* Entries */}
              {entries.map((e, i) => (
                <div key={i} className="card">
                  <div className="card-header-tinted">
                    <Avatar name={e.author} size={28} hue={e.hue} />
                    <div>
                      <div className="title">{e.author}</div>
                      <div className="secondary-text" style={{ fontSize: 12 }}>{e.date} · {e.time}</div>
                    </div>
                    <span className={`badge badge-${e.mood}`} style={{ marginLeft: 'auto' }}>
                      <span className="dot"></span>{e.mood.charAt(0).toUpperCase() + e.mood.slice(1)}
                    </span>
                  </div>
                  <div className="card-body">
                    <div className={`mood-border-${e.mood}`} style={{ paddingLeft: 14 }}>
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{e.text}</p>
                      {e.extras.length > 0 && (
                        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: 'wrap' }}>
                          {e.extras.map(x => <span key={x} className="badge badge-neutral">{x}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="row" style={{ marginTop: 12, gap: 14, fontSize: 12.5, color: 'var(--muted)' }}>
                      <button className="btn btn-ghost btn-sm" style={{ height: 24, padding: '0 6px' }}>♡ 2</button>
                      <button className="btn btn-ghost btn-sm" style={{ height: 24, padding: '0 6px' }}>↩ Reply</button>
                      <button className="btn btn-ghost btn-sm" style={{ height: 24, padding: '0 6px' }}>★ Save for Dr. Patel</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right rail */}
            <div className="col">
              <TintedCard title="Mood, last 30 days">
                <svg viewBox="0 0 280 90" style={{ width: '100%', height: 90 }}>
                  {Array.from({ length: 30 }).map((_, i) => {
                    const moods = [3, 2, 1, 2, 2, 3, 1, 2, 2, 1, 3, 2, 3, 0, 1, 2, 2, 1, 1, 2, 3, 2, 2, 1, 2, 1, 0, 1, 2, 1];
                    const colors = ['var(--mood-good)','var(--mood-okay)','var(--mood-difficult)','var(--mood-crisis)'];
                    const m = moods[i];
                    return (
                      <rect key={i} x={i * 9 + 4} y={20 + m * 16} width={6} height={50 - m * 12} rx={2} fill={colors[m]} opacity={0.85} />
                    );
                  })}
                </svg>
                <div className="row" style={{ marginTop: 4, justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
                  <span className="mono">30d AGO</span>
                  <span className="mono">TODAY</span>
                </div>
              </TintedCard>

              <TintedCard title="Saved for Dr. Patel" meta="3 entries">
                <div className="col" style={{ gap: 10 }}>
                  {[
                    'Sun 8p crisis — lorazepam dose',
                    'Tue 4p — disorientation episode',
                    'Apr 19 — sundowning, 90 min',
                  ].map(t => (
                    <div key={t} style={{ fontSize: 13, color: 'var(--text-primary)' }}>★ {t}</div>
                  ))}
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 4 }}>Compile for Friday's visit →</button>
                </div>
              </TintedCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ScreenJournal = ScreenJournal;


// === screen-shifts.jsx ===
// Screen 5 — Shifts / Handoff
const ScreenShifts = () => {
  return (
    <div className="cs-frame">
      <Rail active="shifts" />
      <div className="cs-main">
        <TopBar
          title="Shifts &amp; handoff"
          crumb="Care team"
          action={<button className="btn btn-primary"><span>+</span> New shift</button>}
        />
        <div className="cs-body">
          <div className="col">
            {/* Live handoff banner */}
            <div className="card" style={{ background: 'var(--app-shell)', color: 'var(--app-shell-text)', boxShadow: 'none' }}>
              <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 24 }}>
                <div>
                  <div className="eyebrow" style={{ color: 'var(--app-shell-muted)' }}>Handoff in 38 minutes · 8:00a</div>
                  <div className="headline-display" style={{ fontSize: 26, color: 'var(--app-shell-text)', marginTop: 6 }}>
                    <em style={{ color: 'var(--primary-light)' }}>Sarah</em> is handing off to <em style={{ color: 'var(--primary-light)' }}>you</em>.
                  </div>
                  <div style={{ marginTop: 12, color: 'var(--app-shell-muted)', fontSize: 13.5 }}>
                    Three doses missed overnight, one hard wake at 2a. Sarah's left a 5-min voice note.
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-outline" style={{ background: 'transparent', color: 'var(--app-shell-text)', border: '1px solid rgba(196,181,253,0.25)' }}>
                    ▶ Voice note 5:12
                  </button>
                  <button className="btn btn-primary">Read summary →</button>
                </div>
              </div>
            </div>

            {/* Schedule grid */}
            <TintedCard title="This week" meta="Apr 27 – May 3" action={<button className="btn btn-ghost btn-sm">Month view</button>}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(7, 1fr)', gap: 0, fontSize: 12 }}>
                <div></div>
                {['Mon 27','Tue 28','Wed 29','Thu 30','Fri 1','Sat 2','Sun 3'].map((d, i) => (
                  <div key={d} className="mono" style={{ padding: '6px 8px', color: i === 2 ? 'var(--primary)' : 'var(--muted)', fontWeight: i === 2 ? 600 : 400, borderBottom: '1px solid var(--border)' }}>{d}</div>
                ))}
                {['Day 8a–2p','Aft 2p–6p','Eve 6p–10p','Night 10p–8a'].map((band, r) => (
                  <React.Fragment key={band}>
                    <div className="mono" style={{ padding: '12px 8px', color: 'var(--muted)', alignSelf: 'center' }}>{band}</div>
                    {Array.from({ length: 7 }).map((_, c) => {
                      // dummy assignments
                      const grid = [
                        ['Anna','Anna','Anna','Anna','Anna','David','You'],
                        ['Maria','Maria','Maria','—','Maria','Maria','—'],
                        ['Anna','Anna','Anna','Anna','Anna','David','David'],
                        ['Sarah','Sarah','Sarah','David','Sarah','Sarah','Sarah'],
                      ];
                      const who = grid[r][c];
                      const isOpen = who === '—';
                      const today = c === 2;
                      const liveNow = today && r === 0; // current band
                      return (
                        <div key={c} style={{
                          padding: 8,
                          borderBottom: '1px solid var(--border)',
                          borderLeft: c === 0 ? '1px solid var(--border)' : 0,
                          background: liveNow ? 'var(--primary-subtle)' : today ? 'rgba(124,58,237,0.04)' : 'transparent',
                        }}>
                          {isOpen ? (
                            <div style={{
                              padding: '6px 8px',
                              borderRadius: 8,
                              border: '1px dashed var(--secondary-light)',
                              color: 'var(--secondary)',
                              fontSize: 12,
                              textAlign: 'center',
                            }}>Open · cover?</div>
                          ) : (
                            <div className="row" style={{ gap: 6 }}>
                              <Avatar name={who} size={20} hue={who === 'Anna' ? 1 : who === 'Sarah' ? 2 : who === 'Maria' ? 0 : 3} />
                              <span style={{ fontSize: 12.5, fontWeight: liveNow ? 600 : 400 }}>{who}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </TintedCard>

            {/* Handoff card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <TintedCard title="Last night, in 3 lines" meta="from Sarah · 5:48a">
                <div className="col" style={{ gap: 10 }}>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span className="badge badge-difficult" style={{ marginTop: 2 }}>1</span>
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                      Up at 11p, 2a, 4a. The 2a was the hard one — didn't recognize Sarah, asked for Dad.
                    </div>
                  </div>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span className="badge badge-amber" style={{ marginTop: 2 }}>2</span>
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                      Refused 9p donepezil and 10p calcium. Sarah didn't push it. Catch up donepezil with breakfast.
                    </div>
                  </div>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span className="badge badge-good" style={{ marginTop: 2 }}>3</span>
                    <div style={{ fontSize: 14, lineHeight: 1.55 }}>
                      No falls, no bathroom issues. She's sleeping now — let her go until she wakes.
                    </div>
                  </div>
                </div>
              </TintedCard>

              <TintedCard title="Open shifts this week" meta="2 open · cover needed">
                <div className="col" style={{ gap: 10 }}>
                  {[
                    { day: 'Thu Apr 30', band: 'Aft 2p–6p', need: 'Maria swapped to evening' },
                    { day: 'Sun May 3', band: 'Aft 2p–6p', need: 'No coverage assigned' },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: 12,
                      border: '1px dashed var(--secondary-light)',
                      borderRadius: 12,
                      background: 'var(--secondary-subtle)',
                    }}>
                      <div className="row">
                        <div className="mono" style={{ color: 'var(--secondary)' }}>{s.day} · {s.band}</div>
                        <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>Cover this</button>
                      </div>
                      <div className="secondary-text" style={{ fontSize: 12.5, marginTop: 4 }}>{s.need}</div>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>Ask the family →</button>
                </div>
              </TintedCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.ScreenShifts = ScreenShifts;


// === screen-profile.jsx ===
// Screen 6 — Recipient Profile (Mom's profile)
const ScreenProfile = () => (
  <div className="cs-frame">
    <Rail active="profile" />
    <div className="cs-main">
      <TopBar
        title="Margaret Hoffman"
        crumb="Care recipient"
        action={<button className="btn btn-outline">Edit</button>}
      />
      <div className="cs-body" style={{ padding: 0 }}>
        {/* Hero */}
        <div style={{
          padding: '40px 48px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, var(--primary-subtle), var(--surface) 90%)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: 28, alignItems: 'center' }}>
            <div className="cs-avatar" style={{
              width: 140, height: 140, fontSize: 56,
              borderRadius: 24,
              background: 'linear-gradient(135deg, var(--primary-light), var(--primary))',
              boxShadow: '0 1px 2px rgba(30,10,60,0.08)',
            }}>M</div>
            <div>
              <Eyebrow>Mom · 82 · she/her</Eyebrow>
              <div className="headline-display" style={{ fontSize: 40, marginTop: 8 }}>
                Margaret <em>"Maggie"</em> Hoffman
              </div>
              <div className="row" style={{ marginTop: 14, gap: 18, color: 'var(--text-secondary)', fontSize: 13.5, flexWrap: 'wrap' }}>
                <span><strong style={{ color: 'var(--text-primary)' }}>Lives at home</strong> · Boulder, CO</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>Diagnosis: <strong style={{ color: 'var(--text-primary)' }}>Alzheimer's, moderate</strong></span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span>Primary: <strong style={{ color: 'var(--text-primary)' }}>Anna (you)</strong></span>
              </div>
            </div>
            <div className="col" style={{ gap: 8, alignItems: 'flex-end' }}>
              <button className="btn btn-primary"><span>↗</span> Share with provider</button>
              <button className="btn btn-outline">Print one-pager</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 48px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
            <div className="col">
              {/* Who she is */}
              <TintedCard title="Who she is" meta="Family-written">
                <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                  Maggie taught third grade in Boulder for 32 years. Reads two novels a week, used to.
                  Loves the cabin in Estes Park, anything with rhubarb, and her cat Pickles.
                  Doesn't like being talked down to, fluorescent lights, or having her hair brushed by anyone but family.
                  Best between 9a and 1p. After 6p the world gets smaller for her.
                </div>
                <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
                  {['Quiet rooms','Rhubarb pie','Old jazz','Pickles the cat','Cabin photos','Lavender hand cream'].map(t => (
                    <span key={t} className="badge badge-coral">{t}</span>
                  ))}
                </div>
              </TintedCard>

              {/* What works / what doesn't */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <TintedCard title="What helps">
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {[
                      'Sit beside her, not across',
                      'Use Dad\'s name; she settles',
                      'Tea before any hard topic',
                      'Photographs from the cabin',
                    ].map(x => (
                      <li key={x} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
                        <span style={{ color: 'var(--mood-good)', marginRight: 8 }}>✓</span>{x}
                      </li>
                    ))}
                  </ul>
                </TintedCard>
                <TintedCard title="What doesn't">
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {[
                      'Bright overhead light at night',
                      'Being asked the date',
                      'Loud TV during meals',
                      'Hair brushed by non-family',
                    ].map(x => (
                      <li key={x} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13.5 }}>
                        <span style={{ color: 'var(--mood-difficult)', marginRight: 8 }}>✕</span>{x}
                      </li>
                    ))}
                  </ul>
                </TintedCard>
              </div>

              {/* Conditions */}
              <TintedCard title="Health summary" meta="for Dr. Patel" action={<button className="btn btn-ghost btn-sm">Compile →</button>}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <Eyebrow>Conditions</Eyebrow>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                      <li>Alzheimer's disease (2022)</li>
                      <li>Hypothyroidism</li>
                      <li>Hypertension</li>
                      <li>Mild osteoporosis</li>
                    </ul>
                  </div>
                  <div>
                    <Eyebrow>Allergies</Eyebrow>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                      <li>Penicillin (rash)</li>
                      <li>Shellfish</li>
                    </ul>
                  </div>
                </div>
              </TintedCard>
            </div>

            <div className="col">
              {/* Care team */}
              <TintedCard title="Care team" meta="6 people">
                <div className="col" style={{ gap: 0 }}>
                  {[
                    { n: 'Anna Hoffman', r: 'Daughter · primary caregiver', tag: 'You', hue: 1 },
                    { n: 'Sarah Reed', r: 'Sister · overnights', tag: 'Family', hue: 2 },
                    { n: 'David Hoffman', r: 'Brother · supports', tag: 'Family', hue: 3 },
                    { n: 'Maria Lopez', r: 'Paid aide · 4 afternoons/wk', tag: 'Aide', hue: 0 },
                    { n: 'Dr. Reena Patel', r: 'Neurology · Boulder Med', tag: 'Clinician', hue: 4 },
                    { n: 'Marcus Webb, PT', r: 'In-home physical therapy', tag: 'Clinician', hue: 0 },
                  ].map((p, i) => (
                    <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.n} size={32} hue={p.hue} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13.5 }}>{p.n}</div>
                        <div className="secondary-text" style={{ fontSize: 12 }}>{p.r}</div>
                      </div>
                      <span className="badge badge-neutral">{p.tag}</span>
                    </div>
                  ))}
                </div>
              </TintedCard>

              {/* Documents */}
              <TintedCard title="Documents" meta="4 files">
                <div className="col" style={{ gap: 8 }}>
                  {[
                    ['Advance directive', 'PDF · signed Mar 2023'],
                    ['Insurance card', 'Image · updated Jan'],
                    ['Med list (current)', 'Auto-generated'],
                    ['Dr. Patel notes (last 3 visits)', 'PDF · 11 pages'],
                  ].map(([t, m]) => (
                    <div key={t} className="row" style={{ padding: 8, borderRadius: 10, background: 'var(--surface-muted)' }}>
                      <span style={{ width: 24, color: 'var(--primary)' }}>▦</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t}</div>
                        <div className="secondary-text" style={{ fontSize: 11.5 }}>{m}</div>
                      </div>
                      <span className="mono" style={{ color: 'var(--muted)' }}>↓</span>
                    </div>
                  ))}
                </div>
              </TintedCard>

              {/* Emergency */}
              <div className="card" style={{ background: 'var(--danger-subtle)' }}>
                <div className="card-body">
                  <Eyebrow color="var(--danger)">In an emergency</Eyebrow>
                  <div className="col" style={{ gap: 4, marginTop: 8 }}>
                    <div style={{ fontSize: 13.5 }}><strong>Dr. Reena Patel</strong> · 303 555 0148</div>
                    <div style={{ fontSize: 13.5 }}><strong>Boulder Med after-hours</strong> · 303 555 0199</div>
                    <div style={{ fontSize: 13.5 }}><strong>Power of attorney:</strong> Anna Hoffman</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

window.ScreenProfile = ScreenProfile;


// === screen-marketing.jsx ===
// Screen 7 — Marketing landing page (bolder reinterpretation)
const ScreenMarketing = () => (
  <div className="marketing-surface">
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 48px 80px' }}>
      {/* Nav */}
      <div className="row" style={{ padding: '8px 0 32px' }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="cs-rail-brand-mark">c</div>
          <div className="cs-rail-brand-name">CareSync</div>
        </div>
        <div className="row" style={{ marginLeft: 40, gap: 22, fontSize: 13.5, color: 'var(--text-secondary)' }}>
          <span>How it works</span>
          <span>For families</span>
          <span>For aides</span>
          <span>Pricing</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <button className="btn btn-ghost">Sign in</button>
          <button className="btn btn-primary">Start free</button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center', padding: '32px 0 56px' }}>
        <div>
          <Eyebrow>$14/mo · whole family · cancel anytime</Eyebrow>
          <h1 className="headline-display" style={{ fontSize: 'clamp(2.4rem, 3.4vw + 1rem, 4rem)', margin: '14px 0 24px' }}>
            One place for the family <em>caring</em> for someone, together.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--text-secondary)', maxWidth: 520, margin: 0 }}>
            CareSync replaces the group chat, the shared note, the calendar invites, and the things you keep meaning to write down.
            Built for the exhausted Tuesday at 11pm, not the boardroom.
          </p>
          <div className="row" style={{ marginTop: 28, gap: 10 }}>
            <button className="btn btn-primary btn-lg">Start free for 14 days</button>
            <button className="btn btn-outline btn-lg">See a sample brief</button>
          </div>
          <div className="row" style={{ marginTop: 22, gap: 12, color: 'var(--muted)', fontSize: 12.5 }}>
            <span>WCAG 2.2 AA</span><span>·</span><span>HIPAA-ready</span><span>·</span><span>No ads, ever</span>
          </div>
        </div>

        {/* Editorial card mockup */}
        <div style={{
          padding: 24, borderRadius: 24, background: 'var(--surface)',
          boxShadow: '0 0 0 1px rgba(30,10,60,0.10), 0 30px 60px -20px rgba(30,10,60,0.18)',
          transform: 'rotate(-0.5deg)',
        }}>
          <Eyebrow>Today's brief · Wednesday, Apr 29 · 7:02a</Eyebrow>
          <div className="headline-display" style={{ fontSize: 26, marginTop: 10 }}>
            Mom slept <em>poorly</em>. Three med doses <em>missed</em> in the gap between Sarah and you.
          </div>
          <div className="hairline" style={{ borderRadius: 12, padding: 12, marginTop: 16, background: 'var(--primary-subtle)', borderColor: 'transparent' }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ width: 22, color: 'var(--primary)' }}>℞</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Donepezil 10mg — catch up after breakfast</div>
                <div className="secondary-text" style={{ fontSize: 12.5 }}>Missed at 9p, 10p, 6a</div>
              </div>
              <span className="badge badge-amber">Catch up</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <Avatar name="Sarah Reed" size={26} hue={2} />
            <div className="secondary-text" style={{ fontSize: 12.5 }}>From Sarah's overnight log, 5:48a</div>
          </div>
        </div>
      </div>

      {/* Three quiet promises */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, padding: '40px 0' }}>
        {[
          { t: 'A morning brief, not a dashboard', d: 'One paragraph that tells you what happened overnight and what needs your attention. Not 47 widgets.' },
          { t: 'A timeline a doctor will respect', d: 'Every dose, mood, and visit is logged once and shows up in the right place. Print before any appointment.' },
          { t: 'Handoffs that actually happen', d: 'When the next person comes on shift, they get a 3-line summary and a voice note. No more midnight texts.' },
        ].map(c => (
          <div key={c.t} className="card">
            <div className="card-body">
              <div style={{ fontSize: 17, fontWeight: 600, fontFamily: 'Fraunces, Georgia, serif', letterSpacing: '-0.01em' }}>{c.t}</div>
              <div className="secondary-text" style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>{c.d}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pull quote */}
      <div style={{
        padding: '48px 36px', margin: '24px 0',
        borderRadius: 24,
        background: 'var(--ink)',
        color: 'var(--app-shell-text)',
      }}>
        <div className="eyebrow" style={{ color: 'var(--app-shell-muted)' }}>From a beta family · Boulder, CO</div>
        <div className="headline-display" style={{
          fontSize: 'clamp(1.6rem, 2vw + 0.5rem, 2.4rem)',
          color: 'var(--app-shell-text)', marginTop: 14, maxWidth: 880,
        }}>
          The first morning the brief said <em style={{ color: 'var(--primary-light)' }}>"Mom slept well"</em>, I cried at the kitchen table.
          Someone else was paying attention with me.
        </div>
        <div style={{ marginTop: 20, color: 'var(--app-shell-muted)', fontSize: 13.5 }}>
          — Anna H., daughter, primary caregiver to her mother
        </div>
      </div>

      {/* Pricing strip */}
      <div className="row" style={{ padding: '24px 0', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="headline-display" style={{ fontSize: 28 }}>$14<span style={{ color: 'var(--muted)', fontSize: 16 }}> / month</span></div>
          <div className="secondary-text" style={{ fontSize: 13.5 }}>Whole family, unlimited members. First 14 days free.</div>
        </div>
        <button className="btn btn-primary btn-lg">Start free for 14 days</button>
      </div>
    </div>
  </div>
);

window.ScreenMarketing = ScreenMarketing;


