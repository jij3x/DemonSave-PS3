use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// A single file returned to the frontend, with base64-encoded contents.
#[derive(Serialize)]
struct FileEntry {
    name: String,
    /// Base64-encoded file contents (raw bytes → std base64).
    data: String,
}

/// Check whether a directory contains a file named `PARAM.SFO`
/// (case-insensitive). Used to validate that the user selected a real
/// PS3 save folder before accepting it.
fn dir_has_param_sfo(dir: &std::path::Path) -> bool {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_file() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.eq_ignore_ascii_case("PARAM.SFO") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// Pick a directory via a native OS dialog.
///
/// Loops until the selected directory contains `PARAM.SFO` or the user
/// cancels. If the folder is missing `PARAM.SFO`, the dialog re-opens
/// with a warning title so the user knows to pick a different folder.
///
/// Returns `Some((path, folder_name))` if a valid folder was selected,
/// or `None` if the dialog was cancelled.
#[tauri::command]
async fn pick_directory(app: tauri::AppHandle) -> Result<Option<(String, String)>, String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;

    let mut title = "Select PS3 save folder".to_string();

    loop {
        // rfd::pick_folder().await returns Option (None = cancelled), not Result
        let folder = rfd::AsyncFileDialog::new()
            .set_title(&title)
            .pick_folder()
            .await;

        // Keep the window focused after the dialog closes.
        let _ = window.set_focus();

        let dir = match folder {
            Some(d) => d,
            None => return Ok(None), // user cancelled
        };

        let path = dir.path();

        // Validate: the folder must contain PARAM.SFO
        if dir_has_param_sfo(path) {
            let p = path.to_string_lossy().to_string();
            let n = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            return Ok(Some((p, n)));
        }

        // Invalid folder — re-prompt with a warning so the user knows
        // why the dialog appeared again.
        title = "\u{26a0} No PARAM.SFO found. Select a valid PS3 save folder."
            .to_string();
    }
}

/// Read all files (non-recursive) in the given directory path.
///
/// Each file's contents is base64-encoded for safe JSON transport.
/// Returns a list of `{ name, data }` objects.
#[tauri::command]
fn read_dir_files(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let dir = PathBuf::from(&dir_path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {dir_path}"));
    }

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&dir).map_err(|e| format!("Cannot read dir: {e}"))?;
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Dir entry error: {e}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());

        let bytes = fs::read(&path).map_err(|e| format!("Cannot read file {name}: {e}"))?;
        let data = general_purpose::STANDARD.encode(&bytes);

        entries.push(FileEntry { name, data });
    }

    Ok(entries)
}

/// Write a single file (base64-encoded contents) to the given directory.
/// Creates the file if it doesn't exist; overwrites if it does.
#[tauri::command]
fn write_file(dir_path: String, file_name: String, data_b64: String) -> Result<(), String> {
    let bytes =
        general_purpose::STANDARD.decode(&data_b64).map_err(|e| format!("Base64 decode: {e}"))?;

    let dir = PathBuf::from(&dir_path);
    if !dir.is_dir() {
        return Err(format!("Directory does not exist: {dir_path}"));
    }

    let file_path = dir.join(&file_name);
    fs::write(&file_path, &bytes).map_err(|e| format!("Cannot write {file_name}: {e}"))?;

    Ok(())
}

/// Delete a file from the given directory. Silently succeeds if the file
/// doesn't exist (mirrors the JS-side NotFoundError tolerance).
#[tauri::command]
fn delete_file(dir_path: String, file_name: String) -> Result<(), String> {
    let file_path = PathBuf::from(&dir_path).join(&file_name);
    match fs::remove_file(&file_path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Cannot delete {file_name}: {e}")),
    }
}

/// Show a native "Save As" dialog for a single file (e.g. a ZIP export).
///
/// Returns `Some(path)` if the user confirms, or `None` if cancelled.
#[tauri::command]
async fn pick_save_path(
    app: tauri::AppHandle,
    suggested_name: String,
) -> Result<Option<String>, String> {
    let window = app.get_webview_window("main").ok_or("main window not found")?;

    // rfd::save_file().await returns Option (None = cancelled), not Result
    let result = rfd::AsyncFileDialog::new()
        .set_title("Save export as…")
        .set_file_name(&suggested_name)
        .add_filter("ZIP archive", &["zip"])
        .save_file()
        .await;

    let _ = window.set_focus();

    Ok(result.map(|f| f.path().to_string_lossy().to_string()))
}

