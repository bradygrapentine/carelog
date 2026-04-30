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
