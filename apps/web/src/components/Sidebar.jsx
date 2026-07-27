import { Activity, Boxes, Gauge, Settings } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: Gauge, testId: "nav-dashboard" },
  { label: "Registry", icon: Boxes, testId: "nav-registry" },
  { label: "Health", icon: Activity, testId: "nav-health" },
  { label: "Settings", icon: Settings, testId: "nav-settings" }
];

export function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className="hidden border-r border-border bg-card md:flex md:min-h-screen md:flex-col">
      <div className="flex h-20 items-center justify-between border-b border-border px-5">
        {!collapsed && (
          <div>
            <p className="font-display text-xl font-black tracking-normal">BiztelAI</p>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Platform</p>
          </div>
        )}
        <button
          className="border border-border px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] hover:-translate-y-0.5 active:scale-95"
          data-testid="sidebar-toggle"
          type="button"
          onClick={onToggle}
        >
          {collapsed ? "Open" : "Close"}
        </button>
      </div>
      <nav className="grid gap-2 p-4">
        {navItems.map(({ label, icon: Icon, testId }) => (
          <button
            className="flex items-center gap-3 rounded-sm px-3 py-3 text-left text-sm font-bold hover:bg-secondary active:scale-95"
            data-testid={testId}
            type="button"
            key={label}
          >
            <Icon size={18} strokeWidth={1.5} />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
