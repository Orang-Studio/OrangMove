//! TURN credential vending for the peer-to-peer path.
//!
//! STUN alone lets two browsers find each other through friendly NATs, but on
//! symmetric NAT / CGNAT (common on mobile and many ISPs) no direct path can be
//! punched and the WebRTC connection just fails. A TURN relay is the fallback:
//! both peers send their bytes through it.
//!
//! We run our own coturn (see deploy/DEPLOY.md) configured with `use-auth-secret`,
//! so this module hands out credentials in the TURN REST scheme: a short-lived
//! `username` of the expiry unix timestamp, and a `credential` of
//! `base64(HMAC-SHA1(shared-secret, username))`. coturn recomputes the same HMAC
//! to authenticate - no per-user state, and the secret never leaves the server.
//!
//! When `ORANG_TURN_SECRET` is unset the endpoint returns an empty list and the
//! client stays on STUN only, so this is safe to ship before coturn exists.

use axum::extract::State;
use axum::Json;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha1::Sha1;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

// Credentials are cheap to mint (a single HMAC) so we just issue a fresh, long
// enough window per request - a transfer may itself run for a while.
const CRED_TTL_SECS: u64 = 86_400;

#[derive(Clone)]
pub struct TurnConfig {
    inner: Arc<Inner>,
}

struct Inner {
    secret: Option<String>,
    host: String,
}

impl TurnConfig {
    /// Read the coturn shared secret and public host from the environment. No
    /// secret means TURN is disabled and clients fall back to STUN only.
    pub fn from_env() -> Self {
        let secret = std::env::var("ORANG_TURN_SECRET").ok().filter(|s| !s.is_empty());
        let host = std::env::var("ORANG_TURN_HOST")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "turn.oranges.lt".to_string());
        TurnConfig {
            inner: Arc::new(Inner { secret, host }),
        }
    }

    /// The `iceServers` object to hand the client: our coturn entry with fresh
    /// REST credentials when configured, otherwise an empty array (STUN-only).
    fn ice_servers(&self) -> Value {
        let Some(secret) = &self.inner.secret else {
            return json!([]);
        };
        let username = (now() + CRED_TTL_SECS).to_string();
        let credential = hmac_b64(secret.as_bytes(), username.as_bytes());
        let host = &self.inner.host;
        json!({
            // UDP first (best path), then TCP, then TLS on 443-friendly 5349 as
            // the most firewall-tolerant fallback.
            "urls": [
                format!("turn:{host}:3478?transport=udp"),
                format!("turn:{host}:3478?transport=tcp"),
                format!("turns:{host}:5349?transport=tcp"),
            ],
            "username": username,
            "credential": credential,
        })
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn hmac_b64(secret: &[u8], msg: &[u8]) -> String {
    let mut mac = Hmac::<Sha1>::new_from_slice(secret).expect("HMAC accepts any key length");
    mac.update(msg);
    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes())
}

/// GET /api/turn - always 200 with `{ "iceServers": <object|[]> }` so the client
/// can unconditionally merge the result with its built-in STUN servers.
pub async fn turn(State(cfg): State<TurnConfig>) -> Json<Value> {
    Json(json!({ "iceServers": cfg.ice_servers() }))
}

#[cfg(test)]
mod tests {
    use super::*;

    // No secret configured => never mint, hand back STUN-only. This is the safe
    // default that keeps the endpoint harmless before coturn is wired up.
    #[test]
    fn unconfigured_is_stun_only() {
        std::env::remove_var("ORANG_TURN_SECRET");
        let cfg = TurnConfig::from_env();
        assert_eq!(cfg.ice_servers(), json!([]));
    }

    // Credentials must follow the TURN REST scheme coturn validates against:
    // username is the expiry timestamp, credential is base64(HMAC-SHA1(secret, username)).
    #[test]
    fn configured_mints_rest_credentials() {
        let cfg = TurnConfig {
            inner: Arc::new(Inner {
                secret: Some("s3cret".into()),
                host: "turn.example".into(),
            }),
        };
        let ice = cfg.ice_servers();

        let username = ice["username"].as_str().unwrap();
        let expiry: u64 = username.parse().expect("username is a unix timestamp");
        assert!(expiry > now(), "expiry must be in the future");

        assert_eq!(ice["credential"], hmac_b64(b"s3cret", username.as_bytes()));
        assert!(ice["urls"][0].as_str().unwrap().contains("turn.example:3478"));
        assert!(ice["urls"][2].as_str().unwrap().starts_with("turns:"));
    }
}
