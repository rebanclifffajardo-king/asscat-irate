"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Download, EllipsisVertical, MonitorDown, Share, Smartphone, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectPlatform, getPwaState, getServerPwaState, isIosSafari, promptInstall, rememberIntroShown, subscribePwa,
  type InstallPlatform,
} from "@/lib/pwa";

const noopSubscribe = () => () => {};

/**
 * "Install ASSCAT iRATE" for the login page only. Hidden while the app runs
 * installed (standalone) or after it was installed from this browser. The
 * introductory card is shown once per device; afterwards only a small
 * "Install App" link remains.
 */
export function InstallAppPrompt() {
  const pwa = useSyncExternalStore(subscribePwa, getPwaState, getServerPwaState);
  const platform = useSyncExternalStore(noopSubscribe, detectPlatform, () => null);
  const iosSafari = useSyncExternalStore(noopSubscribe, isIosSafari, () => true);
  const [introClosed, setIntroClosed] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = pwa.ready && !pwa.installed && platform !== null;
  const introVisible = visible && !pwa.introSeen && !introClosed;
  // Remember that the intro was shown so a refresh does not show it again.
  useEffect(() => { if (introVisible) rememberIntroShown(); }, [introVisible]);

  if (!visible) return null;

  // Native prompt where the browser offers one; otherwise show the steps for this device.
  const install = async () => {
    if (!pwa.canPrompt) { setShowSteps((v) => !v); return; }
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  };
  const steps = <InstallSteps platform={platform} iosSafari={iosSafari} />;

  if (introVisible) {
    return (
      <section aria-labelledby="install-app-title" className="mt-4 rounded-md border border-brand-200 bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Smartphone className="h-5 w-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 id="install-app-title" className="font-semibold text-gray-900">Install ASSCAT iRATE</h2>
            <p className="mt-0.5 text-sm text-gray-600">Install ASSCAT iRATE on your device for faster and easier access.</p>
          </div>
          <button type="button" onClick={() => setIntroClosed(true)} className="-mr-1 -mt-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Dismiss install message">
            <X className="h-4 w-4" />
          </button>
        </div>
        {(platform === "ios" || showSteps) && <div className="mt-3 border-t border-gray-100 pt-3">{steps}</div>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIntroClosed(true)}>Not now</Button>
          {platform !== "ios" && (
            <Button size="sm" onClick={install} loading={busy}>{!busy && <Download className="h-4 w-4" />} Install App</Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="mt-4 text-center">
      <button type="button" onClick={install} disabled={busy} aria-expanded={pwa.canPrompt ? undefined : showSteps}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50 hover:underline disabled:opacity-60">
        <Download className="h-4 w-4" aria-hidden /> Install App
      </button>
      {showSteps && <div className="mt-2 rounded-md border border-gray-200 bg-white p-4 text-left shadow-card">{steps}</div>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white" aria-hidden>{n}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-gray-900">{children}</strong>;
const Glyph = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-gray-50 align-text-bottom text-gray-700">{children}</span>
);

/** Instructions for the detected device only. */
function InstallSteps({ platform, iosSafari }: { platform: InstallPlatform; iosSafari: boolean }) {
  const list = "mt-2 space-y-2 text-sm text-gray-700";
  switch (platform) {
    case "ios":
      return (
        <div>
          <p className="text-sm font-semibold text-gray-800">Install on iPhone/iPad</p>
          {!iosSafari && <p className="mt-1 text-xs text-gray-500">Tip: if you don&apos;t see &ldquo;Add to Home Screen&rdquo;, open this page in Safari.</p>}
          <ol className={list}>
            <Step n={1}>Tap the <Key>Share</Key> button <Glyph><Share className="h-3.5 w-3.5" aria-label="Share icon" /></Glyph> in {iosSafari ? "Safari" : "your browser"}.</Step>
            <Step n={2}>Scroll down and select <Key>Add to Home Screen</Key> <Glyph><SquarePlus className="h-3.5 w-3.5" aria-label="Add icon" /></Glyph>.</Step>
            <Step n={3}>Tap <Key>Add</Key>.</Step>
            <Step n={4}>Open ASSCAT iRATE from the new Home Screen icon.</Step>
          </ol>
        </div>
      );
    case "android":
      return (
        <div>
          <p className="text-sm font-semibold text-gray-800">Install on Android</p>
          <ol className={list}>
            <Step n={1}>Open the browser menu <Glyph><EllipsisVertical className="h-3.5 w-3.5" aria-label="Menu icon" /></Glyph> (usually at the top or bottom of the screen).</Step>
            <Step n={2}>Select <Key>Install app</Key> or <Key>Add to Home screen</Key> — the wording depends on your browser.</Step>
            <Step n={3}>Confirm the installation, then open ASSCAT iRATE from your Home screen.</Step>
          </ol>
        </div>
      );
    case "desktop-chromium":
      return (
        <div>
          <p className="text-sm font-semibold text-gray-800">Install on this computer</p>
          <ol className={list}>
            <Step n={1}>Click the install icon <Glyph><MonitorDown className="h-3.5 w-3.5" aria-label="Install icon" /></Glyph> at the right end of the address bar, or open the browser menu <Glyph><EllipsisVertical className="h-3.5 w-3.5" aria-label="Menu icon" /></Glyph>.</Step>
            <Step n={2}>Choose <Key>Install ASSCAT iRATE</Key> (in Edge: <Key>Apps › Install this site as an app</Key>).</Step>
            <Step n={3}>Click <Key>Install</Key>. The app opens in its own window.</Step>
          </ol>
        </div>
      );
    case "desktop-safari":
      return (
        <div>
          <p className="text-sm font-semibold text-gray-800">Install on Mac</p>
          <ol className={list}>
            <Step n={1}>In Safari&apos;s menu bar, choose <Key>File › Add to Dock</Key> (or click <Glyph><Share className="h-3.5 w-3.5" aria-label="Share icon" /></Glyph> and choose <Key>Add to Dock</Key>).</Step>
            <Step n={2}>Click <Key>Add</Key>. ASSCAT iRATE appears in your Dock.</Step>
          </ol>
          <p className="mt-2 text-xs text-gray-500">Requires Safari 17 (macOS Sonoma) or later.</p>
        </div>
      );
    default:
      return (
        <div>
          <p className="text-sm font-semibold text-gray-800">Install on this computer</p>
          <p className="mt-1 text-sm text-gray-700">
            If your browser has an <Key>Install app</Key> option in the address bar or menu, use it. Otherwise, open ASSCAT iRATE in
            Google Chrome, Microsoft Edge or Safari to install it.
          </p>
        </div>
      );
  }
}
