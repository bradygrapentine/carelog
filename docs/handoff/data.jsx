// CareSync — fictional dashboard data for prototype.
// "Margaret" is the recipient (mom). Late-evening Tuesday context.

const DATA = {
  user: { name: "Alex", role: "Coordinator" },
  recipient: {
    firstName: "Margaret",
    fullName: "Margaret Lin",
    initials: "ML",
    age: 78,
    status: "Home · last note 11:34p",
  },
  teams: [
    { id: "mom", first: "Margaret", initials: "ML", role: "Coordinator", active: true },
    { id: "dad", first: "Henry", initials: "HL", role: "Supporter", active: false },
  ],
  brief: {
    eyebrow: "Today’s brief · auto-generated 7:02a",
    parts: [
      { kind: "t", text: "Mom slept " },
      { kind: "em", text: "poorly" },
      { kind: "t", text: ". Three med doses " },
      { kind: "em", text: "missed" },
      { kind: "t", text: " yesterday. Cardiology is " },
      { kind: "em", text: "Thursday 2:30" },
      { kind: "t", text: "." },
    ],
    pills: [
      { id: "meds", label: "4 medications tracked", tone: "success" },
      { id: "mood", label: "feeling difficult", tone: "primary" },
      { id: "entries", label: "6 notes logged", tone: "warning" },
    ],
  },
  meds: [
    { name: "Metoprolol", dose: "25 mg", at: "8:00a", instr: "with breakfast", state: "done" },
    { name: "Lisinopril", dose: "10 mg", at: "8:00a", instr: "with food", state: "done" },
    { name: "Atorvastatin", dose: "40 mg", at: "9:00p", instr: "evening", state: "due", due: "in 28m" },
    { name: "Vitamin D", dose: "1000 IU", at: "8:00a", instr: "", state: "missed" },
  ],
  mood: [
    { d: "Wed", m: "okay" },
    { d: "Thu", m: "good" },
    { d: "Fri", m: "okay" },
    { d: "Sat", m: "difficult" },
    { d: "Sun", m: "difficult" },
    { d: "Mon", m: "okay" },
    { d: "Tue", m: "difficult", today: true },
  ],
  moodNote: {
    quote: "Restless again. Asking for Dad. Cold hands, refused dinner around 6.",
    by: "Sarah · 7:45p",
  },
  sleep: { hours: 4.2, change: "-2.1h", spark: [7.1, 6.8, 7.4, 5.9, 5.2, 6.0, 4.2] },
  comingUp: [
    { when: "Today · 9:00p", title: "Atorvastatin 40 mg", sub: "Evening dose — Sarah on shift", tag: "meds" },
    { when: "Tomorrow · 8:00a", title: "Sarah → Daniel handoff", sub: "Morning meds, walk after coffee", tag: "shift" },
    { when: "Thu May 21 · 2:30p", title: "Cardiology · Dr. Hsu", sub: "Bring med list + last ECG. Parking validated.", tag: "appt" },
    { when: "Fri May 22", title: "Pharmacy refill · Metoprolol", sub: "CVS Westlake — 3 day supply left", tag: "meds" },
  ],
  onShift: {
    current: { name: "Sarah", until: "9:30p", note: "Through evening meds + bedtime." },
    upNext: [
      { who: "Daniel", when: "Wed 8:00a – 2:00p", role: "Sibling", initials: "DL" },
      { who: "Inez (aide)", when: "Wed 2:00p – 6:00p", role: "Aide", initials: "IM" },
      { who: "Sarah", when: "Wed 6:00p – 9:30p", role: "Sibling", initials: "SL" },
    ],
  },
  pattern: {
    eyebrow: "Pattern · last 7 days",
    parts: [
      { kind: "t", text: "Sleep has dropped " },
      { kind: "em", text: "below 5 hours" },
      { kind: "t", text: " three nights in a row. Mom’s rougher days follow her shortest nights by about " },
      { kind: "em", text: "36 hours" },
      { kind: "t", text: "." },
    ],
    sub: "Worth raising at Thursday’s cardiology visit.",
  },
  // Now board events relative to "11:34p Tuesday"
  nowBoard: {
    past: [
      { type: "Note", time: "9:12p", text: "Got her into bed. Took half the Atorvastatin — refused the rest.", mood: "difficult" },
      { type: "Symptom", time: "6:20p", text: "Cold hands, mottled. Pulse 88. No SOB.", mood: "okay" },
      { type: "Medication", time: "8:02a", text: "Metoprolol 25 mg + Lisinopril 10 mg with toast.", mood: "good" },
    ],
    upNext: [
      { type: "Medication", time: "Wed 8:00a", text: "Morning dose — Daniel taking handoff.", mood: null },
      { type: "Appointment", time: "Thu 2:30p", text: "Cardiology · Dr. Hsu · bring last ECG.", mood: null },
    ],
  },
};

Object.assign(window, { DATA });
