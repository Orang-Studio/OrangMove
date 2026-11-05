pub mod error;
pub mod routes;
pub mod signal;
pub mod sniff;
pub mod turn;
pub mod store;
pub mod token;
pub const MAX_SIZE: u64 = 1024 * 1024 * 1024; // 1 GiB
pub const MIN_TTL: i64 = 30;
pub const MAX_TTL: i64 = 3600;
use axum::extract::DefaultBodyLimit;
use axum::http::{HeaderValue, Method};
use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;
use std::time::Duration;
use store::Store;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::key_extractor::SmartIpKeyExtractor;
use tower_governor::GovernorLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
// The SPA may live on a different subdomain than this API
fn cors() -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);
    match std::env::var("APP_ORIGIN") {
        Ok(origin) if !origin.is_empty() => {
            match origin.parse::<HeaderValue>() {
                Ok(v) => layer.allow_origin(v),
                Err(_) => layer.allow_origin(Any),
            }
        }
        _ => layer.allow_origin(Any),
    }
}
pub fn build_app(store: Store) -> Router {
    let api = Router::new()
        .route("/upload", post(routes::upload))
        .route("/meta/:token", get(routes::meta))
        .route("/file/:token", get(routes::download))
        .route("/view/:token", get(routes::view))
        .layer(DefaultBodyLimit::max(MAX_SIZE as usize + 1024))
        .with_state(store);
    // WebRTC signaling relay for the peer-to-peer transfer path.
    let signal = Router::new()
        .route("/signal/:room", get(signal::signal))
        .with_state(signal::Signaling::default());
    let turn = Router::new()
        .route("/turn", get(turn::turn))
        .with_state(turn::TurnConfig::from_env());
    let api = api.merge(signal).merge(turn).layer(cors());

    Router::new().nest("/api", api).fallback_service(
        ServeDir::new("frontend/dist").append_index_html_on_directories(true),
    )
}

// Wrap an app in a per IP rate limiter: burst requests up front, refilling one
// every per_second seconds. The real client IP is taken from X-Forwarded-For /
// X-Real-IP and falls back to the socket address, so the
// served app must use into_make_service_with_connect_info::<SocketAddr>().
pub fn rate_limited(app: Router, per_second: u64, burst: u32) -> Router {
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(per_second)
            .burst_size(burst)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("governor config"),
    );
    let gc = config.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(60)).await;
            gc.limiter().retain_recent();
        }
    });
    app.layer(GovernorLayer { config })
}