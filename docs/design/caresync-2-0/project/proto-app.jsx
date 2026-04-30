// proto-app.jsx — main app: state machine + tweaks panel + screen routing

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "sage",
  "tone": "steady",
  "density": "regular",
  "railMode": "regular",
  "headlineSerif": "fraunces",
  "dark": false,
  "accentMode": "tinted",
  "cornerRadius": 14,
  "briefWidth": "editorial",
  "briefHeadline": "emphasized",
  "briefSarah": "indented",
  "briefPattern": "spark-plus",
  "briefAgenda": "rows",
  "briefShowShift": true,
  "briefShowPattern": true,
  "briefHeadlineWeight": "bold",
  "timelineLayout": "rail",
  "timelineDensity": "regular",
  "timelineGroup": "chronological",
  "timelineNowMarker": "pill",
  "timelineShowQuickLog": true,
  "timelineShowFilters": true,
  "timelineFilterStyle": "chips",
  "timelineIcons": true,
  "timelineColorByType": false,
  "medsAttentionStyle": "hero",
  "medsListLayout": "rows",
  "medsScheduleViz": "day-strip",
  "medsRxGlyph": "serif-rx",
  "medsStatusStyle": "badge",
  "medsGroupBy": "none",
  "medsShowSchedule": true,
  "medsShowAdherence": true,
  "shiftsHandoffStyle": "narrative",
  "shiftsScheduleView": "week-grid",
  "shiftsTeamLayout": "list",
  "shiftsShowQuestions": true,
  "journalComposerLayout": "inline",
  "journalMoodStyle": "badges",
  "journalEntryTreatment": "card-bordered",
  "journalSidebar": "mood-bars",
  "journalShowExportHint": true,
  "profilePortraitStyle": "avatar-card",
  "profileLikesStyle": "list",
  "profileTeamLayout": "list",
  "profileShowEmergency": true
}/*EDITMODE-END*/;

