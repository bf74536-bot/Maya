import React from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center overflow-hidden p-0 md:p-4 bg-cyber-grid bg-scanlines">
      {/* Outer Phone Mockup for Desktop / Tablet; Pure Fullscreen on Mobile */}
      <div className="relative w-full h-[100dvh] md:h-[90vh] md:max-h-[880px] md:max-w-[430px] md:rounded-[44px] md:border-4 md:border-cyan-900/60 md:shadow-[0_0_60px_rgba(6,182,212,0.3),0_20px_50px_rgba(0,0,0,0.9)] bg-black flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Android Punch-Hole Front Camera Notch (Rendered on Desktop Preview) */}
        <div className="hidden md:flex absolute top-3 left-1/2 -translate-x-1/2 z-40 items-center justify-center pointer-events-none">
          <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border border-cyan-800/80 shadow-[0_0_6px_rgba(6,182,212,0.4)] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-900/70" />
          </div>
        </div>

        {/* Futuristic Sci-Fi Edge Accents (Desktop frame only) */}
        <div className="hidden md:block absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400/40 rounded-tl-[40px] pointer-events-none z-40" />
        <div className="hidden md:block absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-[40px] pointer-events-none z-40" />
        <div className="hidden md:block absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/40 rounded-bl-[40px] pointer-events-none z-40" />
        <div className="hidden md:block absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400/40 rounded-br-[40px] pointer-events-none z-40" />

        {/* Android App Viewport Content */}
        <div className="relative w-full h-full flex flex-col overflow-hidden z-10 bg-black">
          {children}
        </div>
      </div>
    </div>
  );
};
