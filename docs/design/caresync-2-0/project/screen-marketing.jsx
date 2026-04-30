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
