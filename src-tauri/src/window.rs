//! The one app window: the production site loaded as an external URL.
//!
//! Desktop: a sized, titled window with a `Chronolog-Desktop/<version>` user-agent suffix.
//! iOS: a full-screen webview with WKWebView's own user agent; navigations that leave the
//! production origin open in Safari instead (there is no back button to come home with).

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const PRODUCTION_URL: &str = "https://chronolog.throb.online";

/// The site the shell loads: production, except in a debug build launched with
/// `CHRONOLOG_SHELL_URL` in its environment (e.g. `http://localhost:5248`, to try the shell against
/// a local dev server; in the iOS simulator pass `SIMCTL_CHILD_CHRONOLOG_SHELL_URL=…` to
/// `xcrun simctl launch`). Read at run time because `tauri ios build` runs xcodebuild, and so
/// cargo, with a cleaned environment. Release builds ignore the variable.
pub fn app_url() -> Url {
    #[cfg(debug_assertions)]
    if let Ok(override_url) = std::env::var("CHRONOLOG_SHELL_URL") {
        if let Ok(parsed) = Url::parse(&override_url) {
            return parsed;
        }
    }
    Url::parse(PRODUCTION_URL).expect("production URL is valid")
}

/// WKWebView's default macOS user agent, with the desktop suffix appended (setting a custom user
/// agent replaces the default, so the default is restated here)
#[cfg(desktop)]
pub fn user_agent(app_version: &str) -> String {
    format!(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Chronolog-Desktop/{app_version}"
    )
}

/// Whether the shell keeps a navigation in the webview: the app's origin (`app_url()`), and the
/// non-network schemes the page uses itself (`about:blank` print frames, `blob:` attachments).
/// Anything else (an `https://` link in a note, a `mailto:`) leaves the app. Used on iOS only;
/// the desktop window keeps its 035 behaviour (unit tested on the desktop target).
#[cfg_attr(desktop, allow(dead_code))]
pub fn stays_in_app(target: &Url) -> bool {
    match target.scheme() {
        "about" | "blob" | "data" => true,
        _ => target.origin() == app_url().origin(),
    }
}

fn log_page_loads(
    builder: WebviewWindowBuilder<'_, tauri::Wry, AppHandle>,
) -> WebviewWindowBuilder<'_, tauri::Wry, AppHandle> {
    // One line per page load on stderr (desktop: run Contents/MacOS/chronolog from a terminal;
    // iOS simulator: `xcrun simctl launch --console`)
    builder.on_page_load(|_window, payload| {
        if let PageLoadEvent::Finished = payload.event() {
            eprintln!("[chronolog-shell] loaded {}", payload.url());
        }
    })
}

#[cfg(desktop)]
pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let app_version = app.package_info().version.to_string();
    let builder = WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::External(app_url()))
        .title("Chronolog")
        .inner_size(1200.0, 800.0)
        .min_inner_size(480.0, 480.0)
        .user_agent(&user_agent(&app_version))
        .on_document_title_changed(|window, title| {
            eprintln!("[chronolog-desktop] title {title:?}");
            let _ = window.set_title(&title);
        });
    log_page_loads(builder).build()
}

#[cfg(mobile)]
pub fn create_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    use tauri_plugin_opener::OpenerExt;
    let app_for_links = app.clone();
    let builder = WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::External(app_url()))
        .on_navigation(move |target| {
            if stays_in_app(target) {
                return true;
            }
            eprintln!("[chronolog-shell] opening outside the app: {target}");
            let _ = app_for_links.opener().open_url(target.as_str(), None::<&str>);
            false
        });
    log_page_loads(builder).build()
}

#[cfg(desktop)]
pub fn show_main_window(app: &AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Show the window and run a snippet in the page (no IPC permission needed: Rust drives it)
#[cfg(desktop)]
pub fn show_main_window_and_run(app: &AppHandle, script: &str) {
    use tauri::Manager;
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

    #[test]
    fn production_pages_stay_in_app() {
        assert!(stays_in_app(&Url::parse("https://chronolog.throb.online/time?week=2026-W45").unwrap()));
        assert!(stays_in_app(&Url::parse("about:blank").unwrap()));
        assert!(stays_in_app(&Url::parse("blob:https://chronolog.throb.online/1234").unwrap()));
    }

    #[test]
    fn other_sites_and_schemes_leave_the_app() {
        assert!(!stays_in_app(&Url::parse("https://example.com/").unwrap()));
        assert!(!stays_in_app(&Url::parse("http://chronolog.throb.online/").unwrap()));
        assert!(!stays_in_app(&Url::parse("https://chronolog.throb.online.evil.test/").unwrap()));
        assert!(!stays_in_app(&Url::parse("mailto:someone@example.com").unwrap()));
    }
}
