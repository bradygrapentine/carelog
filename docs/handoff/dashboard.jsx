// CareSync — App shell + router + Tweaks panel.

const { useEffect, useState } = React;

const DEFAULTS = {
  "layout": "editorial",
  "headlineStyle": "italic",
  "headlineCompact": false,
  "showBlob": true,
  "blobStyle": "violet",
  "showPills": true,
  "density": "comfortable",
  "surface": "cream",
  "shell": "expanded",
  "showRecipientCard": true,
  "headerStyle": "tinted",
  "cardRadius": 14,
  "cardLift": true,
  "showMed": true,
  "showMood": true,
  "showSleep": true,
  "showComingUp": true,
  "showOnShift": true,
  "showPattern": true,
  "moodStyle": "dots",
  "sleepStyle": "spark",
  "comingUpLimit": 4,
  "patternStyle": "editorial",
  "addonsBar": true,
  "journalRail": true,
  "journalBorder": 4,
  "journalGroup": true,
  "journalShowQuickLog": true,
  "journalFlagBg": true,
  "shiftsShowStats": true,
  "shiftsDayStart": 6,
  "shiftsDayEnd": 22,
  "shiftsRowHeight": 36,
  "medsBanner": true,
  "medsCompact": false,
  "teamGroupByRole": true,
  "teamShowAccess": true,
  "docsView": "both",
  "docsShowFolders": true,
  "briefHeadline": "italic",
  "briefShowFlagged": true,
  "briefShowMeds": true,
  "briefBodySize": 17
};

// ─── Routes ───────────────────────────────────────────────────────────
const ROUTES = [
  { id:"today",     label:"Today",       icon:"Home",     meta:"" },
  { id:"journal",   label:"Journal",     icon:"Journal",  meta:"12" },
  { id:"shifts",    label:"Shifts",      icon:"Calendar", meta:"" },
  { id:"meds",      label:"Medications", icon:"Pill",     meta:"" },
  { id:"team",      label:"Team",        icon:"Users",    meta:"" },
];
const ROUTES_RECORDS = [
  { id:"documents", label:"Documents",   icon:"FileText", meta:"" },
  { id:"brief",     label:"Visit brief", icon:"Sparkles", meta:"" },
  { id:"settings",  label:"Settings",    icon:"Settings", meta:"" },
];

function parseHash() {
  const h = (window.location.hash || "").replace(/^#/, "");
  const known = [...ROUTES, ...ROUTES_RECORDS].some(r => r.id === h);
  return known ? h : "today";
}

// ─── Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ shell, showRecipientCard, current, onNav }) {
  const railClass = shell === "rail" ? "shell rail" : "shell";
  const NavItem = ({ r }) => {
    const Ico = Icons[r.icon] || Icons.Home;
    const active = current === r.id;
    return (
      <a className={"nav-item " + (active ? "active" : "")}
        href={"#" + r.id}
        onClick={(e) => { e.preventDefault(); onNav(r.id); }}>
        <Ico size={17}/>
        <span className="nav-label">{r.label}</span>
        {r.meta && <span className="nav-meta">{r.meta}</span>}
      </a>
    );
  };
  return (
    <nav className={railClass} aria-label="Primary">
      <div className="shell-logo">
        <div className="shell-mark"></div>
        <div className="shell-name">CareSync</div>
      </div>

      <div className="shell-section-label">Care</div>
      {ROUTES.map(r => <NavItem key={r.id} r={r}/>)}

      <div className="shell-section-label">Records</div>
      {ROUTES_RECORDS.filter(r => r.id !== "settings").map(r => <NavItem key={r.id} r={r}/>)}

      {showRecipientCard && shell === "expanded" && (
        <div className="recipient-card" style={{marginTop: 20}}>
          <div className="recipient-avatar">{DATA.recipient.initials}</div>
          <div style={{minWidth:0, flex:1}}>
            <div className="recipient-name">{DATA.recipient.fullName}</div>
            <div className="recipient-status">{DATA.recipient.status}</div>
          </div>
        </div>
      )}

      <div className="shell-footer">
        <NavItem r={ROUTES_RECORDS.find(r => r.id === "settings")} />
      </div>
    </nav>
  );
}

