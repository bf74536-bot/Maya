import React, { useEffect, useRef } from 'react';
import { Volume2, Copy, Check, Bot, User, Trash2, Globe } from 'lucide-react';
import { ChatMessage } from '../types';

interface ConversationHUDProps {
  messages: ChatMessage[];
  onReplayAudio: (text: string) => void;
  onClearHistory: () => void;
  onQuickPromptSelect: (prompt: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
}

export const ConversationHUD: React.FC<ConversationHUDProps> = ({
  messages,
  onReplayAudio,
  onClearHistory,
  onQuickPromptSelect,
  isProcessing,
  isSpeaking,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const samplePrompts = [
    'Maya, status briefing',
    'नमस्ते माया, आप क्या कर सकती हैं?',
    'Explain quantum computing in Hindi',
    'Calculate warp velocity to Mars',
  ];

  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-black/40 backdrop-blur-sm relative">
      {/* Header Bar for Chat with Clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyan-950/80 bg-slate-950/40 text-[11px] font-tech text-cyan-500">
        <span className="tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          HOLOGRAPHIC COMM LOG [{messages.length}]
        </span>
        {messages.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-cyan-600 hover:text-red-400 transition-colors px-2 py-0.5 rounded border border-transparent hover:border-red-900/50"
            title="Purge Communication Cache"
          >
            <Trash2 className="w-3 h-3" />
            <span>PURGE</span>
          </button>
        )}
      </div>

      {/* Message List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-full border border-cyan-400/50 bg-cyan-950/30 flex items-center justify-center glow-box-cyan">
              <Bot className="w-7 h-7 text-cyan-300" />
            </div>
            <div>
              <h3 className="font-hud font-bold text-sm text-cyan-200 tracking-wider">
                MAYA NEURAL LINK ESTABLISHED
              </h3>
              <p className="text-xs font-tech text-cyan-400/70 mt-1 max-w-xs">
                Jarvis-style Android voice intelligence online. Speak in English or Hindi, or select a protocol below.
              </p>
            </div>

            {/* Quick Starters */}
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs mt-2">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onQuickPromptSelect(prompt)}
                  className="text-left px-3 py-2 rounded border border-cyan-800/60 bg-cyan-950/20 text-cyan-300 text-xs font-hud hover:border-cyan-400 hover:bg-cyan-900/30 active:scale-98 transition-all flex items-center justify-between"
                >
                  <span className="truncate">{prompt}</span>
                  <span className="text-[10px] text-cyan-600 font-tech">RUN &rarr;</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-tech text-cyan-600">
                {msg.role === 'user' ? (
                  <>
                    <span>COMMANDER</span>
                    <User className="w-3 h-3 text-cyan-500" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-cyan-400" />
                    <span>MAYA AI</span>
                  </>
                )}
                <span>&bull;</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`relative max-w-[86%] rounded-xl p-3 text-sm font-sans tracking-wide leading-relaxed shadow-lg backdrop-blur-md ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-950/60 to-blue-950/80 border border-cyan-700/60 text-cyan-100 rounded-tr-none'
                    : 'bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-cyan-950/50 border border-cyan-400/50 text-cyan-50 rounded-tl-none glow-box-cyan'
                }`}
              >
                {msg.grounded && (
                  <div className="flex items-center gap-1 mb-1.5 px-1.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/50 text-[9px] font-mono text-cyan-300 w-fit">
                    <Globe className="w-2.5 h-2.5 text-cyan-400" />
                    <span>GROUNDED VIA GOOGLE SEARCH INTEL</span>
                  </div>
                )}
                {msg.text ? (
                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span className="text-xs font-tech text-cyan-300 tracking-wider">
                      Receiving neural transmission...
                    </span>
                  </div>
                )}

                {/* Actions for Assistant replies */}
                {msg.role === 'model' && msg.text.trim().length > 0 && (
                  <div className="mt-2 pt-2 border-t border-cyan-900/40 flex items-center justify-end gap-3 text-cyan-400">
                    <button
                      onClick={() => onReplayAudio(msg.text)}
                      title="Replay Voice Transmission"
                      className="p-1 hover:text-cyan-200 active:scale-90 transition-all flex items-center gap-1 text-[11px] font-tech"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>SPEAK</span>
                    </button>
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy to clipboard"
                      className="p-1 hover:text-cyan-200 active:scale-90 transition-all flex items-center gap-1 text-[11px] font-tech"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Neural Processing Indicator in chat stream */}
        {isProcessing && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-tech text-amber-500">
              <Bot className="w-3 h-3 text-amber-400" />
              <span>MAYA THINKING</span>
            </div>
            <div className="rounded-xl rounded-tl-none p-3 border border-amber-500/40 bg-amber-950/20 backdrop-blur-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs font-tech text-amber-300 tracking-wider">
                Synthesizing response through neural nexus...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
