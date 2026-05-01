// proto-today.jsx — Today / Timeline, interactive

const ProtoToday = ({ state, dispatch, tweaks, onNav }) => {
  const t = tweaks || {};
  const layout = t.timelineLayout || 'rail';
  const density = t.timelineDensity || 'regular';
  const groupBy = t.timelineGroup || 'chronological';
  const nowMarker = t.timelineNowMarker || 'pill';
  const filterStyle = t.timelineFilterStyle || 'chips';
  const showIcons = t.timelineIcons !== false;
  const colorByType = !!t.timelineColorByType;
  const showQuickLog = t.timelineShowQuickLog !== false;
  const showFilters = t.timelineShowFilters !== false;
  const showSidebar = showQuickLog || showFilters;

  const items = [
    { id: 'sh1', time: '6:00a', kind: 'shift', label: "Sarah’s overnight ended", sub: '6p–6a · 4h 20m sleep, 3 wakes', tag: 'Logged' },
    { id: 'wake', time: '6:48a', kind: 'sleep', label: 'Mom woke up', sub: 'Asked for coffee, oriented x3' },
    { id: 'brief', time: '7:02a', kind: 'brief', label: 'Daily brief generated', sub: 'Auto · review and edit before group call' },
    { id: 'levo', time: '7:15a', kind: 'med', label: 'Levothyroxine 50mcg', sub: 'On time · taken with water', tag: 'Done', tagClass: 'badge-good' },
    { id: 'bf', time: '7:30a', kind: 'meal', label: 'Breakfast — half eaten', sub: 'Oatmeal, banana. Refused eggs.' },
    { id: 'now', time: '8:00a', kind: 'now', label: 'Handoff — you take over', sub: 'Sarah → Anna · 10 min standup', goto: 'shifts' },
    { id: 'don', time: '9:00a', kind: 'med', label: 'Donepezil 10mg', sub: 'Catch-up dose · missed last 3 windows', tag: state.donepezilTaken ? 'Done' : 'Catch up', tagClass: state.donepezilTaken ? 'badge-good' : 'badge-amber', goto: 'meds' },
    { id: 'pt', time: '10:30a', kind: 'visit', label: 'Marcus, in-home PT', sub: '45 min · knee strengthening' },
    { id: 'lunch', time: '12:00p', kind: 'meal', label: 'Lunch', sub: 'Soft foods preferred lately' },
    { id: 'maria', time: '2:00p', kind: 'shift', label: 'Maria arrives', sub: 'Paid aide · until 6p' },
  ];

  const iconFor = { shift: '◑', sleep: '☾', brief: '◐', med: '℞', meal: '⊕', now: '●', visit: '✚' };
  const tintFor = {
    shift: 'var(--tertiary-subtle)',
    sleep: 'var(--surface-muted)',
    brief: 'var(--secondary-subtle)',
    med: 'var(--primary-subtle)',
    meal: 'var(--secondary-subtle)',
    visit: 'var(--tertiary-subtle)',
  };
  const labelFor = {
    shift: 'Shift', sleep: 'Sleep', brief: 'Brief',
    med: 'Medication', meal: 'Meal', visit: 'Visit', now: 'Now',
  };

  // ─── Filter ─────────────────────────────────────────────────────
  const filters = ['All', 'Meds', 'Meals', 'Sleep', 'Visits', 'Shifts'];
  const filterMap = { Meds: 'med', Meals: 'meal', Sleep: 'sleep', Visits: 'visit', Shifts: 'shift' };
  const [filter, setFilter] = React.useState('All');
  const filtered = filter === 'All' ? items : items.filter(it => it.kind === filterMap[filter]);

  // ─── Grouping ───────────────────────────────────────────────────
  const parseTime = (s) => {
    const m = s.match(/(\d+):(\d+)([ap])/);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3] === 'p' && h !== 12) h += 12;
    if (m[3] === 'a' && h === 12) h = 0;
    return h * 60 + min;
  };
  const groups = (() => {
    if (groupBy === 'period') {
      const buckets = { Morning: [], Afternoon: [], Evening: [] };
      filtered.forEach(it => {
        const m = parseTime(it.time);
        if (m < 12 * 60) buckets.Morning.push(it);
        else if (m < 17 * 60) buckets.Afternoon.push(it);
        else buckets.Evening.push(it);
      });
      return Object.entries(buckets).filter(([_, arr]) => arr.length > 0);
    }
    if (groupBy === 'type') {
      const order = ['shift', 'sleep', 'med', 'meal', 'visit', 'brief', 'now'];
      const buckets = {};
      filtered.forEach(it => {
        const k = labelFor[it.kind] || 'Other';
        (buckets[k] = buckets[k] || []).push(it);
      });
      return Object.entries(buckets).sort((a, b) => {
        const ia = order.indexOf(Object.keys(labelFor).find(k => labelFor[k] === a[0]));
        const ib = order.indexOf(Object.keys(labelFor).find(k => labelFor[k] === b[0]));
        return ia - ib;
      });
    }
    return [['All', filtered]];
  })();

  // Density spacing
  const rowPad = density === 'compact' ? '6px 0' : density === 'roomy' ? '16px 0' : '10px 0';
  const cardPad = density === 'compact' ? '8px 12px' : density === 'roomy' ? '14px 18px' : '10px 14px';

  // ─── Renderers ──────────────────────────────────────────────────
  const renderEventInline = (it) => {
    const isNow = it.kind === 'now';
    const bg = isNow ? 'var(--primary-subtle)'
      : (colorByType ? tintFor[it.kind] || 'transparent' : 'transparent');
    return (
      <div onClick={() => it.goto && onNav(it.goto)}
        style={{
          padding: cardPad,
          background: bg,
          borderRadius: 12,
          display: 'flex', gap: 12, alignItems: 'center',
          cursor: it.goto ? 'pointer' : 'default',
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: isNow ? 600 : 500 }}>{it.label}</div>
          <div className="secondary-text" style={{ fontSize: 12.5 }}>{it.sub}</div>
        </div>
        {it.tag && <span className={`badge ${it.tagClass || 'badge-neutral'}`}>{it.tag}</span>}
      </div>
    );
  };

  const renderRailItem = (it, i, arr) => {
    const isNow = it.kind === 'now';
    return (
      <div key={it.id} style={{ position: 'relative', padding: rowPad }}>
        <div className="mono" style={{
          position: 'absolute', left: -92, top: 12, width: 64, textAlign: 'right',
          color: isNow ? 'var(--primary)' : 'var(--muted)', fontWeight: isNow ? 600 : 400,
        }}>{it.time}</div>
        {showIcons && (
          <div style={{
            position: 'absolute', left: -22, top: 12, width: 28, height: 28, borderRadius: 999,
            background: isNow && nowMarker === 'pill' ? 'var(--primary)' : 'var(--surface)',
            border: '1px solid ' + (isNow && nowMarker === 'pill' ? 'var(--primary)' : 'var(--border)'),
            color: isNow && nowMarker === 'pill' ? '#fff' : 'var(--text-secondary)',
            display: 'grid', placeItems: 'center', fontSize: 13,
            boxShadow: isNow && nowMarker === 'pill' ? '0 0 0 6px rgba(124,58,237,0.12)' : 'none',
          }}>{iconFor[it.kind] || '·'}</div>
        )}
        {renderEventInline(it)}
      </div>
    );
  };

  const renderCard = (it) => {
    const isNow = it.kind === 'now';
    return (
      <div key={it.id} className="card" style={{
        padding: density === 'compact' ? 12 : density === 'roomy' ? 20 : 16,
        background: colorByType ? tintFor[it.kind] || 'var(--surface)' : (isNow ? 'var(--primary-subtle)' : 'var(--surface)'),
        borderColor: isNow ? 'var(--primary)' : 'var(--border)',
        cursor: it.goto ? 'pointer' : 'default',
      }}
        onClick={() => it.goto && onNav(it.goto)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {showIcons && <span style={{ fontSize: 14, color: 'var(--primary)' }}>{iconFor[it.kind] || '·'}</span>}
          <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>{labelFor[it.kind] || it.kind}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{it.time}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{it.label}</div>
        <div className="secondary-text" style={{ fontSize: 12.5, marginTop: 2 }}>{it.sub}</div>
        {it.tag && <div style={{ marginTop: 8 }}><span className={`badge ${it.tagClass || 'badge-neutral'}`}>{it.tag}</span></div>}
      </div>
    );
  };

  const renderFeedItem = (it, i, arr) => {
    const isNow = it.kind === 'now';
    return (
      <div key={it.id}
        onClick={() => it.goto && onNav(it.goto)}
        style={{
          padding: rowPad,
          borderTop: i ? '1px solid var(--border)' : 0,
          display: 'grid', gridTemplateColumns: showIcons ? '60px 28px 1fr auto' : '60px 1fr auto',
          gap: 12, alignItems: 'center',
          cursor: it.goto ? 'pointer' : 'default',
          background: colorByType ? tintFor[it.kind] || 'transparent' : (isNow ? 'var(--primary-subtle)' : 'transparent'),
          borderRadius: isNow || colorByType ? 8 : 0,
        }}>
        <span className="mono" style={{ color: isNow ? 'var(--primary)' : 'var(--muted)', fontWeight: isNow ? 600 : 400 }}>{it.time}</span>
        {showIcons && <span style={{ color: 'var(--primary)', fontSize: 14, textAlign: 'center' }}>{iconFor[it.kind] || '·'}</span>}
        <div>
          <div style={{ fontSize: 13.5, fontWeight: isNow ? 600 : 500 }}>{it.label}</div>
          <div className="secondary-text" style={{ fontSize: 12.5 }}>{it.sub}</div>
        </div>
        {it.tag && <span className={`badge ${it.tagClass || 'badge-neutral'}`}>{it.tag}</span>}
      </div>
    );
  };

  // ─── Now marker overlays ───────────────────────────────────────
  const NowBanner = () => (
    <div style={{
      padding: '12px 18px', background: 'var(--primary)', color: '#fff',
      borderRadius: 10, marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
    }} onClick={() => onNav('shifts')}>
      <span className="mono" style={{ fontSize: 11, opacity: 0.85, textTransform: 'uppercase' }}>Now · 8:00a</span>
      <span style={{ fontWeight: 600, flex: 1 }}>Handoff with Sarah</span>
      <span style={{ fontSize: 12, opacity: 0.85 }}>10 min standup →</span>
    </div>
  );
  const NowLine = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--primary)' }} />
      <span className="mono" style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>NOW · 8:00a</span>
      <div style={{ flex: 0, width: 16, height: 1, background: 'var(--primary)' }} />
    </div>
  );

  // ─── Render group bodies ───────────────────────────────────────
  const renderGroupBody = (groupItems) => {
    if (layout === 'cards') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {groupItems.map((it, i) => {
            // For non-pill now markers, suppress the special card style on the "now" item
            const showAsCard = !(it.kind === 'now' && nowMarker !== 'pill');
            return showAsCard ? renderCard(it) : <React.Fragment key={it.id}>{nowMarker === 'banner' ? <NowBanner /> : <NowLine />}</React.Fragment>;
          })}
        </div>
      );
    }
    if (layout === 'feed') {
      const out = [];
      groupItems.forEach((it, i) => {
        if (it.kind === 'now' && nowMarker === 'banner') { out.push(<NowBanner key={'nb-' + i} />); return; }
        if (it.kind === 'now' && nowMarker === 'line') { out.push(<NowLine key={'nl-' + i} />); return; }
        out.push(renderFeedItem(it, i, groupItems));
      });
      return <div>{out}</div>;
    }
    // rail (default)
    return (
      <div style={{ position: 'relative', paddingLeft: showIcons ? 92 : 80 }}>
        <div style={{ position: 'absolute', left: showIcons ? 78 : 70, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
        {groupItems.map((it, i) => {
          if (it.kind === 'now' && nowMarker === 'banner') return <div key={it.id} style={{ marginLeft: -92 }}><NowBanner /></div>;
          if (it.kind === 'now' && nowMarker === 'line') return <div key={it.id} style={{ marginLeft: -92 }}><NowLine /></div>;
          return renderRailItem(it, i, groupItems);
        })}
      </div>
    );
  };

  // ─── Filter controls ────────────────────────────────────────────
  const renderFilters = () => {
    if (filterStyle === 'tabs') {
      return (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, gap: 0 }}>
          {filters.map((f) => (
            <div key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 14px', cursor: 'pointer', fontSize: 13,
              fontWeight: filter === f ? 600 : 400,
              color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: filter === f ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
            }}>{f}</div>
          ))}
        </div>
      );
    }
    if (filterStyle === 'dropdown') {
      return (
        <div style={{ marginBottom: 12 }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
          >
            {filters.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      );
    }
    // chips
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {filters.map((f) => (
          <span key={f} onClick={() => setFilter(f)} className={`badge ${filter === f ? 'badge-violet' : 'badge-neutral'}`} style={{ cursor: 'pointer' }}>{f}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="cs-frame">
      <PRail active="today" onNavigate={onNav} mode={state.railMode} density={state.density} />
      <div className="cs-main">
        <PTopBar
          title="Wednesday, Apr 29"
          crumb="Timeline"
          action={
            <div className="row">
              <button className="btn btn-outline btn-sm">◀</button>
              <button className="btn btn-outline btn-sm">Today</button>
              <button className="btn btn-outline btn-sm">▶</button>
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'toast', msg: 'Quick log opened (placeholder)' })}><span>+</span> Log</button>
            </div>
          }
        />
        <div className="cs-body">
          <div style={{ display: 'grid', gridTemplateColumns: showSidebar ? '1fr 280px' : '1fr', gap: 24 }}>
            <div className="col">
              <PCard title="Today, in order" meta={`${filtered.length} events`}>
                {/* Inline filter when toolbar isn't shown in sidebar */}
                {!showFilters && filterStyle === 'tabs' && renderFilters()}
                {!showFilters && filterStyle === 'dropdown' && renderFilters()}
                {!showFilters && filterStyle === 'chips' && renderFilters()}
                {groups.map(([groupName, groupItems], gi) => (
                  <div key={groupName} style={{ marginTop: gi ? 24 : 0 }}>
                    {groupBy !== 'chronological' && (
                      <div className="mono" style={{
                        fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase',
                        marginBottom: 8, letterSpacing: '0.04em',
                      }}>{groupName} · {groupItems.length}</div>
                    )}
                    {renderGroupBody(groupItems)}
                  </div>
                ))}
              </PCard>
            </div>

            {showSidebar && (
              <div className="col">
                {showQuickLog && (
                  <PCard title="Quick log" meta="⌘L">
                    <div className="col" style={{ gap: 8 }}>
                      {[['℞','Medication','meds'],['☾','Sleep / wake'],['⊕','Meal'],['☎','Call / message'],['◔','Mood note','journal'],['✚','Visit / appointment']].map(([ic, lab, goto]) => (
                        <button key={lab} className="btn btn-outline" style={{ height: 36, justifyContent: 'flex-start', width: '100%' }} onClick={() => goto ? onNav(goto) : dispatch({ type: 'toast', msg: `${lab} log (placeholder)` })}>
                          <span style={{ width: 22, color: 'var(--primary)' }}>{ic}</span> {lab}
                        </button>
                      ))}
                    </div>
                  </PCard>
                )}

                {showFilters && (
                  <PCard title="Filter">
                    {renderFilters()}
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

window.ProtoToday = ProtoToday;