// ─── Today head ───────────────────────────────────────────────────────
function TodayHead({ recipient, teams, addonsBar, layout, onLayout }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow-mono" style={{marginBottom: 10}}>Tuesday · May 19 · 11:34p</div>
          <h1 className="page-title headline-display">Caring for <em>{recipient.firstName}</em></h1>
        </div>
        <div className="page-actions">
          {addonsBar && (
            <div className="toggle-group" role="tablist" aria-label="Dashboard view">
              <button className={layout === "editorial" ? "active" : ""} onClick={() => onLayout("editorial")}>Today</button>
              <button className={layout === "now" ? "active" : ""} onClick={() => onLayout("now")}>Now</button>
              <button className={layout === "magazine" ? "active" : ""} onClick={() => onLayout("magazine")}>Magazine</button>
            </div>
          )}
          <button className="btn btn-outline" aria-label="Generate visit summary">
            <Icons.Printer/> <span>Visit summary</span>
          </button>
          <button className="btn btn-primary">
            <Icons.Plus/> Log a note
          </button>
        </div>
      </div>
      <div className="chips" style={{marginBottom: 22}}>
        <span className="eyebrow-mono" style={{marginRight: 6}}>Recipients</span>
        {teams.map(tm => (
          <button key={tm.id} className={"chip " + (tm.active ? "active" : "")}>
            <span className="ini">{tm.initials}</span>
            {tm.first}
            <span className="eyebrow-mono" style={{marginLeft: 6, fontSize:10}}>{tm.role}</span>
          </button>
        ))}
        <button className="chip" style={{borderStyle:"dashed", color: "var(--color-muted)"}}>
          <Icons.Plus size={12}/> Add care team
        </button>
      </div>
    </>
  );
}

// ─── Mobile top bar (compact app header) ──────────────────────────────
function MobileTopBar({ current }) {
  const titles = {
    today: "Today", journal: "Journal", shifts: "Shifts", meds: "Medications",
    team: "Team", documents: "Documents", brief: "Visit brief", settings: "Settings",
  };
  return (
    <header className="mobile-top">
      <div className="mt-mark">c</div>
      <div className="mt-title">{titles[current] || "CareSync"}</div>
      <button className="mt-bell" aria-label="Notifications"><Icons.Bell size={18}/></button>
    </header>
  );
}

