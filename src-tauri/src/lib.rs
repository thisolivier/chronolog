//! Chronolog desktop shell: the production site in one window, kept alive in the menu bar.
//!
//! - `window`: the main window (external production URL, desktop user-agent suffix)
//! - `tray`: the menu-bar item, its menu, and the 1 s title ticker
//! - `timer`: the timer snapshot the page pushes, and the title formatting

mod timer;
mod tray;
mod window;

use timer::{TimerSnapshot, TimerStore};
use tauri::{Manager, RunEvent, WindowEvent};

/// Called by the page (through `window.__TAURI__.core.invoke`) on every timer change and once
/// a minute. The only command the remote origin is granted (capabilities/remote-timer.json).
#[tauri::command]
fn set_timer_state(
    app: tauri::AppHandle,
    running: bool,
    started_at: Option<i64>,
    contract_short_code: Option<String>,
) {
    let running_changed = app.state::<TimerStore>().replace(TimerSnapshot {
        running,
        started_at_milliseconds: started_at,
        contract_short_code,
    });
    if running_changed {
        eprintln!("[chronolog-desktop] timer running={running}");
        app.state::<tray::TimerMenuItems>().reflect_running(running);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(TimerStore::default())
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
