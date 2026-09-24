/**
 * Browser-side PWA state (service worker registration, install prompt and
 * installed-state detection) exposed as a tiny external store for
 * useSyncExternalStore. Started once from <PwaRegister /> in the root layout
 * so the `beforeinstallprompt` event is captured on whichever page it fires.
 */

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaState = {
  /** false during SSR / before the store has started */
  ready: boolean;
  /** running as an installed app, or installed from this browser */
  installed: boolean;
  /** the browser offered a native install prompt we can trigger */
  canPrompt: boolean;
  /** the one-time introductory install notice was already shown on this device */
  introSeen: boolean;
};

export const INTRO_KEY = "asscat-irate-pwa-install-intro-shown";
const INSTALLED_KEY = "asscat-irate-pwa-installed";

const SERVER_STATE: PwaState = { ready: false, installed: false, canPrompt: false, introSeen: true };
let state: PwaState = SERVER_STATE;
let deferred: InstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function update(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

// localStorage can be unavailable (private mode, blocked storage).
const storage = {
  get: (k: string) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } },
  remove: (k: string) => { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** True when the page runs as an installed app (Android/desktop display mode, or iOS home-screen app). */
export function isStandalone(): boolean {
  const modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
  return modes.some((m) => window.matchMedia(`(display-mode: ${m})`).matches)
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  state = {
    ready: true,
    installed: isStandalone() || storage.get(INSTALLED_KEY) === "1",
    canPrompt: false,
    introSeen: storage.get(INTRO_KEY) === "1",
  };

  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the event for our "Install App" button instead of the browser's
    // automatic banner. Browsers only fire it when the app is NOT installed.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    storage.remove(INSTALLED_KEY);
    update({ canPrompt: true, installed: isStandalone() });
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    storage.set(INSTALLED_KEY, "1");
    update({ installed: true, canPrompt: false });
  });
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (e) => {
    if (e.matches) update({ installed: true, canPrompt: false });
  });

  // Chromium can report whether this site's own app is installed.
  const nav = window.navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
  nav.getInstalledRelatedApps?.().then((apps) => { if (apps.length) update({ installed: true }); }).catch(() => {});

  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => console.warn("[pwa] service worker", err));
  }
  for (const l of listeners) l();
}

export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  startPwa();
  return () => { listeners.delete(listener); };
}
export const getPwaState = () => state;
export const getServerPwaState = () => SERVER_STATE;

/** Shows the browser's native install dialog (must be called from a user gesture). */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null; // a prompt event can only be used once
  update({ canPrompt: false });
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") {
    storage.set(INSTALLED_KEY, "1");
    update({ installed: true });
  }
  return outcome;
}

/** Remember that the one-time intro was shown (does not change the current page's view). */
export function rememberIntroShown() {
  storage.set(INTRO_KEY, "1");
}

export type InstallPlatform = "ios" | "android" | "desktop-chromium" | "desktop-safari" | "desktop-other";

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports a Mac user agent; touch support tells them apart.
  const iOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Edg\/|Chrome\/|Chromium\//.test(ua) && !/OPR\/|Firefox\//.test(ua)) return "desktop-chromium";
  if (/Safari\//.test(ua) && /Version\//.test(ua) && !/Chrome\//.test(ua)) return "desktop-safari";
  return "desktop-other";
}

export const isIosSafari = () => {
  const ua = navigator.userAgent;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
};
