use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

#[derive(Debug)]
pub enum AppError {
    NotFound,
    BadRequest(&'static str),
    TooLarge,
    OutOfSpace,
    Internal,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, msg) = match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found".to_string()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.to_string()),
            AppError::TooLarge => {
                (StatusCode::PAYLOAD_TOO_LARGE, "file exceeds 1 GiB".to_string())
            }
            AppError::OutOfSpace => (
                StatusCode::INSUFFICIENT_STORAGE,
                "the server is full, try again later".to_string(),
            ),
            AppError::Internal => {
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error".to_string())
            }
        };
        (status, msg).into_response()
    }
}