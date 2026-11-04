//! Timer state pushed from the page, and the menu-bar title derived from it.
//!
//! The page calls `set_timer_state` on every change and once a minute. Rust keeps the last
//! state in a `Mutex` and computes the elapsed time itself from `started_at`, so a hidden
//! window whose page timers are throttled still shows the right elapsed time.

use std::sync::Mutex;

/// The last timer state the page reported
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TimerSnapshot {
    pub running: bool,
    /// Start of the running timer, milliseconds since the Unix epoch
    pub started_at_milliseconds: Option<i64>,
    /// Client short code of the timer's contract; empty while no contract is chosen
    pub contract_short_code: Option<String>,
}

/// Managed state: the latest snapshot behind a mutex
#[derive(Debug, Default)]
pub struct TimerStore {
    snapshot: Mutex<TimerSnapshot>,
}

impl TimerStore {
    /// Replace the stored snapshot; returns true when `running` changed
    pub fn replace(&self, new_snapshot: TimerSnapshot) -> bool {
        let mut snapshot = self.snapshot.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let running_changed = snapshot.running != new_snapshot.running;
        *snapshot = new_snapshot;
        running_changed
    }

    pub fn current(&self) -> TimerSnapshot {
        self.snapshot
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

/// The tray title: `None` (icon only) when idle, `HH:MM CODE` while a timer runs
pub fn tray_title(snapshot: &TimerSnapshot, now_milliseconds: i64) -> Option<String> {
    if !snapshot.running {
        return None;
    }
    let elapsed_text = match snapshot.started_at_milliseconds {
        Some(started_at) => {
            let elapsed_minutes = (now_milliseconds - started_at).max(0) / 60_000;
            format!("{:02}:{:02}", elapsed_minutes / 60, elapsed_minutes % 60)
        }
        None => "--:--".to_string(),
    };
    match snapshot.contract_short_code.as_deref().map(str::trim) {
        Some(short_code) if !short_code.is_empty() => Some(format!("{elapsed_text} {short_code}")),
        _ => Some(elapsed_text),
    }
}

pub fn now_milliseconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINUTE: i64 = 60_000;

    fn running_since(started_at: i64, short_code: Option<&str>) -> TimerSnapshot {
        TimerSnapshot {
            running: true,
            started_at_milliseconds: Some(started_at),
            contract_short_code: short_code.map(str::to_string),
        }
    }

    #[test]
    fn idle_timer_shows_icon_only() {
        assert_eq!(tray_title(&TimerSnapshot::default(), 0), None);
    }

    #[test]
    fn running_timer_shows_hours_minutes_and_code() {
        let snapshot = running_since(0, Some("ACME"));
        assert_eq!(tray_title(&snapshot, 0).as_deref(), Some("00:00 ACME"));
        assert_eq!(tray_title(&snapshot, 59 * 1000).as_deref(), Some("00:00 ACME"));
        assert_eq!(tray_title(&snapshot, 61 * MINUTE + 30_000).as_deref(), Some("01:01 ACME"));
        assert_eq!(tray_title(&snapshot, (12 * 60 + 5) * MINUTE).as_deref(), Some("12:05 ACME"));
    }

    #[test]
    fn hours_beyond_two_digits_are_not_truncated() {
        let snapshot = running_since(0, None);
        assert_eq!(tray_title(&snapshot, 100 * 60 * MINUTE).as_deref(), Some("100:00"));
    }

    #[test]
    fn missing_or_blank_code_shows_time_only() {
        assert_eq!(tray_title(&running_since(0, None), 5 * MINUTE).as_deref(), Some("00:05"));
        assert_eq!(tray_title(&running_since(0, Some("  ")), 5 * MINUTE).as_deref(), Some("00:05"));
    }

    #[test]
    fn start_in_the_future_clamps_to_zero() {
        assert_eq!(tray_title(&running_since(10 * MINUTE, None), 0).as_deref(), Some("00:00"));
    }

    #[test]
    fn running_without_start_shows_placeholder() {
        let snapshot = TimerSnapshot { running: true, ..TimerSnapshot::default() };
        assert_eq!(tray_title(&snapshot, 0).as_deref(), Some("--:--"));
    }

    #[test]
    fn store_replaces_snapshot_and_reports_running_changes() {
        let store = TimerStore::default();
        assert_eq!(store.current(), TimerSnapshot::default());
        assert!(store.replace(running_since(5, Some("ACME"))));
        assert!(!store.replace(running_since(6, Some("BETA"))));
        assert_eq!(store.current(), running_since(6, Some("BETA")));
        assert!(store.replace(TimerSnapshot::default()));
        assert!(!store.current().running);
    }

    #[test]
    fn store_is_shared_across_threads() {
        let store = std::sync::Arc::new(TimerStore::default());
        let writer = {
            let store = std::sync::Arc::clone(&store);
            std::thread::spawn(move || store.replace(running_since(1, None)))
        };
        writer.join().expect("writer thread panicked");
        assert!(store.current().running);
    }
}
