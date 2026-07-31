use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::sync::OnceLock;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ContractError {
    #[error("invalid topic: {0}")]
    InvalidTopic(String),
    #[error("invalid topic pattern: {0}")]
    InvalidTopicPattern(String),
    #[error("invalid timestamp: {0}")]
    InvalidTimestamp(String),
}

pub const TOPIC_FAMILIES: [&str; 5] = ["camera", "result", "control", "event", "health"];

fn topic_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(camera|result|control|event|health)\.[a-z0-9][a-z0-9_.-]*$").unwrap())
}

fn prefix_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"^(camera|result|control|event|health)(\.[a-z0-9][a-z0-9_.-]*)?$").unwrap())
}

pub fn is_topic(topic: &str) -> bool {
    topic_re().is_match(topic)
}

pub fn assert_topic(topic: &str) -> Result<&str, ContractError> {
    if is_topic(topic) {
        Ok(topic)
    } else {
        Err(ContractError::InvalidTopic(topic.to_string()))
    }
}

pub fn is_topic_pattern(pattern: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix(".*") {
        prefix_re().is_match(prefix)
    } else {
        is_topic(pattern)
    }
}

pub fn assert_topic_pattern(pattern: &str) -> Result<&str, ContractError> {
    if is_topic_pattern(pattern) {
        Ok(pattern)
    } else {
        Err(ContractError::InvalidTopicPattern(pattern.to_string()))
    }
}

pub fn topic_family(topic: &str) -> Result<&str, ContractError> {
    Ok(assert_topic(topic)?.split('.').next().unwrap_or(topic))
}

pub fn topic_matches(pattern: &str, topic: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix(".*") {
        topic == prefix || topic.starts_with(&format!("{}.", prefix))
    } else {
        pattern == topic
    }
}

pub fn canonical_topics() -> BTreeMap<&'static str, &'static str> {
    BTreeMap::from([
        ("cameraLine1", "camera.line1"),
        ("resultAiSupervisor", "result.ai-supervisor"),
        ("resultImageInspection", "result.image-inspection"),
        ("resultOcr", "result.ocr"),
        ("eventServiceRegistered", "event.service.registered"),
        ("eventServiceUnhealthy", "event.service.unhealthy"),
        ("controlShutdown", "control.shutdown"),
        ("healthHeartbeat", "health.heartbeat"),
    ])
}

fn validate_timestamp(value: &str) -> Result<(), ContractError> {
    let has_date_time = value.contains('T');
    let has_zone = value.ends_with('Z') || value.rfind('+').map_or(false, |index| index > 10);
    if has_date_time && has_zone { Ok(()) } else { Err(ContractError::InvalidTimestamp(value.to_string())) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceRegistration {
    pub schema_version: String,
    pub service_id: String,
    pub display_name: String,
    pub role: String,
    pub version: String,
    pub host_id: String,
    pub process_id: Option<u32>,
    #[serde(default)]
    pub subscribes: Vec<String>,
    #[serde(default)]
    pub publishes: Vec<String>,
    #[serde(default = "default_health_topic")]
    pub health_topic: String,
    pub started_at_utc: String,
    #[serde(default)]
    pub metadata: BTreeMap<String, Value>,
}

fn default_health_topic() -> String {
    "health.heartbeat".to_string()
}

impl ServiceRegistration {
    pub fn validate(&self) -> Result<(), ContractError> {
        validate_timestamp(&self.started_at_utc)?;
        assert_topic(&self.health_topic)?;
        for topic in &self.publishes {
            assert_topic(topic)?;
        }
        for pattern in &self.subscribes {
            assert_topic_pattern(pattern)?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHeartbeat {
    pub schema_version: String,
    pub service_id: String,
    pub state: String,
    pub timestamp_utc: String,
    pub uptime_ms: u64,
    pub message: Option<String>,
    #[serde(default)]
    pub metrics: BTreeMap<String, f64>,
}

impl ServiceHeartbeat {
    pub fn validate(&self) -> Result<(), ContractError> {
        validate_timestamp(&self.timestamp_utc)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShutdownCommand {
    pub schema_version: String,
    pub service_id: String,
    pub reason: String,
    pub requested_by: String,
    pub timestamp_utc: String,
}

impl ShutdownCommand {
    pub fn validate(&self) -> Result<(), ContractError> {
        validate_timestamp(&self.timestamp_utc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn topics_match_shared_rules() {
        assert!(is_topic("camera.line1"));
        assert!(!is_topic("Camera.line1"));
        assert!(is_topic_pattern("result.*"));
        assert!(topic_matches("result.*", "result.echo"));
        assert!(!topic_matches("result.*", "camera.line1"));
    }
}
