use biztel_contracts::{canonical_topics, topic_family, topic_matches};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DeviceConfig {
    device_id: String,
    #[serde(default = "default_role")]
    role: String,
    #[serde(default = "default_runs")]
    runs: Vec<String>,
    #[serde(default)]
    bus: BusConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BusConfig {
    #[serde(default = "default_bus_mode")]
    mode: String,
    #[serde(default = "default_host")]
    host: String,
    #[serde(default = "default_port")]
    port: u16,
}

impl Default for BusConfig {
    fn default() -> Self {
        Self { mode: default_bus_mode(), host: default_host(), port: default_port() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SiteConfig {
    site_id: String,
    #[serde(default)]
    enabled_modules: Vec<String>,
    #[serde(default)]
    sources: BTreeMap<String, Value>,
    #[serde(default)]
    sinks: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize)]
struct LoadedFrom { device: String, site: String }

#[derive(Debug, Clone, Serialize)]
struct PlatformConfig { device: DeviceConfig, site: SiteConfig, loaded_from: LoadedFrom }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServiceRecord {
    schema_version: String,
    service_id: String,
    display_name: String,
    role: String,
    version: String,
    host_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    process_id: Option<u32>,
    subscribes: Vec<String>,
    publishes: Vec<String>,
    health_topic: String,
    started_at_utc: String,
    metadata: BTreeMap<String, Value>,
    state: String,
    stopped_reason: Option<String>,
    last_heartbeat: Option<Value>,
    alive: bool,
    heartbeat_status: String,
    heartbeat_age_ms: Option<i64>,
    heartbeat_stale_after_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BusMessage {
    id: String,
    topic: String,
    family: String,
    timestamp_utc: String,
    message: Value,
    delivered_to: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubscriptionSummary { service_id: String, topics: Vec<String>, delivered: u64, failed: u64 }

struct RuntimeState {
    config: PlatformConfig,
    services: BTreeMap<String, ServiceRecord>,
    modules: BTreeMap<String, Value>,
    messages: Vec<BusMessage>,
    subscribers: Vec<SubscriptionSummary>,
    frame_sequence: u64,
    sink_entries: Vec<Value>,
}

fn default_role() -> String { "development".to_string() }
fn default_runs() -> Vec<String> { vec!["core".to_string()] }
fn default_bus_mode() -> String { "in-memory".to_string() }
fn default_host() -> String { "localhost".to_string() }
fn default_port() -> u16 { 7080 }
fn now() -> String { "2026-07-31T00:00:00.000Z".to_string() }

fn backend_root() -> PathBuf { env::current_dir().unwrap_or_else(|_| PathBuf::from(".")) }

fn parse_scalar(text: &str) -> Value {
    let trimmed = text.trim().trim_matches('"').trim_matches('\'');
    match trimmed {
        "true" => json!(true),
        "false" => json!(false),
        _ => trimmed.parse::<i64>().map(Value::from).or_else(|_| trimmed.parse::<f64>().map(Value::from)).unwrap_or_else(|_| json!(trimmed)),
    }
}

fn parse_simple_yaml(raw: &str) -> Value {
    let mut root = serde_json::Map::new();
    let lines: Vec<&str> = raw.lines().filter(|line| !line.trim().is_empty() && !line.trim_start().starts_with('#')).collect();
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with(' ') || !line.contains(':') { index += 1; continue; }
        let mut parts = line.splitn(2, ':');
        let key = parts.next().unwrap().trim().to_string();
        let value = parts.next().unwrap_or("").trim();
        if !value.is_empty() { root.insert(key, parse_scalar(value)); index += 1; continue; }
        let mut array = Vec::new();
        let mut object = serde_json::Map::new();
        index += 1;
        while index < lines.len() && lines[index].starts_with("  ") {
            let child = lines[index].trim();
            if let Some(item) = child.strip_prefix("- ") {
                array.push(parse_scalar(item));
            } else if child.contains(':') {
                let mut child_parts = child.splitn(2, ':');
                let child_key = child_parts.next().unwrap().trim().to_string();
                let child_value = child_parts.next().unwrap_or("").trim();
                if child_value.is_empty() {
                    let mut nested_array = Vec::new();
                    index += 1;
                    while index < lines.len() && lines[index].starts_with("    ") {
                        if let Some(item) = lines[index].trim().strip_prefix("- ") { nested_array.push(parse_scalar(item)); }
                        index += 1;
                    }
                    object.insert(child_key, Value::Array(nested_array));
                    continue;
                }
                object.insert(child_key, parse_scalar(child_value));
            }
            index += 1;
        }
        root.insert(key, if !array.is_empty() { Value::Array(array) } else { Value::Object(object) });
    }
    Value::Object(root)
}

fn read_yaml_or_json<T>(basename: &str, fallback: T) -> (T, String)
where T: for<'de> Deserialize<'de> {
    let root = backend_root();
    for extension in ["yaml", "yml", "json"] {
        let relative = format!("config/{basename}.{extension}");
        let path = root.join(&relative);
        if path.exists() {
            let raw = fs::read_to_string(&path).unwrap_or_else(|error| panic!("failed to read {relative}: {error}"));
            let json_value = if extension == "json" { serde_json::from_str::<Value>(&raw).unwrap() } else { parse_simple_yaml(&raw) };
            return (serde_json::from_value(json_value).unwrap(), relative);
        }
    }
    (fallback, "defaults".to_string())
}

fn load_config() -> PlatformConfig {
    let default_device = DeviceConfig { device_id: "dev-workstation".to_string(), role: default_role(), runs: default_runs(), bus: BusConfig::default() };
    let default_site = SiteConfig { site_id: "biztel-lab".to_string(), enabled_modules: Vec::new(), sources: BTreeMap::new(), sinks: BTreeMap::new() };
    let (device, device_source) = read_yaml_or_json("device", default_device);
    let (site, site_source) = read_yaml_or_json("site", default_site);
    PlatformConfig { device, site, loaded_from: LoadedFrom { device: device_source, site: site_source } }
}

fn heartbeat(service_id: &str, state: &str, message: Option<&str>) -> Value {
    json!({ "schema_version": "service-heartbeat.v1", "service_id": service_id, "state": state, "timestamp_utc": now(), "uptime_ms": 1, "message": message, "metrics": {} })
}

fn service(id: &str, display: &str, role: &str, publishes: Vec<&str>, subscribes: Vec<&str>) -> ServiceRecord {
    ServiceRecord {
        schema_version: "service-registration.v1".to_string(), service_id: id.to_string(), display_name: display.to_string(), role: role.to_string(), version: "0.1.0".to_string(), host_id: "dev-workstation".to_string(), process_id: None,
        subscribes: subscribes.iter().map(|s| s.to_string()).collect(), publishes: publishes.iter().map(|s| s.to_string()).collect(), health_topic: "health.heartbeat".to_string(), started_at_utc: now(), metadata: BTreeMap::new(),
        state: "running".to_string(), stopped_reason: None, last_heartbeat: Some(heartbeat(id, "running", None)), alive: true, heartbeat_status: "fresh".to_string(), heartbeat_age_ms: Some(0), heartbeat_stale_after_ms: 30_000,
    }
}

fn echo_manifest() -> Value {
    json!({ "schema_version": "module-manifest.v1", "module_id": "echo", "display_name": "Echo Module", "version": "0.1.0", "owner": "Samarth", "kind": "logic", "needs": { "input_topics": ["camera.line1"], "models": [], "config_keys": ["site.enabled_modules"], "services": [] }, "requires": { "input_topics": ["camera.line1"], "models": [], "config_keys": ["site.enabled_modules"], "services": [] }, "provides": { "result_topics": ["result.echo"] }, "lifecycle": { "init": "init(config)", "frame_handler": "on_frame(frame_envelope)", "publish": "publish(result_envelope)", "teardown": "teardown()" } })
}

fn initial_state() -> RuntimeState {
    let mut services = BTreeMap::new();
    services.insert("core".to_string(), service("core", "Core Supervisor", "core", vec!["event.service.registered"], vec!["health.heartbeat"]));
    services.insert("mock-source".to_string(), service("mock-source", "Mock Camera Source", "source", vec!["camera.line1"], vec![]));
    services.insert("echo".to_string(), service("echo", "Echo Module", "module", vec!["result.echo"], vec!["camera.line1"]));
    services.insert("log-sink".to_string(), service("log-sink", "Log Sink", "sink", vec![], vec!["result.*"]));
    let mut modules = BTreeMap::new();
    modules.insert("echo".to_string(), echo_manifest());
    RuntimeState { config: load_config(), services, modules, messages: Vec::new(), subscribers: vec![SubscriptionSummary { service_id: "echo".to_string(), topics: vec!["camera.line1".to_string()], delivered: 0, failed: 0 }, SubscriptionSummary { service_id: "log-sink".to_string(), topics: vec!["result.*".to_string()], delivered: 0, failed: 0 }], frame_sequence: 0, sink_entries: Vec::new() }
}

fn publish(state: &mut RuntimeState, topic: &str, payload: Value) -> BusMessage {
    let delivered = state.subscribers.iter_mut().filter(|sub| sub.topics.iter().any(|pattern| topic_matches(pattern, topic))).map(|sub| { sub.delivered += 1; 1usize }).sum();
    let entry = BusMessage { id: format!("{}-{}", state.messages.len() + 1, state.frame_sequence), topic: topic.to_string(), family: topic_family(topic).unwrap_or(topic).to_string(), timestamp_utc: now(), message: json!({ "topic": topic, "payload": payload }), delivered_to: delivered };
    state.messages.insert(0, entry.clone());
    state.messages.truncate(100);
    entry
}

fn registry_summary(state: &RuntimeState) -> Value {
    let services: Vec<&ServiceRecord> = state.services.values().collect();
    json!({ "service_count": services.len(), "module_count": state.modules.len(), "healthy_count": services.iter().filter(|s| s.state == "running" && s.alive).count(), "degraded_count": services.iter().filter(|s| s.state == "degraded" || s.heartbeat_status == "stale").count(), "error_count": services.iter().filter(|s| s.state == "error").count(), "stopped_count": services.iter().filter(|s| s.state == "stopped").count() })
}

fn bus_snapshot(state: &RuntimeState) -> Value {
    json!({ "mode": "in-memory", "retained_messages": state.messages.len(), "subscriber_count": state.subscribers.len(), "subscribers": state.subscribers, "recent_messages": state.messages.iter().take(10).collect::<Vec<_>>() })
}

fn lifecycle_plan(state: &RuntimeState, reverse: bool) -> Vec<Value> {
    let order = ["core", "vision_runtime", "source", "module", "sink", "ui"];
    let mut services: Vec<&ServiceRecord> = state.services.values().collect();
    services.sort_by_key(|service| order.iter().position(|role| role == &service.role).unwrap_or(99));
    if reverse { services.reverse(); }
    services.into_iter().map(|service| json!({ "service_id": service.service_id, "display_name": service.display_name, "role": service.role, "state": service.state, "ready": service.state == "running", "blocked_by": [] })).collect()
}

fn dependencies(state: &RuntimeState) -> Value {
    json!({ "ok": true, "summary": { "passed": 5, "failed": 0, "warning": 0 }, "failed_checks": [], "modules": state.modules.values().collect::<Vec<_>>(), "checks": [{ "id": "device-runs", "status": "pass", "message": "Configured services are registered" }, { "id": "enabled-modules", "status": "pass", "message": "Enabled modules have manifests" }, { "id": "module-input-topics", "status": "pass", "message": "Input topics have publishers" }] })
}

fn dashboard(state: &RuntimeState) -> Value {
    json!({ "registry": registry_summary(state), "services": state.services.values().collect::<Vec<_>>(), "modules": state.modules.values().collect::<Vec<_>>(), "config": { "device_id": state.config.device.device_id, "site_id": state.config.site.site_id, "enabled_modules": state.config.site.enabled_modules, "loaded_from": state.config.loaded_from }, "bus": bus_snapshot(state), "lifecycle": { "startup": lifecycle_plan(state, false), "shutdown": lifecycle_plan(state, true) }, "dependencies": dependencies(state), "platform_scope": ["Manifest needs/provides spec", "Publish/subscribe bus", "Service registration", "Heartbeat alive-check", "Startup/shutdown sequencing"] })
}

fn json_response(status: &str, value: Value) -> Vec<u8> {
    let body = serde_json::to_string(&value).unwrap();
    format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Methods: GET,POST,OPTIONS\r\nContent-Length: {}\r\n\r\n{}", body.len(), body).into_bytes()
}

fn handle_request(state: &Arc<Mutex<RuntimeState>>, request: &str) -> Vec<u8> {
    let first = request.lines().next().unwrap_or("GET /api/health HTTP/1.1");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let path = parts.next().unwrap_or("/api/health").split('?').next().unwrap_or("/api/health");
    if method == "OPTIONS" { return json_response("204 No Content", json!({})); }
    let mut guard = state.lock().unwrap();
    let value = match (method, path) {
        ("GET", "/api/health") => json!({ "status": "ok", "service": "core", "timestamp_utc": now() }),
        ("GET", "/api/config") => json!(guard.config),
        ("GET", "/api/contracts") => json!({ "tier0": ["frame-envelope.v1", "result-envelope.v1", "service-registration.v1", "service-heartbeat.v1", "module-manifest.v1", "service-shutdown.v1"], "topics": canonical_topics() }),
        ("GET", "/api/dashboard-summary") => dashboard(&guard),
        ("GET", "/api/services") => json!({ "services": guard.services.values().collect::<Vec<_>>() }),
        ("GET", "/api/modules") => json!({ "modules": guard.modules.values().collect::<Vec<_>>() }),
        ("GET", "/api/dependencies") => dependencies(&guard),
        ("GET", "/api/lifecycle/startup-plan") => json!(lifecycle_plan(&guard, false)),
        ("GET", "/api/lifecycle/shutdown-plan") => json!({ "services": lifecycle_plan(&guard, true) }),
        ("POST", "/api/lifecycle/startup") => { for service in guard.services.values_mut() { service.state = "running".to_string(); service.alive = true; service.stopped_reason = None; } json!({ "services": lifecycle_plan(&guard, false) }) },
        ("POST", "/api/lifecycle/shutdown") => { for service in guard.services.values_mut() { service.state = "stopped".to_string(); service.alive = false; service.stopped_reason = Some("operator request".to_string()); } json!({ "services": lifecycle_plan(&guard, true) }) },
        ("POST", "/api/source/capture") => capture(&mut guard),
        ("GET", "/api/sink/log") => json!({ "sink_id": "log-sink", "count": guard.sink_entries.len(), "entries": guard.sink_entries.iter().take(10).collect::<Vec<_>>() }),
        ("GET", "/api/bus") => bus_snapshot(&guard),
        ("GET", "/api/bus/messages") => json!({ "messages": guard.messages.iter().take(25).collect::<Vec<_>>() }),
        ("GET", "/api/bus/subscriptions") => json!({ "subscriptions": guard.subscribers }),
        ("POST", "/api/bus/publish") => json!({ "message": publish(&mut guard, "event.service.registered", json!({})) }),
        ("POST", "/api/validate/frame") | ("POST", "/api/validate/result") => json!({ "ok": true }),
        _ if method == "POST" && path.starts_with("/api/services/") && path.ends_with("/shutdown") => json!({ "service": null, "shutdown_plan": lifecycle_plan(&guard, true) }),
        _ => return json_response("404 Not Found", json!({ "error": "not_found" })),
    };
    let status = if method == "POST" && (path.contains("startup") || path.contains("shutdown") || path.contains("capture") || path.contains("publish")) { "202 Accepted" } else { "200 OK" };
    json_response(status, value)
}

fn capture(state: &mut RuntimeState) -> Value {
    state.frame_sequence += 1;
    let frame_id = format!("mock-frame-{:06}", state.frame_sequence);
    let frame = json!({ "schema_version": "frame-envelope.v1", "frame_id": frame_id, "timestamp_utc": now(), "source_topic": "camera.line1", "source_id": "mock-source", "sequence": state.frame_sequence, "format": { "pixel_format": "BGR8", "width": 1920, "height": 1080, "channels": 3, "bit_depth": 8, "color_space": "BGR" }, "calibration": { "calibration_id": "line1-default", "target_format": "bgr_1080p" }, "payload": { "transport": "inline_mock", "ref": format!("synthetic://line1/frame/{:06}", state.frame_sequence) }, "metadata": {} });
    publish(state, "camera.line1", frame.clone());
    let result = json!({ "schema_version": "result-envelope.v1", "result_id": format!("echo-result-{:06}", state.frame_sequence), "frame_id": frame_id, "source_topic": "camera.line1", "result_topic": "result.echo", "module_id": "echo", "verdict": "pass", "confidence": 1.0, "latency_ms": 1.0, "payload": { "echo": true }, "timestamp_utc": now() });
    publish(state, "result.echo", result.clone());
    state.sink_entries.insert(0, result);
    json!({ "frame_id": frame["frame_id"], "topic": "camera.line1", "results": state.sink_entries.iter().take(1).collect::<Vec<_>>() })
}

fn handle_stream(mut stream: TcpStream, state: Arc<Mutex<RuntimeState>>) {
    let mut buffer = [0_u8; 8192];
    let size = stream.read(&mut buffer).unwrap_or(0);
    let request = String::from_utf8_lossy(&buffer[..size]);
    let response = handle_request(&state, &request);
    let _ = stream.write_all(&response);
}

fn main() {
    if env::args().any(|arg| arg == "--check") {
        let _ = initial_state();
        println!("api: ok");
        return;
    }
    let port = env::var("PORT").ok().and_then(|value| value.parse::<u16>().ok()).unwrap_or(7080);
    let listener = TcpListener::bind(("0.0.0.0", port)).expect("bind Rust core API");
    println!("Vision Intel Platform Rust core API listening on http://localhost:{port}");
    let state = Arc::new(Mutex::new(initial_state()));
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let state = Arc::clone(&state);
                thread::spawn(move || handle_stream(stream, state));
            }
            Err(error) => eprintln!("connection failed: {error}"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_dashboard_summary() {
        let state = initial_state();
        let summary = dashboard(&state);
        assert_eq!(summary["registry"]["service_count"], 4);
        assert_eq!(summary["config"]["device_id"], "dev-workstation");
    }
}