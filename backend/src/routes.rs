use crate::error::AppError;
use crate::store::{sanitize_name, Store};
use crate::{sniff, token, MAX_SIZE, MAX_TTL, MIN_TTL};
use axum::body::Body;
use axum::extract::{Multipart, Path, Request, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use std::path::PathBuf;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tower::util::ServiceExt;
use tower_http::services::ServeFile;
pub async fn upload( State(store): State<Store>, mut mp: Multipart,) -> Result<impl IntoResponse, AppError> { if store.live_total().await.map_err(|_| AppError::Internal)? >= store.max_total { return Err(AppError::OutOfSpace);}
    let mut ttl: i64 = 0;
    let mut original_name = String::from("file");
    let mut got_file = false;
    let token = token::generate();
    let path = store.path_for(&token);
    let mut size: u64 = 0;
    while let Some(mut field) = mp
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("bad multipart"))?
    {
        match field.name() {
            Some("ttl") => {
                let raw = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("bad ttl"))?;
                ttl = raw
                    .trim()
                    .parse()
                    .map_err(|_| AppError::BadRequest("ttl not a number"))?;
            }
            Some("file") => {
                original_name = field.file_name().unwrap_or("file").to_string();

                let mut out = tokio::fs::File::create(&path)
                    .await
                    .map_err(|_| AppError::Internal)?;

                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|_| AppError::BadRequest("read error"))?
                {
                    size += chunk.len() as u64;
                    if size > MAX_SIZE {
                        discard(out, &path).await;
                        return Err(AppError::TooLarge);
                    }
                    out.write_all(&chunk).await.map_err(|_| AppError::Internal)?;
                }

                out.flush().await.map_err(|_| AppError::Internal)?;
                got_file = true;
            }
            _ => {}
        }
    }

    if !got_file || size == 0 {let _ = tokio::fs::remove_file(&path).await;return Err(AppError::BadRequest("no file provided"));}
    if !(MIN_TTL..=MAX_TTL).contains(&ttl) { let _ = tokio::fs::remove_file(&path).await; return Err(AppError::BadRequest("ttl must be 30..3600 seconds"));}

    let name = sanitize_name(&original_name);
    store
        .insert(&token, &name, "application/octet-stream", size as i64, ttl)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok((StatusCode::CREATED, Json(json!({ "token": token }))))
}

async fn discard(file: tokio::fs::File, path: &std::path::Path) { drop(file); let _ = tokio::fs::remove_file(path).await;}

pub async fn meta(State(store): State<Store>,Path(token): Path<String>,) -> Result<impl IntoResponse, AppError> { if !token::is_valid(&token) { return Err(AppError::NotFound); }
    store
        .get_live(&token)
        .await
        .map_err(|_| AppError::Internal)?
        .map(Json)
        .ok_or(AppError::NotFound)
}

/// how much of file is enough to recognise it by its magic bytes
const SNIFF_BYTES: usize = 8192;

async fn locate(store: &Store, token: &str) -> Result<(crate::store::Meta, PathBuf), AppError> {
    if !token::is_valid(token) {
        return Err(AppError::NotFound);
    }
    let meta = store
        .get_live(token)
        .await
        .map_err(|_| AppError::Internal)?
        .ok_or(AppError::NotFound)?;
    let path = store.path_for(token);
    if !tokio::fs::try_exists(&path).await.unwrap_or(false) {
        return Err(AppError::NotFound);
    }
    Ok((meta, path))
}

/// just enough of the file to sniff, without reading the rest of it
async fn head_of(path: &PathBuf) -> Result<Vec<u8>, AppError> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| AppError::NotFound)?;
    let mut head = vec![0u8; SNIFF_BYTES];
    let mut filled = 0;
    while filled < head.len() {
        let read = file
            .read(&mut head[filled..])
            .await
            .map_err(|_| AppError::Internal)?;
        if read == 0 {
            break;
        }
        filled += read;
    }
    head.truncate(filled);
    Ok(head)
}

/// hands file to ServeFile, which streams it off disk and answers Range requests.
async fn stream_file(path: PathBuf, content_type: &str, req: Request) -> Result<Response, AppError> {
    let mime: mime::Mime = content_type.parse().map_err(|_| AppError::Internal)?;
    ServeFile::new_with_mime(path, &mime)
        .oneshot(req)
        .await
        .map(|response| response.map(Body::new))
        .map_err(|_| AppError::Internal)
}

pub async fn download(
    State(store): State<Store>,
    Path(token): Path<String>,
    req: Request,
) -> Result<Response, AppError> {
    let (meta, path) = locate(&store, &token).await?;
    if already_has_it(&req, &token) {
        return Ok(not_modified(&token, &meta));
    }
    let mut response = stream_file(path, "application/octet-stream", req).await?;
    let headers = response.headers_mut();
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, nosniff());
    if let Ok(v) = HeaderValue::from_str(&format!("attachment; filename=\"{}\"", meta.name)) {headers.insert(header::CONTENT_DISPOSITION, v);}
    cache_headers(&mut response, &token, &meta);
    Ok(response)
}

pub async fn view(State(store): State<Store>,Path(token): Path<String>,req: Request,) -> Result<Response, AppError> {let (meta, path) = locate(&store, &token).await?; if already_has_it(&req, &token) { return Ok(not_modified(&token, &meta)); }
    let head = head_of(&path).await?;
    let media = sniff::preview_media_type(&head, &meta.name);
    let content_type = if !media.is_empty() {media} else if sniff::looks_textual(&head) {"text/plain; charset=utf-8"} else {"application/octet-stream"};
    let mut response = stream_file(path, content_type, req).await?;
    let headers = response.headers_mut();
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, nosniff());
    headers.insert(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static("default-src 'none'; sandbox"),);
    headers.insert(header::CONTENT_DISPOSITION, HeaderValue::from_static("inline"));
    cache_headers(&mut response, &token, &meta);
    Ok(response)
}

/// An empty 304 that still carries the caching headers
fn not_modified(token: &str, meta: &crate::store::Meta) -> Response {
    let mut response = StatusCode::NOT_MODIFIED.into_response();
    cache_headers(&mut response, token, meta);
    response
}

fn nosniff() -> HeaderValue {
    HeaderValue::from_static("nosniff")
}
fn already_has_it(req: &Request, token: &str) -> bool {
    if req.headers().contains_key(header::RANGE) {return false;}
    let etag = format!("\"{token}\"");
    req.headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|raw| {
            raw.split(',').any(|candidate| {
                let candidate = candidate.trim();
                candidate == "*" || candidate.trim_start_matches("W/") == etag
            })
        })
}

/// caching headers for a stored file
fn cache_headers(response: &mut Response, token: &str, meta: &crate::store::Meta) {
    let remaining = meta
        .expires_at
        .saturating_sub(crate::store::now_secs())
        .max(0);
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&format!("private, max-age={remaining}, immutable")) { headers.insert(header::CACHE_CONTROL, value);}
    if let Ok(value) = HeaderValue::from_str(&format!("\"{token}\"")) {headers.insert(header::ETAG, value);}
}