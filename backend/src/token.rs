use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;

// 32 random bytes, base64url-encoded.
pub fn generate() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

// This kills path traversal at the door.
pub fn is_valid(token: &str) -> bool {
    token.len() == 43
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generated_tokens_are_valid_and_unique() {
        let a = generate();
        let b = generate();
        assert!(is_valid(&a));
        assert!(is_valid(&b));
        assert_ne!(a, b);
    }
    #[test]
    fn rejects_traversal_and_bad_chars() {
        assert!(!is_valid("../../etc/passwd"));
        assert!(!is_valid("short"));
        assert!(!is_valid(&"a".repeat(43).replacen('a', "/", 1)));
        assert!(!is_valid("with.dot.and.extension.aaaaaaaaaaaaaaaaaaaa"));
    }
}