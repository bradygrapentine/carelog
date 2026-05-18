// CareSync — Today (dashboard) page body.
// Pulled out of dashboard.jsx so the router can mount it alongside Journal,
// Shifts, etc.

function TodayPage({ t }) {
  const cards = {
    hero: <BriefHero key="hero"
      headlineStyle={t.headlineStyle}
      compact={t.headlineCompact}
      showBlob={t.showBlob}
      blobStyle={t.blobStyle}
      showPills={t.showPills} />,
    med: t.showMed && <MedCard key="med" headerStyle={t.headerStyle} />,
    mood: t.showMood && <MoodCard key="mood" headerStyle={t.headerStyle} style={t.moodStyle} />,
    sleep: t.showSleep && <SleepCard key="sleep" headerStyle={t.headerStyle} style={t.sleepStyle} />,
    coming: t.showComingUp && <ComingUp key="coming" headerStyle={t.headerStyle} limit={t.comingUpLimit} />,
    onshift: t.showOnShift && <OnShift key="onshift" headerStyle={t.headerStyle} />,
    pattern: t.showPattern && <PatternCard key="pattern" style={t.patternStyle} />,
  };

  if (t.layout === "now") {
    return (
      <>
        <div className="grid grid-editorial">
          <NowBoard headerStyle={t.headerStyle} />
          <div className="col">
            {cards.med}
            {cards.mood}
            {cards.onshift}
          </div>
        </div>
        {cards.pattern && <div style={{marginTop:"var(--row-gap)"}}>{cards.pattern}</div>}
      </>
    );
  }
  if (t.layout === "magazine") {
    return (
      <>
        {cards.hero}
        <div className="grid grid-magazine" style={{marginTop: "var(--row-gap)"}}>
          <MagStat value="4.2h" label="Last night’s sleep" note="2.1 hours under her 7-day baseline. Third short night in a row." />
          <MagStat value="3" label="Missed doses this week" note="Vitamin D today; Atorvastatin Sun & Mon evenings." />
          <MagStat value="36h" label="Lag from short night → rough day" note="Saturday’s 5.2h showed up Sunday around 6pm." />
        </div>
        <div className="grid grid-editorial" style={{marginTop: "var(--row-gap)"}}>
          <div className="col">
            {cards.med}
            {cards.coming}
            {cards.pattern}
          </div>
          <div className="col">
            {cards.mood}
            {cards.sleep}
            {cards.onshift}
          </div>
        </div>
      </>
    );
  }
  if (t.layout === "compact") {
    return (
      <>
        {cards.hero}
        <div className="grid" style={{gridTemplateColumns:"1fr 1fr 1fr", marginTop:"var(--row-gap)"}}>
          {cards.med}
          {cards.mood}
          {cards.sleep}
        </div>
        <div className="grid grid-editorial" style={{marginTop:"var(--row-gap)"}}>
          <div className="col">
            {cards.coming}
            {cards.pattern}
          </div>
          {cards.onshift}
        </div>
      </>
    );
  }
  // editorial default — pattern lives under Coming up in the left column.
  return (
    <>
      <div className="grid grid-editorial">
        <div className="col">
          {cards.hero}
          {cards.coming}
          {cards.pattern}
        </div>
        <div className="col">
          {cards.med}
          {cards.mood}
          {cards.sleep}
          {cards.onshift}
        </div>
      </div>
    </>
  );
}

Object.assign(window, { TodayPage });
