// CareSync — page data for Journal / Shifts / Medications / Team / Documents.

const PAGE_DATA = {
  journal: {
    quickPrompts: ["Add note", "Log medication", "Mark symptom", "Start shift"],
    days: [
      {
        date: "Tuesday · May 19",
        sub: "Today",
        entries: [
          { id: 1, time: "11:34p", type: "note",     mood: "difficult", author: "Sarah", text: "Settled finally. She drifted off mid-sentence — asked about Dad twice. Cold hands again.", flagged: true },
          { id: 2, time: "9:12p",  type: "med",      mood: null,        author: "Sarah", text: "Half-dose Atorvastatin. Refused the rest. Will note for Dr. Hsu.", flagged: false },
          { id: 3, time: "6:20p",  type: "symptom",  mood: "okay",      author: "Sarah", text: "Cold hands, mottled. Pulse 88. No SOB.", flagged: false },
          { id: 4, time: "5:45p",  type: "note",     mood: "difficult", author: "Sarah", text: "Refused dinner around 6. Had two crackers and tea. Watching for a UTI flare again.", flagged: false },
        ],
      },
      {
        date: "Monday · May 18",
        sub: "Yesterday",
        entries: [
          { id: 10, time: "8:02a", type: "med",     mood: null,    author: "Daniel", text: "Morning meds done — Metoprolol + Lisinopril with toast.", flagged: false },
          { id: 11, time: "9:45a", type: "note",    mood: "good",  author: "Daniel", text: "Good morning. Sat in the sun an hour, asked about her sister. Lucid.", flagged: false },
          { id: 12, time: "3:10p", type: "shift",   mood: null,    author: "Inez",   text: "Took over at 2. PT exercises went 12 minutes — she pushed back at the end.", flagged: false },
          { id: 13, time: "7:30p", type: "med",     mood: null,    author: "Sarah",  text: "Atorvastatin skipped — she was already asleep when I tried. Not pressing it tonight.", flagged: true },
        ],
      },
      {
        date: "Sunday · May 17",
        sub: "Sun",
        entries: [
          { id: 20, time: "11:00a", type: "note",    mood: "okay",   author: "Daniel", text: "Phone call with Aunt Ruth — Mom seemed grounded and present. Mentioned Dad lovingly, not anxiously.", flagged: false },
          { id: 21, time: "8:45p",  type: "symptom", mood: "difficult", author: "Daniel", text: "Sundown-y after dinner. Pacing for ~20 min. Music helped.", flagged: false },
        ],
      },
    ],
  },
  shifts: {
    week: ["Mon May 19", "Tue May 20", "Wed May 21", "Thu May 22", "Fri May 23", "Sat May 24", "Sun May 25"],
    hours: ["6a","8a","10a","12p","2p","4p","6p","8p","10p"],
    blocks: [
      // day index 0-6, startHr (24h), endHr, who, status
      { d:0, s:8,  e:14, who:"Daniel",  role:"Sibling", status:"completed" },
      { d:0, s:14, e:18, who:"Inez",    role:"Aide",    status:"completed" },
      { d:0, s:18, e:21.5, who:"Sarah", role:"Sibling", status:"completed" },
      { d:1, s:8,  e:14, who:"Sarah",   role:"Sibling", status:"in-progress" },
      { d:1, s:14, e:18, who:"Inez",    role:"Aide",    status:"scheduled" },
      { d:1, s:18, e:21.5, who:"Sarah", role:"Sibling", status:"scheduled" },
      { d:2, s:8,  e:14, who:"Daniel",  role:"Sibling", status:"scheduled" },
      { d:2, s:14, e:18, who:"Inez",    role:"Aide",    status:"scheduled" },
      { d:2, s:18, e:21.5, who:null,    role:"—",       status:"unassigned" },
      { d:3, s:8,  e:14, who:"Sarah",   role:"Sibling", status:"scheduled" },
      { d:3, s:14, e:16, who:"Inez",    role:"Aide",    status:"scheduled" },
      { d:3, s:14.5, e:15.5, who:"Cardio", role:"Appt", status:"scheduled", appt:true },
      { d:3, s:18, e:21.5, who:"Daniel",role:"Sibling", status:"scheduled" },
      { d:4, s:8,  e:14, who:"Daniel",  role:"Sibling", status:"scheduled" },
      { d:4, s:14, e:18, who:null,      role:"—",       status:"unassigned" },
      { d:4, s:18, e:21.5, who:"Sarah", role:"Sibling", status:"scheduled" },
      { d:5, s:9,  e:15, who:"Inez",    role:"Aide",    status:"scheduled" },
      { d:5, s:15, e:21, who:"Daniel",  role:"Sibling", status:"scheduled" },
      { d:6, s:9,  e:21, who:"Sarah",   role:"Sibling", status:"scheduled" },
    ],
    gaps: 2,
  },
  medications: [
    { name:"Metoprolol",  dose:"25 mg",   form:"tablet", schedule:"Twice daily · 8a, 8p", with:"with food",      refills:1, supply:"3 days", taken:"8:02a today",  notes:"Cardiology — BP / HR" },
    { name:"Lisinopril",  dose:"10 mg",   form:"tablet", schedule:"Once daily · 8a",      with:"with food",      refills:3, supply:"22 days", taken:"8:02a today",  notes:"ACE inhibitor — check potassium quarterly" },
    { name:"Atorvastatin",dose:"40 mg",   form:"tablet", schedule:"Once daily · 9p",      with:"evening",        refills:2, supply:"14 days", taken:"Half — 9:12p", notes:"Statin — liver panel at next visit" },
    { name:"Vitamin D",   dose:"1000 IU", form:"capsule",schedule:"Once daily · 8a",      with:"with food",      refills:0, supply:"6 days",  taken:"missed today", notes:"OTC — restock at CVS" },
    { name:"Donepezil",   dose:"5 mg",    form:"tablet", schedule:"Once daily · 8p",      with:"bedtime",        refills:2, supply:"30 days", taken:"yesterday 8:14p", notes:"Memory support — taper conversation in 2 weeks" },
    { name:"Acetaminophen",dose:"500 mg",form:"tablet", schedule:"As needed · max 3/day", with:"with water",     refills:99,supply:"open",   taken:"—",            notes:"PRN — for joint pain" },
  ],
  team: [
    { who:"Alex Lin",     role:"Coordinator", rel:"Daughter",  status:"You", lastSeen:"now",        initials:"AL", access:"Full",      notify:true },
    { who:"Sarah Lin",    role:"Caregiver",   rel:"Daughter",  status:"On shift", lastSeen:"3m",     initials:"SL", access:"Full",      notify:true },
    { who:"Daniel Lin",   role:"Caregiver",   rel:"Son",       status:"",        lastSeen:"yesterday", initials:"DL", access:"Full",   notify:true },
    { who:"Inez Marquez", role:"Aide",        rel:"Paid · 24h/wk", status:"",    lastSeen:"yesterday", initials:"IM", access:"Care log + shifts", notify:false },
    { who:"Dr. Marie Hsu",role:"Clinician",   rel:"Cardiology", status:"",       lastSeen:"7 days",   initials:"MH", access:"Briefs only", notify:false },
    { who:"Aunt Ruth",    role:"Supporter",   rel:"Sister",    status:"",        lastSeen:"4 days",   initials:"AR", access:"Briefs only", notify:false },
  ],
  pendingInvites: [
    { who:"Pastor Wilson", role:"Supporter", email:"wilson@stmarks.org", sent:"2 days ago" },
  ],
  documents: {
    folders: [
      { name:"Insurance",        count: 6, icon:"FileText", color:"primary" },
      { name:"Medical records",  count: 14, icon:"Heart",    color:"secondary" },
      { name:"Advance directive",count: 3, icon:"FileText", color:"primary" },
      { name:"Receipts",         count: 22, icon:"Receipt",  color:"muted" },
      { name:"Photos",           count: 41, icon:"Sun",      color:"muted" },
    ],
    recent: [
      { name:"Cardiology — May 12 visit notes.pdf", folder:"Medical records", size:"3.2 MB", at:"3 days ago",  by:"Sarah",  ocr:true },
      { name:"Medicare Part D — formulary 2026.pdf", folder:"Insurance",       size:"1.1 MB", at:"1 week ago",  by:"Alex",   ocr:false },
      { name:"DNR — signed May 1 2024.pdf",          folder:"Advance directive", size:"248 KB", at:"2 weeks ago", by:"Alex",  ocr:true },
      { name:"Pharmacy receipt — Atorvastatin.jpg",  folder:"Receipts",         size:"480 KB", at:"5 days ago",  by:"Sarah",  ocr:true },
      { name:"PT exercise sheet — May.pdf",          folder:"Medical records", size:"712 KB", at:"yesterday",   by:"Inez",   ocr:false },
    ],
  },
  brief: {
    eyebrow: "Today’s brief · auto-generated 7:02a · for Dr. Hsu",
    headlineParts: [
      { kind:"t", text:"Mom slept " },
      { kind:"em", text:"poorly" },
      { kind:"t", text:" — third night under 5 hours. Three doses missed since Sunday. " },
      { kind:"em", text:"Cardiology Thursday." },
    ],
    paragraphs: [
      { date:"Tuesday May 19", text:"Restless overnight, cold hands at 6:20p, refused the second half of Atorvastatin. Sarah noted intermittent confusion in the evening — asked about her late husband twice." },
      { date:"Monday May 18",  text:"Mostly steady. Lucid morning in the sun with Daniel. Skipped Atorvastatin — fell asleep before evening dose." },
      { date:"Sunday May 17",  text:"Sundowning after dinner; calmed with music in ~20 minutes. No symptoms otherwise." },
    ],
    flagged: [
      "Skipped Atorvastatin two evenings in a row",
      "Cold extremities + reduced appetite Tuesday evening",
      "Asking for late spouse — first time in ~3 weeks",
    ],
    medications: [
      { name:"Metoprolol", dose:"25 mg", note:"2× daily, with food" },
      { name:"Lisinopril", dose:"10 mg", note:"Once daily, morning" },
      { name:"Atorvastatin", dose:"40 mg", note:"Once daily, evening" },
      { name:"Donepezil", dose:"5 mg", note:"Once daily, bedtime" },
    ],
  },
};

Object.assign(window, { PAGE_DATA });
