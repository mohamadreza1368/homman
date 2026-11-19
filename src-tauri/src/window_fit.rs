//! Desktop window placement and workspace bounds fitting.
//!
//! Ensures application windows open cleanly within available monitor work areas,
//! preventing primary controls and navigation bars from clipping beneath taskbars.

use tauri::{PhysicalPosition, PhysicalRect, PhysicalSize, WebviewWindow};

/// Computed window dimensions and screen coordinates.
#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Fit {
    /// Target content dimensions excluding window frame decorations.
    pub inner: PhysicalSize<u32>,
    /// Target screen position coordinates.
    pub position: PhysicalPosition<i32>,
}

/// Computes centered window geometry clamped within the provided workspace rectangle.
///
/// Ensures content bounds shrink to fit small displays while preserving window
/// decorations and title bars above the display edge.
pub(crate) fn fit(
    area: PhysicalRect<i32, u32>,
    chrome: PhysicalSize<u32>,
    inner: PhysicalSize<u32>,
) -> Fit {
    let available_w = area.size.width.saturating_sub(chrome.width);
    let available_h = area.size.height.saturating_sub(chrome.height);

    let target_inner = PhysicalSize::new(
        inner.width.min(available_w),
        inner.height.min(available_h),
    );

    let target_outer_w = target_inner.width + chrome.width;
    let target_outer_h = target_inner.height + chrome.height;

    let offset_x = ((area.size.width as i64 - target_outer_w as i64) / 2).max(0) as i32;
    let offset_y = ((area.size.height as i64 - target_outer_h as i64) / 2).max(0) as i32;

    Fit {
        inner: target_inner,
        position: PhysicalPosition::new(
            area.position.x + offset_x,
            area.position.y + offset_y,
        ),
    }
}

/// Inspects current monitor bounds and adjusts the window position and dimensions.
pub(crate) fn fit_to_work_area(window: &WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };

    let (Ok(outer), Ok(inner)) = (window.outer_size(), window.inner_size()) else {
        return;
    };

    let chrome = PhysicalSize::new(
        outer.width.saturating_sub(inner.width),
        outer.height.saturating_sub(inner.height),
    );

    let result = fit(*monitor.work_area(), chrome, inner);

    if result.inner != inner {
        let _ = window.set_size(result.inner);
    }
    let _ = window.set_position(result.position);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn desktop_1080p() -> PhysicalRect<i32, u32> {
        PhysicalRect {
            position: PhysicalPosition::new(0, 0),
            size: PhysicalSize::new(1920, 1032),
        }
    }

    fn test_chrome() -> PhysicalSize<u32> {
        PhysicalSize::new(16, 39)
    }

    #[test]
    fn a_window_that_fits_is_only_centred() {
        let requested = PhysicalSize::new(1440, 860);
        let outcome = fit(desktop_1080p(), test_chrome(), requested);

        assert_eq!(outcome.inner, requested);
        assert_eq!(outcome.position, PhysicalPosition::new(232, 66));
    }

    #[test]
    fn a_window_taller_than_the_work_area_is_shrunk_to_it() {
        let outcome = fit(desktop_1080p(), test_chrome(), PhysicalSize::new(1440, 1200));

        assert_eq!(outcome.inner.height, 1032 - 39);
        assert_eq!(outcome.position.y, 0);
    }

    #[test]
    fn a_small_laptop_keeps_the_whole_interface() {
        let area = PhysicalRect {
            position: PhysicalPosition::new(0, 0),
            size: PhysicalSize::new(1366, 728),
        };
        let outcome = fit(area, test_chrome(), PhysicalSize::new(1440, 860));

        assert_eq!(outcome.inner, PhysicalSize::new(1350, 689));
        assert_eq!(outcome.position, PhysicalPosition::new(0, 0));
    }

    #[test]
    fn the_monitor_origin_is_respected() {
        let area = PhysicalRect {
            position: PhysicalPosition::new(-1920, -200),
            size: PhysicalSize::new(1920, 1032),
        };
        let outcome = fit(area, test_chrome(), PhysicalSize::new(1440, 860));

        assert_eq!(outcome.position, PhysicalPosition::new(-1920 + 232, -200 + 66));
    }

    #[test]
    fn an_absurd_work_area_does_not_panic() {
        let area = PhysicalRect {
            position: PhysicalPosition::new(0, 0),
            size: PhysicalSize::new(8, 8),
        };
        let outcome = fit(area, test_chrome(), PhysicalSize::new(1440, 860));

        assert_eq!(outcome.inner, PhysicalSize::new(0, 0));
        assert_eq!(outcome.position, PhysicalPosition::new(0, 0));
    }
}
