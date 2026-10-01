use objc2_app_kit::{NSView, NSWindow, NSWindowButton};

fn right_origin(width: f64, group_width: f64) -> f64 {
    (width - group_width - 16.0).max(0.0)
}

pub fn align_buttons(window: &tauri::Window) -> tauri::Result<()> {
    let window_handle = window.clone();
    window.run_on_main_thread(move || {
        let Ok(pointer) = window_handle.ns_window() else {
            return;
        };
        let Some(native_window) = (unsafe { pointer.cast::<NSWindow>().as_ref() }) else {
            return;
        };
        let (Some(close), Some(minimize), Some(zoom)) = (
            native_window.standardWindowButton(NSWindowButton::CloseButton),
            native_window.standardWindowButton(NSWindowButton::MiniaturizeButton),
            native_window.standardWindowButton(NSWindowButton::ZoomButton),
        ) else {
            return;
        };
        let close_frame = NSView::frame(&close);
        let spacing = NSView::frame(&minimize).origin.x - close_frame.origin.x;
        let start = right_origin(
            native_window.frame().size.width,
            spacing * 2.0 + NSView::frame(&zoom).size.width,
        );
        for (index, button) in [close, minimize, zoom].iter().enumerate() {
            let mut origin = NSView::frame(button).origin;
            origin.x = start + index as f64 * spacing;
            button.setFrameOrigin(origin);
        }
    })
}

#[cfg(test)]
mod tests {
    use super::right_origin;

    #[test]
    fn buttons_keep_a_sixteen_point_right_inset() {
        assert_eq!(right_origin(300.0, 52.0), 232.0);
        assert_eq!(right_origin(1200.0, 52.0), 1132.0);
        assert_eq!(right_origin(50.0, 52.0), 0.0);
    }
}
