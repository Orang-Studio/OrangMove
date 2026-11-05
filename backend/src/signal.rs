//! WebRTC signaling relay for peer-to-peer transfers
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, State};
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
const MAX_PEERS: usize = 2;

#[derive(Clone, Default)]
pub struct Signaling {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
}

#[derive(Default)]
struct Room {
    peers: HashMap<u64, mpsc::UnboundedSender<Message>>,
}

static PEER_SEQ: AtomicU64 = AtomicU64::new(0);

/// room ids are generated client-side
fn valid_room(id: &str) -> bool {
    (8..=64).contains(&id.len())
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub async fn signal(ws: WebSocketUpgrade,Path(room): Path<String>,State(sig): State<Signaling>,) -> impl IntoResponse {ws.on_upgrade(move |socket| handle(socket, room, sig))}

async fn handle(socket: WebSocket, room: String, sig: Signaling) {
    if !valid_room(&room) {
        let mut s = socket;
        let _ = s.send(Message::Close(None)).await;
        return;
    }

    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let peer_id = PEER_SEQ.fetch_add(1, Ordering::Relaxed);
    {
        let mut rooms = sig.rooms.lock().await;
        let entry = rooms.entry(room.clone()).or_default();
        if entry.peers.len() >= MAX_PEERS {drop(rooms); let _ = ws_tx.send(Message::Close(None)).await; return;}
        entry.peers.insert(peer_id, tx);
    }

    // pump relayed messages out to this peer's socket
    let pump = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(msg).await.is_err() {break;}
        }
    });

    // forward everything this peer says to the other peer in the room
    while let Some(Ok(msg)) = ws_rx.next().await {
        match msg {
            Message::Text(_) | Message::Binary(_) => {
                let rooms = sig.rooms.lock().await;
                if let Some(r) = rooms.get(&room) {
                    for (id, peer) in &r.peers {
                        if *id != peer_id {
                            let _ = peer.send(msg.clone());
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    // this peer left, drop, say
    let mut rooms = sig.rooms.lock().await;
    if let Some(r) = rooms.get_mut(&room) {
        r.peers.remove(&peer_id);
        for peer in r.peers.values() {
            let _ = peer.send(Message::Close(None));
        }
        if r.peers.is_empty() {
            rooms.remove(&room);
        }
    }
    drop(rooms);
    pump.abort();
}

#[cfg(test)]
mod tests {
    use super::valid_room;

    #[test]
    fn room_ids_are_validated() {
        assert!(valid_room("abc123XYZ_-def"));
        assert!(!valid_room("short")); // < 8
        assert!(!valid_room("has space inside it")); // bad char
        assert!(!valid_room(&"x".repeat(65))); // too long
        assert!(!valid_room("../../etc/passwd")); // path
    }
}
