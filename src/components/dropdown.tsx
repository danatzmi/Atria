"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// A dropdown that positions itself from measurement rather than from
// hardcoded alignment classes.
//
// Why this exists: the same menu-clipped-off-screen bug was fixed three
// times with `right-0` / `left-0 sm:right-0` guesses. Each fix was correct
// for the layout at the time and silently wrong the next time the trigger
// moved — a class can't know where its button ended up. This measures, so
// it can't drift.
//
// Not Radix: these menus contain native <dialog> items that must stay
// mounted while their modal is open, and the menu must NOT close when an
// item is clicked. Radix closes on select and manages focus, which fights
// a native top-layer dialog — a combination that has already produced one
// hard-to-find bug here. The parts Radix would give us that we actually
// need are collision handling and dismissal, both of which are below.
//
// Rendered `fixed` and positioned in viewport coordinates, which also
// escapes any `overflow-hidden` ancestor — another way these menus can be
// clipped that alignment classes cannot address.

const VIEWPORT_MARGIN = 8;
const GAP = 4;

type Align = "start" | "end";

export function Dropdown({
  trigger,
  children,
  align = "end",
  menuClassName = "",
  contentWidth = 176,
  label = "Menu",
}: {
  // Receives the props the trigger must carry; the caller keeps full
  // control of how it looks.
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => ReactNode;
  // A render function receives `close`, so an item can dismiss the menu
  // once its own work succeeds — which is how the dialog-bearing menus
  // stay open while a modal is up.
  children: ReactNode | ((close: () => void) => ReactNode);
  // Preferred side. Flipped automatically when it wouldn't fit.
  align?: Align;
  menuClassName?: string;
  // Used for the first measurement, before the menu has laid out.
  contentWidth?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  // Clearing coords alongside open keeps the next opening from painting a
  // frame at the previous trigger's position.
  const closeMenu = useCallback(() => {
    setOpen(false);
    setCoords(null);
  }, []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const t = trigger.getBoundingClientRect();
    const menu = menuRef.current;
    const width = menu?.offsetWidth || contentWidth;
    const height = menu?.offsetHeight || 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: try the preferred side, flip if it would clip, then clamp
    // so a menu wider than the space on either side still lands on screen
    // rather than half off it.
    let left = align === "end" ? t.right - width : t.left;
    if (left + width > vw - VIEWPORT_MARGIN) left = t.right - width;
    if (left < VIEWPORT_MARGIN) left = t.left;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN)
    );

    // Vertical: below by default, above when there isn't room and there is
    // room above — the usual case being a trigger near the bottom of a
    // phone screen.
    let top = t.bottom + GAP;
    if (height && top + height > vh - VIEWPORT_MARGIN) {
      const above = t.top - GAP - height;
      top = above >= VIEWPORT_MARGIN ? above : Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN);
    }

    setCoords({ left: Math.round(left), top: Math.round(top) });
  }, [align, contentWidth]);

  // Measure before paint, so the menu never flashes at the wrong place.
  // Measuring the DOM and storing the result is what useLayoutEffect is
  // for; the position can't be derived during render because it depends on
  // the trigger's rendered rect and the menu's own measured size.
  //
  // Stale coords are cleared by closeMenu, not here — resetting state in
  // the effect's closed branch would cascade an extra render on every
  // dismissal.
  useLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  // The trigger moves when the page scrolls or the window resizes, so the
  // menu has to follow it. Capture-phase scroll catches scrolling inside
  // any ancestor, not just the window.
  useEffect(() => {
    if (!open) return;
    const update = () => position();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, { capture: true });
    };
  }, [open, position]);

  // Dismissal. Deliberately does NOT close on a click inside the menu:
  // items here open native dialogs that would be unmounted mid-open if the
  // menu closed underneath them. Callers close it themselves on success.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: () => (open ? closeMenu() : setOpen(true)),
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          // invisible until measured — one frame at the wrong coordinates
          // is exactly the jump this component exists to remove.
          style={{
            left: coords?.left ?? 0,
            top: coords?.top ?? 0,
            visibility: coords ? "visible" : "hidden",
          }}
          className={`fixed z-50 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ${menuClassName}`}
        >
          {typeof children === "function" ? children(closeMenu) : children}
        </div>
      )}
    </>
  );
}
