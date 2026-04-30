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
              background: 'linear-gradient(135deg, #f08e76, #d97706)',
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
