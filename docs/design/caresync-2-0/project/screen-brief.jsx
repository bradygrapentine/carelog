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
