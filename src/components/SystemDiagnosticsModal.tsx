import React, { useState } from 'react';
import {
  X,
  Cpu,
  Zap,
  Volume2,
  Shield,
  Radio,
  Sliders,
  Play,
  Fingerprint,
  Lock,
  Unlock,
  Check,
  KeyRound,
} from 'lucide-react';
import { LanguageMode, SystemStatus, VoiceConfig, VoicePersona } from '../types';
import {
  getVaultConfig,
  saveVaultConfig,
  updatePin,
  isBiometricsSupported,
  lockVault,
} from '../utils/securityVault';

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemStatus: SystemStatus;
  useGeminiTTS: boolean;
  onToggleTTS: (val: boolean) => void;
  continuousVoice: boolean;
  onToggleContinuousVoice: (val: boolean) => void;
  language: LanguageMode;
  onLanguageChange: (lang: LanguageMode) => void;
  voiceConfig: VoiceConfig;
  onVoiceConfigChange: (config: VoiceConfig) => void;
  onTestVoice: () => void;
}

export const SystemDiagnosticsModal: React.FC<SystemDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  systemStatus,
  useGeminiTTS,
  onToggleTTS,
  continuousVoice,
  onToggleContinuousVoice,
  language,
  onLanguageChange,
  voiceConfig,
  onVoiceConfigChange,
  onTestVoice,
}) => {
  const [vaultConfig, setVaultConfigState] = useState(() => getVaultConfig());
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const personas: Array<{ id: VoicePersona; name: string; tag: string; desc: string }> = [
    {
      id: 'Zephyr',
      name: 'Zephyr (Jarvis Prime)',
      tag: 'BRITISH / TACTICAL',
      desc: 'Swift, confident, articulate cadence optimized for crisp tactical directives.',
    },
    {
      id: 'Aoede',
      name: 'Aoede (Melodic Core)',
      tag: 'HARMONIC / WARM',
      desc: 'Warm, empathetic, flowing harmonic resonance. Ideal for natural conversations.',
    },
    {
      id: 'Kore',
      name: 'Kore (Neural Analyst)',
      tag: 'ANALYTICAL / PRECISE',
      desc: 'Sharp, objective diagnostic poise with absolute military-grade clarity.',
    },
    {
      id: 'Fenrir',
      name: 'Fenrir (Command Gravitas)',
      tag: 'DEEP / AUTHORITATIVE',
      desc: 'Heavy baritone resonance with commanding gravitas and stoic presence.',
    },
    {
      id: 'Puck',
      name: 'Puck (Agile Swift)',
      tag: 'RAPID / ENERGETIC',
      desc: 'High energy, witty verbal execution and agile sub-second response pacing.',
    },
  ];

  const handleToggleVault = (enabled: boolean) => {
    const updated = saveVaultConfig({ enabled });
    setVaultConfigState(updated);
    if (!enabled) {
      lockVault();
    }
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{4}$/.test(newPinInput)) {
      updatePin(newPinInput);
      setVaultConfigState(getVaultConfig());
      setPinChangeMsg('PIN updated successfully');
      setNewPinInput('');
      setTimeout(() => setPinChangeMsg(null), 3000);
    } else {
      setPinChangeMsg('PIN must be exactly 4 numeric digits');
      setTimeout(() => setPinChangeMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <Cpu className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-hud font-bold text-xs sm:text-sm text-cyan-100 tracking-wider">
                CORE DIAGNOSTICS & TELEMETRY
              </h2>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest">
                MAYA AI SUB-SYSTEM MATRIX
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

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 text-xs font-sans text-cyan-100 overflow-y-auto flex-1">
          {/* Telemetry Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/80 border border-cyan-900/60 rounded-xl p-3 glow-box-cyan">
              <div className="flex items-center justify-between text-cyan-500 mb-1">
                <span className="font-tech text-[10px]">CORE TEMP</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="font-mono text-base font-bold text-cyan-200">
                {systemStatus.coreTemp.toFixed(1)} &deg;C
              </div>
              <div className="w-full bg-cyan-950 rounded-full h-1 mt-2 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (systemStatus.coreTemp / 60) * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-cyan-900/60 rounded-xl p-3 glow-box-cyan">
              <div className="flex items-center justify-between text-cyan-500 mb-1">
                <span className="font-tech text-[10px]">NEURAL SYNC</span>
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              </div>
              <div className="font-mono text-base font-bold text-cyan-200">
                {systemStatus.neuralSync.toFixed(1)} %
              </div>
              <div className="w-full bg-cyan-950 rounded-full h-1 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${systemStatus.neuralSync}%` }}
                />
              </div>
            </div>
          </div>

          {/* Voice Persona Matrix & Audio Frequency Synthesizer */}
          <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-cyan-800/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <div className="flex items-center justify-between border-b border-cyan-950 pb-2">
              <h4 className="font-hud font-bold text-cyan-300 text-xs tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                VOICE PERSONA MATRIX & FREQUENCY SYNTHESIZER
              </h4>
              <button
                onClick={onTestVoice}
                title="Test current voice frequency"
                className="px-2 py-1 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300 hover:border-cyan-300 active:scale-95 text-[10px] font-hud flex items-center gap-1"
              >
                <Play className="w-3 h-3 text-cyan-400" />
                <span>TEST FREQ</span>
              </button>
            </div>

            {/* Persona Selectors */}
            <div className="space-y-2">
              <label className="text-[10px] font-tech text-cyan-400 tracking-wider">
                SELECT QUANTUM VOICE PERSONA:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {personas.map((p) => {
                  const isSelected = voiceConfig.persona === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onVoiceConfigChange({ ...voiceConfig, persona: p.id })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-950 to-blue-950 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          : 'bg-slate-900/60 border-cyan-900/50 hover:border-cyan-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-hud font-bold text-xs text-cyan-100">{p.name}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-400">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-cyan-400/70 mt-1 leading-snug font-sans">
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frequency Modulation Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-black/40 p-2.5 rounded-lg border border-cyan-950">
                <div className="flex justify-between items-center text-[10px] font-mono text-cyan-300 mb-1">
                  <span>AUDIO PITCH</span>
                  <span>{voiceConfig.pitch.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.05"
                  value={voiceConfig.pitch}
                  onChange={(e) =>
                    onVoiceConfigChange({ ...voiceConfig, pitch: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="bg-black/40 p-2.5 rounded-lg border border-cyan-950">
                <div className="flex justify-between items-center text-[10px] font-mono text-cyan-300 mb-1">
                  <span>TEMPO / RATE</span>
                  <span>{voiceConfig.rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="1.30"
                  step="0.05"
                  value={voiceConfig.rate}
                  onChange={(e) =>
                    onVoiceConfigChange({ ...voiceConfig, rate: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Biometric Core Security Vault */}
          <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-cyan-800/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <h4 className="font-hud font-bold text-cyan-300 text-xs tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              BIOMETRIC CORE SECURITY VAULT
            </h4>

            <div className="flex items-center justify-between py-1 border-b border-cyan-950">
              <div>
                <p className="font-hud font-semibold text-cyan-200 text-xs">
                  Hardware Vault Protection
                </p>
                <p className="text-[10px] text-cyan-400/70 font-sans">
                  Requires Fingerprint / PIN gate to access Memory Matrix & Google Calendar
                </p>
              </div>
              <button
                onClick={() => handleToggleVault(!vaultConfig.enabled)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                  vaultConfig.enabled ? 'bg-cyan-500' : 'bg-cyan-950 border border-cyan-800'
                }`}
              >
                <div
                  className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    vaultConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {vaultConfig.enabled && (
              <div className="pt-1 space-y-2">
                <form onSubmit={handleSavePin} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="password"
                      maxLength={4}
                      value={newPinInput}
                      onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Change 4-Digit Security PIN (Default: 1234)"
                      className="w-full bg-black/60 border border-cyan-800/70 rounded-lg px-3 py-1.5 text-xs text-cyan-200 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={newPinInput.length !== 4}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-600 text-cyan-300 hover:border-cyan-400 active:scale-95 disabled:opacity-40 text-xs font-hud font-semibold"
                  >
                    UPDATE PIN
                  </button>
                </form>

                {pinChangeMsg && (
                  <p className="text-[11px] font-tech text-emerald-400">{pinChangeMsg}</p>
                )}
              </div>
            )}
          </div>

          {/* Engine Configurations */}
          <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-cyan-900/50">
            <h4 className="font-hud font-bold text-cyan-300 text-xs tracking-wider flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              VOICE ENGINE & INTERACTION MODES
            </h4>

            {/* Continuous Voice Mode Toggle */}
            <div className="flex items-center justify-between py-1 border-b border-cyan-950">
              <div>
                <p className="font-hud font-semibold text-cyan-200 text-xs">
                  Continuous Voice Dialogue
                </p>
                <p className="text-[10px] text-cyan-400/70 font-sans">
                  Resumes listening automatically when Maya finishes speaking
                </p>
              </div>
              <button
                onClick={() => onToggleContinuousVoice(!continuousVoice)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                  continuousVoice ? 'bg-cyan-500' : 'bg-cyan-950 border border-cyan-800'
                }`}
              >
                <div
                  className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    continuousVoice ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Gemini Studio TTS vs Native Browser Speech */}
            <div className="flex items-center justify-between py-1 border-b border-cyan-950">
              <div>
                <p className="font-hud font-semibold text-cyan-200 text-xs">
                  High-Fidelity Studio Voice
                </p>
                <p className="text-[10px] text-cyan-400/70 font-sans">
                  Uses Gemini 3.8 Flash Lite TTS (Fallback to Android speech synthesis)
                </p>
              </div>
              <button
                onClick={() => onToggleTTS(!useGeminiTTS)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                  useGeminiTTS ? 'bg-cyan-500' : 'bg-cyan-950 border border-cyan-800'
                }`}
              >
                <div
                  className={`bg-black w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    useGeminiTTS ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Language Selection */}
            <div className="py-1">
              <label className="font-hud font-semibold text-cyan-200 text-xs block mb-1.5">
                Primary Hologram Language Protocol:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'auto', label: 'Auto (EN / HI)' },
                  { id: 'en', label: 'English' },
                  { id: 'hi', label: 'Hindi (हिंदी)' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => onLanguageChange(opt.id as any)}
                    className={`py-1.5 px-2 rounded-lg border text-center font-hud text-xs font-semibold transition-all ${
                      language === opt.id
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-cyan-950/30 border-cyan-900/60 text-cyan-400/70 hover:border-cyan-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-950 bg-black/80 flex items-center justify-between text-[11px] font-tech text-cyan-500 shrink-0">
          <span>HOST: GOOGLE AI CLOUD // GEMINI 3.8</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all font-hud font-semibold"
          >
            CONFIRM & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
