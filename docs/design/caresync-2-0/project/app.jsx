// app.jsx — runs after design-canvas.jsx + all-components.jsx
const { DesignCanvas, DCSection, DCArtboard } = window;

function ThemeWrap({ theme, children }) {
  return (
    <div data-theme={theme} style={{ width: '100%', height: '100%', background: theme === 'dark' ? '#0f0a1a' : '#faf5ff' }}>
      {children}
    </div>
  );
}

const PALETTES = {
  hearth: {
    label: 'Hearth',
    sub: 'terracotta + warm cream',
    vars: {
      '--primary': '#b8543a', '--primary-light': '#d27a5e', '--primary-subtle': '#f5e6df',
      '--secondary': '#a8741a', '--secondary-light': '#c89030', '--secondary-subtle': '#f5ead4',
      '--tertiary': '#6b3f5e', '--tertiary-light': '#8a5478', '--tertiary-subtle': '#ece1e7',
      '--ink': '#2a1f1a', '--surface': '#faf5f0', '--surface-muted': '#f3ede5',
      '--app-shell': '#2a1f1a', '--app-shell-text': '#f5ead4', '--app-shell-muted': '#c8a984',
      '--text-primary': '#2a1f1a', '--text-secondary': '#5a4a3f', '--muted': '#8a7868',
      '--border': '#ece1d5',
    },
  },
  sage: {
    label: 'Sage parlor',
    sub: 'eucalyptus + putty',
    vars: {
      '--primary': '#5a7a5a', '--primary-light': '#7a9a7a', '--primary-subtle': '#e3ecdf',
      '--secondary': '#a8741a', '--secondary-light': '#c89030', '--secondary-subtle': '#f5ead4',
      '--tertiary': '#a85040', '--tertiary-light': '#c4705f', '--tertiary-subtle': '#f0ddd8',
      '--ink': '#1f2820', '--surface': '#f6f4ee', '--surface-muted': '#ece9e0',
      '--app-shell': '#1f2820', '--app-shell-text': '#e3ecdf', '--app-shell-muted': '#a8b8a4',
      '--text-primary': '#1f2820', '--text-secondary': '#4a5448', '--muted': '#7a8478',
      '--border': '#dfddd2',
    },
  },
  slate: {
    label: 'Slate dusk',
    sub: 'graphite + warm tan',
    vars: {
      '--primary': '#3a4a5a', '--primary-light': '#5a6a7a', '--primary-subtle': '#dfe4ea',
      '--secondary': '#b8854a', '--secondary-light': '#d2a06a', '--secondary-subtle': '#f0e2cf',
      '--tertiary': '#8a4f4a', '--tertiary-light': '#a86a65', '--tertiary-subtle': '#ecdedc',
      '--ink': '#1f2630', '--surface': '#f4f2ee', '--surface-muted': '#e8e6e0',
      '--app-shell': '#1f2630', '--app-shell-text': '#dfe4ea', '--app-shell-muted': '#9ca8b4',
      '--text-primary': '#1f2630', '--text-secondary': '#4a5260', '--muted': '#7a8290',
      '--border': '#dcdad2',
    },
  },
};

function App() {
  const [theme, setTheme] = React.useState('light');
  const [palette, setPalette] = React.useState('sage');
  React.useEffect(() => {
    const vars = PALETTES[palette].vars;
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }, [palette]);
  return (
    <>
      <div className="cs-toolbar">
        <span style={{ color: '#c8a984', fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '0 6px 0 10px' }}>Palette</span>
        {Object.entries(PALETTES).map(([k, p]) => (
          <button key={k} className={palette === k ? 'active' : ''} onClick={() => setPalette(k)}>{p.label}</button>
        ))}
        <span style={{ width: 1, height: 18, background: 'rgba(200,169,132,0.25)', margin: '0 4px' }}></span>
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
      </div>
      <DesignCanvas
        title="CareSync 2.0 — Enhancement Exploration"
        subtitle="Living Room palette, editorial typography, panel-tinted hierarchy. 6 in-app screens + 1 marketing page. Toggle dark via top-right."
      >
        <DCSection id="primary" title="Anchor — the editorial moment">
          <DCArtboard id="brief" label="Daily Brief — signature editorial home" width={1280} height={1100}>
            <ThemeWrap theme={theme}><window.ScreenBrief /></ThemeWrap>
          </DCArtboard>
        </DCSection>
        <DCSection id="core" title="Core in-app surfaces">
          <DCArtboard id="today" label="Today / Timeline" width={1280} height={1080}>
            <ThemeWrap theme={theme}><window.ScreenToday /></ThemeWrap>
          </DCArtboard>
          <DCArtboard id="meds" label="Medications" width={1280} height={1180}>
            <ThemeWrap theme={theme}><window.ScreenMeds /></ThemeWrap>
          </DCArtboard>
          <DCArtboard id="shifts" label="Shifts & Handoff" width={1280} height={1140}>
            <ThemeWrap theme={theme}><window.ScreenShifts /></ThemeWrap>
          </DCArtboard>
        </DCSection>
        <DCSection id="record" title="Record & people">
          <DCArtboard id="journal" label="Journal" width={1280} height={1100}>
            <ThemeWrap theme={theme}><window.ScreenJournal /></ThemeWrap>
          </DCArtboard>
          <DCArtboard id="profile" label="Mom's profile (the recipient is a person)" width={1280} height={1280}>
            <ThemeWrap theme={theme}><window.ScreenProfile /></ThemeWrap>
          </DCArtboard>
        </DCSection>
        <DCSection id="marketing" title="Marketing — bolder reinterpretation">
          <DCArtboard id="market" label="Landing page" width={1280} height={1320}>
            <ThemeWrap theme={theme}><window.ScreenMarketing /></ThemeWrap>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
