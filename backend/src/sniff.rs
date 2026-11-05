//! content sniffing, used only to pick a content-type for the sandboxed preview
pub fn preview_media_type(head: &[u8], name: &str) -> &'static str {
    if head.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {return "image/png";}
    if head.starts_with(&[0xFF, 0xD8, 0xFF]) {return "image/jpeg";}
    if head.starts_with(b"GIF87a") || head.starts_with(b"GIF89a") {return "image/gif";}
    if head.starts_with(b"RIFF") && matches!(head.get(8..12), Some(&[b'W', b'E', b'B', b'P'])) {return "image/webp";}
    if head.starts_with(b"BM") {return "image/bmp";}
    if head.starts_with(b"%PDF-") {return "application/pdf";}
    if let Some(media) = av_media_type(head, name) {return media;}
    match name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("svg") => "image/svg+xml",
        Some("pdf") => "application/pdf",
        _ => "",
    }
}

/// audio and video, which a player will not touch without a real type on the
/// response: application/octet-stream under nosniff is exactly what left
/// every clip over 10 MB unplayable.
fn av_media_type(head: &[u8], name: &str) -> Option<&'static str> {
    let ext = name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .unwrap_or_default();
    if matches!(head.get(4..8), Some(b"ftyp")) {
        let brand = head.get(8..12).unwrap_or_default();
        return Some(match () {
            _ if brand.starts_with(b"qt") => "video/quicktime",
            _ if brand.starts_with(b"M4A") || ext == "m4a" || ext == "m4b" => "audio/mp4",
            _ if brand.starts_with(b"3g") => "video/3gpp",
            _ => "video/mp4",
        });
    }
    // Matroska/WebM share the EBML header
    if head.starts_with(&[0x1A, 0x45, 0xDF, 0xA3]) {
        return Some(if ext == "mkv" { "video/x-matroska" } else { "video/webm" });
    }
    if head.starts_with(b"OggS") {
        return Some(match ext.as_str() {
            "ogv" => "video/ogg",
            "opus" => "audio/opus",
            _ => "audio/ogg",
        });
    }
    if head.starts_with(b"fLaC") {return Some("audio/flac");}
    // MP3 with an ID3 tag, or a bare MPEG audio frame sync
    if head.starts_with(b"ID3")
        || matches!(head.get(0..2), Some(&[0xFF, b]) if b & 0xE0 == 0xE0 && ext == "mp3")
    {
        return Some("audio/mpeg");
    }
    if head.starts_with(b"RIFF") {
        return match head.get(8..12) {
            Some(b"WAVE") => Some("audio/wav"),
            Some(b"AVI ") => Some("video/x-msvideo"),
            _ => None,
        };
    }
    match ext.as_str() {
        "mp4" | "m4v" => Some("video/mp4"),
        "mov" => Some("video/quicktime"),
        "webm" => Some("video/webm"),
        "mkv" => Some("video/x-matroska"),
        "avi" => Some("video/x-msvideo"),
        "mp3" => Some("audio/mpeg"),
        "m4a" => Some("audio/mp4"),
        "wav" => Some("audio/wav"),
        "flac" => Some("audio/flac"),
        "aac" => Some("audio/aac"),
        "opus" => Some("audio/opus"),
        "oga" | "ogg" => Some("audio/ogg"),
        _ => None,
    }
}

// true when head looks like UTF-8 text
pub fn looks_textual(head: &[u8]) -> bool {
    if head.is_empty() || head.contains(&0) {return false;}
    match std::str::from_utf8(head) {
        Ok(_) => true,
        // error only at the very end means a truncated trailing char
        Err(e) => e.error_len().is_none(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // executables are accepted like anything else, and the preview has no type for them - so they come back as an opaque download rather than something browser will try to render.
    #[test]
    fn executables_have_no_previewable_type() {
        let mut pe = b"MZ\x90\x00".to_vec();
        pe.extend_from_slice(&[0u8; 8]);
        assert_eq!(preview_media_type(&pe, "setup.exe"), "");
        assert!(!looks_textual(&pe));

        assert_eq!(preview_media_type(&[0x7F, b'E', b'L', b'F', 1, 0, 0, 0], "prog"), "");
        assert_eq!(preview_media_type(b"#!/bin/sh\n", "run.sh"), "");
    }

    #[test]
    fn preview_types_from_magic() {
        assert_eq!(preview_media_type(&[0x89, 0x50, 0x4E, 0x47, 0x0d], "x"), "image/png");
        assert_eq!(preview_media_type(&[0xFF, 0xD8, 0xFF, 0xE0], "x"), "image/jpeg");
        assert_eq!(preview_media_type(b"GIF89a and more", "x"), "image/gif");
        assert_eq!(preview_media_type(b"%PDF-1.7", "x"), "application/pdf");
        assert_eq!(preview_media_type(b"RIFF\0\0\0\0WEBPVP8 ", "x"), "image/webp");
    }

    #[test]
    fn preview_types_from_extension() {
        assert_eq!(preview_media_type(b"<svg></svg>", "art.svg"), "image/svg+xml");
        assert_eq!(preview_media_type(b"plain text", "notes.txt"), "");
        assert_eq!(preview_media_type(&[0x01, 0x02, 0x03], "blob"), "");
    }

    #[test]
    fn preview_types_for_audio_and_video() {
        let mut mp4 = vec![0, 0, 0, 0x20];
        mp4.extend_from_slice(b"ftypisom");
        assert_eq!(preview_media_type(&mp4, "clip.mp4"), "video/mp4");
        let mut m4a = vec![0, 0, 0, 0x20];
        m4a.extend_from_slice(b"ftypM4A ");
        assert_eq!(preview_media_type(&m4a, "song.m4a"), "audio/mp4");
        assert_eq!(preview_media_type(&[0x1A, 0x45, 0xDF, 0xA3, 1], "clip.webm"), "video/webm");
        assert_eq!(preview_media_type(&[0x1A, 0x45, 0xDF, 0xA3, 1], "clip.mkv"), "video/x-matroska");
        assert_eq!(preview_media_type(b"ID3\x03\x00", "song.mp3"), "audio/mpeg");
        assert_eq!(preview_media_type(b"RIFF\0\0\0\0WAVEfmt ", "x"), "audio/wav");
        assert_eq!(preview_media_type(b"RIFF\0\0\0\0AVI LIST", "x"), "video/x-msvideo");
    }

    /// phone camera clip whose container this doesn't recognise still has to
    /// come back playable; only the type gets it in front of decoder
    #[test]
    fn unrecognised_bytes_still_honour_a_media_extension() {
        assert_eq!(preview_media_type(&[0x01, 0x02, 0x03, 0x04], "clip.mov"), "video/quicktime");
        assert_eq!(preview_media_type(&[0x01, 0x02, 0x03, 0x04], "take.mp4"), "video/mp4");
        assert_eq!(preview_media_type(&[0x01, 0x02, 0x03, 0x04], "blob"), "");
    }

    #[test]
    fn textual_detection() {
        assert!(looks_textual(b"hello, world\n{\"a\":1}"));
        assert!(!looks_textual(&[0x00, 0x01, 0x02]));
        assert!(!looks_textual(b""));
        // multi-byte char cut off by prefix is still text
        let cafe = "café".as_bytes();
        assert!(looks_textual(&cafe[..cafe.len() - 1]));
        // invalid byte is not text
        assert!(!looks_textual(&[b'a', 0xFF, b'b']));
    }
}