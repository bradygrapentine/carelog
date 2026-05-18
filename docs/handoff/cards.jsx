// CareSync — dashboard sub-components.
// Each card respects header style + density tokens; tweak panel rewires from main.

const { useState } = React;

// ─── Brief headline parts renderer ────────────────────────────────────
function HeadlineParts({ parts }) {
  return (
    <>{parts.map((p, i) => p.kind === "em" ? <em key={i}>{p.text}</em> : <span key={i}>{p.text}</span>)}</>
  );
}

// ─── Card shell with header variants ──────────────────────────────────
function Card({ title, action, headerStyle = "tinted", children, lift = true, className = "" }) {
  const headerClass = "ch-" + headerStyle + (headerStyle === "serif" ? " ch-serif" : "");
  return (
    <section className={"card " + (lift ? "lift " : "") + className}>
      {title && (
        <header className={"card-header " + headerClass}>
          <h3 className="card-title">{title}</h3>
          {action}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

// ─── Hero (BriefHero) ─────────────────────────────────────────────────
function BriefHero({ headlineStyle, showPills, showBlob, blobStyle, compact }) {
  const b = DATA.brief;
  const cls = ["headline-display", "hero-headline"];
  if (headlineStyle === "bold") cls.push("bold");
  if (headlineStyle === "sans") cls.push("sansy");
  if (compact) cls.push("compact");
  return (
    <section className="hero" aria-label="Today's brief">
      {showBlob && <div className={"hero-blob " + (blobStyle === "warm" ? "warm" : "")} aria-hidden="true" />}
      <div className="hero-content">
        <span className="hero-eyebrow eyebrow-mono">
          <span className="dot" />
          <span>{b.eyebrow}</span>
        </span>
        <h1 className={cls.join(" ")}>
          <HeadlineParts parts={b.parts} />
        </h1>
        {showPills && (
          <ul className="hero-pills">
            {b.pills.map((p) => (
              <li key={p.id}>
                <span className={"pill " + p.tone}>
                  <span className="dot" />
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Medication card ──────────────────────────────────────────────────
function MedCard({ headerStyle }) {
  const [meds, setMeds] = useState(DATA.meds);
  const toggle = (i) => setMeds(m => m.map((x, idx) => idx === i ? { ...x, state: x.state === "done" ? "due" : "done" } : x));
  return (
    <Card title="Today’s medications" headerStyle={headerStyle}
      action={<button className="btn btn-ghost btn-sm"><Icons.Plus size={14}/> Log</button>}>
      <div>
        {meds.map((m, i) => {
          const checkCls = "med-check" + (m.state === "done" ? " done" : m.state === "missed" ? " missed" : "");
          return (
            <div className="med-row" key={i}>
              <button className={checkCls} aria-label={`Mark ${m.name} ${m.state === "done" ? "undone" : "done"}`} onClick={() => toggle(i)}>
                <Icons.Check size={14}/>
              </button>
              <div className="med-info">
                <div className="med-name">{m.name} <span className="dosage">{m.dose}</span></div>
                <div className="med-meta">{m.instr || "—"}</div>
              </div>
              <div className={"med-time " + (m.state === "missed" ? "missed" : "")}>
                {m.state === "missed" ? "MISSED " : ""}{m.at}
                {m.due && <div style={{color: "var(--color-primary-deep)"}}>{m.due}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Mood card ────────────────────────────────────────────────────────
function MoodCard({ headerStyle, style }) {
  return (
    <Card title="This week’s mood" headerStyle={headerStyle}
      action={<button className="btn btn-ghost btn-sm">7d</button>}>
      {style === "bars" ? (
        <div className="mood-bars" role="img" aria-label="Mood for the past 7 days">
          {DATA.mood.map((d, i) => {
            const h = d.m === "good" ? 80 : d.m === "okay" ? 60 : d.m === "difficult" ? 40 : 25;
            return (
              <div key={i} className="mood-bar-wrap">
                <div className={"mood-bar " + d.m} style={{ height: h + "%" }} />
                <span className="mood-day-label">{d.d[0]}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mood-week" role="img" aria-label="Mood for the past 7 days">
          {DATA.mood.map((d, i) => (
            <div key={i} className="mood-day">
              <div className={"mood-dot " + d.m + (d.today ? " today" : "")} title={d.m}>
                {d.m === "good" ? "✓" : d.m === "okay" ? "~" : d.m === "difficult" ? "↓" : "!"}
              </div>
              <span className="mood-day-label">{d.d[0]}</span>
            </div>
          ))}
        </div>
      )}
      <p className="mood-note">
        <q>{DATA.moodNote.quote}</q>
        <span className="attr">— {DATA.moodNote.by}</span>
      </p>
    </Card>
  );
}

// ─── Sleep / Sparkline (editorial stat) ───────────────────────────────
function SleepCard({ headerStyle, style }) {
  const data = DATA.sleep.spark;
  const min = Math.min(...data), max = Math.max(...data);
  const W = 240, H = 56, pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i * (W - pad * 2)) / (data.length - 1);
    const y = H - pad - ((v - min) / Math.max(0.1, max - min)) * (H - pad * 2);
    return [x, y];
  });
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <Card title="Sleep — last 7 nights" headerStyle={headerStyle}
      action={<span className="eyebrow-mono">{DATA.sleep.change}</span>}>
      <div className="sleep-row">
        <div>
          <div className="sleep-big"><em>{DATA.sleep.hours}h</em></div>
          <div className="sleep-sub">last night</div>
        </div>
      </div>
      {style === "bars" ? (
        <div className="mood-bars" style={{height: 56}}>
          {data.map((v, i) => (
            <div key={i} className="mood-bar-wrap">
              <div className="mood-bar" style={{height: ((v-min)/Math.max(0.1,max-min)*100) + "%", background: "var(--color-primary-light)"}} />
            </div>
          ))}
        </div>
      ) : (
        <svg className="sleep-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={path + ` L ${W-pad} ${H-pad} L ${pad} ${H-pad} Z`} fill="url(#sleepFill)" />
          <path d={path} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length-1 ? 4 : 2.5}
              fill={i === pts.length-1 ? "var(--color-primary-deep)" : "var(--color-primary)"} />
          ))}
        </svg>
      )}
    </Card>
  );
}

// ─── Coming up ────────────────────────────────────────────────────────
function ComingUp({ headerStyle, limit = 4 }) {
  return (
    <Card title="Coming up" headerStyle={headerStyle}
      action={<button className="btn btn-ghost btn-sm">All <Icons.ChevronRight size={12}/></button>}>
      <div className="timeline">
        {DATA.comingUp.slice(0, limit).map((it, i) => (
          <div className="tl-item" key={i}>
            <div className="tl-when">{it.when}</div>
            <div>
              <div className="tl-title">{it.title}</div>
              <div className="tl-sub">{it.sub}</div>
            </div>
            <span className={"tl-tag " + it.tag}>{it.tag}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── On-shift sidebar ─────────────────────────────────────────────────
function OnShift({ headerStyle }) {
  return (
    <Card title="On shift" headerStyle={headerStyle}>
      <div className="shift-now">
        <div className="shift-now-label">
          <span className="pulse" /> NOW · UNTIL {DATA.onShift.current.until.toUpperCase()}
        </div>
        <div className="shift-name">{DATA.onShift.current.name}</div>
        <div className="shift-sub">{DATA.onShift.current.note}</div>
      </div>
      <div>
        {DATA.onShift.upNext.map((s, i) => (
          <div className="shift-row" key={i}>
            <div className="avatar">{s.initials}</div>
            <div>
              <div className="who">{s.who}</div>
              <div className="when">{s.when}</div>
            </div>
            <span className="role">{s.role}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Pattern card (editorial footer) ──────────────────────────────────
function PatternCard({ style }) {
  return (
    <div className={"pattern " + (style === "editorial" ? "editorial" : "")}>
      <div className="pattern-eyebrow">{DATA.pattern.eyebrow}</div>
      <p className="pattern-text"><HeadlineParts parts={DATA.pattern.parts} /></p>
      <div className="pattern-sub">{DATA.pattern.sub}</div>
    </div>
  );
}

// ─── Now Board ────────────────────────────────────────────────────────
function NowBoard({ headerStyle }) {
  return (
    <Card title="Now Board" headerStyle={headerStyle}>
      <div className="nb-group">
        <div className="nb-group-label">Past</div>
        {DATA.nowBoard.past.map((e, i) => (
          <div key={i} className={"nb-event " + (e.mood || "")}>
            <div className="nb-event-head">
              <span className="nb-type">{e.type}</span>
              <span className="nb-time">{e.time}</span>
            </div>
            <div className="nb-text">{e.text}</div>
          </div>
        ))}
      </div>
      <div className="nb-marker">
        <span className="dot" />
        <span className="nb-marker-label">NOW · 11:34p</span>
        <span className="rule" />
      </div>
      <div className="nb-group">
        <div className="nb-group-label">Up next</div>
        {DATA.nowBoard.upNext.map((e, i) => (
          <div key={i} className={"nb-event " + (e.mood || "")}>
            <div className="nb-event-head">
              <span className="nb-type">{e.type}</span>
              <span className="nb-time">{e.time}</span>
            </div>
            <div className="nb-text">{e.text}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Magazine layout pieces ───────────────────────────────────────────
function MagStat({ value, label, note, headerStyle = "outline" }) {
  const parts = String(value).split(/(\d+\.?\d*)/);
  return (
    <Card headerStyle={headerStyle} title={label}>
      <div className="mag-stat">
        {parts.map((p, i) => /\d/.test(p) ? <em key={i}>{p}</em> : <span key={i}>{p}</span>)}
      </div>
      {note && <div className="mag-note">{note}</div>}
    </Card>
  );
}

Object.assign(window, {
  Card, BriefHero, MedCard, MoodCard, SleepCard, ComingUp,
  OnShift, PatternCard, NowBoard, MagStat, HeadlineParts,
});