// ─── Mobile bottom-tab nav ────────────────────────────────────────────
function MobileNav({ current, onNav }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRoutes = [
    {id:"team",      label:"Team",        icon:"Users"},
    {id:"documents", label:"Documents",   icon:"FileText"},
    {id:"brief",     label:"Visit brief", icon:"Sparkles"},
    {id:"settings",  label:"Settings",    icon:"Settings"},
  ];
  const tabs = [
    {id:"today",   label:"Today",   icon:"Home"},
    {id:"journal", label:"Journal", icon:"Journal"},
    {id:"shifts",  label:"Shifts",  icon:"Calendar"},
    {id:"meds",    label:"Meds",    icon:"Pill"},
    {id:"_more",   label:"More",    icon:"Sparkles"},
  ];
  const moreActive = moreRoutes.some(r => r.id === current);

  return (
    <>
      <nav className="mobile-nav" aria-label="Primary, mobile">
        {tabs.map(tb => {
          const Ico = Icons[tb.icon] || Icons.Home;
          const active = tb.id === "_more" ? moreActive : tb.id === current;
          return (
            <button key={tb.id} className={"mb-tab " + (active ? "active" : "")}
              onClick={() => tb.id === "_more" ? setMoreOpen(true) : onNav(tb.id)}
              aria-current={active ? "page" : undefined}>
              <span className="mb-tab-icon"><Ico size={18}/></span>
              <span className="mb-tab-label">{tb.label}</span>
            </button>
          );
        })}
      </nav>

      {moreOpen && (
        <div className="mb-sheet-back" onClick={() => setMoreOpen(false)} role="dialog" aria-modal="true">
          <div className="mb-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mb-sheet-handle" />
            <div className="mb-sheet-head">
              <div className="mb-sheet-title">More</div>
              <button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="mb-sheet-recipient">
              <div className="recipient-avatar" style={{width:40, height:40}}>{DATA.recipient.initials}</div>
              <div>
                <div className="recipient-name" style={{color:"var(--color-ink)"}}>{DATA.recipient.fullName}</div>
                <div className="recipient-status" style={{color:"var(--color-muted)"}}>{DATA.recipient.status}</div>
              </div>
            </div>
            {moreRoutes.map(r => {
              const Ico = Icons[r.icon] || Icons.Settings;
              return (
                <button key={r.id} className="mb-sheet-row"
                  onClick={() => { setMoreOpen(false); onNav(r.id); }}>
                  <Ico size={18}/>
                  <span>{r.label}</span>
                  <Icons.ChevronRight size={14}/>
                </button>
              );
            })}
            <div className="mb-sheet-footer">
              <button className="mb-sheet-row" style={{borderTop:"1px solid var(--color-border)"}}>
                <span style={{color:"var(--color-muted)"}}>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────
function App() {
  const [t, setT] = useState(DEFAULTS);
  // setTweak preserved as a name so layout switcher in TodayHead can flip layouts.
  const setTweak = (key, val) => setT(prev => ({ ...prev, [key]: val }));
  const [route, setRoute] = useState(parseHash());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function nav(id) {
    window.location.hash = id;
    setRoute(id);
    if (typeof window.scrollTo === "function") window.scrollTo({ top: 0, behavior: "instant" });
  }

  // Body classes for density + surface
  useEffect(() => {
    document.body.classList.remove("density-cozy", "density-comfortable", "density-compact");
    document.body.classList.add("density-" + t.density);
  }, [t.density]);
  useEffect(() => {
    document.body.classList.remove("surface-paper", "surface-morning", "surface-dusk");
    if (t.surface !== "cream") document.body.classList.add("surface-" + t.surface);
  }, [t.surface]);
  useEffect(() => {
    document.documentElement.style.setProperty("--card-radius", t.cardRadius + "px");
  }, [t.cardRadius]);

  const appClass = "app " + (t.shell === "hidden" ? "shell-hidden" : t.shell === "rail" ? "shell-rail" : "");

  // ── Render the right page ──────────────────────────────────────────
  let body;
  if (route === "today") {
    body = (
      <>
        <TodayHead recipient={DATA.recipient} teams={DATA.teams} addonsBar={t.addonsBar}
          layout={t.layout} onLayout={(v) => setTweak("layout", v)} />
        <TodayPage t={t} />
      </>
    );
  } else if (route === "journal") body = <JournalPage t={t}/>;
  else if (route === "shifts") body = <ShiftsPage t={t}/>;
  else if (route === "meds") body = <MedicationsPage t={t}/>;
  else if (route === "team") body = <TeamPage t={t}/>;
  else if (route === "documents") body = <DocumentsPage t={t}/>;
  else if (route === "brief") body = <BriefPage t={t}/>;
  else if (route === "settings") body = <SettingsPage t={t}/>;
  else body = <TodayPage t={t}/>;

  const T = window;
  return (
    <div className={appClass}>
      <Sidebar shell={t.shell} showRecipientCard={t.showRecipientCard} current={route} onNav={nav} />
      <MobileTopBar current={route} onLog={() => {}} />
      <main className="page">
        {body}
        <p style={{marginTop:40, fontSize:12, color:"var(--color-muted)", maxWidth:680, lineHeight:1.55}}>
          Mock data for design exploration. The Living Room palette is preserved; tweaks control
          layout, density, hierarchy treatments, and which surfaces appear — not brand color.
        </p>
      </main>
      <MobileNav current={route} onNav={nav} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
