import { useState, useRef, useCallback, useEffect } from 'react';
import { VoicePersona } from '../types';
import { getRuntimeApiKey, getRuntimeLiveModel, fetchRuntimeConfig } from '../utils/runtimeConfig';

interface UseGeminiLiveProps {
  onInterrupted?: () => void;
  onTextReceived?: (text: string) => void;
  onAudioActivity?: (level: number) => void;
  memories?: any[];
  voiceName?: VoicePersona;
  apiKey?: string;
  liveModel?: string;
}

// Downsample audio buffer to 16kHz PCM
function downsampleTo16k(buffer: Float32Array, fromRate: number): Float32Array {
  if (fromRate === 16000) return buffer;
  const ratio = fromRate / 16000;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : buffer[offsetBuffer];
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export function useGeminiLive({
  onInterrupted,
  onTextReceived,
  onAudioActivity,
  memories,
  voiceName = 'Zephyr',
  apiKey,
  liveModel,
}: UseGeminiLiveProps) {
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;
  const voiceNameRef = useRef(voiceName);
  voiceNameRef.current = voiceName;
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  const liveModelRef = useRef(liveModel);
  liveModelRef.current = liveModel;
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Control flags for reconnection & quota
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectCountRef = useRef(0);
  const isQuotaExhaustedRef = useRef(false);

  // Float32 to 16-bit PCM Base64 converter
  const floatTo16BitPCMBase64 = (input: Float32Array): string => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Convert Base64 16-bit PCM to AudioBuffer at 24kHz
  const playPCMChunk = useCallback((base64Data: string) => {
    try {
      const binary = window.atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!outputAudioCtxRef.current) {
        outputAudioCtxRef.current = new AudioContextClass();
      }
      const ctx = outputAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const sampleCount = len / 2;
      const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      for (let i = 0; i < sampleCount; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        channelData[i] = int16 / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        const idx = activeSourcesRef.current.indexOf(source);
        if (idx !== -1) {
          activeSourcesRef.current.splice(idx, 1);
        }
      };

      setLiveAudioLevel(0.65 + Math.random() * 0.35);
      onAudioActivity?.(0.7);
    } catch (err) {
      console.warn('Error playing live audio chunk:', err);
    }
  }, [onAudioActivity]);

  const stopAllAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    setLiveAudioLevel(0);
  }, []);

  const disconnect = useCallback((manual = true) => {
    if (manual) {
      manualDisconnectRef.current = true;
      reconnectCountRef.current = 0;
      setReconnectAttempt(0);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // ignore
      }
      wsRef.current = null;
    }

    // Explicitly disconnect audio nodes to prevent memory and thread leaks
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (muteGainRef.current) {
      muteGainRef.current.disconnect();
      muteGainRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    stopAllAudioPlayback();
    setIsConnected(false);
    setIsConnecting(false);
  }, [stopAllAudioPlayback]);

  const connect = useCallback(async (isAutoReconnect = false) => {
    if (!isAutoReconnect) {
      manualDisconnectRef.current = false;
      reconnectCountRef.current = 0;
      setReconnectAttempt(0);
    }

    disconnect(false);
    setIsConnecting(true);
    setError(null);

    try {
      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams();
      if (memoriesRef.current && memoriesRef.current.length > 0) {
        params.set('memories', JSON.stringify(memoriesRef.current));
      }
      if (voiceNameRef.current) {
        params.set('voice', voiceNameRef.current);
      }

      // Ensure runtime API key and Live model are included
      let activeKey = apiKeyRef.current || getRuntimeApiKey();
      let activeModel = liveModelRef.current || getRuntimeLiveModel();
      if (!activeKey) {
        const config = await fetchRuntimeConfig();
        if (config.apiKey) activeKey = config.apiKey;
        if (config.liveModel) activeModel = config.liveModel;
      }
      if (activeKey) {
        params.set('key', activeKey);
      }
      if (activeModel) {
        params.set('model', activeModel);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const wsUrl = `${protocol}//${window.location.host}/live${queryString}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectCountRef.current = 0;
        setReconnectAttempt(0);

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const inputCtx = new AudioContextClass();
        inputAudioCtxRef.current = inputCtx;

        if (inputCtx.state === 'suspended') {
          inputCtx.resume().catch(() => {});
        }

        const source = inputCtx.createMediaStreamSource(stream);
        sourceNodeRef.current = source;

        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        source.connect(processor);

        // Mute gain node to prevent echo loopback into speakers
        const muteGain = inputCtx.createGain();
        muteGain.gain.value = 0;
        muteGainRef.current = muteGain;
        processor.connect(muteGain);
        muteGain.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const rawData = e.inputBuffer.getChannelData(0);

            // Calculate mic level
            let sum = 0;
            for (let i = 0; i < rawData.length; i++) {
              sum += rawData[i] * rawData[i];
            }
            const rms = Math.sqrt(sum / rawData.length);
            if (rms > 0.02) {
              setLiveAudioLevel(Math.min(1, rms * 5));
              onAudioActivity?.(Math.min(1, rms * 5));
            }

            // Downsample to 16kHz PCM
            const downsampledData = downsampleTo16k(rawData, inputCtx.sampleRate);
            const base64Audio = floatTo16BitPCMBase64(downsampledData);
            ws.send(JSON.stringify({ audio: base64Audio, mimeType: 'audio/pcm;rate=16000' }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.audio) {
            playPCMChunk(data.audio);
          }
          if (data.text) {
            onTextReceived?.(data.text);
          }
          if (data.interrupted) {
            stopAllAudioPlayback();
            onInterrupted?.();
          }
          if (data.error) {
            if (data.quotaExceeded || data.error?.includes('quota') || data.error?.includes('429')) {
              isQuotaExhaustedRef.current = true;
            }
            setError(data.error);
          }
        } catch (e) {
          console.error('Error handling live message:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('Gemini Live WebSocket error:', err);
        setError('Real-time Live connection encountered an error.');
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);

        // Bounded auto-reconnection if not manually disconnected and quota not exhausted
        if (!manualDisconnectRef.current && !isQuotaExhaustedRef.current && reconnectCountRef.current < 3) {
          reconnectCountRef.current += 1;
          const attempt = reconnectCountRef.current;
          setReconnectAttempt(attempt);
          const delay = Math.pow(2, attempt - 1) * 1000;
          setError(`Live connection dropped. Reconnecting (attempt ${attempt}/3)...`);
          reconnectTimerRef.current = setTimeout(() => {
            connect(true);
          }, delay);
        } else if (reconnectCountRef.current >= 3) {
          setError('Live connection lost. Maximum reconnection attempts reached.');
          setReconnectAttempt(0);
        }
      };
    } catch (err: any) {
      console.error('Failed to initiate Gemini Live session:', err);
      setError(err?.message || 'Could not access microphone or connect to Live API.');
      setIsConnecting(false);
    }
  }, [disconnect, onAudioActivity, onInterrupted, onTextReceived, playPCMChunk, stopAllAudioPlayback]);

  useEffect(() => {
    return () => {
      disconnect(true);
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempt,
    error,
    liveAudioLevel,
    connect,
    disconnect,
    stopAllAudioPlayback,
  };
}
