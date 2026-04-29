use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

use crate::error::{CmdError, CmdResult};

#[derive(Serialize, Clone)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub mtime_ms: u64,
}

#[derive(Serialize, Clone)]
pub struct WriteResult {
    pub path: String,
    pub mtime_ms: u64,
}

#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum TreeEntry {
    Folder { name: String, path: String },
    File { name: String, path: String },
}

fn mtime_ms(path: &Path) -> CmdResult<u64> {
    let meta = std::fs::metadata(path)?;
    let dur = meta
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| CmdError::Other(e.to_string()))?;
    Ok(dur.as_millis() as u64)
}

#[tauri::command]
pub async fn read_file(path: String) -> CmdResult<FileContent> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(CmdError::InvalidPath(path));
    }
    let content = std::fs::read_to_string(&p)?;
    let mtime_ms = mtime_ms(&p)?;
    Ok(FileContent {
        path,
        content,
        mtime_ms,
    })
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> CmdResult<WriteResult> {
    let p = PathBuf::from(&path);
    let parent = p.parent().ok_or_else(|| CmdError::InvalidPath(path.clone()))?;
    if !parent.exists() {
        std::fs::create_dir_all(parent)?;
    }
    let file_name = p
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| CmdError::InvalidPath(path.clone()))?;
    let tmp_name = format!(".{}.tmp.{}", file_name, std::process::id());
    let tmp_path = parent.join(tmp_name);
    std::fs::write(&tmp_path, content.as_bytes())?;
    std::fs::rename(&tmp_path, &p)?;
    let mtime_ms = mtime_ms(&p)?;
    Ok(WriteResult { path, mtime_ms })
}

#[tauri::command]
pub async fn pick_file(app: AppHandle) -> CmdResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });
    let chosen = rx.recv().map_err(|e| CmdError::Other(e.to_string()))?;
    Ok(chosen.and_then(|p| p.into_path().ok().and_then(|pb| pb.to_str().map(String::from))))
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> CmdResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });
    let chosen = rx.recv().map_err(|e| CmdError::Other(e.to_string()))?;
    Ok(chosen.and_then(|p| p.into_path().ok().and_then(|pb| pb.to_str().map(String::from))))
}

#[tauri::command]
pub async fn pick_save_path(app: AppHandle, suggested_name: Option<String>) -> CmdResult<Option<String>> {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut builder = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"]);
    if let Some(name) = suggested_name {
        builder = builder.set_file_name(&name);
    }
    builder.save_file(move |path| {
        let _ = tx.send(path);
    });
    let chosen = rx.recv().map_err(|e| CmdError::Other(e.to_string()))?;
    Ok(chosen.and_then(|p| p.into_path().ok().and_then(|pb| pb.to_str().map(String::from))))
}

#[tauri::command]
pub async fn list_dir(path: String) -> CmdResult<Vec<TreeEntry>> {
    let p = PathBuf::from(&path);
    if !p.is_dir() {
        return Err(CmdError::InvalidPath(path));
    }
    let mut entries = Vec::new();
    for dirent in std::fs::read_dir(&p)? {
        let dirent = dirent?;
        let name = match dirent.file_name().to_str() {
            Some(n) if !n.starts_with('.') => n.to_string(),
            _ => continue,
        };
        let entry_path = dirent.path();
        let path_str = match entry_path.to_str() {
            Some(s) => s.to_string(),
            None => continue,
        };
        let ft = dirent.file_type()?;
        if ft.is_dir() {
            entries.push(TreeEntry::Folder {
                name,
                path: path_str,
            });
        } else if ft.is_file() {
            let is_md = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| matches!(e.to_ascii_lowercase().as_str(), "md" | "markdown"))
                .unwrap_or(false);
            if is_md {
                entries.push(TreeEntry::File {
                    name,
                    path: path_str,
                });
            }
        }
    }
    entries.sort_by(|a, b| match (a, b) {
        (TreeEntry::Folder { name: an, .. }, TreeEntry::Folder { name: bn, .. }) => an.cmp(bn),
        (TreeEntry::File { name: an, .. }, TreeEntry::File { name: bn, .. }) => an.cmp(bn),
        (TreeEntry::Folder { .. }, TreeEntry::File { .. }) => std::cmp::Ordering::Less,
        (TreeEntry::File { .. }, TreeEntry::Folder { .. }) => std::cmp::Ordering::Greater,
    });
    Ok(entries)
}

#[tauri::command]
pub async fn new_window(app: AppHandle) -> CmdResult<()> {
    let ts = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let label = format!("w{ts}");
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App("/".into()))
        .title("markmap_cc")
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|e| CmdError::Other(e.to_string()))?;
    Ok(())
}
