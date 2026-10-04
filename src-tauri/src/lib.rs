mod directories;
mod media;
mod thumbnail_service;
#[cfg(target_os = "macos")]
mod window_chrome;

use directories::{read_directory, sample_images, DirectoryEntry, PreviewEntry};
use media::BrowserState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
struct RootDirectory {
    session: u64,
    path: String,
    entries: Vec<DirectoryEntry>,
}

#[tauri::command]
async fn choose_directory(app: AppHandle) -> Result<Option<RootDirectory>, String> {
    let state = app.state::<BrowserState>();
    if state.choosing.swap(true, Ordering::SeqCst) {
        return Err("文件夹选择器已打开".into());
    }
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let Some(selected) = handle.dialog().file().blocking_pick_folder() else {
            return Ok(None);
        };
        let path = selected
            .into_path()
            .map_err(|error| error.to_string())?
            .canonicalize()
            .map_err(|error| error.to_string())?;
        let entries = read_directory(&path)?;
        let state = handle.state::<BrowserState>();
        let session = state.commit_root(path.clone())?;
        Ok(Some(RootDirectory {
            session,
            path: path.to_string_lossy().into_owned(),
            entries,
        }))
    })
    .await
    .map_err(|error| error.to_string());
    state.choosing.store(false, Ordering::SeqCst);
    result?
}

#[tauri::command]
async fn list_directory(
    path: String,
    session: u64,
    state: State<'_, BrowserState>,
) -> Result<Vec<DirectoryEntry>, String> {
    let root = state.root(session)?;
    tauri::async_runtime::spawn_blocking(move || read_directory(&media::authorize(&root, &path)?))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn sample_directory_images(
    path: String,
    session: u64,
    state: State<'_, BrowserState>,
) -> Result<Vec<PreviewEntry>, String> {
    let root = state.root(session)?;
    tauri::async_runtime::spawn_blocking(move || sample_images(&media::authorize(&root, &path)?))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::align_buttons(&window.as_ref().window())?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if matches!(
                event,
                tauri::WindowEvent::Resized(_)
                    | tauri::WindowEvent::ScaleFactorChanged { .. }
                    | tauri::WindowEvent::Focused(_)
            ) {
                if let Err(error) = window_chrome::align_buttons(window) {
                    eprintln!("Unable to align window controls: {error}");
                }
            }
        })
        .manage(BrowserState::default())
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("media", |context, request, responder| {
            let app = context.app_handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app.state::<BrowserState>();
                let thumbnail = request
                    .uri()
                    .query()
                    .unwrap_or("")
                    .split('&')
                    .any(|part| part == "thumbnail=1");
                let permits = if thumbnail {
                    state.thumbnail_requests.clone()
                } else {
                    state.original_requests.clone()
                };
                let Ok(_permit) = permits.acquire_owned().await else {
                    return;
                };
                let result =
                    tauri::async_runtime::spawn_blocking(move || media::serve(&app, request)).await;
                responder.respond(result.unwrap_or_else(|_| media::error_response()));
            });
        })
        .invoke_handler(tauri::generate_handler![
            choose_directory,
            list_directory,
            sample_directory_images
        ])
        .run(tauri::generate_context!())
        .expect("error while running PopView");
}
