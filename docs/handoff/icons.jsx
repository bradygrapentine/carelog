// Inline icon set — lucide-style stroke icons matching the existing app.
const Icon = ({ d, size = 18, stroke = 1.75, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const Icons = {
  Home: (p) => <Icon {...p} d={<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></>} />,
  Journal: (p) => <Icon {...p} d={<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></>} />,
  Calendar: (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>} />,
  Pill: (p) => <Icon {...p} d={<><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/></>} />,
  Users: (p) => <Icon {...p} d={<><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.5 2-4 4-4s2.5 1 2.5 3"/></>} />,
  Heart: (p) => <Icon {...p} d={<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>} />,
  FileText: (p) => <Icon {...p} d={<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h6"/></>} />,
  Settings: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.5.2 1.04.32 1.51.41A2 2 0 0 1 23 13v-.09c-.5.1-1 .26-1.51.41z"/></>} />,
  Printer: (p) => <Icon {...p} d={<><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 14h12v7H6z"/></>} />,
  Plus: (p) => <Icon {...p} d={<><path d="M12 5v14M5 12h14"/></>} />,
  ChevronRight: (p) => <Icon {...p} d={<path d="M9 6l6 6-6 6"/>} />,
  Mail: (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>} />,
  Check: (p) => <Icon {...p} d={<path d="M4 12l5 5L20 6"/>} />,
  AlertCircle: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></>} />,
  Clock: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>} />,
  Moon: (p) => <Icon {...p} d={<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>} />,
  Receipt: (p) => <Icon {...p} d={<><path d="M5 3v18l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5V3"/><path d="M8 8h8M8 12h8M8 16h5"/></>} />,
  Bell: (p) => <Icon {...p} d={<><path d="M18 16V11a6 6 0 1 0-12 0v5l-2 3h16z"/><path d="M10 21h4"/></>} />,
  Sun: (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M17 7l1.4-1.4M5.6 18.4 7 17"/></>} />,
  Sparkles: (p) => <Icon {...p} d={<><path d="M12 4l1.5 4L18 9.5 13.5 11 12 15l-1.5-4L6 9.5 10.5 8z"/><path d="M19 16l.7 1.8L21.5 18l-1.8.7L19 20.5l-.7-1.8L16.5 18l1.8-.7z"/></>} />,
};

Object.assign(window, { Icons, Icon });
