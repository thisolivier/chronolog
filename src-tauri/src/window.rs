//! The one app window: the production site loaded as an external URL.

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const PRODUCTION_URL: &str = "https://chronolog.throb.online";

/// WKWebView's default user agent, with the desktop suffix appended (setting a custom user
/// agent replaces the default, so the default is restated here)
pub fn user_agent(app_version: &str) -> String {
    format!(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chronolog-Desktop/{app_version}"
    )
}

pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let production_url = PRODUCTION_URL.parse().expect("production URL is valid");
    let app_version = app.package_info().version.to_string();
    WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::External(production_url))
        .title("Chronolog")
        .inner_size(1200.0, 800.0)
        .min_inner_size(480.0, 480.0)
        .user_agent(&user_agent(&app_version))
        // One line per page load on stderr: run Contents/MacOS/chronolog from a terminal to see it
        .on_page_load(|_window, payload| {
            if let PageLoadEvent::Finished = payload.event() {
                eprintln!("[chronolog-desktop] loaded {}", payload.url());
            }
        })
        .on_document_title_changed(|window, title| {
            eprintln!("[chronolog-desktop] title {title:?}");
            let _ = window.set_title(&title);
        })
        .build()
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Show the window and run a snippet in the page (no IPC permission needed: Rust drives it)
pub fn show_main_window_and_run(app: &AppHandle, script: &str) {
    show_main_window(app);
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.eval(script);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_agent_ends_with_desktop_suffix() {
        assert!(user_agent("1.2.3").ends_with(" Chronolog-Desktop/1.2.3"));
    }
}
