import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Activity, Download, Globe, Radio, MessageSquare, Compass, Brain, CheckSquare, Camera } from 'lucide-react';
import { LanguageMode, SystemStatus } from '../types';

import { getISTTimeInfo, TimeInfo } from '../utils/clock';

interface FuturisticHUDHeaderProps {
  systemStatus: SystemStatus;
  currentLanguage: LanguageMode;
  onLanguageChange: (lang: LanguageMode) => void;
  onOpenDiagnostics: () => void;
  onOpenAPKModal: () => void;
  onOpenVisionModal: () => void;
  onOpenTranscribeModal: () => void;
  onOpenMemoryModal: () => void;
  memoryCount?: number;
  onOpenActionsModal: () => void;
  pendingTasksCount?: number;
  isLiveConnected: boolean;
  isLiveConnecting: boolean;
  onToggleLive: () => void;
  activeView: 'core' | 'chat';
  onToggleView: () => void;
  unreadCount?: number;
}

export const FuturisticHUDHeader: React.FC<FuturisticHUDHeaderProps> = ({
  systemStatus,
  currentLanguage,
  onLanguageChange,
  onOpenDiagnostics,
  onOpenAPKModal,
  onOpenVisionModal,
  onOpenTranscribeModal,
  onOpenMemoryModal,
  memoryCount = 0,
  onOpenActionsModal,
  pendingTasksCount = 0,
  isLiveConnected,
  isLiveConnecting,
  onToggleLive,
  activeView,
  onToggleView,
  unreadCount = 0,
}) => {
  const [clockInfo, setClockInfo] = useState<TimeInfo>(() => getISTTimeInfo());
  const [batteryPct, setBatteryPct] = useState(88);

  useEffect(() => {
    const updateClock = () => {
      setClockInfo(getISTTimeInfo());
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Try reading battery if supported in browser
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryPct(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryPct(Math.round(battery.level * 100));
        });
      }).catch(() => {
        // Fallback
      });
    }
  }, []);

  const cycleLanguage = () => {
    if (currentLanguage === 'auto') onLanguageChange('en');
    else if (currentLanguage === 'en') onLanguageChange('hi');
    else onLanguageChange('auto');
  };

  const getLanguageLabel = () => {
    switch (currentLanguage) {
      case 'hi':
        return 'HI (हिंदी)';
      case 'en':
        return 'EN';
      default:
        return 'AUTO (EN/HI)';
    }
  };

  return (
    <header className="w-full flex flex-col border-b border-cyan-900/40 bg-gradient-to-b from-black via-slate-950/90 to-transparent backdrop-blur-md select-none shrink-0 z-30">
      {/* Android Top Phone Status Bar */}
      <div className="w-full flex items-center justify-between px-4 py-1 text-[11px] font-tech text-cyan-400/80 border-b border-cyan-950/60">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-cyan-200 tracking-wide font-mono">
            {clockInfo.timeShort} <span className="text-[9px] text-cyan-400">IST</span>
          </span>
          <span className="text-[10px] text-cyan-400/80 font-tech">
            {clockInfo.dateShort}
          </span>
          <span className="text-[9px] tracking-wider px-1 bg-cyan-950/70 border border-cyan-800/40 rounded text-cyan-300">
            5G ULTRA
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-cyan-400/70">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>CORE 99%</span>
          </span>
          <Wifi className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex items-center gap-1 text-cyan-300 font-mono">
            <span>{batteryPct}%</span>
            <Battery className="w-3.5 h-3.5 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Futuristic Maya Jarvis App Bar */}
      <div className="w-full flex items-center justify-between px-3 py-2">
        {/* Brand Identity & Status */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full border border-cyan-400/80 bg-cyan-950/50 flex items-center justify-center glow-box-cyan">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-ping" />
            <span className="absolute w-2 h-2 rounded-full bg-white shadow-[0_0_8px_#22d3ee]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-hud font-bold text-sm text-cyan-100 tracking-wider">
                MAYA <span className="text-cyan-400 text-xs font-normal">v4.2</span>
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            </div>
            <p className="text-[10px] font-tech text-cyan-500/90 tracking-widest leading-none">
              JARVIS HOLOGRAPHIC CORE
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Live API Mode Toggle Button */}
          <button
            onClick={onToggleLive}
            title={
              isLiveConnected
                ? 'Disconnect Gemini 3.8 Live API'
                : 'Connect Real-Time Gemini 3.8 Live Voice'
            }
            className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-hud font-semibold transition-all active:scale-95 ${
              isLiveConnected
                ? 'bg-red-500/20 border-red-400 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse'
                : isLiveConnecting
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 animate-pulse'
                : 'bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-cyan-400/80 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:border-cyan-300'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-red-400 animate-spin' : 'text-cyan-300'}`} />
            <span className="text-[10px] tracking-wider">
              {isLiveConnected ? 'LIVE ACTIVE' : isLiveConnecting ? 'SYNCING...' : 'LIVE API'}
            </span>
          </button>

          {/* Multimodal Optical Vision Scanner Button */}
          <button
            onClick={onOpenVisionModal}
            title="Multimodal Optical Vision Scanner (Gemini 3.8 Flash)"
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud font-semibold"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline text-[10px]">SCAN</span>
          </button>

          {/* Audio Transcribe Button (gemini-3.5-transcribe) */}
          <button
            onClick={onOpenTranscribeModal}
            title="Transcribe Audio with Gemini 3.5 Transcribe"
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud font-semibold"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline text-[10px]">TRANSCRIBE</span>
          </button>

          {/* Neural Memory Matrix Vault Button */}
          <button
            onClick={onOpenMemoryModal}
            title={`Neural Memory Matrix (${memoryCount} persistent records)`}
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud font-semibold"
          >
            <Brain className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] tracking-wider">MEM</span>
            <span className="px-1 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-mono border border-cyan-500/40">
              {memoryCount}
            </span>
          </button>

          {/* Jarvis Operational Tasks & Reminders Button */}
          <button
            onClick={onOpenActionsModal}
            title={`Jarvis Operational Tasks & Reminders (${pendingTasksCount} pending)`}
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud font-semibold"
          >
            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline text-[10px] tracking-wider">TASKS</span>
            {pendingTasksCount > 0 && (
              <span className="px-1 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono border border-emerald-500/40">
                {pendingTasksCount}
              </span>
            )}
          </button>

          {/* Language Toggle Chip */}
          <button
            onClick={cycleLanguage}
            title="Toggle Language: Auto / English / Hindi"
            className="flex items-center gap-1 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud font-semibold"
          >
            <Globe className="w-3 h-3 text-cyan-400" />
            <span className="text-[11px]">{getLanguageLabel()}</span>
          </button>

          {/* View Mode Switcher (Core View vs Chat Log) */}
          <button
            onClick={onToggleView}
            title={activeView === 'core' ? 'Show Conversation Log' : 'Show Holographic Core'}
            className={`relative p-1.5 rounded border transition-all active:scale-95 ${
              activeView === 'chat'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-400 hover:border-cyan-600'
            }`}
          >
            {activeView === 'core' ? (
              <MessageSquare className="w-4 h-4" />
            ) : (
              <Compass className="w-4 h-4" />
            )}
            {unreadCount > 0 && activeView === 'core' && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* APK Export Button */}
          <button
            onClick={onOpenAPKModal}
            title="Export Android APK"
            className="flex items-center gap-1 px-2 py-1 rounded bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-400/80 text-cyan-200 text-xs font-hud font-semibold hover:border-cyan-300 active:scale-95 transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
          >
            <Download className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline text-[11px]">APK</span>
          </button>
        </div>
      </div>
    </header>
  );
};
