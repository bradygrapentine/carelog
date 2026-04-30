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
