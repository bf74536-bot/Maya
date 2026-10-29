/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  RefreshCw,
  Upload,
  Sparkles,
  Volume2,
  Copy,
  Check,
  Send,
  Eye,
  Scan,
  Maximize2,
  AlertCircle,
  FileImage,
} from 'lucide-react';
import { MemoryItem } from '../types';

interface HolographicVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat: (userText: string, aiText: string) => void;
  onSpeakText: (text: string) => void;
  memories?: MemoryItem[];
}

export const HolographicVisionModal: React.FC<HolographicVisionModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
  onSpeakText,
  memories,
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCameraStream = useCallback(async (facing: 'environment' | 'user') => {
    stopCameraStream();
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera sensor API not supported on this platform.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream activation error:', err);
      setError('Camera access denied or unavailable. You can upload an image file instead.');
      setIsCameraActive(false);
    }
  }, [stopCameraStream]);

  // Handle open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setAnalysisResult(null);
      setError(null);
      setPrompt('');
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, startCameraStream, stopCameraStream]);

  if (!isOpen) return null;

  const toggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCameraStream();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image format (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCameraStream();
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setError(null);
    startCameraStream(facingMode);
  };

  const triggerOpticalAnalysis = async (customDirective?: string) => {
    if (!capturedImage) {
      setError('Please capture an optical frame or upload an image first.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setAnalysisResult(null);

    const activePrompt = customDirective || prompt.trim() || 'Analyze this optical frame in detail with tactical HUD intelligence. Identify objects, visible text, spatial layout, and anomalies. Provide a concise, structured Jarvis-style briefing.';

    try {
      const res = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: capturedImage,
          mimeType: 'image/jpeg',
          prompt: activePrompt,
          memories: memories || [],
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || data.error || 'Failed to complete optical scan.');
      }

      setAnalysisResult(data.analysis);
    } catch (err: any) {
      setError(err?.message || 'Optical analysis link failure.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopy = () => {
    if (analysisResult) {
      navigator.clipboard.writeText(analysisResult);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  const handleInjectIntoChat = () => {
    if (analysisResult) {
      const query = prompt.trim() || 'Visual Optical Scan';
      onSendToChat(`[Optical Scan Analysis: "${query}"]`, analysisResult);
      onClose();
    }
  };

  const quickDirectives = [
    { label: 'Scene Recon', query: 'Analyze this optical frame in detail. Identify objects, spatial layout, condition, and notable observations.' },
    { label: 'Optical OCR', query: 'Extract and transcribe all visible text, signage, serial codes, or labels visible in this image verbatim.' },
    { label: 'Inspect Anomaly', query: 'Diagnose any defects, anomalies, warning indicators, or hardware issues visible in this frame.' },
    { label: 'Object Inventory', query: 'Provide a structured bullet-point tally and classification of all items visible.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg flex flex-col max-h-[92vh] bg-slate-950 border border-cyan-500/60 rounded-2xl shadow-[0_0_60px_rgba(6,182,212,0.4)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/90 via-slate-950 to-slate-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <Eye className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-hud font-bold text-xs sm:text-sm text-cyan-100 tracking-wider">
                MULTIMODAL VISUAL SCANNER
              </h2>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest">
                GEMINI 3.8 FLASH OPTICAL HUD MATRIX
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

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs font-sans text-cyan-100 flex-1">
          {/* Viewport Frame */}
          <div className="relative w-full aspect-video bg-black rounded-xl border border-cyan-700/60 overflow-hidden flex items-center justify-center shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]">
            {capturedImage ? (
              <img
                src={capturedImage}
                alt="Captured Target"
                className="w-full h-full object-contain"
              />
            ) : isCameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-cyan-400/70">
                <Camera className="w-10 h-10 mb-2 opacity-50 text-cyan-400" />
                <p className="text-xs font-hud">OPTICAL SENSOR OFFLINE</p>
                <p className="text-[10px] font-tech text-cyan-500 mt-1">
                  Upload an image or permit camera access
                </p>
              </div>
            )}

            {/* Futuristic Targeting Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
              {/* Corner brackets */}
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              </div>

              {/* Center Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border border-cyan-400/40 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                </div>
              </div>

              {/* Status bar */}
              <div className="flex justify-between items-end text-[9px] font-mono text-cyan-400 bg-black/50 px-2 py-0.5 rounded">
                <span>{capturedImage ? 'FRAME LOCKED' : isCameraActive ? 'LIVE STREAM' : 'STANDBY'}</span>
                <span>FOCAL: AUTO // 60FPS</span>
              </div>

              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>

            {/* Scanning Laser Line when analyzing */}
            {isScanning && (
              <div className="absolute inset-x-0 h-1 bg-cyan-300 shadow-[0_0_15px_#22d3ee] animate-pulse top-0 animate-[bounce_2s_infinite]" />
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!capturedImage ? (
              <div className="flex items-center gap-2 w-full justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" />
                    <span>UPLOAD</span>
                  </button>

                  <button
                    onClick={toggleCameraFacing}
                    title="Switch Camera Facing (Front / Back)"
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">{facingMode === 'environment' ? 'BACK' : 'FRONT'}</span>
                  </button>
                </div>

                <button
                  onClick={handleCaptureSnapshot}
                  disabled={!isCameraActive}
                  className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-sky-400 text-black font-hud font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>CAPTURE TARGET</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={handleRetake}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400 active:scale-95 transition-all text-xs font-hud flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>RETAKE / NEW IMAGE</span>
                </button>

                <button
                  onClick={() => triggerOpticalAnalysis()}
                  disabled={isScanning}
                  className="px-4 py-1.5 rounded-lg bg-cyan-400 text-black font-hud font-bold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'ANALYZING OPTICS...' : 'SCAN & ANALYZE'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Directive Chips */}
          {capturedImage && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-tech text-cyan-400 tracking-wider">
                TACTICAL DIRECTIVE TEMPLATES:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quickDirectives.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(d.query);
                      triggerOpticalAnalysis(d.query);
                    }}
                    disabled={isScanning}
                    className="px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400 text-[11px] font-hud active:scale-95 transition-all disabled:opacity-50"
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Prompt Input */}
          {capturedImage && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask Maya about this image (e.g., 'What is this error code?')..."
                className="flex-1 bg-slate-900 border border-cyan-800/70 rounded-xl px-3.5 py-2 text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 font-sans"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') triggerOpticalAnalysis();
                }}
              />
              <button
                onClick={() => triggerOpticalAnalysis()}
                disabled={isScanning}
                className="p-2 rounded-xl bg-cyan-500 text-black font-bold disabled:opacity-40 hover:bg-cyan-400 active:scale-95 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Analysis Result Display */}
          {analysisResult && (
            <div className="space-y-2 bg-slate-900/90 border border-cyan-500/50 rounded-xl p-3.5 animate-fade-in shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <div className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
                <span className="font-hud font-bold text-xs text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  HOLOGRAPHIC OPTICAL INTEL REPORT
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSpeakText(analysisResult)}
                    title="Speak Report"
                    className="p-1 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCopy}
                    title="Copy Report"
                    className="p-1 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-300 hover:border-cyan-400"
                  >
                    {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-xs font-sans text-cyan-100 whitespace-pre-wrap leading-relaxed">
                {analysisResult}
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleInjectIntoChat}
                  className="px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 hover:bg-cyan-500/30 text-[11px] font-hud font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Send className="w-3 h-3 text-cyan-300" />
                  <span>TRANSMIT TO CONVERSATION LOG</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-cyan-950 bg-black/80 flex items-center justify-between text-[10px] font-tech text-cyan-500 shrink-0">
          <span>GEMINI 3.8 FLASH VISION ENGINE</span>
          <button
            onClick={onClose}
            className="text-cyan-400/80 hover:text-cyan-300 font-mono underline"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
