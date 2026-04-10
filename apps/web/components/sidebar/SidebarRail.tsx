import { SidebarNav } from "./SidebarNav";

export function SidebarRail() {
  return (
    <aside
      data-testid="sidebar-rail"
      className="hidden md:flex fixed left-0 top-0 h-screen w-[60px] flex-col items-center bg-[var(--color-ink)] py-3 z-40"
    >
      {/* Logo mark */}
      <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center mb-4 shrink-0">
        <span className="text-white font-extrabold text-sm">C</span>
      </div>

      <SidebarNav showLabels={false} />
    </aside>
  );
}
