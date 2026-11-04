import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const wheelGain = 0.6;
const settlingTime = 180;

export default function SmoothScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let target = window.scrollY,
      current = window.scrollY,
      lastWritten = window.scrollY,
      frame = 0,
      lastTime = 0;
    const maximum = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const clamp = (value: number) => Math.max(0, Math.min(maximum(), value));
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      target = current = lastWritten = window.scrollY;
    }
    function tick(now: number) {
      const elapsed = lastTime ? Math.min(64, now - lastTime) : 16;
      lastTime = now;
      target = clamp(target);
      current += (target - current) * (1 - Math.exp(-elapsed / settlingTime));
      const settled = Math.abs(target - current) < 0.5;
      window.scrollTo({ top: settled ? target : current, behavior: "instant" });
      lastWritten = window.scrollY;
      if (!settled) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        lastTime = 0;
      }
    }
    function wheel(event: WheelEvent) {
      if (
        preference.matches ||
        event.defaultPrevented ||
        !event.cancelable ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        stop();
        return;
      }
      const element = event.target instanceof Element ? event.target : null;
      if (
        element?.closest(
          'input,textarea,select,[contenteditable="true"],[role="slider"]',
        )
      ) {
        stop();
        return;
      }
      // Tables, menus and other nested scroll areas retain their native scrolling.
      for (
        let parent = element;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (
          parent.scrollHeight > parent.clientHeight + 1 &&
          /auto|scroll/.test(getComputedStyle(parent).overflowY) &&
          ((event.deltaY > 0 &&
            parent.scrollTop + parent.clientHeight < parent.scrollHeight - 1) ||
            (event.deltaY < 0 && parent.scrollTop > 0))
        ) {
          stop();
          return;
        }
      }
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1;
      if (!frame) target = current = window.scrollY;
      const next = clamp(target + event.deltaY * unit * wheelGain);
      if (next === target) return;
      event.preventDefault();
      target = next;
      if (!frame) frame = requestAnimationFrame(tick);
    }
    function sync() {
      if (frame && Math.abs(window.scrollY - lastWritten) > 2) stop();
    }
    function key(event: KeyboardEvent) {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        stop();
    }
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("blur", stop);
    preference.addEventListener("change", stop);
    return () => {
      stop();
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("scroll", sync);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("blur", stop);
      preference.removeEventListener("change", stop);
    };
  }, [pathname]);
  return null;
}
