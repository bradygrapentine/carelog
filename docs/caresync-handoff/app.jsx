// app.jsx — CareSync 2.0 handoff build
// Tweaks panel removed; design preferences locked in as constants.
// Components imported from shell.jsx, screen-brief.jsx, screen-today.jsx, screens-rest.jsx.

// ─── Frozen design tokens ─────────────────────────────────────────
// These were the user's selected values from the prototype Tweaks panel.
const DESIGN = {
  // Palette + chrome
  palette: 'sage',           // sage parlor — eucalyptus + putty
  dark: false,
  accentMode: 'tinted',      // soft per-card tinted headers
  cornerRadius: 14,

  // Type
  headlineSerif: 'fraunces', // 'Fraunces' display, Geist body

  // App-wide
  railMode: 'regular',
  density: 'regular',
  tone: 'steady',            // copy voice — neither warm nor clinical

  // Brief
  briefWidth: 'editorial',
  briefHeadline: 'emphasized',
  briefHeadlineWeight: 'bold',
  briefSarah: 'indented',
  briefPattern: 'spark-plus',
  briefAgenda: 'rows',
  briefShowShift: true,
  briefShowPattern: true,

  // Timeline
  timelineLayout: 'rail',
  timelineDensity: 'regular',
  timelineGroup: 'chronological',
  timelineNowMarker: 'pill',
  timelineFilterStyle: 'chips',
  timelineIcons: true,
  timelineColorByType: false,
  timelineShowQuickLog: true,
  timelineShowFilters: true,

  // Meds
  medsAttentionStyle: 'hero',
  medsListLayout: 'rows',
  medsScheduleViz: 'day-strip',
  medsRxGlyph: 'serif-rx',
  medsStatusStyle: 'badge',
  medsGroupBy: 'none',
  medsShowSchedule: true,
  medsShowAdherence: true,

  // Shifts
  shiftsHandoffStyle: 'narrative',
  shiftsScheduleView: 'week-grid',
  shiftsTeamLayout: 'list',
  shiftsShowQuestions: true,

  // Journal
  journalComposerLayout: 'inline',
  journalMoodStyle: 'badges',
  journalEntryTreatment: 'card-bordered',
  journalSidebar: 'mood-bars',
  journalShowExportHint: true,

  // Profile
  profilePortraitStyle: 'avatar-card',
  profileLikesStyle: 'list',
  profileTeamLayout: 'list',
  profileShowEmergency: true,
};

// ─── Sage parlor palette (the only one shipped) ────────────────────
const SAGE_VARS = {
  '--primary':'#5a7a5a','--primary-light':'#7a9a7a','--primary-subtle':'#e3ecdf',
  '--secondary':'#a8741a','--secondary-light':'#c89030','--secondary-subtle':'#f5ead4',
  '--tertiary':'#a85040','--tertiary-light':'#c4705f','--tertiary-subtle':'#f0ddd8',
  '--ink':'#1f2820','--surface':'#f6f4ee','--surface-muted':'#ece9e0',
  '--app-shell':'#1f2820','--app-shell-text':'#e3ecdf','--app-shell-muted':'#a8b8a4',
  '--text-primary':'#1f2820','--text-secondary':'#4a5448','--muted':'#7a8478','--border':'#dfddd2',
};

// ─── App state ────────────────────────────────────────────────────
function useAppState() {
  const [state, setState] = React.useState({
    dismissed: [],
    donepezilTaken: false,
    handoffAccepted: false,
    journal: [
      { id: 1, text: 'She watched the cardinals for almost ten minutes this morning. Quiet, present. I held her coffee for her. She said "thank you, sweetheart" — first time in two weeks she\'s used my name like that.', mood: 'good', who: 'Anna · you', when: 'Yesterday, 7:42a' },
      { id: 2, text: "Hard afternoon. Wouldn't take the calcium, asked three times where Dad was, got upset when I told her. Sundown started early. I left the kitchen radio on and that helped.", mood: 'difficult', who: 'Anna · you', when: 'Apr 27, 4:50p' },
    ],
    railMode: DESIGN.railMode,
    density: DESIGN.density,
    toast: '',
  });

  const dispatch = React.useCallback((action) => {
    setState(s => {
      switch (action.type) {
        case 'dismiss': return { ...s, dismissed: [...s.dismissed, action.id], toast: 'Marked resolved' };
        case 'takeDonepezil': return { ...s, donepezilTaken: true, toast: 'Donepezil catch-up dose recorded' };
        case 'acceptHandoff': return { ...s, handoffAccepted: true, toast: "Handoff accepted — you're on shift" };
        case 'addJournal': return { ...s, journal: [...s.journal, action.entry], toast: 'Entry saved' };
        case 'toast': return { ...s, toast: action.msg };
        default: return s;
      }
    });
  }, []);

  React.useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => setState(s => ({ ...s, toast: '' })), 2400);
    return () => clearTimeout(t);
  }, [state.toast]);

  return [state, dispatch];
}

// ─── Apply palette + type once at mount ───────────────────────────
function useDesignTokens() {
  React.useEffect(() => {
    Object.entries(SAGE_VARS).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.style.background = 'var(--surface)';

    const fontDisplay = "'Fraunces', Georgia, serif";
    document.documentElement.style.setProperty('--font-display', fontDisplay);

    let s = document.getElementById('cs-dynamic-style');
    if (!s) { s = document.createElement('style'); s.id = 'cs-dynamic-style'; document.head.appendChild(s); }
    s.textContent = `
      .headline-display, .cs-rail-brand-name, .cs-rail-brand-mark { font-family: ${fontDisplay}; }
      :root { --r-lg: ${DESIGN.cornerRadius}px; --r-xl: ${Math.round(DESIGN.cornerRadius * 1.4)}px; --r-md: ${Math.max(6, Math.round(DESIGN.cornerRadius * 0.7))}px; }
    `;
  }, []);
}

// Toast component (unchanged from prototype)
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--app-shell)', color: 'var(--app-shell-text)',
      padding: '10px 16px', borderRadius: 10, fontSize: 13.5, letterSpacing: '0.01em',
      boxShadow: '0 12px 32px rgba(31,40,32,0.25)', zIndex: 1000,
    }}>{msg}</div>
  );
}

function App() {
  useDesignTokens();
  const [screen, setScreen] = React.useState('brief');
  const [state, dispatch] = useAppState();

  const props = { state, dispatch, tweaks: DESIGN, onNav: setScreen };
  const screens = {
    brief:   <ProtoBrief    {...props} tone={DESIGN.tone} />,
    today:   <ProtoToday    {...props} />,
    meds:    <ProtoMeds     {...props} />,
    shifts:  <ProtoShifts   {...props} />,
    journal: <ProtoJournal  {...props} />,
    profile: <ProtoProfile  state={state} tweaks={DESIGN} onNav={setScreen} />,
    docs:    <Placeholder title="Documents" onNav={setScreen} />,
    visits:  <Placeholder title="Visit summaries" onNav={setScreen} />,
  };

  return (
    <>
      <div className="proto-shell" data-screen-label={`CareSync · ${screen}`}>
        {screens[screen] || screens.brief}
      </div>
      <Toast msg={state.toast} />
    </>
  );
}

function Placeholder({ title, onNav }) {
  return (
    <div className="cs-frame">
      <PRail active={title.toLowerCase()} onNavigate={onNav} mode="regular" density="regular" />
      <div className="cs-main">
        <PTopBar title={title} crumb="Record" search={false} />
        <div className="cs-body" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="img-ph" style={{ width: 480, height: 280, fontSize: 14 }}>{title.toUpperCase()} · placeholder</div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