const PALETTES = {
  sage: { label: 'Sage parlor', sub: 'eucalyptus + putty',
    vars: { '--primary':'#5a7a5a','--primary-light':'#7a9a7a','--primary-subtle':'#e3ecdf',
      '--secondary':'#a8741a','--secondary-light':'#c89030','--secondary-subtle':'#f5ead4',
      '--tertiary':'#a85040','--tertiary-light':'#c4705f','--tertiary-subtle':'#f0ddd8',
      '--ink':'#1f2820','--surface':'#f6f4ee','--surface-muted':'#ece9e0',
      '--app-shell':'#1f2820','--app-shell-text':'#e3ecdf','--app-shell-muted':'#a8b8a4',
      '--text-primary':'#1f2820','--text-secondary':'#4a5448','--muted':'#7a8478','--border':'#dfddd2' } },
  hearth: { label: 'Hearth', sub: 'terracotta + cream',
    vars: { '--primary':'#b8543a','--primary-light':'#d27a5e','--primary-subtle':'#f5e6df',
      '--secondary':'#a8741a','--secondary-light':'#c89030','--secondary-subtle':'#f5ead4',
      '--tertiary':'#6b3f5e','--tertiary-light':'#8a5478','--tertiary-subtle':'#ece1e7',
      '--ink':'#2a1f1a','--surface':'#faf5f0','--surface-muted':'#f3ede5',
      '--app-shell':'#2a1f1a','--app-shell-text':'#f5ead4','--app-shell-muted':'#c8a984',
      '--text-primary':'#2a1f1a','--text-secondary':'#5a4a3f','--muted':'#8a7868','--border':'#ece1d5' } },
  slate: { label: 'Slate dusk', sub: 'graphite + tan',
    vars: { '--primary':'#3a4a5a','--primary-light':'#5a6a7a','--primary-subtle':'#dfe4ea',
      '--secondary':'#b8854a','--secondary-light':'#d2a06a','--secondary-subtle':'#f0e2cf',
      '--tertiary':'#8a4f4a','--tertiary-light':'#a86a65','--tertiary-subtle':'#ecdedc',
      '--ink':'#1f2630','--surface':'#f4f2ee','--surface-muted':'#e8e6e0',
      '--app-shell':'#1f2630','--app-shell-text':'#dfe4ea','--app-shell-muted':'#9ca8b4',
      '--text-primary':'#1f2630','--text-secondary':'#4a5260','--muted':'#7a8290','--border':'#dcdad2' } },
  linen: { label: 'Linen', sub: 'paper + ink',
    vars: { '--primary':'#4a5a3a','--primary-light':'#6a7a55','--primary-subtle':'#e8eadf',
      '--secondary':'#9a6a3a','--secondary-light':'#b8855a','--secondary-subtle':'#f0e4d2',
      '--tertiary':'#7a4a4a','--tertiary-light':'#9a6a6a','--tertiary-subtle':'#ecdcdc',
      '--ink':'#22221f','--surface':'#fafaf3','--surface-muted':'#efeee5',
      '--app-shell':'#22221f','--app-shell-text':'#eae8da','--app-shell-muted':'#b0ad9a',
      '--text-primary':'#22221f','--text-secondary':'#4a4842','--muted':'#7a7869','--border':'#e0ddcf' } },
  dusk: { label: 'Dusk', sub: 'plum + lilac',
    vars: { '--primary':'#6a4a6a','--primary-light':'#8a6a8a','--primary-subtle':'#ece2ec',
      '--secondary':'#b8743a','--secondary-light':'#d2925a','--secondary-subtle':'#f5e2cf',
      '--tertiary':'#3a4a6a','--tertiary-light':'#5a6a8a','--tertiary-subtle':'#dde2ec',
      '--ink':'#251f2a','--surface':'#f7f3f5','--surface-muted':'#ece5ea',
      '--app-shell':'#251f2a','--app-shell-text':'#e8dde6','--app-shell-muted':'#b09cab',
      '--text-primary':'#251f2a','--text-secondary':'#54485a','--muted':'#80758a','--border':'#e0d8de' } },
  oat: { label: 'Oat', sub: 'fawn + olive',
    vars: { '--primary':'#7a8a4a','--primary-light':'#9aaa6a','--primary-subtle':'#eceedf',
      '--secondary':'#b8854a','--secondary-light':'#d2a06a','--secondary-subtle':'#f0e2cf',
      '--tertiary':'#a85a4a','--tertiary-light':'#c47a6a','--tertiary-subtle':'#f0ddd8',
      '--ink':'#2a261f','--surface':'#f8f5ec','--surface-muted':'#ede9da',
      '--app-shell':'#2a261f','--app-shell-text':'#ede4cd','--app-shell-muted':'#b8aa8a',
      '--text-primary':'#2a261f','--text-secondary':'#544c3f','--muted':'#857d65','--border':'#e0dac8' } },
};

function useAppState() {
  const [state, setState] = React.useState({
    dismissed: [],
    donepezilTaken: false,
    handoffAccepted: false,
    journal: [
      { id: 1, text: "She watched the cardinals for almost ten minutes this morning. Quiet, present. I held her coffee for her. She said \"thank you, sweetheart\" — first time in two weeks she's used my name like that.", mood: 'good', who: 'Anna · you', when: 'Yesterday, 7:42a' },
      { id: 2, text: "Hard afternoon. Wouldn't take the calcium, asked three times where Dad was, got upset when I told her. Sundown started early. I left the kitchen radio on and that helped.", mood: 'difficult', who: 'Anna · you', when: 'Apr 27, 4:50p' },
    ],
    railMode: 'regular',
    density: 'regular',
    toast: '',
  });

  const dispatch = React.useCallback((action) => {
    setState(s => {
      switch (action.type) {
        case 'dismiss': return { ...s, dismissed: [...s.dismissed, action.id], toast: 'Marked resolved' };
        case 'takeDonepezil': return { ...s, donepezilTaken: true, toast: 'Donepezil catch-up dose recorded' };
        case 'acceptHandoff': return { ...s, handoffAccepted: true, toast: 'Handoff accepted — you\'re on shift' };
        case 'addJournal': return { ...s, journal: [...s.journal, action.entry], toast: 'Entry saved' };
        case 'toast': return { ...s, toast: action.msg };
        case 'setRail': return { ...s, railMode: action.value };
        case 'setDensity': return { ...s, density: action.value };
        case 'reset': return { ...s, dismissed: [], donepezilTaken: false, handoffAccepted: false, toast: 'Demo state reset' };
        default: return s;
      }
    });
  }, []);

  // auto-clear toast
  React.useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => setState(s => ({ ...s, toast: '' })), 2400);
    return () => clearTimeout(t);
  }, [state.toast]);

  return [state, dispatch];
}

function ProtoApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState('brief');
  const [state, dispatch] = useAppState();

  // Sync rail/density tweaks into shared state
  React.useEffect(() => { dispatch({ type: 'setRail', value: tweaks.railMode }); }, [tweaks.railMode]);
  React.useEffect(() => { dispatch({ type: 'setDensity', value: tweaks.density }); }, [tweaks.density]);

  // Apply palette + dark mode
  React.useEffect(() => {
    const vars = PALETTES[tweaks.palette].vars;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    document.documentElement.setAttribute('data-theme', tweaks.dark ? 'dark' : 'light');
    document.body.style.background = tweaks.dark ? '#0f0805' : 'var(--surface)';
  }, [tweaks.palette, tweaks.dark]);

  // Headline serif and corner radius
  React.useEffect(() => {
    const fonts = {
      fraunces: "'Fraunces', Georgia, serif",
      'eb-garamond': "'EB Garamond', Georgia, serif",
      newsreader: "'Newsreader', Georgia, serif",
      'libre-caslon': "'Libre Caslon Text', Georgia, serif",
      'cormorant': "'Cormorant Garamond', Georgia, serif",
      'crimson': "'Crimson Pro', Georgia, serif",
      none: "'Geist', system-ui, sans-serif",
    };
    document.documentElement.style.setProperty('--font-display', fonts[tweaks.headlineSerif] || fonts.fraunces);
    // Override .headline-display via injected style
    let s = document.getElementById('cs-dynamic-style');
    if (!s) { s = document.createElement('style'); s.id = 'cs-dynamic-style'; document.head.appendChild(s); }
    const accentRules = (() => {
      switch (tweaks.accentMode) {
        case 'flat':
          return `.card-header-tinted { background: var(--surface-muted) !important; }`;
        case 'bold':
          return `.card-header-tinted { background: var(--primary) !important; color: #fff !important; }
                  .card-header-tinted .title, .card-header-tinted .meta { color: #fff !important; }`;
        case 'outline':
          return `.card-header-tinted { background: transparent !important; border-bottom: 1px solid var(--border); }`;
        case 'rule':
          return `.card-header-tinted { background: transparent !important; padding-bottom: 6px !important; border-bottom: 2px solid var(--primary); }
                  .card-header-tinted .title { color: var(--primary) !important; font-weight: 600; }`;
        case 'serif':
          return `.card-header-tinted { background: transparent !important; }
                  .card-header-tinted .title { font-family: var(--font-display, Fraunces, serif) !important; font-style: italic; font-weight: 500; font-size: 17px; color: var(--text-primary); }`;
        case 'accent-bar':
          return `.card-header-tinted { background: transparent !important; border-left: 3px solid var(--primary); padding-left: 13px !important; }`;
        case 'tinted':
        default:
          return ''; // default tinted backgrounds set inline per card
      }
    })();
    s.textContent = `
      .headline-display, .cs-rail-brand-name, .cs-rail-brand-mark { font-family: ${fonts[tweaks.headlineSerif] || fonts.fraunces}; }
      :root { --r-lg: ${tweaks.cornerRadius}px; --r-xl: ${Math.round(tweaks.cornerRadius * 1.4)}px; --r-md: ${Math.max(6, Math.round(tweaks.cornerRadius * 0.7))}px; }
      ${accentRules}
    `;
  }, [tweaks.headlineSerif, tweaks.cornerRadius, tweaks.accentMode]);

  const screens = {
    brief: <ProtoBrief state={state} dispatch={dispatch} tone={tweaks.tone} tweaks={tweaks} onNav={setScreen} />,
    today: <ProtoToday state={state} dispatch={dispatch} tweaks={tweaks} onNav={setScreen} />,
    meds: <ProtoMeds state={state} dispatch={dispatch} tweaks={tweaks} onNav={setScreen} />,
    shifts: <ProtoShifts state={state} dispatch={dispatch} tweaks={tweaks} onNav={setScreen} />,
    journal: <ProtoJournal state={state} dispatch={dispatch} tweaks={tweaks} onNav={setScreen} />,
    profile: <ProtoProfile state={state} tweaks={tweaks} onNav={setScreen} />,
    docs: <Placeholder title="Documents" onNav={setScreen} />,
    visits: <Placeholder title="Visit summaries" onNav={setScreen} />,
  };

  return (
    <>
      <div className="proto-shell" data-screen-label={`CareSync · ${screen}`}>
        {screens[screen] || screens.brief}
      </div>
      <Toast msg={state.toast} />
      <TweaksPanel title="Tweaks">
        <TweakSection label="Palette" />
        <TweakSelect
          label="Color story"
          value={tweaks.palette}
          options={[
            { value: 'sage', label: 'Sage parlor — eucalyptus + putty' },
            { value: 'hearth', label: 'Hearth — terracotta + cream' },
            { value: 'slate', label: 'Slate dusk — graphite + tan' },
            { value: 'linen', label: 'Linen — paper + ink' },
            { value: 'dusk', label: 'Dusk — plum + lilac' },
            { value: 'oat', label: 'Oat — fawn + olive' },
          ]}
          onChange={(v) => setTweak('palette', v)}
        />
        <TweakToggle label="Dark mode" value={tweaks.dark} onChange={(v) => setTweak('dark', v)} />
        <TweakSelect
          label="Card header tint"
          value={tweaks.accentMode}
          options={[
            { value: 'tinted', label: 'Tinted — soft per-card colors' },
            { value: 'flat', label: 'Flat — single muted band' },
            { value: 'bold', label: 'Bold — primary fill, white text' },
            { value: 'outline', label: 'Outline — hairline rule below' },
            { value: 'rule', label: 'Rule — primary underline + colored title' },
            { value: 'serif', label: 'Serif — italic display title, no fill' },
            { value: 'accent-bar', label: 'Accent bar — left vertical primary stripe' },
          ]}
          onChange={(v) => setTweak('accentMode', v)}
        />

        <TweakSection label="Type & shape" />
        <TweakSelect
          label="Display serif"
          value={tweaks.headlineSerif}
          options={[
            { value: 'fraunces', label: 'Fraunces — modern, soft contrast (default)' },
            { value: 'eb-garamond', label: 'EB Garamond — classical, restrained' },
            { value: 'newsreader', label: 'Newsreader — editorial, even color' },
            { value: 'libre-caslon', label: 'Libre Caslon — old-style, bookish' },
            { value: 'cormorant', label: 'Cormorant — high-contrast, elegant' },
            { value: 'crimson', label: 'Crimson Pro — quiet, humanist' },
            { value: 'none', label: 'No serif — sans-only system' },
          ]}
          onChange={(v) => setTweak('headlineSerif', v)}
        />
        <TweakSlider label="Corner radius" value={tweaks.cornerRadius} min={2} max={28} unit="px" onChange={(v) => setTweak('cornerRadius', v)} />

        {/* ─── Page-specific tweaks ─── */}
        {screen === 'brief' && (
          <>
            <TweakSection label="On this page · Daily brief" />
            <TweakRadio
              label="Width"
              value={tweaks.briefWidth}
              options={[
                { value: 'editorial', label: 'Editorial' },
                { value: 'standard', label: 'Standard' },
                { value: 'narrow', label: 'Narrow' },
              ]}
              onChange={(v) => setTweak('briefWidth', v)}
            />
            <TweakRadio
              label="Headline emphasis"
              value={tweaks.briefHeadline}
              options={[
                { value: 'emphasized', label: 'Emphasized' },
                { value: 'plain', label: 'Plain' },
                { value: 'data', label: 'Data-led' },
              ]}
              onChange={(v) => setTweak('briefHeadline', v)}
            />
            <TweakRadio
              label="Emphasis style"
              value={tweaks.briefHeadlineWeight}
              options={[
                { value: 'bold', label: 'Bold' },
                { value: 'italic', label: 'Italic' },
              ]}
              onChange={(v) => setTweak('briefHeadlineWeight', v)}
            />
            <TweakRadio
              label="Sarah’s note"
              value={tweaks.briefSarah}
              options={[
                { value: 'indented', label: 'Quote' },
                { value: 'card', label: 'Card' },
                { value: 'list', label: 'Notes' },
              ]}
              onChange={(v) => setTweak('briefSarah', v)}
            />
            <TweakSelect
              label="Sleep pattern"
              value={tweaks.briefPattern}
              options={[
                { value: 'spark-plus', label: 'Sparkline + numbers (default)' },
                { value: 'spark', label: 'Sparkline only' },
                { value: 'bars', label: 'Bar chart' },
                { value: 'words', label: 'Numbers only' },
              ]}
              onChange={(v) => setTweak('briefPattern', v)}
            />
            <TweakRadio
              label="Coming up today"
              value={tweaks.briefAgenda}
              options={[
                { value: 'rows', label: 'Rows' },
                { value: 'blocks', label: 'Blocks' },
                { value: 'minimal', label: 'Minimal' },
              ]}
              onChange={(v) => setTweak('briefAgenda', v)}
            />
            <TweakToggle label="Show pattern card" value={tweaks.briefShowPattern} onChange={(v) => setTweak('briefShowPattern', v)} />
            <TweakToggle label="Show on-shift sidebar" value={tweaks.briefShowShift} onChange={(v) => setTweak('briefShowShift', v)} />
          </>
        )}

        {screen === 'today' && (
          <>
            <TweakSection label="On this page · Timeline" />
            <TweakRadio
              label="Layout"
              value={tweaks.timelineLayout}
              options={[
                { value: 'rail', label: 'Time rail' },
                { value: 'cards', label: 'Cards' },
                { value: 'feed', label: 'Feed' },
              ]}
              onChange={(v) => setTweak('timelineLayout', v)}
            />
            <TweakRadio
              label="Group events by"
              value={tweaks.timelineGroup}
              options={[
                { value: 'chronological', label: 'Time' },
                { value: 'period', label: 'Morning/Afternoon' },
                { value: 'type', label: 'Type' },
              ]}
              onChange={(v) => setTweak('timelineGroup', v)}
            />
            <TweakRadio
              label="Density"
              value={tweaks.timelineDensity}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'regular', label: 'Regular' },
                { value: 'roomy', label: 'Roomy' },
              ]}
              onChange={(v) => setTweak('timelineDensity', v)}
            />
            <TweakRadio
              label="Now marker"
              value={tweaks.timelineNowMarker}
              options={[
                { value: 'pill', label: 'Pill' },
                { value: 'line', label: 'Line' },
                { value: 'banner', label: 'Banner' },
              ]}
              onChange={(v) => setTweak('timelineNowMarker', v)}
            />
            <TweakRadio
              label="Filter style"
              value={tweaks.timelineFilterStyle}
              options={[
                { value: 'chips', label: 'Chips' },
                { value: 'tabs', label: 'Tabs' },
                { value: 'dropdown', label: 'Dropdown' },
              ]}
              onChange={(v) => setTweak('timelineFilterStyle', v)}
            />
            <TweakToggle label="Show event icons" value={tweaks.timelineIcons} onChange={(v) => setTweak('timelineIcons', v)} />
            <TweakToggle label="Color rows by type" value={tweaks.timelineColorByType} onChange={(v) => setTweak('timelineColorByType', v)} />
            <TweakToggle label="Show Quick log panel" value={tweaks.timelineShowQuickLog} onChange={(v) => setTweak('timelineShowQuickLog', v)} />
            <TweakToggle label="Show filter panel" value={tweaks.timelineShowFilters} onChange={(v) => setTweak('timelineShowFilters', v)} />
          </>
        )}

        {screen === 'meds' && (
          <>
            <TweakSection label="On this page · Medications" />
            <TweakRadio
              label="Attention card"
              value={tweaks.medsAttentionStyle}
              options={[
                { value: 'hero', label: 'Hero card' },
                { value: 'banner', label: 'Banner' },
                { value: 'inline', label: 'Inline' },
              ]}
              onChange={(v) => setTweak('medsAttentionStyle', v)}
            />
            <TweakRadio
              label="Med list layout"
              value={tweaks.medsListLayout}
              options={[
                { value: 'rows', label: 'Rows' },
                { value: 'cards', label: 'Cards' },
                { value: 'table', label: 'Table' },
              ]}
              onChange={(v) => setTweak('medsListLayout', v)}
            />
            <TweakRadio
              label="Group medications"
              value={tweaks.medsGroupBy}
              options={[
                { value: 'none', label: 'Flat list' },
                { value: 'condition', label: 'By condition' },
                { value: 'time', label: 'By time' },
              ]}
              onChange={(v) => setTweak('medsGroupBy', v)}
            />
            <TweakSelect
              label="Schedule visualization"
              value={tweaks.medsScheduleViz}
              options={[
                { value: 'day-strip', label: 'Day strip — dot per dose, 24h' },
                { value: 'pillbox', label: 'Pillbox — AM/Mid/PM/Night cells' },
                { value: 'time-list', label: 'Time list — plain text' },
              ]}
              onChange={(v) => setTweak('medsScheduleViz', v)}
            />
            <TweakRadio
              label="Med icon"
              value={tweaks.medsRxGlyph}
              options={[
                { value: 'serif-rx', label: 'Serif ℞' },
                { value: 'pill', label: 'Pill' },
                { value: 'initial', label: 'Initial' },
              ]}
              onChange={(v) => setTweak('medsRxGlyph', v)}
            />
            <TweakRadio
              label="Status indicator"
              value={tweaks.medsStatusStyle}
              options={[
                { value: 'badge', label: 'Badge' },
                { value: 'dot', label: 'Dot + label' },
                { value: 'bar', label: 'Adherence bar' },
              ]}
              onChange={(v) => setTweak('medsStatusStyle', v)}
            />
            <TweakToggle label="Show today’s schedule strip" value={tweaks.medsShowSchedule} onChange={(v) => setTweak('medsShowSchedule', v)} />
            <TweakToggle label="Show 7-day adherence card" value={tweaks.medsShowAdherence} onChange={(v) => setTweak('medsShowAdherence', v)} />
          </>
        )}

        {screen === 'shifts' && (
          <>
            <TweakSection label="On this page · Shifts" />
            <TweakSelect
              label="Handoff treatment"
              value={tweaks.shiftsHandoffStyle}
              options={[
                { value: 'narrative', label: 'Narrative — three things you need to know' },
                { value: 'checklist', label: 'Checklist — todos with checkboxes' },
                { value: 'briefing',  label: 'Briefing — Sleep / Meds / Schedule blocks' },
              ]}
              onChange={(v) => setTweak('shiftsHandoffStyle', v)}
            />
            <TweakRadio
              label="Schedule view"
              value={tweaks.shiftsScheduleView}
              options={[
                { value: 'week-grid', label: 'Week grid' },
                { value: 'lanes', label: 'Lanes' },
                { value: 'compact-list', label: 'Next 5' },
              ]}
              onChange={(v) => setTweak('shiftsScheduleView', v)}
            />
            <TweakRadio
              label="Care team layout"
              value={tweaks.shiftsTeamLayout}
              options={[
                { value: 'list', label: 'List' },
                { value: 'roster', label: 'Roster' },
                { value: 'now-board', label: 'Now-board' },
              ]}
              onChange={(v) => setTweak('shiftsTeamLayout', v)}
            />
            <TweakToggle label="Show Sarah’s open questions" value={tweaks.shiftsShowQuestions} onChange={(v) => setTweak('shiftsShowQuestions', v)} />
          </>
        )}

        {screen === 'journal' && (
          <>
            <TweakSection label="On this page · Journal" />
            <TweakRadio
              label="Composer"
              value={tweaks.journalComposerLayout}
              options={[
                { value: 'inline', label: 'Inline' },
                { value: 'prompted', label: 'Prompted' },
                { value: 'minimal', label: 'Minimal' },
              ]}
              onChange={(v) => setTweak('journalComposerLayout', v)}
            />
            <TweakRadio
              label="Mood control"
              value={tweaks.journalMoodStyle}
              options={[
                { value: 'badges', label: 'Badges' },
                { value: 'spectrum', label: 'Spectrum' },
                { value: 'tags', label: 'Tags' },
              ]}
              onChange={(v) => setTweak('journalMoodStyle', v)}
            />
            <TweakRadio
              label="Entry style"
              value={tweaks.journalEntryTreatment}
              options={[
                { value: 'card-bordered', label: 'Card' },
                { value: 'page', label: 'Page' },
                { value: 'thread', label: 'Thread' },
              ]}
              onChange={(v) => setTweak('journalEntryTreatment', v)}
            />
            <TweakSelect
              label="Sidebar"
              value={tweaks.journalSidebar}
              options={[
                { value: 'mood-bars', label: 'Weekly mood bars + tags' },
                { value: 'calendar-heatmap', label: 'Calendar heatmap' },
                { value: 'tags-only', label: 'Tags only' },
                { value: 'none', label: 'No sidebar' },
              ]}
              onChange={(v) => setTweak('journalSidebar', v)}
            />
            <TweakToggle label="Show Friday-export hint" value={tweaks.journalShowExportHint} onChange={(v) => setTweak('journalShowExportHint', v)} />
          </>
        )}

        {screen === 'profile' && (
          <>
            <TweakSection label="On this page · Profile" />
            <TweakRadio
              label="Portrait"
              value={tweaks.profilePortraitStyle}
              options={[
                { value: 'avatar-card', label: 'Avatar card' },
                { value: 'editorial', label: 'Editorial' },
                { value: 'minimal', label: 'Minimal' },
              ]}
              onChange={(v) => setTweak('profilePortraitStyle', v)}
            />
            <TweakRadio
              label="Likes & dislikes"
              value={tweaks.profileLikesStyle}
              options={[
                { value: 'list', label: 'List' },
                { value: 'cards', label: 'Cards' },
                { value: 'narrative', label: 'Narrative' },
              ]}
              onChange={(v) => setTweak('profileLikesStyle', v)}
            />
            <TweakRadio
              label="Care team"
              value={tweaks.profileTeamLayout}
              options={[
                { value: 'list', label: 'List' },
                { value: 'cards', label: 'Cards' },
                { value: 'directory', label: 'Directory' },
              ]}
              onChange={(v) => setTweak('profileTeamLayout', v)}
            />
            <TweakToggle label="Show emergency card" value={tweaks.profileShowEmergency} onChange={(v) => setTweak('profileShowEmergency', v)} />
          </>
        )}

        <TweakSection label="Demo" />
        <TweakButton label="Reset interactions" onClick={() => dispatch({ type: 'reset' })} />
      </TweaksPanel>
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

ReactDOM.createRoot(document.getElementById('root')).render(<ProtoApp />);
