// proto-brief.jsx — Daily Brief, interactive

const ProtoBrief = ({ state, dispatch, tone, tweaks, onNav }) => {
  const t = tweaks || {};
  const items = [
    { id: 'donepezil', icon: '℘', label: 'Donepezil 10mg', sub: 'Missed at 9p, 10p, 6a · last taken yesterday 7a', tag: 'Catch up after breakfast', tagClass: 'badge-amber', goto: 'meds' },
    { id: 'patel',     icon: '☎', label: 'Dr. Patel — return call', sub: "Left voicemail 4:18p yesterday about Friday's neuro f/u", tag: 'Office opens 8:30a', tagClass: 'badge-violet' },
    { id: 'aide',      icon: '◔', label: 'Aide schedule confirmation', sub: "Maria switched Thursday to evening · needs Sarah's nod", tag: 'Awaiting Sarah', tagClass: 'badge-neutral', goto: 'shifts' },
  ].filter(it => !state.dismissed.includes(it.id));

  // ─── Headline by tone × style ───────────────────────────────────
  const Em = t.briefHeadlineWeight === 'italic' ? 'em' : 'strong';
  const headline = (() => {
    const style = t.briefHeadline || 'emphasized';
    if (tone === 'clinical') {
      if (style === 'data') return <><Em>4h 20m sleep</Em>, 3 wakes. <Em>3 doses missed</Em> in 21:00–06:00 window.</>;
      if (style === 'plain') return <>Sleep disrupted (4h 20m, 3 wakes). 3 doses missed between 21:00 and 06:00 handoff.</>;
      return <>Sleep <Em>disrupted</Em> (4h 20m, 3 wakes). <Em>3 doses missed</Em> between 21:00–06:00 handoff window.</>;
    }
    if (tone === 'steady') {
      if (style === 'data') return <><Em>4h 20m of sleep</Em>, woke 3 times. <Em>Three medication doses</Em> missed overnight.</>;
      if (style === 'plain') return <>Margaret had a rough night. Three medication doses were missed between Sarah’s shift and yours.</>;
      return <>Margaret had a <Em>rough night</Em>. Three medication doses were <Em>missed</Em> between Sarah’s shift and yours.</>;
    }
    // warm
    if (style === 'data') return <><Em>4 hours, 20 minutes</Em> of sleep. <Em>Three doses</Em> went by while we were both asleep.</>;
    if (style === 'plain') return <>Mom slept poorly. Three med doses were missed in the gap between Sarah’s shift and yours.</>;
    return <>Mom slept <Em>poorly</Em>. Three med doses <Em>missed</Em> in the gap between Sarah’s shift and yours.</>;
  })();

  // Sarah's note copy
  const sarahNote = tone === 'clinical'
    ? "Pt. awake x4 overnight. Disoriented at 02:00, calling for deceased spouse. Settled w/ presence ~20 min, no fall risk. Refused 21:00 donepezil and 22:00 calcium. BMs WNL. Currently sleeping; do not wake."
    : tone === 'steady'
    ? "Awake four times overnight. At 2a she was disoriented and asked for her husband; sitting with her settled it in about 20 minutes. No falls. She refused the 9p donepezil and the 10p calcium — I didn’t push. Bowels normal. She’s asleep now; let her rest."
    : "Up four times. She didn’t recognize me at 2a, asked for Dad. I sat with her until she settled, about 20 minutes. No falls. Refused the 9p donepezil and the 10p calcium; I didn’t push it. Bowels normal. She’s asleep now, finally — let her go until she wakes on her own.";

  // ─── Sarah's note variants ──────────────────────────────────────
  const sarahVariant = t.briefSarah || 'indented';
  const sarahMetaRow = (
    <div className="row" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted)' }}>
      <span className="mono">SLEEP 4h 20m</span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span className="mono">3 WAKES</span>
      <span style={{ color: 'var(--border)' }}>·</span>
      <span className="mono">2 REFUSED DOSES</span>
    </div>
  );
  let sarahCard;
  if (sarahVariant === 'list') {
    const bullets = [
      ['Wakes', '4 (worst at 2a)'],
      ['Disorientation', 'asked for husband; settled in ~20 min'],
      ['Refused', 'donepezil 9p, calcium 10p'],
      ['Falls', 'none'],
      ['Bowels', 'normal'],
      ['Status', 'sleeping; do not wake'],
    ];
    sarahCard = (
      <PCard title="Overnight notes — Sarah" meta="written 5:48a" action={<span className="badge badge-difficult"><span className="dot"></span>Difficult</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6, columnGap: 16, fontSize: 13.5 }}>
          {bullets.map(([k, v], i) => (
            <React.Fragment key={i}>
              <div className="mono" style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', alignSelf: 'center' }}>{k}</div>
              <div style={{ borderTop: i ? '1px solid var(--border)' : 0, padding: i ? '8px 0 0' : '0' }}>{v}</div>
            </React.Fragment>
          ))}
        </div>
      </PCard>
    );
  } else if (sarahVariant === 'card') {
    sarahCard = (
      <div className="card" style={{ background: 'var(--surface-muted)', padding: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <PAvatar name="Sarah Reed" size={36} hue={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Sarah Reed</div>
            <div className="secondary-text" style={{ fontSize: 12 }}>Overnight · written 5:48a</div>
          </div>
          <span className="badge badge-difficult"><span className="dot"></span>Difficult</span>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, fontFamily: 'var(--font-display, Fraunces, serif)', fontStyle: 'italic' }}>
          {'“'}{sarahNote}{'”'}
        </p>
        {sarahMetaRow}
      </div>
    );
  } else {
    sarahCard = (
      <PCard title="The night, in Sarah’s words" meta="written 5:48a" action={<span className="badge badge-difficult"><span className="dot"></span>Difficult</span>}>
        <div className="mood-border-difficult" style={{ paddingLeft: 14 }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{sarahNote}</p>
          {sarahMetaRow}
        </div>
      </PCard>
    );
  }

  // ─── Pattern variants ───────────────────────────────────────────
  const sleepHours = [6.5, 6.0, 5.2, 3.5, 3.2, 2.6, 4.3];
  const sleepLabels = ['Th','Fr','Sa','Su','Mo','Tu','We'];
  const patternVariant = t.briefPattern || 'bars';
  // Sparkline render helper
  const renderSpark = (W = 280, H = 70) => {
    const max = 7, min = 0;
    const points = sleepHours.map((v, i) => {
      const x = (i / (sleepHours.length - 1)) * (W - 12) + 6;
      const y = H - ((v - min) / (max - min)) * (H - 18) - 12;
      return [x, y];
    });
    const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
    // Soft area under line
    const areaPath = path + ` L${points[points.length - 1][0]},${H - 12} L${points[0][0]},${H - 12} Z`;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, marginTop: 14 }}>
        <path d={areaPath} fill="var(--secondary-subtle)" opacity="0.7" />
        <path d={path} fill="none" stroke="var(--secondary)" strokeWidth="2" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i >= 3 ? 3.5 : 2.5} fill={i >= 3 ? 'var(--secondary)' : 'var(--primary)'} />
        ))}
        {sleepLabels.map((l, i) => {
          const x = (i / (sleepLabels.length - 1)) * (W - 12) + 6;
          return <text key={i} x={x} y={H - 1} textAnchor="middle" fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--muted)">{l}</text>;
        })}
      </svg>
    );
  };
  let patternViz;
  if (patternVariant === 'spark-plus') {
    patternViz = (
      <>
        {renderSpark(280, 80)}
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 0 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Last 4 nights</div>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 2, color: 'var(--secondary)' }}>3.4h <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>avg</span></div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Before</div>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 2, color: 'var(--text-secondary)' }}>5.9h <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>avg</span></div>
          </div>
        </div>
      </>
    );
  } else if (patternVariant === 'spark') {
    patternViz = renderSpark(280, 70);
  } else if (patternVariant === 'words') {
    patternViz = (
      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>This week</div>
          <div className="headline-display" style={{ fontSize: 32, lineHeight: 1, marginTop: 4 }}>3.4h</div>
          <div className="secondary-text" style={{ fontSize: 12 }}>avg sleep, last 4 nights</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Two weeks ago</div>
          <div className="headline-display" style={{ fontSize: 32, lineHeight: 1, marginTop: 4, color: 'var(--text-secondary)' }}>5.9h</div>
          <div className="secondary-text" style={{ fontSize: 12 }}>before schedule change</div>
        </div>
      </div>
    );
  } else {
    patternViz = (
      <svg viewBox="0 0 280 70" style={{ width: '100%', height: 70, marginTop: 14 }}>
        {[0,1,2,3,4,5,6].map(i => {
          const heights = [60, 55, 48, 30, 28, 22, 25];
          const x = i * 40 + 6;
          const h = heights[i];
          const isWorse = i >= 3;
          return (
            <g key={i}>
              <rect x={x} y={70 - h} width={28} height={h} rx={4} fill={isWorse ? 'var(--secondary)' : 'var(--primary-subtle)'} />
              <text x={x + 14} y={66} textAnchor="middle" fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--muted)">
                {sleepLabels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  // ─── Agenda variants ────────────────────────────────────────────
  const agenda = [
    { time: '8:00a', evt: 'Handoff with Sarah', sub: 'Right here · 10 min', who: 'Sarah → You', goto: 'shifts' },
    { time: '10:30a', evt: 'PT — Marcus (in-home)', sub: 'Knee strengthening, 45 min', who: 'Confirmed' },
    { time: '12:00p', evt: 'Lunch + lorazepam if needed', sub: 'Use only if agitated', who: 'PRN', goto: 'meds' },
    { time: '2:00p', evt: 'Maria arrives', sub: 'Aide · until 6p', who: 'Confirmed' },
    { time: '5:30p', evt: 'Family group call', sub: 'You, David, Joanne · weekly', who: '3 people' },
  ];
  const agendaVariant = t.briefAgenda || 'rows';
  let agendaBody;
  if (agendaVariant === 'blocks') {
    agendaBody = (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {agenda.map((row, i) => (
          <div key={i}
            onClick={() => row.goto && onNav(row.goto)}
            className="hairline"
            style={{ padding: 12, borderRadius: 10, cursor: row.goto ? 'pointer' : 'default' }}>
            <div className="mono" style={{ color: 'var(--primary)', fontSize: 11, textTransform: 'uppercase' }}>{row.time}</div>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 4 }}>{row.evt}</div>
            <div className="secondary-text" style={{ fontSize: 12 }}>{row.sub}</div>
          </div>
        ))}
      </div>
    );
  } else if (agendaVariant === 'minimal') {
    agendaBody = (
      <div className="col" style={{ gap: 6 }}>
        {agenda.map((row, i) => (
          <div key={i}
            onClick={() => row.goto && onNav(row.goto)}
            style={{ display: 'flex', gap: 16, padding: '4px 0', cursor: row.goto ? 'pointer' : 'default', fontSize: 13.5 }}>
            <span className="mono" style={{ color: 'var(--muted)', minWidth: 60 }}>{row.time}</span>
            <span>{row.evt}</span>
          </div>
        ))}
      </div>
    );
  } else {
    agendaBody = (
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', columnGap: 16 }}>
        {agenda.map((row, i) => (
          <React.Fragment key={i}>
            <div className="mono" style={{ color: 'var(--muted)', padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0 }}>{row.time}</div>
            <div onClick={() => row.goto && onNav(row.goto)} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0, cursor: row.goto ? 'pointer' : 'default' }}>
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{row.evt}</div>
              <div className="secondary-text" style={{ fontSize: 12.5 }}>{row.sub}</div>
            </div>
            <div style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0, color: 'var(--text-secondary)', fontSize: 12.5, alignSelf: 'center' }}>{row.who}</div>
          </React.Fragment>
        ))}
      </div>
    );
  }

  // ─── Width ──────────────────────────────────────────────────────
  const width = t.briefWidth || 'editorial';
  const heroPadding = width === 'editorial' ? '40px 56px 32px' : (width === 'standard' ? '28px 40px 24px' : '24px 32px 20px');
  const heroMaxW = width === 'editorial' ? 880 : (width === 'standard' ? 740 : 620);
  const bodyPadding = width === 'editorial' ? '0 56px 56px' : (width === 'standard' ? '0 40px 40px' : '0 32px 32px');
  const showSidebar = t.briefShowShift || t.briefShowPattern;

  return (
    <div className="cs-frame">
      <PRail active="brief" onNavigate={onNav} attentionCount={items.length} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar
          title="Daily brief"
          crumb="Today"
          action={<button className="btn btn-outline"><span>↻</span> Refresh</button>}
        />
        <div className="cs-body" style={{ padding: 0 }}>
          <div style={{ padding: heroPadding, maxWidth: heroMaxW }}>
            <PEyebrow>Today’s brief · auto-generated 7:02a · Wednesday, Apr 29</PEyebrow>
            <h1 className="headline-display" style={{
              fontSize: width === 'editorial' ? 'clamp(2rem, 2.4vw + 1rem, 2.75rem)' : (width === 'standard' ? '2rem' : '1.7rem'),
              margin: '14px 0 0',
            }}>
              {headline}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 22, color: 'var(--text-secondary)', fontSize: 14 }}>
              <PAvatar name="Sarah Reed" size={28} hue={2} />
              <span>Sarah was on 6p–6a · handing off to <strong style={{ color: 'var(--text-primary)' }}>you</strong> at 8a</span>
            </div>
          </div>

          <div style={{
            padding: bodyPadding,
            display: 'grid',
            gridTemplateColumns: showSidebar ? '1fr 320px' : '1fr',
            gap: 24,
            alignItems: 'start',
            maxWidth: showSidebar ? 'none' : (heroMaxW + 100),
          }}>
            <div className="col">
              <PCard title="What needs your attention this morning" meta={`${items.length} item${items.length === 1 ? '' : 's'}`}>
                {items.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)' }}>
                    <div style={{ fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18, fontStyle: 'italic', color: 'var(--text-secondary)' }}>All clear.</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>Nothing else needs you right now.</div>
                  </div>
                ) : (
                  <div className="col" style={{ gap: 0 }}>
                    {items.map((it, i) => (
                      <div key={it.id} style={{
                        padding: '12px 0',
                        borderTop: i ? '1px solid var(--border)' : 0,
                        display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: 'var(--primary-subtle)', color: 'var(--primary)',
                          display: 'grid', placeItems: 'center', fontSize: 14,
                        }}>{it.icon}</div>
                        <div onClick={() => it.goto && onNav(it.goto)} style={{ cursor: it.goto ? 'pointer' : 'default' }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{it.label}</div>
                          <div className="secondary-text" style={{ fontSize: 12.5 }}>{it.sub}</div>
                        </div>
                        <span className={`badge ${it.tagClass}`}>{it.tag}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Mark resolved"
                          onClick={() => dispatch({ type: 'dismiss', id: it.id })}
                          style={{ padding: '0 8px' }}
                        >✓</button>
                      </div>
                    ))}
                  </div>
                )}
              </PCard>

              {sarahCard}

              <PCard title="Coming up today" meta="Wed Apr 29">
                {agendaBody}
              </PCard>
            </div>

            {showSidebar && (
              <div className="col">
                {t.briefShowPattern && (
                  <div className="card">
                    <div className="card-header-tinted" style={{ background: 'var(--secondary-subtle)' }}>
                      <div className="title">Pattern this week</div>
                      <span className="badge badge-amber">Worth noting</span>
                    </div>
                    <div className="card-body">
                      <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                        Sleep got worse on the 3 nights after the new donepezil schedule started. Worth raising with Dr. Patel on Friday.
                      </div>
                      {patternViz}
                      <div className="row" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
                        <span className="mono">HOURS SLEPT · LAST 7 NIGHTS</span>
                      </div>
                    </div>
                  </div>
                )}

                {t.briefShowShift && (
                  <PCard title="On shift now" padding="8px 0">
                    {[
                      { name: 'Sarah Reed', role: 'Sister · overnight', status: 'Off in 58 min', hue: 2 },
                      { name: 'You (Anna)', role: 'Primary · daytime', status: 'Starts 8:00a', hue: 1 },
                      { name: 'Maria Lopez', role: 'Paid aide · afternoon', status: '2:00p–6:00p', hue: 0 },
                      { name: 'David Hoffman', role: 'Brother · supporting', status: 'Joining 5:30p call', hue: 3 },
                    ].map((p, i) => (
                      <div key={i} style={{
                        padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 0,
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <PAvatar name={p.name} size={32} hue={p.hue} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                          <div className="secondary-text" style={{ fontSize: 12 }}>{p.role}</div>
                        </div>
                        <div className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{p.status}</div>
                      </div>
                    ))}
                  </PCard>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

window.ProtoBrief = ProtoBrief;
