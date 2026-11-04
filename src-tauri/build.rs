fn main() {
    // Only `set_timer_state` becomes a permission (`allow-set-timer-state`); the remote
    // capability grants it to the production origin and nothing else.
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["set_timer_state"])),
    )
    .expect("failed to run tauri-build");
}
