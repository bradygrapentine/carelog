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
