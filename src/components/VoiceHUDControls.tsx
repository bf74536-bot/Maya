import React, { useState } from 'react';
import { Mic, MicOff, Send, Square, Keyboard, Sparkles, AlertTriangle, Globe } from 'lucide-react';
import { MayaState } from '../types';

interface VoiceHUDControlsProps {
  state: MayaState;
  isListening: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  permissionError: string | null;
  onToggleListening: () => void;
  onStopAll: () => void;
  onSubmitText: (text: string) => void;
  useSearchGrounding?: boolean;
  onToggleSearchGrounding?: (val: boolean) => void;
}

export const VoiceHUDControls: React.FC<VoiceHUDControlsProps> = ({
  state,
  isListening,
  isSpeaking,
  interimTranscript,
  permissionError,
  onToggleListening,
  onStopAll,
  onSubmitText,
  useSearchGrounding = false,
  onToggleSearchGrounding,
}) => {
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [inputText, setInputText] = useState('');

  const handleMicClick = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(25);
      } catch (e) {
        // ignore
      }
    }
    onToggleListening();
  };

  const handleStopClick = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([15, 30, 15]);
      } catch (e) {
        // ignore
      }
    }
    onStopAll();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSubmitText(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="w-full select-none flex flex-col items-center justify-end pb-3 pt-2 px-4 bg-gradient-to-t from-black via-slate-950/95 to-transparent z-20 shrink-0">
      {/* Live Interim Speech Transcription or Alert */}
      {interimTranscript && (
        <div className="w-full max-w-sm mb-3 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.3)] backdrop-blur-md flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping shrink-0" />
          <p className="text-xs font-hud text-cyan-200 tracking-wide truncate">
            &ldquo;{interimTranscript}&rdquo;
          </p>
        </div>
      )}

      {permissionError && (
        <div className="w-full max-w-sm mb-3 px-3 py-2 rounded-lg bg-red-950/70 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)] backdrop-blur-md flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs font-sans text-red-200 leading-tight">
            {permissionError}
          </p>
        </div>
      )}

      {/* Collapsible Text Input Bar */}
      {showKeyboard && (
        <form
          onSubmit={handleFormSubmit}
          className="w-full max-w-sm mb-3 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Transmit directive to Maya..."
              className="w-full bg-slate-900/90 border border-cyan-600/60 rounded-xl px-4 py-2.5 text-sm text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-sans backdrop-blur-md"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-cyan-500 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan-400 active:scale-95 transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Live Web Grounding Toggle Chip */}
      <div className="w-full max-w-sm mb-2.5 flex items-center justify-center">
        <button
          type="button"
          onClick={() => onToggleSearchGrounding?.(!useSearchGrounding)}
          title="Toggle Google Search Real-Time Web Intelligence"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-hud tracking-wider transition-all active:scale-95 ${
            useSearchGrounding
              ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
              : 'bg-slate-950/60 border-cyan-900/50 text-cyan-400/60 hover:border-cyan-700/60'
          }`}
        >
          <Globe className={`w-3 h-3 ${useSearchGrounding ? 'text-cyan-300 animate-spin' : 'text-cyan-600'}`} />
          <span>WEB INTEL: {useSearchGrounding ? 'ACTIVE // GROUNDED' : 'OFFLINE'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${useSearchGrounding ? 'bg-cyan-300 shadow-[0_0_6px_#22d3ee]' : 'bg-slate-600'}`} />
        </button>
      </div>

      {/* Main Control Deck */}
      <div className="w-full max-w-sm flex items-center justify-between px-4">
        {/* Keyboard Toggle */}
        <button
          onClick={() => setShowKeyboard(!showKeyboard)}
          title={showKeyboard ? 'Hide Keyboard' : 'Text Input Mode'}
          className={`p-3 rounded-full border transition-all active:scale-90 ${
            showKeyboard
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-400 hover:border-cyan-600'
          }`}
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Central Master Microphone Orb */}
        <div className="relative flex items-center justify-center">
          {/* Animated Acoustic Waves when listening */}
          {isListening && (
            <>
              <span className="absolute w-20 h-20 rounded-full border border-cyan-400/50 animate-ping opacity-60" />
              <span className="absolute w-24 h-24 rounded-full border border-cyan-300/30 animate-pulse" />
            </>
          )}

          <button
            onClick={handleMicClick}
            className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 z-10 ${
              isListening
                ? 'bg-gradient-to-tr from-cyan-400 to-sky-300 text-black shadow-[0_0_35px_#22d3ee]'
                : state === 'speaking'
                ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white shadow-[0_0_25px_#0284c7]'
                : 'bg-gradient-to-tr from-cyan-950 via-slate-900 to-cyan-900 text-cyan-300 border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:border-cyan-300'
            }`}
          >
            {isListening ? (
              <Mic className="w-7 h-7 animate-pulse" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
        </div>

        {/* Instant Stop / Abort Button */}
        <button
          onClick={handleStopClick}
          disabled={!isListening && !isSpeaking && state !== 'processing' && state !== 'thinking'}
          title="Abort Current Action & Silence Voice"
          className={`p-3 rounded-full border transition-all active:scale-90 ${
            isListening || isSpeaking || state === 'processing' || state === 'thinking'
              ? 'bg-red-950/60 border-red-500/80 text-red-300 hover:bg-red-900/60 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : 'bg-slate-950/40 border-slate-800/40 text-slate-600 opacity-40 cursor-not-allowed'
          }`}
        >
          <Square className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* Android Bottom Navigation Pill */}
      <div className="w-32 h-1 bg-cyan-950 rounded-full mt-4 border border-cyan-900/40" />
    </div>
  );
};
