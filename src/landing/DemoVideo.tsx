import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** The recordings of each mode (scripts/record-demos.mjs), by screen. */
const DEVICES = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1080, height: 1440 },
  phone: { width: 780, height: 1560 },
} as const;

type Device = keyof typeof DEVICES;

/**
 * The screen the visitor will use the app on, by the app's own rule for
 * its keypad (src/dsl/editor/ScriptEditor.tsx): a narrow screen is a phone,
 * a touch screen otherwise a tablet, anything else a desktop.
 */
function device(): Device {
  if (typeof matchMedia !== "function") return "desktop";
  if (matchMedia("(max-width: 640px)").matches) return "phone";
  if (matchMedia("(pointer: coarse)").matches) return "tablet";
  return "desktop";
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A recording of a mode in use, looping without sound, as it looks on the
 * visitor's kind of screen: the desktop's, a tablet's or a phone's, with
 * the page's keypad on touch screens. It loads and plays only while on
 * screen, and never by itself for those who ask for less motion: they (and
 * pages without JavaScript) see its poster, and may play it.
 */
export function DemoVideo({ name, label }: { name: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  // The built page (the same for everyone) has the desktop's; the visitor's
  // screen is known once the page is up.
  const [shown, setShown] = useState<Device>("desktop");
  // Paused by the visitor: scrolling back does not start it again.
  const held = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the screen is read after hydration, so the first render matches the built page.
    setShown(device());
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || reducedMotion() || typeof IntersectionObserver !== "function")
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !held.current) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [shown]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      held.current = false;
      void video.play().catch(() => {});
    } else {
      held.current = true;
      video.pause();
    }
  };

  const base = `${import.meta.env.BASE_URL}demos/${name}-${shown}`;
  return (
    <figure className={`demo demo--${shown}`} data-ui>
      <video
        // A new screen, a new recording: the element starts afresh.
        key={shown}
        ref={ref}
        src={`${base}.mp4`}
        poster={`${base}.jpg`}
        width={DEVICES[shown].width}
        height={DEVICES[shown].height}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        className="demo__toggle"
        onClick={toggle}
        aria-label={playing ? "Pause the video" : "Play the video"}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </button>
    </figure>
  );
}
