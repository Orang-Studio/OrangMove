use orangmove::{build_app, rate_limited, store::Store};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::Duration;
#[tokio::main]
async fn main() {
    let dir = PathBuf::from(env("ORANG_STORAGE", "storage"));
    let db = env("ORANG_DB", "sqlite:orangmove.db?mode=rwc");
    let addr: SocketAddr = env("ORANG_BIND", "0.0.0.0:8080").parse().expect("ORANG_BIND");
    let store = Store::new(dir, &db).await.expect("store init");
    let reaper = store.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = reaper.reap().await { eprintln!("reaper: {e}"); }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });

    let app = rate_limited(build_app(store), 1, 60);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("orangmove on {addr}");
    axum::serve( listener, app.into_make_service_with_connect_info::<SocketAddr>(),)
    .await
    .unwrap();
}
fn env(key: &str, default: &str) -> String { std::env::var(key).unwrap_or_else(|_| default.to_string()) }