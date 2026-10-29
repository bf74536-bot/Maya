import React, { useState } from 'react';
import { X, Smartphone, Terminal, Globe, Download, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface APKExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APKExportModal: React.FC<APKExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'instant' | 'pwabuilder' | 'bubblewrap' | 'capacitor'>('instant');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const { isInstallable, isInstalled, triggerInstall } = usePWAInstall();

  if (!isOpen) return null;

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : 'https://your-maya-app.run.app';

  const copyToClipboard = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <Smartphone className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-hud font-bold text-sm text-cyan-100 tracking-wider">
                ANDROID APK EXPORT SUITE
              </h2>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest">
                MAYA AI PACKAGING MATRIX
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-cyan-900/60 text-cyan-400 hover:text-white hover:border-cyan-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-cyan-950 bg-black/60 px-3 py-1 text-xs font-hud overflow-x-auto">
          {[
            { id: 'instant', label: '1. Instant WebAPK', icon: Smartphone },
            { id: 'pwabuilder', label: '2. 1-Click APK', icon: Download },
            { id: 'bubblewrap', label: '3. Bubblewrap CLI', icon: Terminal },
            { id: 'capacitor', label: '4. Android Studio', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-200 bg-cyan-950/30'
                    : 'border-transparent text-cyan-600 hover:text-cyan-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans text-cyan-100/90 leading-relaxed">
          {/* TAB 1: INSTANT WEBAPK */}
          {activeTab === 'instant' && (
            <div className="space-y-3.5">
              <div className="p-3 rounded-xl border border-cyan-500/40 bg-cyan-950/30 glow-box-cyan flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-hud font-bold text-cyan-200 text-sm">
                    Direct Android WebAPK (Recommended)
                  </h4>
                  <p className="text-[11px] text-cyan-300/80 mt-1">
                    Android OS natively builds and signs an official APK on-device with custom launcher icon, standalone screen, and offline storage.
                  </p>
                </div>
              </div>

              {isInstallable && (
                <button
                  onClick={triggerInstall}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-hud font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:brightness-110 active:scale-98 transition-all"
                >
                  <Download className="w-4 h-4" />
                  INSTALL MAYA AI TO ANDROID NOW
                </button>
              )}

              {isInstalled && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Maya AI is currently running as an installed Android app!</span>
                </div>
              )}

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-cyan-900/50 space-y-2">
                <h5 className="font-hud font-semibold text-cyan-300">
                  Step-by-Step Installation on Android Phone:
                </h5>
                <ol className="list-decimal list-inside space-y-1.5 text-cyan-200/80 pl-1 text-[11px]">
                  <li>Open this web application in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong> on your Android phone.</li>
                  <li>Tap the <strong>three dots menu (&vellip;)</strong> in top-right or look for the <strong>&ldquo;Install App&rdquo;</strong> prompt.</li>
                  <li>Select <strong>&ldquo;Install App&rdquo;</strong> or <strong>&ldquo;Add to Home screen&rdquo;</strong>.</li>
                  <li>Android automatically verifies the PWA manifest and registers the Maya AI APK on your device drawer.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: PWABUILDER 1-CLICK APK */}
          {activeTab === 'pwabuilder' && (
            <div className="space-y-3.5">
              <p className="text-cyan-200/90">
                Generate a standalone downloadable <strong>.apk</strong> or Google Play package in 60 seconds without installing Android Studio.
              </p>

              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-cyan-900/50 space-y-2.5">
                <h5 className="font-hud font-semibold text-cyan-300">
                  Step-by-Step APK Generation:
                </h5>
                <ol className="list-decimal list-inside space-y-2 text-cyan-200/80 pl-1 text-[11px]">
                  <li>
                    Copy your live deployment app URL:
                    <div className="mt-1 flex items-center gap-2 bg-black/60 p-2 rounded border border-cyan-900/80 font-mono text-[10px] text-cyan-300 truncate">
                      <span className="truncate flex-1">{currentAppUrl}</span>
                      <button
                        onClick={() => copyToClipboard(currentAppUrl, 'url')}
                        className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 hover:border-cyan-400 text-cyan-200 shrink-0"
                      >
                        {copiedCmd === 'url' ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                  </li>
                  <li>
                    Visit{' '}
                    <a
                      href="https://www.pwabuilder.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline font-semibold inline-flex items-center gap-1"
                    >
                      pwabuilder.com <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and paste the URL.
                  </li>
                  <li>Click <strong>&ldquo;Package for Stores&rdquo;</strong> &rarr; Select <strong>Android</strong>.</li>
                  <li>Select <strong>Download APK</strong> to get the raw installable file or <strong>Signed AAB</strong> for Google Play.</li>
                  <li>Transfer the <code>.apk</code> to your Android phone, tap to open, and select &ldquo;Install&rdquo;.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: BUBBLEWRAP CLI */}
          {activeTab === 'bubblewrap' && (
            <div className="space-y-3">
              <p className="text-cyan-200/90">
                Google&rsquo;s official Trusted Web Activity (TWA) command-line tool builds production-grade Android APKs directly from terminal:
              </p>

              <div className="space-y-2">
                {[
                  {
                    title: '1. Install Google Bubblewrap CLI',
                    cmd: 'npm install -g @bubblewrap/cli',
                    id: 'b1',
                  },
                  {
                    title: '2. Initialize TWA Android Project',
                    cmd: `bubblewrap init --manifest=${currentAppUrl}/manifest.webmanifest`,
                    id: 'b2',
                  },
                  {
                    title: '3. Build & Sign Android APK',
                    cmd: 'bubblewrap build',
                    id: 'b3',
                  },
                  {
                    title: '4. Direct Install via ADB to Phone',
                    cmd: 'adb install app-release-signed.apk',
                    id: 'b4',
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900/70 p-2.5 rounded-lg border border-cyan-900/60"
                  >
                    <div className="flex items-center justify-between text-[11px] font-hud text-cyan-400 mb-1">
                      <span>{item.title}</span>
                      <button
                        onClick={() => copyToClipboard(item.cmd, item.id)}
                        className="text-cyan-500 hover:text-cyan-200"
                      >
                        {copiedCmd === item.id ? 'COPIED' : 'COPY'}
                      </button>
                    </div>
                    <code className="block bg-black/80 p-2 rounded text-[11px] font-mono text-cyan-200 select-all overflow-x-auto">
                      {item.cmd}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CAPACITOR & ANDROID STUDIO */}
          {activeTab === 'capacitor' && (
            <div className="space-y-3">
              <p className="text-cyan-200/90">
                For complete native compilation with native Android SDKs and plugins:
              </p>

              <div className="bg-slate-900/70 p-3 rounded-lg border border-cyan-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-hud text-cyan-300 font-semibold">
                    Native Android Shell Setup:
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        'npm install @capacitor/core @capacitor/cli @capacitor/android && npx cap init "Maya AI" com.maya.ai --web-dir dist && npm run build && npx cap add android && npx cap open android',
                        'cap'
                      )
                    }
                    className="text-cyan-400 text-[10px] font-tech hover:text-cyan-200"
                  >
                    {copiedCmd === 'cap' ? 'COPIED ALL' : 'COPY COMMANDS'}
                  </button>
                </div>
                <pre className="bg-black/90 p-3 rounded text-[10px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
{`# 1. Install Capacitor
npm i @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Android Project
npx cap init "Maya AI" com.maya.ai --web-dir dist

# 3. Build & sync web dist
npm run build
npx cap add android

# 4. Open in Android Studio & Build APK
npx cap open android`}
                </pre>
              </div>
              <p className="text-[11px] text-cyan-400/80">
                In Android Studio, click <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong>. The resulting APK will be placed in <code>android/app/build/outputs/apk/debug/app-debug.apk</code>.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-950 bg-black/80 flex items-center justify-between text-[11px] font-tech text-cyan-500">
          <span>ANDROID TARGET: API 26+ (ANDROID 8.0 TO 15+)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all font-hud font-semibold"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
