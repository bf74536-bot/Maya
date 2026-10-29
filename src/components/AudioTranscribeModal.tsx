import React, { useState } from 'react';
import { X, Mic, Square, Sparkles, Copy, Check, Send, AlertTriangle, FileAudio } from 'lucide-react';
import { useGeminiTranscribe } from '../hooks/useGeminiTranscribe';
import { LanguageMode } from '../types';

interface AudioTranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageMode;
  onSendToChat: (transcript: string) => void;
}

export const AudioTranscribeModal: React.FC<AudioTranscribeModalProps> = ({
  isOpen,
  onClose,
  language,
  onSendToChat,
}) => {
  const [copied, setCopied] = useState(false);

  const {
    isRecording,
    isTranscribing,
    transcript,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useGeminiTranscribe({
    language,
    onTranscriptComplete: () => {},
  });

  if (!isOpen) return null;

  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = () => {
    if (transcript) {
      onSendToChat(transcript);
      onClose();
    }
  };

  const handleClose = () => {
    if (isRecording) {
      cancelRecording();
    }
    onClose();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md flex flex-col bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <FileAudio className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-hud font-bold text-sm text-cyan-100 tracking-wider">
                AUDIO TRANSCRIBER
              </h2>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest">
                POWERED BY GEMINI-3.5-TRANSCRIBE
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border border-cyan-900/60 text-cyan-400 hover:text-white hover:border-cyan-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs font-sans text-cyan-100">
          {/* Explanation badge */}
          <div className="p-3 rounded-xl border border-cyan-800/60 bg-cyan-950/20 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-cyan-200/90 leading-relaxed">
              Record spoken audio in English or Hindi. Maya will process the audio using{' '}
              <strong className="text-cyan-300 font-mono">gemini-3.5-transcribe</strong> for high-fidelity verbatim transcription.
            </p>
          </div>

          {/* Recording Status & Waveform Area */}
          <div className="flex flex-col items-center justify-center py-5 px-4 bg-slate-900/50 rounded-2xl border border-cyan-900/50 relative overflow-hidden">
            {/* Ambient Background Wave */}
            {isRecording && (
              <div className="absolute inset-0 bg-cyan-500/10 animate-pulse pointer-events-none" />
            )}

            {/* Mic Recording Orb */}
            <div className="relative flex items-center justify-center mb-3">
              {isRecording && (
                <>
                  <span className="absolute w-20 h-20 rounded-full border border-cyan-400 animate-ping opacity-60" />
                  <span className="absolute w-24 h-24 rounded-full border border-cyan-300/40 animate-pulse" />
                </>
              )}

              <button
                onClick={isRecording ? () => stopRecording() : startRecording}
                disabled={isTranscribing}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 z-10 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-[0_0_30px_#ef4444]'
                    : isTranscribing
                    ? 'bg-amber-500/80 text-black shadow-[0_0_20px_#f59e0b]'
                    : 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-black shadow-[0_0_25px_#06b6d4] hover:brightness-110'
                }`}
              >
                {isRecording ? (
                  <Square className="w-6 h-6 fill-current" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>
            </div>

            {/* Status & Timer */}
            <div className="text-center z-10">
              <p className="font-hud font-bold text-sm tracking-wider text-cyan-200">
                {isRecording
                  ? `RECORDING: ${formatTime(recordingDuration)}`
                  : isTranscribing
                  ? 'TRANSCRIBING WITH GEMINI-3.5-TRANSCRIBE...'
                  : 'TAP MIC TO START RECORDING'}
              </p>
              <p className="text-[10px] font-tech text-cyan-500 mt-0.5">
                {isRecording
                  ? 'Tap red square when finished'
                  : isTranscribing
                  ? 'Running neural audio model...'
                  : 'Supports both English & Hindi speech'}
              </p>
            </div>

            {/* Simulated Live Audio Equalizer Wave during recording */}
            {isRecording && (
              <div className="flex items-center gap-1 mt-4">
                {[12, 24, 38, 50, 65, 45, 30, 60, 40, 20, 35, 55, 25, 15].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${Math.max(6, Math.sin((i + recordingDuration) * 0.8) * (h * 0.5) + 16)}px`,
                    }}
                    className="w-1 bg-cyan-400 rounded-full transition-all duration-150 animate-pulse shadow-[0_0_4px_#22d3ee]"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/60 text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Transcribed Result Display */}
          {transcript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-tech text-cyan-400">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  VERBATIM TRANSCRIPTION:
                </span>
                <span className="text-[10px] text-cyan-500">GEMINI-3.5-TRANSCRIBE</span>
              </div>

              <div className="bg-slate-900/90 border border-cyan-500/50 rounded-xl p-3.5 text-xs text-cyan-100 font-sans leading-relaxed max-h-40 overflow-y-auto select-text shadow-inner">
                {transcript}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSend}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-hud font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:brightness-110 active:scale-98 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  SEND TO MAYA AI
                </button>
                <button
                  onClick={handleCopy}
                  className="py-2 px-3 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-200 font-hud font-semibold text-xs flex items-center gap-1.5 hover:border-cyan-400 active:scale-98 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-950 bg-black/80 flex items-center justify-between text-[11px] font-tech text-cyan-500">
          <span>MODEL: GEMINI-3.5-TRANSCRIBE</span>
          <button
            onClick={handleClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all font-hud font-semibold"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
