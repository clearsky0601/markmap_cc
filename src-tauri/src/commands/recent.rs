use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

use crate::error::{CmdError, CmdResult};

const STORE_FILE: &str = "recent.json";
const KEY_RECENT: &str = "recent";
const MAX_RECENT: usize = 30;

#[derive(Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub opened_at_ms: u64,
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn load<R: Runtime>(app: &AppHandle<R>) -> CmdResult<Vec<RecentFile>> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| CmdError::Store(e.to_string()))?;
    let value = store.get(KEY_RECENT).unwrap_or_else(|| json!([]));
    let list: Vec<RecentFile> = serde_json::from_value(value).unwrap_or_default();
    Ok(list)
}

fn save<R: Runtime>(app: &AppHandle<R>, list: &[RecentFile]) -> CmdResult<()> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| CmdError::Store(e.to_string()))?;
    store.set(KEY_RECENT, json!(list));
    store.save().map_err(|e| CmdError::Store(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn list_recent(app: AppHandle) -> CmdResult<Vec<RecentFile>> {
    let mut list = load(&app)?;
    let before = list.len();
    list.retain(|r| std::path::Path::new(&r.path).exists());
    if list.len() != before {
        save(&app, &list)?;
    }
    Ok(list)
}

#[tauri::command]
pub async fn add_recent(app: AppHandle, path: String) -> CmdResult<Vec<RecentFile>> {
    let mut list = load(&app)?;
    list.retain(|r| r.path != path);
    list.insert(
        0,
        RecentFile {
            path,
            opened_at_ms: now_ms(),
        },
    );
    list.truncate(MAX_RECENT);
    save(&app, &list)?;
    Ok(list)
}

#[tauri::command]
pub async fn remove_recent(app: AppHandle, path: String) -> CmdResult<Vec<RecentFile>> {
    let mut list = load(&app)?;
    list.retain(|r| r.path != path);
    save(&app, &list)?;
    Ok(list)
}

