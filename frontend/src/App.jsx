import { motion } from "framer-motion";
import { Activity, CheckCircle2, Network, Power, Route, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Badge } from "./components/Badge.jsx";
import { Card } from "./components/Card.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { TopNav } from "./components/TopNav.jsx";
import { fetchDashboardSummary } from "./lib/api.js";

function StatCard({ label, value, detail, icon: Icon, accent }) {
  return (
    <Card className={accent ? "border-foreground shadow-neopop" : ""}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {Icon && <Icon size={18} strokeWidth={1.5} />}
      </div>
      <p className="mt-5 font-display text-5xl font-black tracking-normal">{value}</p>
      <p className="mt-4 text-sm font-medium leading-6 text-muted-foreground">{detail}</p>
    </Card>
  );
}

function QueueList({ items }) {
  return (
    <Card className="md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">P0 Scope</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Core platform</h2>
        </div>
        <Badge tone="accent">Implemented</Badge>
      </div>
      <div className="mt-8 divide-y divide-border">
        {items.map((item, index) => (
          <div className="flex items-center justify-between gap-4 py-4" key={item}>
            <p className="font-semibold leading-6">{item}</p>
            <span className="font-display text-2xl font-black text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ServicePanel({ services }) {
  return (
    <Card className="md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Registry</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Services</h2>
        </div>
        <Badge>{services.length} total</Badge>
      </div>
      <div className="mt-8 overflow-hidden border border-border">
        <div className="grid grid-cols-[1fr_112px_112px] bg-secondary px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          <span>Service</span>
          <span>Status</span>
          <span>Heartbeat</span>
        </div>
        <div className="divide-y divide-border">
          {services.map((service) => (
            <div className="grid grid-cols-[1fr_112px_112px] items-center gap-4 px-4 py-4" key={service.service_id}>
              <div className="min-w-0">
                <p className="truncate font-bold">{service.display_name}</p>
                <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{service.service_id} / {service.role}</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 text-sm font-bold capitalize">
                <span className={`size-2 rounded-full ${service.alive ? "bg-accent" : "bg-muted-foreground"}`} />
                {service.state}
              </span>
              <span className="w-fit border border-border bg-background px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {service.heartbeat_status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function LifecyclePanel({ lifecycle }) {
  const startup = lifecycle?.startup?.order ?? [];
  const modules = lifecycle?.startup?.modules ?? [];

  return (
    <Card className="md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Sequencing</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Startup order</h2>
        </div>
        <Route size={20} strokeWidth={1.5} />
      </div>
      <div className="mt-8 grid gap-3">
        {startup.map((service, index) => (
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3" key={service.service_id}>
            <p className="font-semibold">{index + 1}. {service.service_id}</p>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">{service.role}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-3">
        {modules.map((module) => (
          <div className="flex items-center justify-between gap-4 bg-secondary px-4 py-3" key={module.module_id}>
            <p className="text-sm font-bold">{module.display_name}</p>
            <Badge tone={module.ready ? "accent" : "default"}>{module.ready ? "Ready" : "Blocked"}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BusPanel({ bus }) {
  return (
    <Card className="md:col-span-2">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Data Plane</p>
      <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Bus topics</h2>
      <div className="mt-8 grid gap-3">
        {bus.subscribers.map((subscriber) => (
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3" key={subscriber.service_id}>
            <p className="font-bold">{subscriber.service_id}</p>
            <p className="text-right text-sm font-semibold text-muted-foreground">{subscriber.topics.join(", ")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ContractPanel() {
  const contracts = ["manifest needs/provides", "service registration", "heartbeat", "shutdown command"];

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Contracts</p>
      <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Tier 0</h2>
      <div className="mt-8 grid gap-3">
        {contracts.map((contract) => (
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3" key={contract}>
            <p className="text-sm font-bold capitalize">{contract}</p>
            <Badge>Schema</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}


function SettingsPanel({ data }) {
  const rows = [
    ["Device", data.config.device_id],
    ["Site", data.config.site_id],
    ["Enabled modules", data.config.enabled_modules.join(", ") || "None"],
    ["Bus mode", data.bus.mode],
    ["Deployment", "Vercel-ready frontend with API function rewrites"]
  ];

  return (
    <Card className="md:col-span-2">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Settings</p>
      <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Platform config</h2>
      <div className="mt-8 grid gap-3">
        {rows.map(([label, value]) => (
          <div className="grid gap-2 border-b border-border pb-3 md:grid-cols-[180px_1fr]" key={label}>
            <p className="text-sm font-bold text-muted-foreground">{label}</p>
            <p className="font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
export default function App() {
  const [summary, setSummary] = useState(null);
  const [theme, setTheme] = useState("light");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");

  useEffect(() => {
    fetchDashboardSummary().then(setSummary);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggleTheme(event) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    const button = event?.currentTarget;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!button || !document.startViewTransition || reduceMotion) {
      setTheme(nextTheme);
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    root.style.setProperty("--theme-toggle-x", `${x}px`);
    root.style.setProperty("--theme-toggle-y", `${y}px`);
    root.style.setProperty("--theme-transition-radius", `${radius}px`);
    root.dataset.themeTransition = "active";

    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(nextTheme));
      root.classList.toggle("dark", nextTheme === "dark");
    });

    transition.finished.finally(() => {
      delete root.dataset.themeTransition;
    });
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const data = summary;
  const services = data?.services ?? data?.lifecycle?.startup?.order ?? [];

  function renderActiveView() {
    if (!data) {
      return (
        <Card>
          <div className="flex items-center gap-3">
            <Power size={20} strokeWidth={1.5} />
            <p className="font-display text-3xl font-black tracking-normal">Loading platform state</p>
          </div>
        </Card>
      );
    }

    if (activeView === "registry") {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <ServicePanel services={services} />
          <ContractPanel />
          <StatCard icon={CheckCircle2} label="Modules" value={data.registry.module_count} detail={data.config.enabled_modules.join(", ") || "No modules enabled"} />
        </div>
      );
    }

    if (activeView === "health") {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <StatCard accent icon={ShieldCheck} label="Healthy" value={data.registry.healthy_count} detail={`${data.registry.degraded_count} degraded, ${data.registry.error_count} errors`} />
          <StatCard icon={Activity} label="Stopped" value={data.registry.stopped_count ?? 0} detail="Lifecycle-controlled shutdowns" />
          <LifecyclePanel lifecycle={data.lifecycle} />
          <ServicePanel services={services} />
        </div>
      );
    }

    if (activeView === "settings") {
      return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
          <SettingsPanel data={data} />
          <ContractPanel />
          <BusPanel bus={data.bus} />
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
        <StatCard accent icon={ShieldCheck} label="Services" value={data.registry.service_count} detail={`${data.registry.healthy_count} healthy, ${data.registry.degraded_count} degraded`} />
        <StatCard icon={CheckCircle2} label="Modules" value={data.registry.module_count} detail={data.config.enabled_modules.join(", ") || "No modules enabled"} />
        <StatCard icon={Network} label="Bus" value={data.bus.retained_messages} detail={`${data.bus.mode} retained messages`} />
        <StatCard icon={Activity} label="Stopped" value={data.registry.stopped_count ?? 0} detail="Lifecycle-controlled shutdowns" />
        <QueueList items={data.samarth_queue} />
        <ContractPanel />
        <LifecyclePanel lifecycle={data.lifecycle} />
        <ServicePanel services={services} />
        <BusPanel bus={data.bus} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className={`grid ${sidebarCollapsed ? "md:grid-cols-[96px_1fr]" : "md:grid-cols-[280px_1fr]"}`}>
        <Sidebar
          activeView={activeView}
          collapsed={sidebarCollapsed}
          onSelectView={setActiveView}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />
        <main>
          <TopNav
            theme={theme}
            onOpenCommand={() => setPaletteOpen(true)}
            onToggleTheme={toggleTheme}
          />
          <motion.div
            className="p-6 md:p-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <Badge tone={data?.offline ? "default" : "accent"}>{data?.offline ? "Local fallback" : "Live core"}</Badge>
                <p className="mt-5 max-w-3xl text-xl font-semibold leading-relaxed text-muted-foreground">
                  Contracts, bus, registry, alive-checks, and lifecycle sequencing for the Samarth-owned P0 platform slice.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Site</p>
                <p className="font-display text-2xl font-black tracking-normal">{data?.config.site_id ?? "loading"}</p>
              </div>
            </div>

            {renderActiveView()}
          </motion.div>
        </main>
      </div>
    </div>
  );
}







