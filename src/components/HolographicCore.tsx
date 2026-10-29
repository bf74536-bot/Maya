import React, { useEffect, useRef } from 'react';
import { MayaState } from '../types';

interface HolographicCoreProps {
  state: MayaState;
  audioLevel?: number; // 0.0 to 1.0
  onCoreTap?: () => void;
  subText?: string;
  isLiveAPI?: boolean;
}

export const HolographicCore: React.FC<HolographicCoreProps> = ({
  state,
  audioLevel = 0,
  onCoreTap,
  subText,
  isLiveAPI = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Dynamic Particle Simulation Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const dpr = window.devicePixelRatio || 1;
    const size = 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;

    // Initialize particles
    const particleCount = state === 'processing' ? 65 : 42;
    const particles = Array.from({ length: particleCount }, () => ({
      x: centerX + (Math.random() - 0.5) * 160,
      y: centerY + (Math.random() - 0.5) * 160,
      radius: Math.random() * 2 + 1,
      angle: Math.random() * Math.PI * 2,
      dist: 30 + Math.random() * 110,
      speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
      alpha: Math.random() * 0.6 + 0.2,
      hue: Math.random() > 0.3 ? 186 : 210, // cyan to sky blue
    }));

    let tick = 0;

    const render = () => {
      ctx.clearRect(0, 0, size, size);
      tick++;

      // Speed multipliers based on state
      let speedMult = 1;
      let coreDistTarget = 70;

      if (state === 'idle') {
        speedMult = 0.8;
      } else if (state === 'listening') {
        speedMult = 1.6 + audioLevel * 2.5;
        coreDistTarget = 60 + audioLevel * 50;
      } else if (state === 'processing') {
        speedMult = 4.2;
        coreDistTarget = 40 + Math.sin(tick * 0.1) * 20;
      } else if (state === 'speaking') {
        speedMult = 2.0;
        coreDistTarget = 75 + Math.sin(tick * 0.15) * 30;
      }

      // Draw particle web & motes
      particles.forEach((p, i) => {
        p.angle += p.speed * speedMult;
        // Ease towards target distance with subtle noise
        p.dist += (coreDistTarget - p.dist) * 0.02;

        const px = centerX + Math.cos(p.angle) * p.dist;
        const py = centerY + Math.sin(p.angle) * p.dist;

        // Draw particle
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${p.alpha})`;
        ctx.shadowColor = `hsl(${p.hue}, 95%, 60%)`;
        ctx.shadowBlur = state === 'speaking' || state === 'processing' ? 10 : 4;
        ctx.fill();

        // Connect nearby particles with subtle holographic strands
        if (i % 2 === 0) {
          const next = particles[(i + 1) % particles.length];
          const nx = centerX + Math.cos(next.angle) * next.dist;
          const ny = centerY + Math.sin(next.angle) * next.dist;
          const d = Math.hypot(px - nx, py - ny);
          if (d < 50) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(nx, ny);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 * (1 - d / 50)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state, audioLevel]);

  // Handle core tap with haptic feedback
  const handleTap = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (e) {
        // ignore
      }
    }
    onCoreTap?.();
  };

  // State text and styling
  const getStatusBadge = () => {
    if (isLiveAPI) {
      if (state === 'interrupted') {
        return {
          title: 'GEMINI LIVE HALTED',
          status: 'INTERRUPTED',
          color: 'text-orange-300 border-orange-500 bg-orange-950/40 shadow-orange-500/30',
          pulse: '',
        };
      }
      if (state === 'error') {
        return {
          title: 'GEMINI LIVE ALERT',
          status: 'ERROR',
          color: 'text-red-300 border-red-500 bg-red-950/50 shadow-red-500/30',
          pulse: 'animate-pulse',
        };
      }
      if (state === 'disconnected') {
        return {
          title: 'GEMINI LIVE OFFLINE',
          status: 'DISCONNECTED',
          color: 'text-slate-400 border-slate-700 bg-slate-950/50 shadow-slate-900/30',
          pulse: '',
        };
      }
      if (state === 'speaking') {
        return {
          title: 'GEMINI 3.8 LIVE AUDIO',
          status: 'SPEAKING',
          color: 'text-emerald-300 border-emerald-400 bg-emerald-950/40 shadow-emerald-500/30',
          pulse: 'animate-pulse',
        };
      }
      return {
        title: 'GEMINI 3.8 LIVE STREAM',
        status: state === 'listening' ? 'LISTENING' : 'READY',
        color: 'text-emerald-400 border-emerald-500 bg-emerald-950/30 shadow-emerald-500/20',
        pulse: state === 'listening' ? 'animate-pulse' : '',
      };
    }
    switch (state) {
      case 'listening':
        return {
          title: 'AUDIO SENSORS ACTIVE',
          status: 'LISTENING',
          color: 'text-cyan-300 border-cyan-400 bg-cyan-950/40 shadow-cyan-500/30',
          pulse: 'animate-pulse',
        };
      case 'thinking':
      case 'processing':
        return {
          title: 'NEURAL COPROCESSOR',
          status: 'THINKING',
          color: 'text-amber-300 border-amber-400 bg-amber-950/40 shadow-amber-500/30',
          pulse: 'animate-pulse',
        };
      case 'speaking':
        return {
          title: 'VOCAL EMITTER',
          status: 'SPEAKING',
          color: 'text-sky-300 border-sky-400 bg-sky-950/40 shadow-sky-500/30',
          pulse: 'animate-pulse',
        };
      case 'interrupted':
        return {
          title: 'PLAYBACK HALTED',
          status: 'INTERRUPTED',
          color: 'text-orange-300 border-orange-500 bg-orange-950/40 shadow-orange-500/30',
          pulse: '',
        };
      case 'error':
        return {
          title: 'DIAGNOSTIC ALERT',
          status: 'ERROR',
          color: 'text-red-300 border-red-500 bg-red-950/50 shadow-red-500/30',
          pulse: 'animate-pulse',
        };
      case 'disconnected':
        return {
          title: 'SYSTEM OFFLINE',
          status: 'DISCONNECTED',
          color: 'text-slate-400 border-slate-700 bg-slate-950/50 shadow-slate-900/30',
          pulse: '',
        };
      case 'ready':
      case 'idle':
      default:
        return {
          title: 'MAYA CORE ONLINE',
          status: 'READY',
          color: 'text-cyan-400 border-cyan-700/60 bg-cyan-950/30 shadow-cyan-900/20',
          pulse: '',
        };
    }
  };

  const badge = getStatusBadge();

  // Dynamic ring rotation speeds based on state
  const ring1Speed =
    state === 'thinking' || state === 'processing'
      ? 'duration-[2s]'
      : state === 'listening'
      ? 'duration-[6s]'
      : state === 'speaking'
      ? 'duration-[5s]'
      : 'duration-[22s]';

  const ring2Speed =
    state === 'thinking' || state === 'processing'
      ? 'duration-[1.5s]'
      : state === 'listening'
      ? 'duration-[4s]'
      : state === 'speaking'
      ? 'duration-[3.5s]'
      : 'duration-[16s]';

  const coreScale =
    state === 'speaking'
      ? 'scale-110 shadow-[0_0_70px_rgba(34,211,238,0.7)]'
      : state === 'listening'
      ? `scale-[${1.05 + audioLevel * 0.15}] shadow-[0_0_60px_rgba(6,182,212,0.65)]`
      : state === 'thinking' || state === 'processing'
      ? 'scale-105 shadow-[0_0_80px_rgba(245,158,11,0.55)]'
      : state === 'error'
      ? 'scale-100 shadow-[0_0_40px_rgba(239,68,68,0.5)]'
      : 'scale-100 shadow-[0_0_40px_rgba(6,182,212,0.35)]';

  return (
    <div className="relative flex flex-col items-center justify-center my-auto py-2 select-none">
      {/* Outer Glow Halo */}
      <div
        className={`absolute w-72 h-72 md:w-80 md:h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          state === 'thinking' || state === 'processing'
            ? 'bg-amber-500/20'
            : state === 'speaking'
            ? 'bg-sky-400/35'
            : state === 'listening'
            ? 'bg-cyan-400/30'
            : state === 'error'
            ? 'bg-red-600/20'
            : state === 'interrupted'
            ? 'bg-orange-500/20'
            : 'bg-cyan-950/25'
        }`}
      />

      {/* Main Interactive Core Container */}
      <div
        onClick={handleTap}
        className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center cursor-pointer group active:scale-95 transition-transform duration-150"
      >
        {/* Background Canvas Particles */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ width: '100%', height: '100%' }}
        />

        {/* SVG Holographic Rings & Tech Glyphs */}
        <svg
          viewBox="0 0 400 400"
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          <defs>
            <radialGradient id="reactorGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#22d3ee" stopOpacity="0.85" />
              <stop offset="65%" stopColor="#0284c7" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#083344" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* Outer Boundary Reticle Ring */}
          <circle
            cx="200"
            cy="200"
            r="185"
            fill="none"
            stroke="#083344"
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.6"
          />

          {/* Radar Sweep Arc when listening */}
          {state === 'listening' && (
            <g className="animate-spin duration-[4s]">
              <path
                d="M 200,200 L 200,25 A 175,175 0 0,1 323,76 Z"
                fill="url(#ringGrad)"
                opacity={0.12 + audioLevel * 0.15}
              />
            </g>
          )}

          {/* Outer Segmented Gear Ring (Clockwise) */}
          <g className={`transition-transform transform-gpu animate-spin ${ring1Speed}`}>
            <circle
              cx="200"
              cy="200"
              r="170"
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="80 20 40 20"
              opacity={state === 'processing' ? 0.9 : 0.65}
            />
            {/* Tech Nodes */}
            <circle cx="200" cy="30" r="3.5" fill="#22d3ee" />
            <circle cx="200" cy="370" r="3.5" fill="#22d3ee" />
            <circle cx="30" cy="200" r="3.5" fill="#22d3ee" />
            <circle cx="370" cy="200" r="3.5" fill="#22d3ee" />
          </g>

          {/* Middle Counter-Rotating Hologram Ring (Counter-Clockwise) */}
          <g
            className={`transition-transform transform-gpu animate-spin [animation-direction:reverse] ${ring2Speed}`}
          >
            <circle
              cx="200"
              cy="200"
              r="142"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="30 15 15 15 5 15"
              opacity="0.75"
            />
            {/* Degree Tick Brackets */}
            <line x1="200" y1="50" x2="200" y2="62" stroke="#22d3ee" strokeWidth="2" />
            <line x1="200" y1="338" x2="200" y2="350" stroke="#22d3ee" strokeWidth="2" />
            <line x1="50" y1="200" x2="62" y2="200" stroke="#22d3ee" strokeWidth="2" />
            <line x1="338" y1="200" x2="350" y2="200" stroke="#22d3ee" strokeWidth="2" />
          </g>

          {/* Inner Audio Reactive Frequency Ring */}
          <circle
            cx="200"
            cy="200"
            r={112 + (state === 'listening' || state === 'speaking' ? audioLevel * 18 : 0)}
            fill="none"
            stroke={state === 'processing' ? '#f59e0b' : '#22d3ee'}
            strokeWidth={state === 'speaking' || state === 'listening' ? '3' : '1.5'}
            strokeDasharray={state === 'speaking' ? '8 4' : '40 10'}
            className="transition-all duration-100"
            opacity="0.85"
          />

          {/* Triangular Arc Reactor Nodes */}
          <polygon
            points="200,98 206,108 194,108"
            fill="#22d3ee"
            className="opacity-90"
          />
          <polygon
            points="200,302 206,292 194,292"
            fill="#22d3ee"
            className="opacity-90"
          />
          <polygon
            points="98,200 108,194 108,206"
            fill="#22d3ee"
            className="opacity-90"
          />
          <polygon
            points="302,200 292,194 292,206"
            fill="#22d3ee"
            className="opacity-90"
          />
        </svg>

        {/* Central Core Element */}
        <div
          className={`relative z-20 w-32 h-32 md:w-36 md:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 border border-cyan-400/40 bg-gradient-to-b from-cyan-950/80 via-black to-slate-950/90 backdrop-blur-sm ${coreScale}`}
        >
          {/* Internal Glowing Orb */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
              state === 'processing'
                ? 'bg-amber-400 shadow-[0_0_40px_#f59e0b]'
                : state === 'speaking'
                ? 'bg-cyan-300 shadow-[0_0_45px_#22d3ee]'
                : state === 'listening'
                ? 'bg-cyan-400 shadow-[0_0_35px_#06b6d4]'
                : 'bg-cyan-500/70 shadow-[0_0_25px_#0891b2]'
            }`}
          >
            {/* White-Hot Plasma Center */}
            <div className="w-8 h-8 rounded-full bg-white shadow-[0_0_15px_#ffffff] animate-pulse" />
          </div>

          {/* Core Frequency Bars (Speaking/Listening Audio Equalizer) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {(state === 'speaking' || state === 'listening') && (
              <div className="flex items-center gap-1">
                {[4, 8, 14, 20, 14, 8, 4].map((height, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${Math.max(4, height * (0.4 + audioLevel * 1.6))}px`,
                    }}
                    className="w-1 bg-cyan-200 rounded-full transition-all duration-75 shadow-[0_0_6px_#22d3ee]"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Corner HUD Tactical Framing */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400/70 pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70 pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70 pointer-events-none" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70 pointer-events-none" />
      </div>

      {/* Holographic Status Badge Under Core */}
      <div className="mt-4 flex flex-col items-center z-20">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border shadow-lg backdrop-blur-md transition-all duration-300 ${badge.color}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'thinking' || state === 'processing'
                ? 'bg-amber-400 animate-ping'
                : state === 'listening'
                ? 'bg-cyan-400 animate-ping'
                : state === 'speaking'
                ? 'bg-sky-400 animate-ping'
                : state === 'interrupted'
                ? 'bg-orange-400'
                : state === 'error'
                ? 'bg-red-400 animate-pulse'
                : state === 'disconnected'
                ? 'bg-slate-500'
                : 'bg-cyan-400'
            }`}
          />
          <span className="font-hud tracking-widest text-xs font-bold">
            {badge.status}
          </span>
        </div>

        {/* Subtext info (e.g. Interim live voice transcript or tap prompt) */}
        <p className="mt-2 text-xs font-tech text-cyan-400/80 tracking-wider text-center max-w-[280px] truncate h-5">
          {subText ||
            (isLiveAPI
              ? 'SPEAK FREELY // GEMINI 3.8 LIVE STREAMING'
              : state === 'ready' || state === 'idle'
              ? 'TAP CORE OR HOLD MIC TO INITIATE'
              : state === 'interrupted'
              ? 'VOICE INTERRUPTED // READY FOR DIRECTIVE'
              : state === 'error'
              ? 'RECOVERABLE ERROR // TAP RETRY OR MIC'
              : state === 'disconnected'
              ? 'NETWORK DISCONNECTED // OFFLINE MODE'
              : 'NEURAL LINK ACTIVE')}
        </p>
      </div>
    </div>
  );
};
