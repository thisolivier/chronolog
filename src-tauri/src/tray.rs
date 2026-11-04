//! The menu-bar item: a template clock icon, the running timer as its title, and a menu.

use crate::timer::{now_milliseconds, tray_title, TimerStore};
use crate::window::{show_main_window, show_main_window_and_run};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

const TRAY_ID: &str = "chronolog-timer";

/// Open the timesheet unless a timesheet page is already showing
const OPEN_TIMESHEET_SCRIPT: &str =
    "if (!location.pathname.startsWith('/time')) location.assign('/time');";

/// Press the timer widget's Stop button, which brings up the completion (stop) form;
/// with no widget on the page, open the timesheet where it lives
const STOP_TIMER_SCRIPT: &str = r#"(() => {
  const stopButton = [...document.querySelectorAll('[data-testid^="timer-widget-"] button')]
    .find((button) => button.textContent.trim() === 'Stop');
  if (stopButton) stopButton.click();
  else if (!location.pathname.startsWith('/time')) location.assign('/time');
})();"#;

/// Menu items whose enabled state follows the timer
pub struct TimerMenuItems {
    start: MenuItem<Wry>,
    stop: MenuItem<Wry>,
}

impl TimerMenuItems {
    pub fn reflect_running(&self, running: bool) {
        let _ = self.start.set_enabled(!running);
        let _ = self.stop.set_enabled(running);
    }
}

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Chronolog", true, None::<&str>)?;
    let start_item = MenuItem::with_id(app, "start", "Start timer", true, None::<&str>)?;
    let stop_item = MenuItem::with_id(app, "stop", "Stop timer", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Chronolog", true, Some("CmdOrCtrl+Q"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show_item, &start_item, &stop_item, &separator, &quit_item])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(tauri::include_image!("icons/tray-template.png"))
        .icon_as_template(true)
        .tooltip("Chronolog")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "start" => show_main_window_and_run(app, OPEN_TIMESHEET_SCRIPT),
            "stop" => show_main_window_and_run(app, STOP_TIMER_SCRIPT),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    app.manage(TimerMenuItems { start: start_item, stop: stop_item });
    Ok(())
}

/// Refresh the tray title once a second from the stored start time
pub fn start_title_ticker(app: AppHandle) {
    std::thread::spawn(move || {
        let mut shown_title: Option<String> = None;
        loop {
            let snapshot = app.state::<TimerStore>().current();
            let title = tray_title(&snapshot, now_milliseconds());
            if title != shown_title {
                if let Some(tray) = app.tray_by_id(TRAY_ID) {
                    if tray.set_title(title.as_deref()).is_ok() {
                        shown_title = title;
                    }
                }
            }
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
