import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Badge } from "./components/Badge.jsx";
import { Card } from "./components/Card.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { TopNav } from "./components/TopNav.jsx";
import { fetchDashboardSummary } from "./lib/api.js";

function StatCard({ label, value, detail, accent }) {
  return (
    <Card className={accent ? "border-foreground shadow-neopop" : ""}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-5 font-display text-5xl font-black tracking-normal">{value}</p>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{detail}</p>
    </Card>
  );
}

function QueueList({ items }) {
  return (
    <Card className="md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Samarth Queue</p>
          <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Platform first</h2>
        </div>
        <Badge tone="accent">P0</Badge>
      </div>
      <div className="mt-8 divide-y divide-border">
        {items.map((item, index) => (
          <div className="flex items-center justify-between py-4" key={item}>
            <p className="font-semibold">{item}</p>
            <span className="font-display text-2xl font-black text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BusPanel({ bus }) {
  return (
    <Card className="md:col-span-2">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Data Plane</p>
      <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Bus topics</h2>
      <div className="mt-8 grid gap-3">
        {bus.subscribers.map((subscriber) => (
          <div className="flex items-center justify-between border-b border-border pb-3" key={subscriber.service_id}>
            <p className="font-bold">{subscriber.service_id}</p>
            <p className="text-sm font-semibold text-muted-foreground">{subscriber.topics.join(", ")}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ContractPanel() {
  const contracts = ["frame envelope", "result envelope", "service interface", "module interface"];

  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Tier 0</p>
      <h2 className="mt-3 font-display text-3xl font-black tracking-normal">Contracts</h2>
      <div className="mt-8 grid gap-3">
        {contracts.map((contract) => (
          <div className="flex items-center justify-between border-b border-border pb-3" key={contract}>
            <p className="text-sm font-bold capitalize">{contract}</p>
            <Badge>Schema</Badge>
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

  useEffect(() => {
    fetchDashboardSummary().then(setSummary);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className={`grid ${sidebarCollapsed ? "md:grid-cols-[96px_1fr]" : "md:grid-cols-[280px_1fr]"}`}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />
        <main>
          <TopNav
            theme={theme}
            onOpenCommand={() => setPaletteOpen(true)}
            onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          />
          <motion.div
            className="p-8 md:p-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <Badge tone={data?.offline ? "default" : "accent"}>{data?.offline ? "Local fallback" : "Live core"}</Badge>
                <p className="mt-5 max-w-3xl text-xl font-semibold leading-relaxed text-muted-foreground">
                  Shared contracts, core registry, config, and operator shell for the first Samarth-owned platform slice.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Site</p>
                <p className="font-display text-2xl font-black tracking-normal">{data?.config.site_id ?? "loading"}</p>
              </div>
            </div>

            {data ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
                <StatCard
                  accent
                  label="Services"
                  value={data.registry.service_count}
                  detail={`${data.registry.healthy_count} healthy, ${data.registry.degraded_count} degraded`}
                />
                <StatCard label="Modules" value={data.registry.module_count} detail={data.config.enabled_modules.join(", ")} />
                <StatCard label="Bus" value={data.bus.retained_messages} detail={`${data.bus.mode} retained messages`} />
                <StatCard label="Errors" value={data.registry.error_count} detail="Core-visible service failures" />
                <QueueList items={data.samarth_queue} />
                <ContractPanel />
                <BusPanel bus={data.bus} />
              </div>
            ) : (
              <Card>
                <p className="font-display text-3xl font-black tracking-normal">Loading platform state</p>
              </Card>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
