import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Network, Play, Power, Radio, RefreshCw, ShieldCheck, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Badge } from "./components/Badge.jsx";
import { Card } from "./components/Card.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { TopNav } from "./components/TopNav.jsx";
import { fetchDashboardSummary, runLifecycleAction } from "./lib/api.js";

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

function ReadinessPanel({ dependencies, className = "" }) {
  const failed = dependencies?.failed ?? [];
  const summary = dependencies?.summary ?? { passed: 0, total: 0 };
  const healthy = dependencies?.ok ?? failed.length === 0;
  const rows = failed.length
    ? failed.slice(0, 4)
    : [{ kind: "healthy", name: "All required services, topics, and config are available" }];

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Readiness</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Dependencies</h2>
        </div>
        {healthy ? <CheckCircle2 size={20} strokeWidth={1.5} /> : <AlertTriangle size={20} strokeWidth={1.5} />}
      </div>
      <p className="mt-8 font-display text-5xl font-black tracking-normal">{healthy ? "Ready" : "Blocked"}</p>
      <p className="mt-4 text-sm font-semibold leading-6 text-muted-foreground">
        {summary.passed} of {summary.total} checks passing
      </p>
      <div className="mt-6 grid gap-3">
        {rows.map((check) => (
          <div className="border-b border-border pb-3" key={`${check.kind}-${check.name}`}>
            <p className="text-sm font-bold capitalize">{check.name}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {check.kind.replaceAll("_", " ")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ModulePanel({ modules, lifecycle, className = "" }) {
  const readiness = lifecycle?.startup?.modules ?? [];
  const byModule = new Map(readiness.map((module) => [module.module_id, module]));

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Modules</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Runtime</h2>
        </div>
        <Badge>{modules.length} loaded</Badge>
      </div>
      <div className="mt-8 grid gap-3">
        {modules.map((module) => {
          const state = byModule.get(module.module_id);
          return (
            <div className="flex items-center justify-between gap-4 border-b border-border pb-3" key={module.module_id}>
              <div className="min-w-0">
                <p className="truncate font-bold">{module.display_name}</p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{module.module_id}</p>
              </div>
              <Badge tone={state?.ready ? "accent" : "default"}>{state?.ready ? "Ready" : "Blocked"}</Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ServicePanel({ services, className = "md:col-span-2" }) {
  return (
    <Card className={className}>
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

function LifecycleControls({ services, busyAction, onAction, onRefresh, offline, className = "md:col-span-2" }) {
  const running = services.filter((service) => service.state === "running" && service.alive).length;
  const stopped = services.filter((service) => service.state === "stopped").length;
  const busy = Boolean(busyAction);

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Lifecycle</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Controls</h2>
        </div>
        <Badge tone={running > 0 ? "accent" : "default"}>{running} running</Badge>
      </div>
      <div className="mt-7 grid gap-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-b border-border pb-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Running</p>
              <p className="mt-1 font-display text-3xl font-black tracking-normal">{running}</p>
            </div>
            <div className="border-b border-border pb-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Stopped</p>
              <p className="mt-1 font-display text-3xl font-black tracking-normal">{stopped}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:w-[360px] lg:justify-end">
            <button
              className="inline-flex h-10 min-w-[112px] items-center justify-between gap-3 border border-border bg-background px-3 text-sm font-bold hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={busy || offline}
              onClick={() => onAction("startup")}
            >
              <span>{busyAction === "startup" ? "Starting" : "Start all"}</span>
              <Play size={16} strokeWidth={1.7} />
            </button>
            <button
              className="inline-flex h-10 min-w-[132px] items-center justify-between gap-3 border border-border bg-background px-3 text-sm font-bold hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={busy || offline || running === 0}
              onClick={() => onAction("shutdown")}
            >
              <span>{busyAction === "shutdown" ? "Stopping" : "Shutdown all"}</span>
              <Square size={16} strokeWidth={1.7} />
            </button>
            <button
              className="inline-flex h-10 min-w-[140px] items-center justify-between gap-3 border border-border bg-background px-3 text-sm font-bold hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onRefresh}
            >
              <span>{busyAction === "refresh" ? "Refreshing" : "Refresh state"}</span>
              <RefreshCw size={16} strokeWidth={1.7} />
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((service) => (
            <div className="flex min-w-0 items-center justify-between gap-3 border border-border bg-background px-3 py-2" key={service.service_id}>
              <p className="truncate text-sm font-bold">{service.display_name}</p>
              <span className="inline-flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                <span className={`size-2 rounded-full ${service.alive ? "bg-accent" : "bg-muted-foreground"}`} />
                {service.state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function BusPanel({ bus, className = "md:col-span-2" }) {
  return (
    <Card className={className}>
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

function EventPanel({ bus, className = "" }) {
  const messages = bus.recent_messages ?? [];
  const rows = messages.length ? messages.slice(0, 5) : [{ id: "empty", topic: "No retained messages", family: "idle" }];

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Events</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Recent bus</h2>
        </div>
        <Radio size={20} strokeWidth={1.5} />
      </div>
      <div className="mt-8 grid gap-3">
        {rows.map((message) => (
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3" key={message.id}>
            <p className="truncate text-sm font-bold">{message.topic}</p>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{message.family}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SettingsPanel({ data, className = "md:col-span-2" }) {
  const rows = [
    ["Device", data.config.device_id],
    ["Site", data.config.site_id],
    ["Enabled modules", data.config.enabled_modules.join(", ") || "None"],
    ["Bus mode", data.bus.mode],
    ["Config source", data.config.loaded_from ? `${data.config.loaded_from.device}, ${data.config.loaded_from.site}` : "Fallback"],
    ["Deployment", "Vercel-ready frontend with API function rewrites"]
  ];

  return (
    <Card className={className}>
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
  const [busyAction, setBusyAction] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function loadSummary() {
    setSummary(await fetchDashboardSummary());
  }

  useEffect(() => {
    loadSummary();
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

  async function handleLifecycleAction(action) {
    setActionError(null);
    setBusyAction(action);
    try {
      await runLifecycleAction(action);
      await loadSummary();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh() {
    setActionError(null);
    setBusyAction("refresh");
    await loadSummary();
    setBusyAction(null);
  }

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
        <div className="grid gap-6">
          <ServicePanel services={services} className="" />
          <div className="grid gap-6 lg:grid-cols-2">
            <ModulePanel modules={data.modules} lifecycle={data.lifecycle} />
            <ReadinessPanel dependencies={data.dependencies} />
          </div>
        </div>
      );
    }

    if (activeView === "health") {
      return (
        <div className="grid gap-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <StatCard accent icon={ShieldCheck} label="Healthy" value={data.registry.healthy_count} detail={`${data.registry.degraded_count} degraded, ${data.registry.error_count} errors`} />
            <StatCard icon={Activity} label="Stopped" value={data.registry.stopped_count ?? 0} detail="Lifecycle-controlled shutdowns" />
            <LifecycleControls services={services} busyAction={busyAction} onAction={handleLifecycleAction} onRefresh={handleRefresh} offline={data.offline} className="xl:col-span-2" />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
            <ReadinessPanel dependencies={data.dependencies} />
            <ServicePanel services={services} className="" />
          </div>
        </div>
      );
    }

    if (activeView === "settings") {
      return (
        <div className="grid gap-6">
          <SettingsPanel data={data} className="" />
          <div className="grid gap-6 lg:grid-cols-3">
            <ReadinessPanel dependencies={data.dependencies} />
            <BusPanel bus={data.bus} className="" />
            <EventPanel bus={data.bus} />
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard accent icon={ShieldCheck} label="Services" value={data.registry.service_count} detail={`${data.registry.healthy_count} healthy, ${data.registry.degraded_count} degraded`} />
          <StatCard icon={CheckCircle2} label="Modules" value={data.registry.module_count} detail={data.config.enabled_modules.join(", ") || "No modules enabled"} />
          <StatCard icon={Network} label="Bus" value={data.bus.retained_messages} detail={`${data.bus.mode} retained messages`} />
          <StatCard icon={Activity} label="Stopped" value={data.registry.stopped_count ?? 0} detail="Lifecycle-controlled shutdowns" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <LifecycleControls services={services} busyAction={busyAction} onAction={handleLifecycleAction} onRefresh={handleRefresh} offline={data.offline} className="" />
          <ReadinessPanel dependencies={data.dependencies} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <ServicePanel services={services} className="" />
          <ModulePanel modules={data.modules} lifecycle={data.lifecycle} />
        </div>
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <BusPanel bus={data.bus} className="" />
          <EventPanel bus={data.bus} />
        </div>
      </div>
    );
  }
  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className={`grid h-full min-h-0 ${sidebarCollapsed ? "md:grid-cols-[96px_1fr]" : "md:grid-cols-[280px_1fr]"}`}>
        <Sidebar
          activeView={activeView}
          collapsed={sidebarCollapsed}
          onSelectView={setActiveView}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />
        <main className="min-h-0 overflow-y-auto overscroll-contain">
          <TopNav
            theme={theme}
            onOpenCommand={() => setPaletteOpen(true)}
            onToggleTheme={toggleTheme}
          />
          <motion.div
            className="mx-auto w-full max-w-[1480px] p-6 md:p-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
              <div>
                <Badge tone={data?.offline ? "default" : "accent"}>{data?.offline ? "Local fallback" : "Live core"}</Badge>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Site</p>
                <p className="font-display text-2xl font-black tracking-normal">{data?.config.site_id ?? "loading"}</p>
              </div>
            </div>

            {actionError && (
              <div className="mb-6 border border-border bg-secondary px-4 py-3 text-sm font-bold text-foreground">{actionError}</div>
            )}
            {renderActiveView()}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
