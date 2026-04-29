mod commands;
mod error;

use commands::ai as cmd_ai;
use commands::fs as cmd_fs;
use commands::recent as cmd_recent;
use commands::watcher as cmd_watcher;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! markmap_cc backend is alive.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(cmd_watcher::WatcherState(std::sync::Mutex::new(
            std::collections::HashMap::new(),
        )))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            cmd_fs::read_file,
            cmd_fs::write_file,
            cmd_fs::pick_file,
            cmd_fs::pick_folder,
            cmd_fs::pick_save_path,
            cmd_fs::list_dir,
            cmd_recent::list_recent,
            cmd_recent::add_recent,
            cmd_recent::remove_recent,
            cmd_watcher::start_watch,
            cmd_watcher::stop_watch,
            cmd_ai::ask_ai,
            cmd_fs::new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
