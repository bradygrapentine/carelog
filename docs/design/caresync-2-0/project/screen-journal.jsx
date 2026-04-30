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
