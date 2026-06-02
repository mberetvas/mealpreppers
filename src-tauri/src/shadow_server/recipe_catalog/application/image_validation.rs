//! Recipe image validation (aligned with `app/utils/recipeImageValidation.ts`).

pub const MAX_BYTES: usize = 5 * 1024 * 1024;

pub fn ext_for_mime(mime: &str) -> Option<&'static str> {
    match mime {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        _ => None,
    }
}

pub fn mime_for_ext(ext: &str) -> Option<&'static str> {
    match ext {
        "jpg" | "jpeg" => Some("image/jpeg"),
        "png" => Some("image/png"),
        "webp" => Some("image/webp"),
        "gif" => Some("image/gif"),
        _ => None,
    }
}

/// Validates MIME type and size before storing an image.
pub fn validate_upload(mime: &str, byte_length: usize) -> Result<(), &'static str> {
    if byte_length == 0 {
        return Err("Image file is empty.");
    }
    if byte_length > MAX_BYTES {
        return Err("Image must be at most 5MB.");
    }
    if ext_for_mime(mime).is_none() {
        return Err("Use a JPEG, PNG, WebP, or GIF image.");
    }
    Ok(())
}

/// Returns `true` for filenames that match `{uuid}.{ext}` (safe subset only).
pub fn is_safe_filename(filename: &str) -> bool {
    let Some((name, ext)) = filename.split_once('.') else {
        return false;
    };

    if mime_for_ext(&ext.to_lowercase()).is_none() {
        return false;
    }

    if name.len() != 36 {
        return false;
    }

    let bytes = name.as_bytes();
    let hyphen_positions = [8usize, 13, 18, 23];
    for (i, &b) in bytes.iter().enumerate() {
        if hyphen_positions.contains(&i) {
            if b != b'-' {
                return false;
            }
        } else if !b.is_ascii_hexdigit() {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_upload_matches_frontend_rules() {
        assert_eq!(
            validate_upload("image/png", 0),
            Err("Image file is empty.")
        );
        assert_eq!(
            validate_upload("image/png", MAX_BYTES + 1),
            Err("Image must be at most 5MB.")
        );
        assert_eq!(
            validate_upload("image/bmp", 100),
            Err("Use a JPEG, PNG, WebP, or GIF image.")
        );
        assert!(validate_upload("image/jpeg", 1024).is_ok());
    }

    #[test]
    fn is_safe_filename_rejects_traversal_and_malformed_names() {
        assert!(!is_safe_filename("../../../etc/passwd"));
        assert!(!is_safe_filename("not-a-uuid.png"));
        assert!(is_safe_filename(
            "a1b2c3d4-e5f6-7890-abcd-ef1234567890.png"
        ));
    }
}
