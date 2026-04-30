// proto-rest.jsx — Meds, Shifts, Journal, Profile screens

// ─── Meds ──────────────────────────────────────────────
const ProtoMeds = ({ state, dispatch, tweaks, onNav }) => {
  const t = tweaks || {};
  const attentionStyle = t.medsAttentionStyle || 'hero';
  const layout = t.medsListLayout || 'rows';
  const groupBy = t.medsGroupBy || 'none';
  const scheduleViz = t.medsScheduleViz || 'day-strip';
  const glyphStyle = t.medsRxGlyph || 'serif-rx';
  const statusStyle = t.medsStatusStyle || 'badge';
  const showSchedule = t.medsShowSchedule !== false;
  const showAdherence = t.medsShowAdherence !== false;

  const meds = [
    { id: 'donepezil', name: 'Donepezil', dose: '10 mg', schedule: '9:00 PM (changed Apr 22)', forCond: 'Memory care', times: [21], status: state.donepezilTaken ? 'on-track' : 'overdue', last: state.donepezilTaken ? 'Today, 9:02a (catch-up)' : 'Yesterday, 7:14a', missed: state.donepezilTaken ? 0 : 3, adherence: state.donepezilTaken ? 86 : 64 },
    { id: 'levo', name: 'Levothyroxine', dose: '50 mcg', schedule: '7:00 AM, empty stomach', forCond: 'Thyroid', times: [7], status: 'on-track', last: 'Today, 7:15a', missed: 0, adherence: 98 },
    { id: 'metop', name: 'Metoprolol', dose: '25 mg', schedule: '8a / 8p', forCond: 'Heart rate', times: [8, 20], status: 'on-track', last: 'Today, 8:02a', missed: 0, adherence: 95 },
    { id: 'cal', name: 'Calcium + D3', dose: '600 mg', schedule: '10:00 PM', forCond: 'Bone density', times: [22], status: 'watch', last: 'Yesterday, refused', missed: 1, adherence: 78 },
    { id: 'lor', name: 'Lorazepam', dose: '0.5 mg', schedule: 'PRN — agitation', forCond: 'Anxiety', times: [], status: 'prn', last: 'Apr 22, 3:40p', missed: 0, adherence: null },
  ];

  const statusColor = { 'on-track': 'var(--mood-good)', 'overdue': 'var(--mood-difficult)', 'watch': 'var(--secondary)', 'prn': 'var(--tertiary)' };
  const statusText  = { 'on-track': 'On track', 'overdue': 'Overdue · 3 missed', 'watch': 'Watch', 'prn': 'PRN' };
  const statusBadge = (m) => {
    if (statusStyle === 'dot') return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor[m.status] }}></span>
        {statusText[m.status]}
      </div>
    );
    if (statusStyle === 'bar') {
      const a = m.adherence;
      if (a === null) return <span className="badge badge-violet">PRN</span>;
      const color = a >= 90 ? 'var(--mood-good)' : a >= 75 ? 'var(--secondary)' : 'var(--mood-difficult)';
      return (
        <div style={{ minWidth: 90 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{a}% · 30d</div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-muted)', overflow: 'hidden' }}>
            <div style={{ width: `${a}%`, height: '100%', background: color }}></div>
          </div>
        </div>
      );
    }
    // badge
    const cls = m.status === 'on-track' ? 'badge-good' : m.status === 'overdue' ? 'badge-difficult' : m.status === 'watch' ? 'badge-amber' : 'badge-violet';
    return <span className={`badge ${cls}`}>{m.status === 'overdue' ? <><span className="dot"></span>Overdue · 3 missed</> : m.status === 'on-track' ? <><span className="dot"></span>On track</> : m.status === 'watch' ? <><span className="dot"></span>Watch</> : 'PRN'}</span>;
  };

  const Glyph = ({ name }) => {
    if (glyphStyle === 'pill') return (
      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'linear-gradient(90deg, var(--primary-light) 50%, var(--primary-subtle) 50%)', border: '1px solid var(--border)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 19, top: 6, bottom: 6, width: 1.5, background: 'rgba(0,0,0,0.15)' }}></div>
      </div>
    );
    if (glyphStyle === 'initial') return (
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18, fontWeight: 600 }}>
        {name[0]}
      </div>
    );
    return (
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18, fontStyle: 'italic' }}>℞</div>
    );
  };

  // Schedule visualization for a single med
  const ScheduleViz = ({ m }) => {
    if (scheduleViz === 'pillbox') {
      const cells = [['AM', 5, 11], ['Mid', 11, 16], ['PM', 16, 20], ['Night', 20, 24]];
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {cells.map(([label, lo, hi]) => {
            const filled = m.times.some(h => h >= lo && h < hi);
            return (
              <div key={label} style={{
                padding: '4px 8px', borderRadius: 6,
                background: filled ? 'var(--primary)' : 'var(--surface-muted)',
                color: filled ? '#fff' : 'var(--muted)',
                fontSize: 10, fontFamily: 'Geist Mono, monospace',
              }}>{label}</div>
            );
          })}
        </div>
      );
    }
    if (scheduleViz === 'time-list') {
      return (
        <div className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          {m.times.length === 0 ? 'PRN' : m.times.map(h => h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`).join(' · ')}
        </div>
      );
    }
    // day-strip
    const W = 240, H = 22;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
        <line x1={0} y1={H/2} x2={W} y2={H/2} stroke="var(--border)" strokeWidth="1" />
        {[6, 12, 18].map(h => (
          <line key={h} x1={(h/24)*W} y1={H/2-3} x2={(h/24)*W} y2={H/2+3} stroke="var(--muted)" strokeWidth="1" />
        ))}
        {m.times.map((h, i) => (
          <circle key={i} cx={(h/24)*W} cy={H/2} r={4.5} fill={m.status === 'overdue' ? 'var(--mood-difficult)' : 'var(--primary)'} />
        ))}
        <text x={2} y={H-2} fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--muted)">12a</text>
        <text x={W-18} y={H-2} fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--muted)">12a</text>
      </svg>
    );
  };

  // Attention-card variants
  const AttentionContent = () => state.donepezilTaken ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0' }}>
      <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--success-subtle)', color: 'var(--mood-good)', display: 'grid', placeItems: 'center', fontSize: 18 }}>{'✓'}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Catch-up dose recorded for 9:02a</div>
        <div className="secondary-text" style={{ fontSize: 12.5 }}>{'We’ll note this in the Friday brief for Dr. Patel.'}</div>
      </div>
    </div>
  ) : (
    <>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
        Sarah recorded that Mom refused last night’s 9pm dose, then slept through 10p and 6a windows. Give one 10mg dose <strong>after breakfast (around 9a)</strong> — don’t double up.
      </p>
      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'takeDonepezil' })}>{'✓ '}Mark catch-up taken</button>
        <button className="btn btn-outline" onClick={() => dispatch({ type: 'toast', msg: 'Reminder set for 11:00a' })}>Snooze 2h</button>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'toast', msg: 'Logged as refused' })}>Mark refused</button>
      </div>
    </>
  );

  let attentionCard = null;
  if (attentionStyle === 'banner' && !state.donepezilTaken) {
    attentionCard = (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', borderRadius: 12,
        background: 'var(--secondary-subtle)', border: '1px solid var(--secondary-light)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--secondary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14 }}>!</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Donepezil — 3 missed overnight</div>
          <div className="secondary-text" style={{ fontSize: 12.5 }}>Give one 10mg dose after breakfast — don’t double up.</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'takeDonepezil' })}>{'✓ '}Mark taken</button>
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'toast', msg: 'Reminder set' })}>Snooze</button>
      </div>
    );
  } else if (attentionStyle === 'banner' && state.donepezilTaken) {
    attentionCard = (
      <div style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--success-subtle)', border: '1px solid var(--mood-good)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--mood-good)', fontSize: 16 }}>{'✓'}</span>
        <div style={{ flex: 1, fontSize: 13.5 }}><strong>Catch-up dose recorded</strong> · 9:02a — noted for Friday’s Dr. Patel brief.</div>
      </div>
    );
  } else if (attentionStyle === 'inline') {
    attentionCard = null; // donepezil row in main list will get its own inline action
  } else {
    // hero
    attentionCard = (
      <PCard
        title="Donepezil — what to do this morning"
        meta="Action needed"
        headerTint="var(--secondary-subtle)"
        action={!state.donepezilTaken && <span className="badge badge-amber">3 missed overnight</span>}
      >
        <AttentionContent />
      </PCard>
    );
  }

  // Today’s schedule strip across all meds
  const todayStrip = (() => {
    const W = 720, H = 56, pad = 30;
    const innerW = W - pad * 2;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
        {/* hour ticks */}
        <line x1={pad} y1={H/2} x2={W-pad} y2={H/2} stroke="var(--border)" />
        {[0,4,8,12,16,20,24].map(h => {
          const x = pad + (h/24) * innerW;
          return (
            <g key={h}>
              <line x1={x} y1={H/2 - 3} x2={x} y2={H/2 + 3} stroke="var(--muted)" />
              <text x={x} y={H - 4} fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--muted)" textAnchor="middle">
                {h === 0 || h === 24 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}
              </text>
            </g>
          );
        })}
        {meds.flatMap(m => m.times.map((h, i) => {
          const x = pad + (h/24) * innerW;
          const taken = m.status === 'on-track' || (m.id === 'donepezil' && state.donepezilTaken);
          const overdue = m.status === 'overdue' || m.status === 'watch';
          return (
            <g key={`${m.id}-${i}`}>
              <circle cx={x} cy={H/2} r={6}
                fill={taken ? 'var(--mood-good)' : overdue ? 'var(--mood-difficult)' : 'var(--primary)'}
                stroke="var(--surface)" strokeWidth="1.5"
              />
              <text x={x} y={H/2 - 10} fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--text-secondary)" textAnchor="middle">
                {m.name.slice(0, 4)}
              </text>
            </g>
          );
        }))}
        {/* now line at 8a */}
        <line x1={pad + (8/24)*innerW} y1={4} x2={pad + (8/24)*innerW} y2={H - 14} stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="2 3" />
        <text x={pad + (8/24)*innerW + 4} y={11} fontSize="9" fontFamily="Geist Mono, monospace" fill="var(--primary)">NOW</text>
      </svg>
    );
  })();

  // Build groups
  const grouped = (() => {
    if (groupBy === 'condition') {
      const map = {};
      meds.forEach(m => { (map[m.forCond] = map[m.forCond] || []).push(m); });
      return Object.entries(map);
    }
    if (groupBy === 'time') {
      const buckets = { 'Morning': [], 'Daytime': [], 'Evening': [], 'PRN': [] };
      meds.forEach(m => {
        if (m.times.length === 0) buckets.PRN.push(m);
        else if (m.times[0] < 12) buckets.Morning.push(m);
        else if (m.times[0] < 17) buckets.Daytime.push(m);
        else buckets.Evening.push(m);
      });
      return Object.entries(buckets).filter(([_, arr]) => arr.length > 0);
    }
    return [['All', meds]];
  })();

  // Render a single med
  const renderMed = (m) => {
    const isInlineAction = attentionStyle === 'inline' && m.id === 'donepezil' && !state.donepezilTaken;
    const inline = (
      <>
        <Glyph name={m.name} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name} <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>{m.dose}</span></div>
          <div className="secondary-text" style={{ fontSize: 12.5 }}>{m.schedule} · {m.forCond}</div>
          {showSchedule && <div style={{ marginTop: 6 }}><ScheduleViz m={m} /></div>}
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>LAST · {m.last}</div>
          {isInlineAction && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'takeDonepezil' })}>{'✓ '}Mark catch-up taken</button>
              <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'toast', msg: 'Snoozed 2h' })}>Snooze 2h</button>
            </div>
          )}
        </div>
        {statusBadge(m)}
        <button className="btn btn-outline btn-sm" onClick={() => dispatch({ type: 'toast', msg: `${m.name} details (placeholder)` })}>Details</button>
      </>
    );

    if (layout === 'cards') {
      return (
        <div key={m.id} className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
            <Glyph name={m.name} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name} <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>{m.dose}</span></div>
              <div className="secondary-text" style={{ fontSize: 12.5 }}>{m.forCond}</div>
            </div>
            {statusBadge(m)}
          </div>
          {showSchedule && <div style={{ marginTop: 4 }}><ScheduleViz m={m} /></div>}
          <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-secondary)' }}>{m.schedule}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>LAST · {m.last}</div>
          {isInlineAction && (
            <div className="row" style={{ marginTop: 10, gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'takeDonepezil' })}>{'✓ '}Mark catch-up</button>
              <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'toast', msg: 'Snoozed 2h' })}>Snooze</button>
            </div>
          )}
        </div>
      );
    }
    if (layout === 'table') {
      return (
        <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}><Glyph name={m.name} /></td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name} <span className="mono" style={{ color: 'var(--muted)', fontWeight: 400 }}>{m.dose}</span></div>
            <div className="secondary-text" style={{ fontSize: 12 }}>{m.forCond}</div>
          </td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }} className="mono">{m.schedule}</td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>{showSchedule && <ScheduleViz m={m} />}</td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }} className="mono">{m.last}</td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>{statusBadge(m)}</td>
          <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>
            {isInlineAction
              ? <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'takeDonepezil' })}>{'✓ '}Catch up</button>
              : <button className="btn btn-outline btn-sm" onClick={() => dispatch({ type: 'toast', msg: `${m.name} details` })}>Details</button>}
          </td>
        </tr>
      );
    }
    // rows
    return (
      <div key={m.id} style={{
        padding: '14px 0', borderTop: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 14, alignItems: 'center',
      }}>{inline}</div>
    );
  };

  const renderGroupBody = (groupMeds) => {
    if (layout === 'cards') {
      return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>{groupMeds.map(renderMed)}</div>;
    }
    if (layout === 'table') {
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th></th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500 }}>Medication</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500 }}>Schedule</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500 }}>Today</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500 }}>Last</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500 }}>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>{groupMeds.map(renderMed)}</tbody>
        </table>
      );
    }
    // rows: apply borderTop:0 to first row
    return (
      <div className="col" style={{ gap: 0 }}>
        {groupMeds.map((m, i) => {
          const node = renderMed(m);
          if (i === 0) {
            return React.cloneElement(node, { style: { ...node.props.style, borderTop: 0 } });
          }
          return node;
        })}
      </div>
    );
  };

  return (
    <div className="cs-frame">
      <PRail active="meds" onNavigate={onNav} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar
          title="Medications"
          crumb="Today"
          action={<button className="btn btn-primary" onClick={() => dispatch({ type: 'toast', msg: 'Add medication (placeholder)' })}><span>+</span> Add med</button>}
        />
        <div className="cs-body">
          <div className="col">
            {attentionCard}

            {showSchedule && (
              <PCard title="Today’s schedule" meta="all meds, single timeline" headerTint="var(--primary-subtle)">
                {todayStrip}
                <div className="row" style={{ gap: 16, fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: 'var(--mood-good)', marginRight: 6, verticalAlign: 'middle' }}></span>Taken</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: 'var(--primary)', marginRight: 6, verticalAlign: 'middle' }}></span>Upcoming</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: 'var(--mood-difficult)', marginRight: 6, verticalAlign: 'middle' }}></span>Missed / watch</span>
                </div>
              </PCard>
            )}

            <PCard title="All medications" meta={`${meds.length} active`}>
              {grouped.map(([groupName, groupMeds], gi) => (
                <div key={groupName} style={{ marginTop: gi ? 18 : 0 }}>
                  {groupBy !== 'none' && (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                      {groupName} · {groupMeds.length}
                    </div>
                  )}
                  {renderGroupBody(groupMeds)}
                </div>
              ))}
            </PCard>

            {showAdherence && (
              <PCard title="Last 7 days" meta="adherence by med" headerTint="var(--tertiary-subtle)">
                <div className="col" style={{ gap: 10 }}>
                  {meds.filter(m => m.adherence !== null).map(m => (
                    <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 50px', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[0,1,2,3,4,5,6].map(d => {
                          const ok = !(m.id === 'donepezil' && d >= 4) && !(m.id === 'cal' && d === 5);
                          return (
                            <div key={d} style={{
                              flex: 1, height: 24, borderRadius: 4,
                              background: ok ? 'var(--mood-good)' : 'var(--mood-difficult)',
                              opacity: ok ? 0.85 : 0.7,
                            }} title={ok ? 'On time' : 'Missed'}></div>
                          );
                        })}
                      </div>
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-secondary)', textAlign: 'right' }}>{m.adherence}%</div>
                    </div>
                  ))}
                </div>
              </PCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shifts ──────────────────────────────────
const ProtoShifts = ({ state, dispatch, tweaks, onNav }) => {
  const t = tweaks || {};
  const handoffStyle = t.shiftsHandoffStyle || 'narrative';
  const scheduleView = t.shiftsScheduleView || 'week-grid';
  const teamLayout = t.shiftsTeamLayout || 'list';
  const showQuestions = t.shiftsShowQuestions !== false;

  const team = [
    { name: 'Sarah Reed', role: 'Sister · overnight', status: 'On now', state: 'on', hue: 2, init: 'S' },
    { name: 'You (Anna)', role: 'Primary · daytime', status: 'Up next', state: 'next', hue: 1, init: 'A' },
    { name: 'Maria Lopez', role: 'Paid aide · pm', status: 'Later today', state: 'later', hue: 0, init: 'M' },
    { name: 'David Hoffman', role: 'Brother · supports remotely', status: 'On call', state: 'remote', hue: 3, init: 'D' },
    { name: 'Joanne Park', role: 'Cousin · weekends', status: '—', state: 'off', hue: 4, init: 'J' },
  ];

  // Handoff variants
  let handoffCard = null;
  const handoffAction = state.handoffAccepted
    ? <span className="badge badge-good"><span className="dot"></span>Accepted</span>
    : <button className="btn btn-primary btn-sm" onClick={() => dispatch({ type: 'acceptHandoff' })}>Accept handoff</button>;

  const sarahQuestion = showQuestions && (
    <div className="hairline" style={{ borderRadius: 12, padding: 14, background: 'var(--surface-muted)', marginTop: 14 }}>
      <PEyebrow>Sarah’s open questions</PEyebrow>
      <div style={{ marginTop: 6, fontSize: 13.5 }}>
        {"“Do you want me to ask Dr. Patel on Friday whether the new donepezil schedule is the cause? I think we should.”"}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={() => dispatch({ type: 'toast', msg: 'Replied: yes, please ask.' })}>Yes, please ask</button>
        <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'toast', msg: 'Replied to Sarah' })}>{"I’ll handle it"}</button>
      </div>
    </div>
  );

  if (handoffStyle === 'checklist') {
    const items = [
      { done: false, text: 'Catch-up donepezil after breakfast (around 9a) — don’t double up.' },
      { done: false, text: 'Skip calcium until tonight — she refused last night’s.' },
      { done: false, text: 'Reply to Maria about Thursday swap before lunch.' },
      { done: true,  text: 'Read overnight notes (3 wakes, disorientation at 2a).' },
    ];
    handoffCard = (
      <PCard title="Handoff — Sarah → Anna" meta="8:00a in 12 min" headerTint="var(--primary-subtle)" action={handoffAction}>
        <div className="col" style={{ gap: 0 }}>
          {items.map((it, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12,
              padding: '10px 0', borderTop: i ? '1px solid var(--border)' : 0, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, border: '1.5px solid var(--border)',
                background: it.done ? 'var(--mood-good)' : 'transparent',
                color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12, marginTop: 1,
              }}>{it.done ? '✓' : ''}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: it.done ? 'var(--muted)' : 'var(--text-primary)', textDecoration: it.done ? 'line-through' : 'none' }}>{it.text}</div>
            </div>
          ))}
        </div>
        {sarahQuestion}
      </PCard>
    );
  } else if (handoffStyle === 'briefing') {
    const blocks = [
      { tint: 'var(--tertiary-subtle)', label: 'Sleep', body: '4h 20m · three wakes · disorientation 2a (asked for Dad).' },
      { tint: 'var(--secondary-subtle)', label: 'Meds', body: 'Three doses missed: donepezil 9p+10p, calcium 10p. Catch up donepezil after breakfast; skip calcium until tonight.' },
      { tint: 'var(--primary-subtle)', label: 'Schedule', body: 'Maria swapped Thursday to evening. She needs your nod before lunch.' },
    ];
    handoffCard = (
      <PCard title="Handoff — Sarah → Anna" meta="8:00a in 12 min" headerTint="var(--primary-subtle)" action={handoffAction}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {blocks.map(b => (
            <div key={b.label} style={{ padding: 14, borderRadius: 12, background: b.tint, border: '1px solid var(--border)' }}>
              <PEyebrow>{b.label}</PEyebrow>
              <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55 }}>{b.body}</div>
            </div>
          ))}
        </div>
        {sarahQuestion}
      </PCard>
    );
  } else {
    // narrative
    handoffCard = (
      <PCard title="Handoff — Sarah → Anna" meta="8:00a in 12 min" headerTint="var(--primary-subtle)" action={handoffAction}>
        <div className="col" style={{ gap: 14 }}>
          <div>
            <PEyebrow>Three things you need to know</PEyebrow>
            <ol style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7, fontSize: 14 }}>
              <li><strong>Sleep was rough.</strong> 4h 20m, three wakes, one disorientation episode at 2a (asked for Dad).</li>
              <li><strong>Three doses missed</strong> — donepezil 9p+10p, calcium 10p. Plan: catch-up donepezil after breakfast, skip calcium until tonight.</li>
              <li><strong>Aide schedule moved.</strong> Maria swapped Thursday to evening; needs your nod before lunch.</li>
            </ol>
          </div>
          {sarahQuestion}
        </div>
      </PCard>
    );
  }

  // Schedule variants
  let scheduleCard = null;
  if (scheduleView === 'lanes') {
    const lanes = [
      { name: 'Sarah',  hue: 2, color: 'rgba(168, 116, 26, 0.85)', shifts: [{ from: 20, to: 32, label: 'overnight' }, { from: 92, to: 104, label: 'overnight' }] },
      { name: 'Anna',   hue: 1, color: 'rgba(90, 122, 90, 0.85)',  shifts: [{ from: 32, to: 44, label: 'day' }, { from: 56, to: 68, label: 'day' }, { from: 104, to: 116, label: 'day' }] },
      { name: 'Maria',  hue: 0, color: 'rgba(168, 80, 64, 0.85)',  shifts: [{ from: 44, to: 50, label: 'pm' }, { from: 116, to: 124, label: 'pm' }] },
    ];
    const totalH = 7 * 24; // hours in week
    return (
      <div className="cs-frame">
        <PRail active="shifts" onNavigate={onNav} mode={state.railMode} density={state.density} />
        <div className="cs-main">
          <PTopBar title="Shifts & handoff" crumb="This week" action={<button className="btn btn-outline">Day view</button>} />
          <div className="cs-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
              <div className="col">
                {handoffCard}
                <PCard title="Week of Apr 27" meta="who covers when">
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', columnGap: 12, rowGap: 10 }}>
                    <div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist Mono, monospace' }}>
                      {['Mon 27','Tue 28','Wed 29','Thu 30','Fri 1','Sat 2','Sun 3'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    {lanes.map(lane => (
                      <React.Fragment key={lane.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                          <PAvatar name={lane.name} size={24} hue={lane.hue} />
                          <span style={{ fontWeight: 500 }}>{lane.name}</span>
                        </div>
                        <div style={{ position: 'relative', height: 28, background: 'var(--surface-muted)', borderRadius: 6, overflow: 'hidden' }}>
                          {lane.shifts.map((s, i) => (
                            <div key={i} style={{
                              position: 'absolute', top: 3, bottom: 3,
                              left: `${(s.from / totalH) * 100}%`, width: `${((s.to - s.from) / totalH) * 100}%`,
                              background: lane.color, borderRadius: 4,
                              color: '#fff', fontSize: 10, fontFamily: 'Geist Mono, monospace',
                              display: 'flex', alignItems: 'center', paddingLeft: 6,
                              textTransform: 'uppercase', letterSpacing: '0.04em',
                            }}>{s.label}</div>
                          ))}
                          {/* day dividers */}
                          {[1,2,3,4,5,6].map(d => (
                            <div key={d} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(d * 24 / totalH) * 100}%`, width: 1, background: 'var(--border)' }}></div>
                          ))}
                          {/* now line at Wed 8a = day 2 + 8 hours */}
                          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${((2*24 + 8) / totalH) * 100}%`, width: 1.5, background: 'var(--primary)' }}></div>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ marginRight: 12 }}><span style={{ display: 'inline-block', width: 1.5, height: 10, background: 'var(--primary)', verticalAlign: 'middle', marginRight: 4 }}></span>now · Wed 8a</span>
                  </div>
                </PCard>
              </div>
              <TeamSidebar team={team} layout={teamLayout} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (scheduleView === 'compact-list') {
    const upcoming = [
      { day: 'Wed Apr 29', who: 'Sarah → Anna', time: '8:00a', label: 'Shift change', live: true },
      { day: 'Wed Apr 29', who: 'Maria',           time: '4:00p', label: 'Aide · pm visit' },
      { day: 'Wed Apr 29', who: 'Anna → Sarah', time: '8:00p', label: 'Shift change' },
      { day: 'Thu Apr 30', who: 'Maria',           time: '5:00p', label: 'Aide · evening (swap)' },
      { day: 'Fri May 1',  who: 'Anna',            time: '11:00a', label: 'Dr. Patel call' },
    ];
    scheduleCard = (
      <PCard title="Next 5 shifts" meta="upcoming">
        <div className="col" style={{ gap: 0 }}>
          {upcoming.map((u, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '110px 60px 1fr auto', gap: 12, alignItems: 'center',
              padding: '12px 0', borderTop: i ? '1px solid var(--border)' : 0,
            }}>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{u.day}</div>
              <div style={{ fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18 }}>{u.time}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13.5 }}>{u.who}</div>
                <div className="secondary-text" style={{ fontSize: 12.5 }}>{u.label}</div>
              </div>
              {u.live && <span className="badge badge-amber"><span className="dot"></span>in 12 min</span>}
            </div>
          ))}
        </div>
      </PCard>
    );
  } else {
    // week-grid
    scheduleCard = (
      <PCard title="This week’s shifts">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={d} className="hairline" style={{ borderRadius: 10, padding: 10, background: i === 2 ? 'var(--primary-subtle)' : 'transparent' }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{d.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 22, marginTop: 2 }}>{27 + i}</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'rgba(168, 116, 26, 0.15)', color: 'var(--secondary)' }}>S · night</div>
                <div style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'rgba(90, 122, 90, 0.15)', color: 'var(--primary)' }}>A · day</div>
                {(i === 1 || i === 3) && <div style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, background: 'rgba(168, 80, 64, 0.15)', color: 'var(--tertiary)' }}>M · pm</div>}
              </div>
            </div>
          ))}
        </div>
      </PCard>
    );
  }

  return (
    <div className="cs-frame">
      <PRail active="shifts" onNavigate={onNav} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar title="Shifts & handoff" crumb="Today" action={<button className="btn btn-outline">Week view</button>} />
        <div className="cs-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
            <div className="col">
              {handoffCard}
              {scheduleCard}
            </div>
            <TeamSidebar team={team} layout={teamLayout} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TeamSidebar = ({ team, layout }) => {
  if (layout === 'roster') {
    return (
      <PCard title="Care team" meta={`${team.length} people`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {team.map((p, i) => (
            <div key={i} className="hairline" style={{ padding: 12, borderRadius: 12, textAlign: 'center' }}>
              <PAvatar name={p.name} size={48} hue={p.hue} />
              <div style={{ fontWeight: 500, fontSize: 13, marginTop: 8 }}>{p.name.split(' ')[0]}</div>
              <div className="secondary-text" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{p.role}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6 }}>{p.status}</div>
            </div>
          ))}
        </div>
      </PCard>
    );
  }
  if (layout === 'now-board') {
    const groups = [
      { label: 'On now', filter: 'on', tint: 'var(--success-subtle)' },
      { label: 'Up next', filter: 'next', tint: 'var(--primary-subtle)' },
      { label: 'Later today', filter: 'later', tint: 'var(--secondary-subtle)' },
      { label: 'Off / remote', filter: ['off', 'remote'], tint: 'var(--surface-muted)' },
    ];
    return (
      <div className="col">
        {groups.map(g => {
          const filter = Array.isArray(g.filter) ? g.filter : [g.filter];
          const members = team.filter(p => filter.includes(p.state));
          if (members.length === 0) return null;
          return (
            <div key={g.label} style={{ borderRadius: 14, background: g.tint, padding: 14, border: '1px solid var(--border)' }}>
              <PEyebrow>{g.label}</PEyebrow>
              <div className="col" style={{ marginTop: 8, gap: 8 }}>
                {members.map(p => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PAvatar name={p.name} size={28} hue={p.hue} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                      <div className="secondary-text" style={{ fontSize: 11.5 }}>{p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // list (default)
  return (
    <PCard title="Care team" padding="8px 0">
      {team.map((p, i) => (
        <div key={i} style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <PAvatar name={p.name} size={32} hue={p.hue} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
            <div className="secondary-text" style={{ fontSize: 12 }}>{p.role}</div>
          </div>
          <div className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{p.status}</div>
        </div>
      ))}
    </PCard>
  );
};

// ─── Journal ─────────────────────────────────
const ProtoJournal = ({ state, dispatch, tweaks, onNav }) => {
  const t = tweaks || {};
  const composerLayout = t.journalComposerLayout || 'inline';
  const moodStyle = t.journalMoodStyle || 'badges';
  const entryTreatment = t.journalEntryTreatment || 'card-bordered';
  const sidebarStyle = t.journalSidebar || 'mood-bars';
  const showExportHint = t.journalShowExportHint !== false;

  const [draft, setDraft] = React.useState('');
  const [mood, setMood] = React.useState('okay');
  const [tags, setTags] = React.useState([]);

  const submit = () => {
    if (!draft.trim()) return;
    dispatch({ type: 'addJournal', entry: { id: Date.now(), text: draft.trim(), mood, who: 'You', when: 'Just now' } });
    setDraft('');
    setMood('okay');
    setTags([]);
  };

  const moods = [
    ['good','Good','badge-good','mood-border-good','var(--mood-good)','☺'],
    ['okay','Okay','badge-okay','mood-border-okay','var(--mood-okay)','—'],
    ['difficult','Difficult','badge-difficult','mood-border-difficult','var(--mood-difficult)','!'],
    ['crisis','Crisis','badge-crisis','mood-border-crisis','var(--mood-crisis)','⚠'],
  ];

  const moodControl = (() => {
    if (moodStyle === 'spectrum') {
      const order = ['good', 'okay', 'difficult', 'crisis'];
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="eyebrow">Mood</span>
          <div style={{ display: 'flex', gap: 6, flex: 1, maxWidth: 280 }}>
            {order.map(k => {
              const m = moods.find(x => x[0] === k);
              const active = mood === k;
              return (
                <button key={k} onClick={() => setMood(k)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: active ? `2px solid ${m[4]}` : '1px solid var(--border)',
                  background: active ? m[4] : 'transparent',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: active ? 600 : 500,
                }}>{m[1]}</button>
              );
            })}
          </div>
        </div>
      );
    }
    if (moodStyle === 'tags') {
      const allTags = ['sleep','meds','agitation','memory','meals','mobility','social','calm','tearful','clear-headed','restless'];
      return (
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>What did this entry feel like? (pick any)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allTags.map(tag => {
              const active = tags.includes(tag);
              return (
                <span key={tag} onClick={() => setTags(active ? tags.filter(x => x !== tag) : [...tags, tag])}
                  className={`badge ${active ? 'badge-good' : 'badge-neutral'}`}
                  style={{ cursor: 'pointer', opacity: active ? 1 : 0.7 }}
                >#{tag}</span>
              );
            })}
          </div>
        </div>
      );
    }
    // badges (default)
    return (
      <div className="row" style={{ gap: 6 }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Mood</span>
        {moods.map(([k, lab, cls]) => (
          <span key={k} onClick={() => setMood(k)} className={`badge ${cls}`}
            style={{ cursor: 'pointer', opacity: mood === k ? 1 : 0.45, outline: mood === k ? '1px solid currentColor' : 'none' }}>{lab}</span>
        ))}
      </div>
    );
  })();

  // Composer variants
  let composer = null;
  if (composerLayout === 'prompted') {
    const [p1, setP1] = React.useState('');
    const [p2, setP2] = React.useState('');
    const [p3, setP3] = React.useState('');
    const promptedSubmit = () => {
      const combined = [p1 && `Today she — ${p1}`, p2 && `What I noticed: ${p2}`, p3 && `Worth flagging: ${p3}`].filter(Boolean).join(' ');
      if (!combined) return;
      dispatch({ type: 'addJournal', entry: { id: Date.now(), text: combined, mood, who: 'You', when: 'Just now' } });
      setP1(''); setP2(''); setP3(''); setMood('okay');
    };
    const inputStyle = { width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13.5, background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none' };
    composer = (
      <PCard title="Three quick questions" meta={'Wed Apr 29 · 8:14a'}>
        <div className="col" style={{ gap: 14 }}>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Today she{'…'}</label>
            <input value={p1} onChange={e => setP1(e.target.value)} placeholder={'“woke up clearer than usual”'} style={inputStyle} />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>What I noticed</label>
            <input value={p2} onChange={e => setP2(e.target.value)} placeholder={'a small thing only you would catch'} style={inputStyle} />
          </div>
          <div>
            <label className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>Worth flagging for Sarah or Dr. Patel?</label>
            <input value={p3} onChange={e => setP3(e.target.value)} placeholder={'leave blank if not'} style={inputStyle} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {moodControl}
            <button className="btn btn-primary" onClick={promptedSubmit}>Save entry</button>
          </div>
        </div>
      </PCard>
    );
  } else if (composerLayout === 'minimal') {
    composer = (
      <div style={{ borderRadius: 14, border: '1px solid var(--border)', padding: 16, background: 'var(--surface)' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Wed Apr 29 — what happened today?"
          rows={3}
          style={{
            width: '100%', resize: 'vertical', border: 0, padding: 0,
            fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18, lineHeight: 1.5,
            background: 'transparent', color: 'var(--text-primary)', outline: 'none',
          }}
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          {moodControl}
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Save</button>
        </div>
      </div>
    );
  } else {
    // inline (default)
    composer = (
      <PCard title="Add an entry" meta={'Wed Apr 29 · 8:14a'}>
        <div className="col" style={{ gap: 12 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={'What happened? What did you notice? Speak as yourself — Sarah and the doctors will read it.'}
            rows={4}
            style={{
              width: '100%', resize: 'vertical', border: '1px solid var(--border)', borderRadius: 12,
              padding: 12, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55,
              background: 'var(--surface)', color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {moodControl}
            <button className="btn btn-primary" onClick={submit} disabled={!draft.trim()} style={{ opacity: draft.trim() ? 1 : 0.5 }}>Save entry</button>
          </div>
        </div>
      </PCard>
    );
  }

  // Entry rendering
  const renderEntry = (e) => {
    const moodCls = moods.find(m => m[0] === e.mood) || moods[1];
    if (entryTreatment === 'page') {
      return (
        <div key={e.id} style={{ padding: '6px 0 22px', borderBottom: '1px solid var(--border)' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {e.when} · {e.who} · mood {moodCls[1].toLowerCase()}
          </div>
          <div style={{ marginTop: 10, paddingLeft: 16, borderLeft: `3px solid ${moodCls[4]}` }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 18, lineHeight: 1.6, color: 'var(--text-primary)' }}>{e.text}</p>
          </div>
        </div>
      );
    }
    if (entryTreatment === 'thread') {
      return (
        <div key={e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <PAvatar name={e.who} size={32} hue={1} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{e.who}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{e.when}</span>
              <span className={`badge ${moodCls[2]}`}><span className="dot"></span>{moodCls[1]}</span>
            </div>
            <div style={{ marginTop: 6, padding: '10px 14px', borderRadius: 12, background: 'var(--surface-muted)', fontSize: 14, lineHeight: 1.55 }}>
              {e.text}
            </div>
          </div>
        </div>
      );
    }
    // card-bordered (default)
    return (
      <PCard key={e.id} title={`${e.who} · ${e.when}`} action={<span className={`badge ${moodCls[2]}`}><span className="dot"></span>{moodCls[1]}</span>}>
        <div className={moodCls[3]} style={{ paddingLeft: 14 }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>{e.text}</p>
        </div>
      </PCard>
    );
  };

  const exportHint = (
    <div style={{ borderRadius: 14, padding: 14, background: 'var(--secondary-subtle)', border: '1px solid var(--secondary-light)' }}>
      <PEyebrow>{'Friday \u00B7 Dr. Patel'}</PEyebrow>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.55 }}>
        Two weeks of journal entries are ready to export as a one-page summary.
      </div>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => dispatch({ type: 'toast', msg: 'Exported 14 entries' })}>Preview export</button>
    </div>
  );

  // Sidebar variants
  const renderSidebar = () => {
    if (sidebarStyle === 'none') return null;
    if (sidebarStyle === 'calendar-heatmap') {
      // 5 weeks x 7 days
      const cells = [];
      const moodPattern = ['good','okay','okay','okay','good','difficult','okay','difficult','okay','good','okay','okay','good','okay','okay','difficult','difficult','okay','okay','okay','good','okay','difficult','difficult','okay','difficult','difficult','okay','difficult',null,null,null,null,null,null];
      const moodColor = { good: 'var(--mood-good)', okay: 'var(--mood-okay)', difficult: 'var(--mood-difficult)', crisis: 'var(--mood-crisis)' };
      return (
        <div className="col">
          <PCard title="Last 5 weeks" meta="mood by day">
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} style={{ textAlign: 'center' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {moodPattern.map((m, i) => (
                <div key={i} style={{
                  aspectRatio: '1', borderRadius: 4,
                  background: m ? moodColor[m] : 'var(--surface-muted)',
                  opacity: m ? 0.85 : 0.5,
                }} title={m || ''}></div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-secondary)', gap: 12 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--mood-good)', marginRight: 4 }}></span>Good</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--mood-okay)', marginRight: 4 }}></span>Okay</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--mood-difficult)', marginRight: 4 }}></span>Difficult</span>
            </div>
          </PCard>
          {showExportHint && exportHint}
        </div>
      );
    }
    if (sidebarStyle === 'tags-only') {
      const tagCounts = [['sleep', 8], ['meds', 6], ['agitation', 4], ['memory', 4], ['mobility', 2], ['meals', 2], ['social', 1]];
      return (
        <div className="col">
          <PCard title="Recurring themes" meta="last 30 days">
            <div className="col" style={{ gap: 8 }}>
              {tagCounts.map(([tag, n]) => (
                <div key={tag} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 24px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>#{tag}</span>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                    <div style={{ width: `${(n / 8) * 100}%`, height: '100%', background: 'var(--primary)' }}></div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>{n}</span>
                </div>
              ))}
            </div>
          </PCard>
          {showExportHint && exportHint}
        </div>
      );
    }
    // mood-bars (default)
    return (
      <div className="col">
        <PCard title="This week">
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{'MOOD · 7 DAYS'}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, alignItems: 'flex-end', height: 40 }}>
            {['good','okay','okay','difficult','difficult','okay','difficult'].map((m, i) => {
              const colors = { good: 'var(--mood-good)', okay: 'var(--mood-okay)', difficult: 'var(--mood-difficult)', crisis: 'var(--mood-crisis)' };
              const heights = { good: 14, okay: 22, difficult: 32, crisis: 40 };
              return <div key={i} style={{ flex: 1, height: heights[m], background: colors[m], borderRadius: 4 }} />;
            })}
          </div>
          <div className="row" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Trending difficult since Sunday.
          </div>
        </PCard>
        <PCard title="Tags">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['sleep','meds','agitation','memory','meals','mobility','social'].map(tag => (
              <span key={tag} className="badge badge-neutral" style={{ cursor: 'pointer' }}>#{tag}</span>
            ))}
          </div>
        </PCard>
        {showExportHint && exportHint}
      </div>
    );
  };

  const sidebar = renderSidebar();
  const grid = sidebar
    ? { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }
    : { display: 'block' };

  const entries = [...state.journal].reverse();

  return (
    <div className="cs-frame">
      <PRail active="journal" onNavigate={onNav} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar title="Journal" crumb="Record" action={<button className="btn btn-outline">{'Export · Friday'}</button>} />
        <div className="cs-body">
          <div style={grid}>
            <div className="col">
              {composer}
              {entryTreatment === 'thread' ? (
                <PCard title="Recent entries" padding="20px">
                  <div className="col" style={{ gap: 18 }}>
                    {entries.map(renderEntry)}
                  </div>
                </PCard>
              ) : entryTreatment === 'page' ? (
                <div style={{ padding: '8px 4px' }}>
                  {entries.map(renderEntry)}
                </div>
              ) : (
                entries.map(renderEntry)
              )}
            </div>
            {sidebar}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Profile ──────────────────────────────────
const ProtoProfile = ({ state, tweaks, onNav }) => {
  const t = tweaks || {};
  const portraitStyle = t.profilePortraitStyle || 'avatar-card';
  const likesStyle = t.profileLikesStyle || 'list';
  const teamLayout = t.profileTeamLayout || 'list';
  const showEmergency = t.profileShowEmergency !== false;

  const conditions = [
    ['Alzheimer (moderate)', 'Dx 2022 · Dr. Patel'],
    ['Hypothyroidism', 'Stable on levothyroxine'],
    ['Atrial fibrillation', 'Controlled · metoprolol'],
    ['Osteopenia', 'Calcium + D3'],
  ];
  const team = [
    ['Dr. Aisha Patel', 'Neurology · primary', '(415) 555-0148'],
    ['Dr. Lin Xu', 'Cardiology', '(415) 555-0102'],
    ['Marcus Reed', 'Physical therapy', '(415) 555-0177'],
    ['Hillview Pharmacy', 'Delivers Tue/Fri', '(415) 555-0163'],
  ];
  const likes = [
    ['Coffee, black, two sips at a time.', 'Don’t pour a full cup — she won’t drink it.'],
    ['Calls Dad “Henry” lately,', 'not “Dad.” Don’t correct her, just go with it.'],
    ['Hates pills with water.', 'Use a spoon of yogurt — works every time.'],
    ['Cardinals on the feeder make her day.', 'Open the kitchen blind first thing.'],
  ];

  // Portrait variants
  let portrait = null;
  if (portraitStyle === 'editorial') {
    portrait = (
      <div style={{
        gridColumn: '1 / -1',
        position: 'relative', borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(120deg, var(--primary-subtle) 0%, var(--secondary-subtle) 60%, var(--tertiary-subtle) 100%)',
        padding: '40px 36px', display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 28, alignItems: 'center',
        border: '1px solid var(--border)',
      }}>
        <div className="cs-avatar" style={{ width: 120, height: 120, fontSize: 44 }}>M</div>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{'Mom’s profile'}</div>
          <div className="headline-display" style={{ fontSize: 44, lineHeight: 1.05, marginTop: 6 }}>Margaret Hoffman</div>
          <div className="secondary-text" style={{ fontSize: 14.5, marginTop: 8 }}>{'82 · “Mom” · widowed 2019 · lives at home with daytime support'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="hairline" style={{ borderRadius: 10, padding: 10, minWidth: 80, background: 'var(--surface)' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>BLOOD</div>
            <div style={{ fontWeight: 600 }}>O+</div>
          </div>
          <div className="hairline" style={{ borderRadius: 10, padding: 10, minWidth: 80, background: 'var(--surface)' }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>WEIGHT</div>
            <div style={{ fontWeight: 600 }}>132 lb</div>
          </div>
        </div>
      </div>
    );
  } else if (portraitStyle === 'minimal') {
    portrait = (
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0 16px' }}>
        <div className="cs-avatar" style={{ width: 56, height: 56, fontSize: 22 }}>M</div>
        <div>
          <div className="headline-display" style={{ fontSize: 28, lineHeight: 1.1 }}>Margaret Hoffman</div>
          <div className="secondary-text" style={{ fontSize: 13.5 }}>{'82 · “Mom” · widowed 2019'}</div>
        </div>
      </div>
    );
  } else {
    // avatar-card (sits in left column)
    portrait = (
      <div className="card" style={{ padding: 20, textAlign: 'center' }}>
        <div className="cs-avatar" style={{ width: 96, height: 96, fontSize: 36, margin: '0 auto' }}>M</div>
        <div className="headline-display" style={{ fontSize: 26, marginTop: 14 }}>Margaret Hoffman</div>
        <div className="secondary-text" style={{ fontSize: 13.5 }}>{'82 · “Mom” · widowed 2019'}</div>
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
          <div className="hairline" style={{ borderRadius: 10, padding: 10 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>BLOOD</div>
            <div style={{ fontWeight: 600 }}>O+</div>
          </div>
          <div className="hairline" style={{ borderRadius: 10, padding: 10 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>WEIGHT</div>
            <div style={{ fontWeight: 600 }}>132 lb</div>
          </div>
        </div>
      </div>
    );
  }

  // Likes & dislikes variants
  let likesCard = null;
  if (likesStyle === 'cards') {
    likesCard = (
      <PCard title="Likes & dislikes" headerTint="var(--tertiary-subtle)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {likes.map(([a, b], i) => (
            <div key={i} className="hairline" style={{ padding: 12, borderRadius: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.4 }}>{a}</div>
              <div className="secondary-text" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 4 }}>{b}</div>
            </div>
          ))}
        </div>
      </PCard>
    );
  } else if (likesStyle === 'narrative') {
    likesCard = (
      <PCard title="Who she is, day to day" headerTint="var(--tertiary-subtle)">
        <p style={{ margin: 0, fontFamily: 'var(--font-display, Fraunces, serif)', fontSize: 17, lineHeight: 1.7, color: 'var(--text-primary)' }}>
          {'She likes her '}<strong>coffee black, two sips at a time</strong>{' — don’t pour a full cup, she won’t drink it. Lately she’s been calling Dad '}<strong>{'“Henry”'}</strong>{' instead of '}<strong>{'“Dad”'}</strong>{'; don’t correct her, just go with it. She '}<strong>hates pills with water</strong>{' — a spoon of yogurt works every time. And '}<strong>cardinals on the feeder make her day</strong>{', so open the kitchen blind first thing.'}
        </p>
      </PCard>
    );
  } else {
    likesCard = (
      <PCard title="Likes & dislikes" headerTint="var(--tertiary-subtle)">
        <div className="col" style={{ gap: 10 }}>
          {likes.map(([a, b], i) => (
            <div key={i}><strong>{a}</strong>{' ' + b}</div>
          ))}
        </div>
      </PCard>
    );
  }

  // Care team variants
  let teamCard = null;
  if (teamLayout === 'cards') {
    teamCard = (
      <PCard title="Care team & contacts">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {team.map(([n, role, phone], i) => (
            <div key={n} className="hairline" style={{ padding: 14, borderRadius: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n}</div>
              <div className="secondary-text" style={{ fontSize: 12.5 }}>{role}</div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{phone}</div>
            </div>
          ))}
        </div>
      </PCard>
    );
  } else if (teamLayout === 'directory') {
    teamCard = (
      <PCard title="Care team & contacts" padding="0 0 8px">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Role</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Geist Mono, monospace', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {team.map(([n, role, phone], i) => (
              <tr key={n} style={{ borderTop: i ? '1px solid var(--border)' : 0 }}>
                <td style={{ padding: '12px 16px', fontWeight: 500, fontSize: 13.5 }}>{n}</td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>{role}</td>
                <td style={{ padding: '12px 16px' }} className="mono">{phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PCard>
    );
  } else {
    teamCard = (
      <PCard title="Care team & contacts" padding="8px 0">
        {team.map(([n, role, phone], i) => (
          <div key={n} style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 0, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{n}</div>
              <div className="secondary-text" style={{ fontSize: 12.5 }}>{role}</div>
            </div>
            <div className="mono" style={{ color: 'var(--text-secondary)', fontSize: 12, alignSelf: 'center' }}>{phone}</div>
          </div>
        ))}
      </PCard>
    );
  }

  const conditionsCard = (
    <PCard title="Conditions" meta="Updated Mar 2026">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
        {conditions.map(([n, sub]) => (
          <div key={n} className="hairline" style={{ padding: 12, borderRadius: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{n}</div>
            <div className="secondary-text" style={{ fontSize: 12.5 }}>{sub}</div>
          </div>
        ))}
      </div>
    </PCard>
  );

  const emergencyCard = showEmergency && (
    <PCard title="In an emergency" headerTint="var(--danger-subtle)">
      <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
        <div><strong>DNR on file</strong>{' (signed Sept 2024, uploaded to Documents).'}</div>
        <div style={{ marginTop: 8 }}>{'Call Anna first, then Dr. Patel. She’s been at Mercy Memorial for everything since the 2022 admit.'}</div>
      </div>
    </PCard>
  );

  // Layout: editorial portrait spans full width; minimal sits above two-col; avatar-card sits inside left column
  const isEditorialOrMinimal = portraitStyle === 'editorial' || portraitStyle === 'minimal';

  return (
    <div className="cs-frame">
      <PRail active="profile" onNavigate={onNav} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar title="Margaret Hoffman" crumb={'Mom’s profile'} action={<button className="btn btn-outline">Edit</button>} />
        <div className="cs-body">
          {isEditorialOrMinimal ? (
            <div className="col">
              {portrait}
              {conditionsCard}
              {likesCard}
              {teamCard}
              {emergencyCard}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
              <div className="col">
                {portrait}
                {likesCard}
              </div>
              <div className="col">
                {conditionsCard}
                {teamCard}
                {emergencyCard}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


Object.assign(window, { ProtoMeds, ProtoShifts, ProtoJournal, ProtoProfile });
