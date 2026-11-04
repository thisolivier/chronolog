//! Chronolog shell: the production site in one window. On macOS it is kept alive in the menu bar;
//! on iOS it is a plain full-screen WKWebView.
//!
//! - `window`: the main window (external production URL; desktop user-agent suffix; iOS link guard)
//! - `tray` (desktop): the menu-bar item, its menu, and the 1 s title ticker
//! - `timer` (desktop): the timer snapshot the page pushes, and the title formatting

#[cfg(desktop)]
mod timer;
#[cfg(desktop)]
mod tray;
mod window;

#[cfg(desktop)]
use tauri::{Manager, RunEvent, WindowEvent};

/// Called by the page (through `window.__TAURI__.core.invoke`) on every timer change and once
/// a minute. The only command the remote origin is granted (capabilities/remote-timer.json,
/// macOS only). Not registered on iOS, where there is no menu bar to show it.
#[cfg(desktop)]
#[tauri::command]
fn set_timer_state(
    app: tauri::AppHandle,
    running: bool,
    started_at: Option<i64>,
    contract_short_code: Option<String>,
) {
    let running_changed = app.state::<timer::TimerStore>().replace(timer::TimerSnapshot {
        running,
        started_at_milliseconds: started_at,
        contract_short_code,
    });
    if running_changed {
        eprintln!("[chronolog-desktop] timer running={running}");
        app.state::<tray::TimerMenuItems>().reflect_running(running);
    }
}

#[cfg(desktop)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(timer::TimerStore::default())
        .invoke_handler(tauri::generate_handler![set_timer_state])
        .setup(|app| {
            window::create_main_window(app.handle())?;
            tray::create_tray(app.handle())?;
            tray::start_title_ticker(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it; the menu bar item keeps the app (and timer) alive
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == window::MAIN_WINDOW_LABEL {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Chronolog");

    app.run(|app_handle, event| {
        // Clicking the Dock icon brings the hidden window back
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            window::show_main_window(app_handle);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
}

/// iOS: one full-screen webview on the production site. No commands, no tray. The opener plugin
/// lets the Rust side hand off-site links to Safari; no capability grants it to the page.
#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            window::create_main_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Chronolog");
}
