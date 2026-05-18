// CareSync — secondary pages.
// Journal, Shifts, Medications, Team, Documents, Brief, Settings.

const { useState: useStatePages } = React;

// ─── Journal page ─────────────────────────────────────────────────────
function JournalPage({ t }) {
  const [filter, setFilter] = useStatePages("all");
  const [draft, setDraft] = useStatePages("");
  const [draftType, setDraftType] = useStatePages("note");

  const counts = { all: 0, note: 0, med: 0, symptom: 0, shift: 0, flagged: 0 };
  PAGE_DATA.journal.days.forEach(d => d.entries.forEach(e => {
    counts.all++; counts[e.type]++; if (e.flagged) counts.flagged++;
  }));

  const filters = [
    { id:"all", label:"All" },
    { id:"note", label:"Notes" },
    { id:"med", label:"Meds" },
    { id:"symptom", label:"Symptoms" },
    { id:"shift", label:"Shifts" },
    { id:"flagged", label:"Flagged" },
  ];

  function matches(e) {
    if (filter === "all") return true;
    if (filter === "flagged") return e.flagged;
    return e.type === filter;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>Care log · {DATA.recipient.firstName}</div>
          <h1 className="page-title headline-display">Journal</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline"><Icons.FileText/> Export week</button>
          <button className="btn btn-primary"><Icons.Plus/> Log a note</button>
        </div>
      </div>

      <div className="grid" style={{gridTemplateColumns: t.journalRail ? "1.6fr 1fr" : "1fr"}}>
        <div className="col">
          {t.journalShowQuickLog && <div className="quick-log">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"What happened with " + DATA.recipient.firstName + " just now?"}
            />
            <div className="actions">
              <div className="types">
                {["note","med","symptom","shift"].map(tp => (
                  <button key={tp} className={"type-chip " + (draftType === tp ? "active" : "")}
                    onClick={() => setDraftType(tp)}>{tp}</button>
                ))}
              </div>
              <button className="btn btn-primary btn-sm" disabled={!draft.trim()}
                style={{opacity: draft.trim() ? 1 : 0.4}}
                onClick={() => setDraft("")}>
                Log entry
              </button>
            </div>
          </div>}

          <div className="journal-head">
            <div className="journal-filters">
              {filters.map(f => (
                <button key={f.id}
                  className={"filter-chip " + (filter === f.id ? "active" : "")}
                  onClick={() => setFilter(f.id)}>
                  {f.label} <span className="ct">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const allEntries = PAGE_DATA.journal.days.flatMap(d => d.entries.map(e => ({...e, _day: d})));
            if (!t.journalGroup) {
              const list = allEntries.filter(matches);
              return (
                <div className="day-group">
                  {list.map(e => (
                    <div key={e.id}
                      className={"entry " + (e.mood || "") + (e.flagged && t.journalFlagBg ? " flagged" : "")}
                      style={{borderLeftWidth: t.journalBorder}}>
                      <div className="entry-time">
                        {e._day.sub} · {e.time}
                        <span className="entry-type">{e.type}</span>
                      </div>
                      <div className="entry-body">
                        <div className="entry-text">{e.text}</div>
                        <div className="entry-meta">
                          {e.mood && <span className={"mood-badge " + e.mood}>{e.mood}</span>}
                          <span className="entry-author">{e.author}</span>
                          {e.flagged && <span className="flag-tag"><Icons.AlertCircle size={11}/> Flagged for visit</span>}
                        </div>
                      </div>
                      <div className="entry-actions">
                        <button className="icon-btn" aria-label="Edit"><Icons.Settings size={14}/></button>
                        <button className="icon-btn" aria-label="Flag"><Icons.Bell size={14}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return PAGE_DATA.journal.days.map((day, di) => {
            const visible = day.entries.filter(matches);
            if (!visible.length) return null;
            return (
              <div className="day-group" key={di}>
                <div className="day-head">
                  <span className="day-date">{day.date}</span>
                  <span className="day-sub">{day.sub}</span>
                </div>
                {visible.map(e => (
                  <div key={e.id}
                    className={"entry " + (e.mood || "") + (e.flagged && t.journalFlagBg ? " flagged" : "")}
                    style={{borderLeftWidth: t.journalBorder}}>
                    <div className="entry-time">
                      {e.time}
                      <span className="entry-type">{e.type}</span>
                    </div>
                    <div className="entry-body">
                      <div className="entry-text">{e.text}</div>
                      <div className="entry-meta">
                        {e.mood && <span className={"mood-badge " + e.mood}>{e.mood}</span>}
                        <span className="entry-author">{e.author}</span>
                        {e.flagged && <span className="flag-tag"><Icons.AlertCircle size={11}/> Flagged for visit</span>}
                      </div>
                    </div>
                    <div className="entry-actions">
                      <button className="icon-btn" aria-label="Edit"><Icons.Settings size={14}/></button>
                      <button className="icon-btn" aria-label="Flag"><Icons.Bell size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          });
          })()}
        </div>

        {t.journalRail && <div className="col">
          <Card title="On shift now" headerStyle={t.headerStyle}>
            <div className="shift-now" style={{marginBottom: 0}}>
              <div className="shift-now-label">
                <span className="pulse"/> NOW · UNTIL 9:30P
              </div>
              <div className="shift-name">Sarah</div>
              <div className="shift-sub">Through evening meds + bedtime.</div>
            </div>
          </Card>
          <Card title="Flagged this week" headerStyle={t.headerStyle}
            action={<span className="eyebrow-mono">3</span>}>
            <ul style={{listStyle:"none", padding:0, margin:0, fontSize:13, lineHeight:1.6}}>
              <li style={{padding:"8px 0", borderBottom:"1px solid var(--color-border)"}}>
                <span className="eyebrow-mono" style={{marginRight:8}}>Tue 11:34p</span>
                Asking about Dad — first time in ~3 weeks
              </li>
              <li style={{padding:"8px 0", borderBottom:"1px solid var(--color-border)"}}>
                <span className="eyebrow-mono" style={{marginRight:8}}>Mon 7:30p</span>
                Atorvastatin skipped — 2nd evening
              </li>
              <li style={{padding:"8px 0"}}>
                <span className="eyebrow-mono" style={{marginRight:8}}>Tue 6:20p</span>
                Cold extremities, refused dinner
              </li>
            </ul>
          </Card>
          <Card title="Quick references" headerStyle={t.headerStyle}>
            <div style={{display:"flex", flexDirection:"column", gap:8}}>
              <button className="btn btn-outline btn-sm" style={{justifyContent:"flex-start"}}><Icons.FileText size={14}/> DNR (last signed May 2024)</button>
              <button className="btn btn-outline btn-sm" style={{justifyContent:"flex-start"}}><Icons.Pill size={14}/> Active medications</button>
              <button className="btn btn-outline btn-sm" style={{justifyContent:"flex-start"}}><Icons.Heart size={14}/> Cardiology · Dr. Hsu</button>
            </div>
          </Card>
        </div>}
      </div>
    </>
  );
}

// ─── Shifts page ──────────────────────────────────────────────────────
function fmtHr(h) {
  const whole = Math.floor(h);
  const min = Math.round((h - whole) * 60);
  const ampm = whole >= 12 ? "p" : "a";
  const dispH = whole === 0 ? 12 : whole > 12 ? whole - 12 : whole;
  return min > 0 ? `${dispH}:${String(min).padStart(2,"0")}${ampm}` : `${dispH}${ampm}`;
}
function ShiftsPage({ t }) {
  const { week, hours, blocks, gaps } = PAGE_DATA.shifts;
  const startHr = t.shiftsDayStart;
  const endHr = t.shiftsDayEnd;
  const totalH = endHr - startHr;
  const cellHeight = t.shiftsRowHeight;
  const todayIdx = 1; // Tuesday

  function blockStyle(b) {
    const top = (b.s - startHr) * cellHeight;
    const height = (b.e - b.s) * cellHeight - 2;
    return { top, height };
  }

  // Stats
  const assigned = blocks.filter(b => b.status !== "unassigned").length;
  const totalHours = blocks.reduce((sum, b) => b.status !== "unassigned" ? sum + (b.e - b.s) : sum, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>Coverage · this week</div>
          <h1 className="page-title headline-display">Shifts</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline">‹ Week</button>
          <button className="btn btn-outline">Today</button>
          <button className="btn btn-outline">Week ›</button>
          <button className="btn btn-primary"><Icons.Plus/> New shift</button>
        </div>
      </div>

      <div className="shifts-summary" style={{display: t.shiftsShowStats ? "grid" : "none"}}>
        <div className="shifts-stat">
          <div className="stat-num"><em>{Math.round(totalHours)}</em>h covered</div>
          <div className="stat-label">This week</div>
        </div>
        <div className="shifts-stat warn">
          <div className="stat-num"><em>{gaps}</em> open shifts</div>
          <div className="stat-label">Need a person</div>
        </div>
        <div className="shifts-stat">
          <div className="stat-num"><em>4</em> teammates</div>
          <div className="stat-label">Sharing the week</div>
        </div>
      </div>

      <div className="shifts-toolbar">
        <div className="week-label">May 19 – 25, 2026</div>
        <div className="filter-chip" style={{cursor:"default"}}>
          <span className="dot" style={{width:6,height:6,borderRadius:"50%",background:"var(--color-success)",marginRight:4}}/>
          In progress
          <span style={{margin:"0 6px",color:"var(--color-border)"}}>·</span>
          <span className="dot" style={{width:6,height:6,borderRadius:"50%",background:"var(--color-primary)",marginRight:4}}/>
          Scheduled
          <span style={{margin:"0 6px",color:"var(--color-border)"}}>·</span>
          <span className="dot" style={{width:6,height:6,borderRadius:"50%",background:"var(--color-danger)",marginRight:4}}/>
          Open
        </div>
      </div>

      <div className="cal">
        <div className="cal-grid">
          <div className="cal-corner" />
          {week.map((d, i) => (
            <div key={i} className={"cal-dayhead " + (i === todayIdx ? "today" : "")}>
              {d}
            </div>
          ))}
          {Array.from({ length: totalH }).map((_, hi) => {
            const hr = startHr + hi;
            const label = hr === 12 ? "12p" : hr > 12 ? (hr - 12) + "p" : hr + "a";
            return (
              <React.Fragment key={hi}>
                <div className="cal-hour" style={{height: cellHeight}}>{label}</div>
                {week.map((_, di) => (
                  <div key={di}
                    className={"cal-cell " + (di === todayIdx ? "today-col" : "")}
                    style={{height: cellHeight}}
                  >
                    {/* Only draw blocks anchored to this hour in this day */}
                    {hi === 0 && blocks.filter(b => b.d === di).map((b, bi) => (
                      <div key={bi} className={"shift-block " + b.status + (b.appt ? " appt" : "")}
                        style={blockStyle(b)}>
                        <div className="who">{b.who || "Unfilled"}</div>
                        <div className="role-tiny">
                          {b.role} · {Math.round((b.e - b.s) * 2) / 2}h
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Mobile agenda view — CSS-toggled in pages.css */}
      <div className="shifts-agenda">
        {week.map((dayName, di) => {
          const dayBlocks = blocks.filter(b => b.d === di);
          if (!dayBlocks.length) return null;
          return (
            <div className="agenda-day" key={di}>
              <div className={"agenda-day-label " + (di === todayIdx ? "today" : "")}>
                {dayName}{di === todayIdx ? " · Today" : ""}
              </div>
              {dayBlocks.map((b, bi) => (
                <div key={bi} className={"agenda-row " + b.status + (b.appt ? " appt" : "")}>
                  <div className="agenda-time">{fmtHr(b.s)} – {fmtHr(b.e)}</div>
                  <div className="agenda-who">
                    {b.who || "Unfilled"}
                    <span className="role-tiny">{b.role} · {Math.round((b.e - b.s) * 2) / 2}h</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Medications page ─────────────────────────────────────────────────
function MedicationsPage({ t }) {
  const lowSupply = PAGE_DATA.medications.filter(m => /\d+/.test(m.supply) && parseInt(m.supply) < 7);
  return (
    <>
      <div className="med-page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>Active · {PAGE_DATA.medications.length}</div>
          <h1 className="page-title headline-display">Medications</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline"><Icons.FileText/> Pharmacy list</button>
          <button className="btn btn-primary"><Icons.Plus/> Add medication</button>
        </div>
      </div>

      {t.medsBanner && lowSupply.length > 0 && (
        <div className="refill-banner">
          <Icons.AlertCircle size={18} className="icon" />
          <div>
            <strong>{lowSupply.length} refill{lowSupply.length > 1 ? "s" : ""} need attention.</strong>{" "}
            {lowSupply.map(m => m.name).join(", ")} below 7-day supply. Pharmacy: CVS Westlake.
          </div>
          <button className="btn btn-outline btn-sm" style={{marginLeft:"auto"}}>Request refills</button>
        </div>
      )}

      <div className={"med-list" + (t.medsCompact ? " compact" : "")}>
        <div className="med-list-head">
          <div>Medication</div>
          <div>Dose</div>
          <div>Schedule</div>
          <div className="h-supply">Supply</div>
          <div className="h-last">Last taken</div>
          <div></div>
        </div>
        {PAGE_DATA.medications.map((m, i) => {
          const supplyNum = parseInt(m.supply);
          const low = !isNaN(supplyNum) && supplyNum < 7;
          const missed = m.taken === "missed today";
          return (
            <div className="med-list-row" key={i}>
              <div>
                <div className="name">{m.name}</div>
                <span className="form-meta">{m.form} · {m.notes}</span>
              </div>
              <div className="dose">{m.dose}</div>
              <div className="schedule">
                {m.schedule}
                <span className="with">{m.with}</span>
              </div>
              <div className={"supply " + (low ? "low" : "")}>{m.supply}</div>
              <div className={"last " + (missed ? "missed" : "")}>{m.taken}</div>
              <div style={{textAlign:"right"}}>
                <button className="icon-btn"><Icons.Settings size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Team page ────────────────────────────────────────────────────────
function TeamPage({ t }) {
  const groups = {
    "Coordinator": PAGE_DATA.team.filter(m => m.role === "Coordinator"),
    "Caregivers": PAGE_DATA.team.filter(m => m.role === "Caregiver"),
    "Paid aides": PAGE_DATA.team.filter(m => m.role === "Aide"),
    "Clinicians": PAGE_DATA.team.filter(m => m.role === "Clinician"),
    "Supporters": PAGE_DATA.team.filter(m => m.role === "Supporter"),
  };
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>Care team · {PAGE_DATA.team.length} active</div>
          <h1 className="page-title headline-display">Team</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline"><Icons.Mail/> Pending ({PAGE_DATA.pendingInvites.length})</button>
          <button className="btn btn-primary"><Icons.Plus/> Invite someone</button>
        </div>
      </div>

      {t.teamGroupByRole ? (
        Object.entries(groups).map(([title, members]) => members.length ? (
          <div key={title}>
            <h2 className="section-title">{title}</h2>
            <div className="team-grid">
              {members.map((m, i) => (
                <div className="team-card" key={i}>
                  <div className="team-row">
                    <div className="team-avatar">{m.initials}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div className="team-name">{m.who}</div>
                      <div className="team-meta">{m.rel}</div>
                      <div>
                        {m.status === "You" && <span className="team-pill you">You</span>}
                        {m.status === "On shift" && <span className="team-pill on-shift">On shift</span>}
                      </div>
                    </div>
                  </div>
                  {t.teamShowAccess && (
                    <div className="team-access">
                      <span>{m.access}</span>
                      <span>last seen {m.lastSeen}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null)
      ) : (
        <div className="team-grid">
          {PAGE_DATA.team.map((m, i) => (
            <div className="team-card" key={i}>
              <div className="team-row">
                <div className="team-avatar">{m.initials}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="team-name">{m.who}</div>
                  <div className="team-meta">{m.role} · {m.rel}</div>
                  <div>
                    {m.status === "You" && <span className="team-pill you">You</span>}
                    {m.status === "On shift" && <span className="team-pill on-shift">On shift</span>}
                  </div>
                </div>
              </div>
              {t.teamShowAccess && (
                <div className="team-access">
                  <span>{m.access}</span>
                  <span>last seen {m.lastSeen}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {PAGE_DATA.pendingInvites.length > 0 && (
        <>
          <h2 className="section-title">Pending invites</h2>
          <div className="team-grid">
            {PAGE_DATA.pendingInvites.map((p, i) => (
              <div className="team-card" key={i} style={{borderStyle:"dashed"}}>
                <div className="team-row">
                  <div className="team-avatar" style={{background:"var(--color-surface-muted)", color:"var(--color-muted)"}}>
                    <Icons.Mail size={18}/>
                  </div>
                  <div style={{flex:1}}>
                    <div className="team-name">{p.who}</div>
                    <div className="team-meta">{p.email}</div>
                  </div>
                </div>
                <div className="team-access">
                  <span>Invite sent {p.sent}</span>
                  <button className="btn btn-ghost btn-sm">Resend</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ─── Documents page ───────────────────────────────────────────────────
function DocumentsPage({ t }) {
  const iconMap = {
    FileText: Icons.FileText,
    Heart: Icons.Heart,
    Receipt: Icons.Receipt,
    Sun: Icons.Sun,
  };
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>{PAGE_DATA.documents.recent.length + 22} documents · 86 MB</div>
          <h1 className="page-title headline-display">Documents</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline"><Icons.Sparkles/> Scan with OCR</button>
          <button className="btn btn-primary"><Icons.Plus/> Upload</button>
        </div>
      </div>

      {t.docsShowFolders && t.docsView !== "list" && (
        <>
          <h2 className="section-title">Folders</h2>
          <div className="docs-folders">
            {PAGE_DATA.documents.folders.map((f, i) => {
              const Ico = iconMap[f.icon] || Icons.FileText;
              return (
                <div className="doc-folder" key={i}>
                  <div className={"icon-tile " + (f.color || "")}><Ico size={18}/></div>
                  <div className="name">{f.name}</div>
                  <div className="count">{f.count} files</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="section-title">Recent uploads</h2>
      <div className="docs-list">
        {PAGE_DATA.documents.recent.map((d, i) => (
          <div className="doc-row" key={i}>
            <div className="icon-tile"><Icons.FileText size={14}/></div>
            <div className="name">
              {d.name}
              <small>{d.folder} · uploaded by {d.by}</small>
            </div>
            <div className="size">{d.size}</div>
            <div className="when">{d.at}</div>
            <div>{d.ocr && <span className="ocr-pill">OCR ✓</span>}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Brief page ───────────────────────────────────────────────────────
function BriefPage({ t }) {
  const b = PAGE_DATA.brief;
  const headlineClass = "brief-headline" +
    (t.briefHeadline === "bold" ? " bold" : t.briefHeadline === "sans" ? " sans" : "");
  return (
    <div className="brief-page">
      <div className="brief-actions">
        <button className="btn btn-outline"><Icons.Mail/> Email family</button>
        <button className="btn btn-outline"><Icons.Printer/> Print for visit</button>
        <button className="btn btn-outline" style={{marginLeft:"auto"}}><Icons.FileText/> Edit brief</button>
      </div>
      <div className="brief-eyebrow">{b.eyebrow}</div>
      <h1 className={headlineClass}>
        <HeadlineParts parts={b.headlineParts} />
      </h1>
      <section style={{fontSize: t.briefBodySize}}>
        {b.paragraphs.map((p, i) => (
          <p className="brief-paragraph" style={{fontSize: "inherit"}} key={i}>
            <span className="date">{p.date} —</span>
            {p.text}
          </p>
        ))}
      </section>

      {(t.briefShowFlagged || t.briefShowMeds) && <hr className="brief-divider" />}

      {(t.briefShowFlagged || t.briefShowMeds) && (
        <h2 className="brief-section-title">For your next visit</h2>
      )}
      {t.briefShowFlagged && (
        <>
          <p className="brief-eyebrow" style={{marginBottom:8}}>Flagged this week</p>
          <ul className="brief-list">
            {b.flagged.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}

      {t.briefShowMeds && (
        <>
          <p className="brief-eyebrow" style={{marginBottom:8, marginTop:24}}>Active medications</p>
          <ul className="brief-list">
            {b.medications.map((m, i) => (
              <li key={i}>
                <strong>{m.name}</strong> <span className="meta">{m.dose}</span> {m.note}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="brief-footer">
        A point-in-time snapshot generated by CareSync. Shared with Dr. Marie Hsu (Cardiology) on May 18.
      </div>
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────
function SettingsPage({ t }) {
  const [tab, setTab] = useStatePages("profile");
  const [notifAll, setNotifAll] = useStatePages(true);
  const [notifShift, setNotifShift] = useStatePages(true);
  const [notifMed, setNotifMed] = useStatePages(false);
  const [notifFlag, setNotifFlag] = useStatePages(true);
  const [reduceMotion, setReduceMotion] = useStatePages(false);

  const tabs = [
    { id:"profile", label:"Profile" },
    { id:"recipient", label:"Care recipient" },
    { id:"notifications", label:"Notifications" },
    { id:"accessibility", label:"Accessibility" },
    { id:"billing", label:"Billing" },
    { id:"export", label:"Export & privacy" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom:10}}>Account · Alex Lin</div>
          <h1 className="page-title headline-display">Settings</h1>
        </div>
      </div>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings tabs">
          {tabs.map(tb => (
            <a key={tb.id} className={tab === tb.id ? "active" : ""}
              onClick={() => setTab(tb.id)} role="button" tabIndex={0}>{tb.label}</a>
          ))}
        </nav>
        <div>
          {tab === "profile" && (
            <div className="settings-section">
              <h3>Profile</h3>
              <p className="sub">How you appear to the rest of the care team.</p>
              <div className="field-row">
                <div className="label">Display name</div>
                <input type="text" defaultValue="Alex Lin" />
              </div>
              <div className="field-row">
                <div className="label">Email <span className="help">Used for invites + login.</span></div>
                <input type="email" defaultValue="alex.lin@hey.com" />
              </div>
              <div className="field-row">
                <div className="label">Role on this team</div>
                <select defaultValue="coordinator">
                  <option value="coordinator">Coordinator</option>
                  <option>Caregiver</option>
                  <option>Aide</option>
                  <option>Supporter</option>
                </select>
              </div>
              <div className="field-row">
                <div className="label">Relationship to recipient</div>
                <input type="text" defaultValue="Daughter" />
              </div>
            </div>
          )}

          {tab === "recipient" && (
            <div className="settings-section">
              <h3>Care recipient · Margaret Lin</h3>
              <p className="sub">PHI lives in our identity vault; team members see display name only.</p>
              <div className="field-row">
                <div className="label">Display name</div>
                <input type="text" defaultValue="Margaret Lin" />
              </div>
              <div className="field-row">
                <div className="label">Preferred name</div>
                <input type="text" defaultValue="Mom" />
              </div>
              <div className="field-row">
                <div className="label">Date of birth</div>
                <input type="text" defaultValue="•• ••• 1947" />
              </div>
              <div className="field-row">
                <div className="label">Primary clinician</div>
                <select defaultValue="hsu">
                  <option value="hsu">Dr. Marie Hsu — Cardiology</option>
                  <option>Dr. Wilson — Internal Medicine</option>
                </select>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div className="settings-section">
              <h3>Notifications</h3>
              <p className="sub">Caregivers are tired. We will only ping you about what matters.</p>
              <div className="field-row">
                <div className="label">All notifications<span className="help">Master switch — turns everything below off.</span></div>
                <button className={"switch " + (notifAll ? "on" : "")} onClick={() => setNotifAll(v=>!v)} aria-pressed={notifAll}/>
              </div>
              <div className="field-row">
                <div className="label">Shift starts &amp; handoffs</div>
                <button className={"switch " + (notifAll && notifShift ? "on" : "")} onClick={() => setNotifShift(v=>!v)} aria-pressed={notifShift}/>
              </div>
              <div className="field-row">
                <div className="label">Missed medications</div>
                <button className={"switch " + (notifAll && notifMed ? "on" : "")} onClick={() => setNotifMed(v=>!v)} aria-pressed={notifMed}/>
              </div>
              <div className="field-row">
                <div className="label">Flagged journal entries</div>
                <button className={"switch " + (notifAll && notifFlag ? "on" : "")} onClick={() => setNotifFlag(v=>!v)} aria-pressed={notifFlag}/>
              </div>
              <div className="field-row">
                <div className="label">Quiet hours</div>
                <select defaultValue="9p-7a">
                  <option value="9p-7a">9:00p — 7:00a</option>
                  <option>10:00p — 6:00a</option>
                  <option>None</option>
                </select>
              </div>
            </div>
          )}

          {tab === "accessibility" && (
            <div className="settings-section">
              <h3>Accessibility</h3>
              <p className="sub">WCAG 2.2 AA. Caregivers skew older, use the app one-handed, often under stress.</p>
              <div className="field-row">
                <div className="label">Reduce motion<span className="help">Disables hover lifts + the pulse animation.</span></div>
                <button className={"switch " + (reduceMotion ? "on" : "")} onClick={() => setReduceMotion(v=>!v)} aria-pressed={reduceMotion}/>
              </div>
              <div className="field-row">
                <div className="label">Text size</div>
                <select defaultValue="default">
                  <option value="default">Default</option>
                  <option>Larger</option>
                  <option>Largest</option>
                </select>
              </div>
              <div className="field-row">
                <div className="label">High contrast mode</div>
                <button className="switch" />
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="settings-section">
              <h3>Billing</h3>
              <p className="sub">Family plan — one subscription covers everyone on the care team.</p>
              <div className="field-row">
                <div className="label">Current plan</div>
                <div>Family · <span className="eyebrow-mono">$14/mo</span> · renews Jun 11</div>
              </div>
              <div className="field-row">
                <div className="label">Card on file</div>
                <div>•••• 4242 · Expires 09/27</div>
              </div>
              <div className="field-row">
                <div className="label">Receipts</div>
                <button className="btn btn-outline btn-sm" style={{justifySelf:"start"}}>Email me last 12 months</button>
              </div>
            </div>
          )}

          {tab === "export" && (
            <div className="settings-section">
              <h3>Export &amp; privacy</h3>
              <p className="sub">The care log belongs to the family. Take it with you whenever you want.</p>
              <div className="field-row">
                <div className="label">Export everything<span className="help">JSON + PDF bundle, emailed within 1 hour.</span></div>
                <button className="btn btn-outline btn-sm" style={{justifySelf:"start"}}>Request export</button>
              </div>
              <div className="field-row">
                <div className="label">Delete this account</div>
                <button className="btn btn-outline btn-sm" style={{color:"var(--color-danger)", justifySelf:"start", borderColor:"var(--color-danger-subtle)"}}>Delete account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

Object.assign(window, {
  JournalPage, ShiftsPage, MedicationsPage,
  TeamPage, DocumentsPage, BriefPage, SettingsPage,
});