/// Write raw bytes (base64-encoded) directly to an absolute file path
/// (returned by `pick_save_path`). Used for ZIP export to a user-chosen
/// location.
#[tauri::command]
fn write_bytes_to_path(path: String, data_b64: String) -> Result<(), String> {
    let bytes =
        general_purpose::STANDARD.decode(&data_b64).map_err(|e| format!("Base64 decode: {e}"))?;
    fs::write(&path, &bytes).map_err(|e| format!("Cannot write to {path}: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ── dir_has_param_sfo ──────────────────────────────────────────

    #[test]
    fn dir_has_param_sfo_exact_match() {
        let dir = tempdir().unwrap();
        fs::File::create(dir.path().join("PARAM.SFO")).unwrap();
        assert!(dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_lowercase() {
        let dir = tempdir().unwrap();
        fs::File::create(dir.path().join("param.sfo")).unwrap();
        assert!(dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_mixed_case() {
        let dir = tempdir().unwrap();
        fs::File::create(dir.path().join("Param.Sfo")).unwrap();
        assert!(dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_missing() {
        let dir = tempdir().unwrap();
        fs::File::create(dir.path().join("other.dat")).unwrap();
        assert!(!dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_empty_dir() {
        let dir = tempdir().unwrap();
        assert!(!dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_ignores_directory_named_param_sfo() {
        let dir = tempdir().unwrap();
        fs::create_dir(dir.path().join("PARAM.SFO")).unwrap();
        assert!(!dir_has_param_sfo(dir.path()));
    }

    #[test]
    fn dir_has_param_sfo_nonexistent_path() {
        assert!(!dir_has_param_sfo(std::path::Path::new(
            "/nonexistent/path/that/should/not/exist"
        )));
    }

    // ── read_dir_files ─────────────────────────────────────────────

    #[test]
    fn read_dir_files_returns_files() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), b"hello").unwrap();
        fs::write(dir.path().join("b.bin"), [0u8, 1, 2, 3]).unwrap();

        let result = read_dir_files(dir.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(result.len(), 2);

        let names: Vec<&str> = result.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"a.txt"));
        assert!(names.contains(&"b.bin"));

        // Verify base64 content
        let entry_a = result.iter().find(|e| e.name == "a.txt").unwrap();
        assert_eq!(
            general_purpose::STANDARD.decode(&entry_a.data).unwrap(),
            b"hello"
        );
    }

    #[test]
    fn read_dir_files_skips_subdirectories() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("file.dat"), b"data").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();

        let result = read_dir_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "file.dat");
    }

    #[test]
    fn read_dir_files_empty_dir() {
        let dir = tempdir().unwrap();
        let result = read_dir_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn read_dir_files_nonexistent_path() {
        let result = read_dir_files("/nonexistent/path/12345".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn read_dir_files_path_is_file_not_dir() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("not_a_dir.txt");
        fs::write(&file_path, b"x").unwrap();

        let result = read_dir_files(file_path.to_string_lossy().to_string());
        assert!(result.is_err());
    }

    // ── write_file ─────────────────────────────────────────────────

    #[test]
    fn write_file_creates_new_file() {
        let dir = tempdir().unwrap();
        let data_b64 = general_purpose::STANDARD.encode(b"file contents");

        write_file(
            dir.path().to_string_lossy().to_string(),
            "output.dat".to_string(),
            data_b64,
        )
        .unwrap();

        let written = fs::read(dir.path().join("output.dat")).unwrap();
        assert_eq!(written, b"file contents");
    }

    #[test]
    fn write_file_overwrites_existing() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("existing.txt"), b"old").unwrap();

        let data_b64 = general_purpose::STANDARD.encode(b"new");
        write_file(
            dir.path().to_string_lossy().to_string(),
            "existing.txt".to_string(),
            data_b64,
        )
        .unwrap();

        let written = fs::read(dir.path().join("existing.txt")).unwrap();
        assert_eq!(written, b"new");
    }

    #[test]
    fn write_file_invalid_base64() {
        let dir = tempdir().unwrap();
        let result = write_file(
            dir.path().to_string_lossy().to_string(),
            "bad.txt".to_string(),
            "!!!not base64!!!".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn write_file_nonexistent_directory() {
        let data_b64 = general_purpose::STANDARD.encode(b"data");
        let result = write_file(
            "/nonexistent/dir/path".to_string(),
            "file.txt".to_string(),
            data_b64,
        );
        assert!(result.is_err());
    }

    // ── delete_file ────────────────────────────────────────────────

    #[test]
    fn delete_file_removes_existing() {
        let dir = tempdir().unwrap();
        fs::write(dir.path().join("to_delete.txt"), b"bye").unwrap();
        assert!(dir.path().join("to_delete.txt").exists());

        delete_file(
            dir.path().to_string_lossy().to_string(),
            "to_delete.txt".to_string(),
        )
        .unwrap();

        assert!(!dir.path().join("to_delete.txt").exists());
    }

    #[test]
    fn delete_file_nonexistent_succeeds_silently() {
        let dir = tempdir().unwrap();
        // Should not error on missing file (mirrors JS NotFoundError tolerance)
        let result = delete_file(
            dir.path().to_string_lossy().to_string(),
            "ghost.txt".to_string(),
        );
        assert!(result.is_ok());
    }

    // ── write_bytes_to_path ────────────────────────────────────────

    #[test]
    fn write_bytes_to_path_absolute() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("direct_write.bin");
        let data_b64 = general_purpose::STANDARD.encode([10u8, 20, 30, 40]);

        write_bytes_to_path(file_path.to_string_lossy().to_string(), data_b64).unwrap();

        let written = fs::read(&file_path).unwrap();
        assert_eq!(written, vec![10u8, 20, 30, 40]);
    }

    #[test]
    fn write_bytes_to_path_overwrites() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("overwrite.bin");
        fs::write(&file_path, b"original").unwrap();

        let data_b64 = general_purpose::STANDARD.encode(b"replaced");
        write_bytes_to_path(file_path.to_string_lossy().to_string(), data_b64).unwrap();

        let written = fs::read(&file_path).unwrap();
        assert_eq!(written, b"replaced");
    }

    #[test]
    fn write_bytes_to_path_invalid_base64() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("bad.bin");

        let result = write_bytes_to_path(
            file_path.to_string_lossy().to_string(),
            "@@@invalid@@@".to_string(),
        );
        assert!(result.is_err());
    }

    #[test]
    fn write_bytes_to_path_nonexistent_parent_dir() {
        let result =
            write_bytes_to_path("/nonexistent/dir/file.bin".to_string(), "dGVzdA==".to_string());
        assert!(result.is_err());
    }

    // ── FileEntry serialization ────────────────────────────────────

    #[test]
    fn file_entry_serializes_correctly() {
        let entry = FileEntry {
            name: "test.sav".to_string(),
            data: general_purpose::STANDARD.encode(b"binary data"),
        };

        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"name\":\"test.sav\""));
        assert!(json.contains("\"data\":\""));
    }

    // ── End-to-end: write then read round-trip ─────────────────────

    #[test]
    fn write_then_read_round_trip() {
        let dir = tempdir().unwrap();
        let original_bytes = b"\x00\x01\x02\x03\xff\xfe\xad\xef";
        let data_b64 = general_purpose::STANDARD.encode(original_bytes);

        // Write a file via the IPC command
        write_file(
            dir.path().to_string_lossy().to_string(),
            "round_trip.bin".to_string(),
            data_b64,
        )
        .unwrap();

        // Read it back via the IPC command
        let entries = read_dir_files(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);

        let entry = &entries[0];
        assert_eq!(entry.name, "round_trip.bin");
        let decoded = general_purpose::STANDARD.decode(&entry.data).unwrap();
        assert_eq!(decoded, original_bytes);
    }
}

/// Tauri app entry point — registers all custom IPC commands.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            pick_directory,
            read_dir_files,
            write_file,
            delete_file,
            pick_save_path,
            write_bytes_to_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}