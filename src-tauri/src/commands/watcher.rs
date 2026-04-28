use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::{CmdError, CmdResult};

pub struct WatcherState(pub Mutex<HashMap<String, RecommendedWatcher>>);

#[derive(Serialize, Clone)]
pub struct FileChangedPayload {
    pub path: String,
    pub mtime_ms: u64,
}

#[tauri::command]
pub fn start_watch(
    path: String,
    app: AppHandle,
    state: State<'_, WatcherState>,
) -> CmdResult<()> {
    let mut map = state.0.lock().unwrap();
    if map.contains_key(&path) {
        return Ok(());
    }

    let file_path = PathBuf::from(&path);
    let parent = file_path
        .parent()
        .ok_or_else(|| CmdError::InvalidPath(path.clone()))?
        .to_path_buf();

    let file_path_clone = file_path.clone();
    let path_clone = path.clone();
    let app_clone = app.clone();

    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };

            let affects_file = event.paths.iter().any(|p| p == &file_path_clone);
            if !affects_file {
                return;
            }

            match event.kind {
                EventKind::Modify(_) | EventKind::Create(_) => {
                    let mtime_ms = std::fs::metadata(&file_path_clone)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    let _ = app_clone.emit(
                        "file-changed",
                        FileChangedPayload {
                            path: path_clone.clone(),
                            mtime_ms,
                        },
                    );
                }
                _ => {}
            }
        })
        .map_err(|e| CmdError::Other(e.to_string()))?;

    watcher
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(|e| CmdError::Other(e.to_string()))?;

    map.insert(path, watcher);
    Ok(())
}

#[tauri::command]
pub fn stop_watch(path: String, state: State<'_, WatcherState>) -> CmdResult<()> {
    let mut map = state.0.lock().unwrap();
    map.remove(&path);
    Ok(())
}
