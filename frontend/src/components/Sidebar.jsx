import { Activity, Boxes, Gauge, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Gauge, testId: "nav-dashboard" },
  { id: "registry", label: "Registry", icon: Boxes, testId: "nav-registry" },
  { id: "health", label: "Health", icon: Activity, testId: "nav-health" },
  { id: "settings", label: "Settings", icon: Settings, testId: "nav-settings" }
];

export function Sidebar({ activeView, collapsed, onSelectView, onToggle }) {
  return (
    <aside className="hidden h-screen min-h-0 border-r border-border bg-card md:flex md:flex-col">
      <div className={`flex h-20 shrink-0 items-center border-b border-border px-5 ${collapsed ? "justify-center" : "justify-end"}`}>
        <button
          className="grid size-10 shrink-0 place-items-center border border-border bg-background hover:-translate-y-0.5 active:scale-95"
          data-testid="sidebar-toggle"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.7} /> : <PanelLeftClose size={18} strokeWidth={1.7} />}
        </button>
      </div>
      <nav className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 ${collapsed ? "grid content-start justify-items-center gap-2" : "grid content-start gap-2"}`}>
        {navItems.map(({ id, label, icon: Icon, testId }) => {
          const active = activeView === id;
          return (
            <button
              className={`${
                collapsed ? "grid size-12 place-items-center" : "flex w-full items-center gap-3 px-3 py-3 text-left"
              } rounded-sm text-sm font-bold active:scale-95 ${active ? "bg-secondary text-foreground" : "hover:bg-secondary"}`}
              data-testid={testId}
              type="button"
              key={id}
              onClick={() => onSelectView(id)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.5} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}