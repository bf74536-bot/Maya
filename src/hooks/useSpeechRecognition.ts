import { useState, useEffect, useRef, useCallback } from 'react';
import { LanguageMode } from '../types';

interface UseSpeechRecognitionProps {
  language: LanguageMode;
  isSpeaking: boolean;
  continuousVoice: boolean;
  onFinalTranscript: (text: string) => void;
  onError?: (error: string) => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition({
  language,
  isSpeaking,
  continuousVoice,
  onFinalTranscript,
  onError,
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(isSpeaking);
  const continuousVoiceRef = useRef(continuousVoice);
  const manualStopRef = useRef(false);
  const hasFatalErrorRef = useRef(false);
  const isStartingRef = useRef(false);
  const micPermissionVerifiedRef = useRef(false);
  const lastTapTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<any>(null);
  const accumulatedTextRef = useRef<string>('');
  const hasDispatchedRef = useRef(false);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  const onErrorRef = useRef(onError);

  // Keep callback refs updated to avoid stale closures
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
    onErrorRef.current = onError;
  }, [onFinalTranscript, onError]);

  // Keep speaking ref updated; if speaking begins, abort recognition to avoid self-hearing
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (isSpeaking && recognitionRef.current && isListening) {
      clearTimeout(silenceTimerRef.current);
      accumulatedTextRef.current = '';
      hasDispatchedRef.current = true;
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
    }
  }, [isSpeaking, isListening]);

  useEffect(() => {
    continuousVoiceRef.current = continuousVoice;
  }, [continuousVoice]);

  // Audio wave fluctuation simulation while listening
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setAudioLevel(0.25 + Math.random() * 0.7);
      }, 100);
      return () => {
        clearInterval(interval);
        setAudioLevel(0);
      };
    } else {
      setAudioLevel(0);
    }
  }, [isListening]);

  // Safe dispatcher that guarantees speech is only sent once per utterance
  const dispatchTranscript = useCallback((text: string) => {
    clearTimeout(silenceTimerRef.current);
    const cleanText = text.trim();
    if (cleanText && !hasDispatchedRef.current && !isSpeakingRef.current) {
      hasDispatchedRef.current = true;
      accumulatedTextRef.current = '';
      setInterimTranscript('');
      console.log('Maya Speech Recognized:', cleanText);
      onFinalTranscriptRef.current(cleanText);
    }
  }, []);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      const msg = 'Speech Recognition API is not supported in this browser. Please use Chrome on Android.';
      setPermissionError(msg);
      onErrorRef.current?.(msg);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    // Use single-phrase recognition for reliable Android silence detection and isFinal emission
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Language mapping
    if (language === 'hi') {
      recognition.lang = 'hi-IN';
    } else if (language === 'en') {
      recognition.lang = 'en-US';
    } else {
      recognition.lang =
        typeof navigator !== 'undefined' && navigator.language?.startsWith('hi')
          ? 'hi-IN'
          : 'en-US';
    }

    recognition.onstart = () => {
      isStartingRef.current = false;
      setIsListening(true);
      setPermissionError(null);
      hasFatalErrorRef.current = false;
      manualStopRef.current = false;
      hasDispatchedRef.current = false;
      accumulatedTextRef.current = '';
      clearTimeout(silenceTimerRef.current);
    };

    recognition.onresult = (event: any) => {
      // Discard input if Maya is speaking to prevent self-transcription
      if (isSpeakingRef.current) {
        return;
      }

      let currentInterim = '';
      let isFinalResult = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const transcriptText = item[0]?.transcript || '';
        if (item.isFinal) {
          isFinalResult = true;
          accumulatedTextRef.current = transcriptText;
        } else {
          currentInterim += transcriptText;
        }
      }

      const activeText = accumulatedTextRef.current || currentInterim;

      if (activeText) {
        setInterimTranscript(activeText);
        accumulatedTextRef.current = activeText;
      }

      // If browser marked it final, dispatch immediately!
      if (isFinalResult && activeText.trim().length > 0) {
        dispatchTranscript(activeText);
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
        return;
      }

      // Silence debounce timer: If user pauses speaking for 1200ms, finalize and dispatch!
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (accumulatedTextRef.current.trim().length > 0 && !hasDispatchedRef.current) {
          dispatchTranscript(accumulatedTextRef.current);
          try {
            recognition.stop();
          } catch (e) {
            // ignore
          }
        }
      }, 1200);
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error event:', event.error);
      isStartingRef.current = false;
      clearTimeout(silenceTimerRef.current);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        hasFatalErrorRef.current = true;
        manualStopRef.current = true;
        const err = 'Microphone permission blocked. Please allow mic access in browser/system settings.';
        setPermissionError(err);
        onErrorRef.current?.(err);
        setIsListening(false);
      } else if (event.error === 'network') {
        hasFatalErrorRef.current = true;
        manualStopRef.current = true;
        const err = 'Speech recognition network service unreachable. Please check internet connection.';
        setPermissionError(err);
        onErrorRef.current?.(err);
        setIsListening(false);
      } else if (event.error === 'audio-capture') {
        hasFatalErrorRef.current = true;
        manualStopRef.current = true;
        const err = 'No microphone hardware found on this device.';
        setPermissionError(err);
        onErrorRef.current?.(err);
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // Natural silence timeout - no fatal error
      }
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setIsListening(false);
      clearTimeout(silenceTimerRef.current);

      // If there was speech spoken before onend and it wasn't dispatched yet, dispatch now!
      if (accumulatedTextRef.current.trim().length > 0 && !hasDispatchedRef.current) {
        dispatchTranscript(accumulatedTextRef.current);
      } else {
        setInterimTranscript('');
      }

      // If continuous voice mode is enabled, and no fatal error occurred, and Maya is NOT speaking, auto-restart!
      if (
        continuousVoiceRef.current &&
        !manualStopRef.current &&
        !isSpeakingRef.current &&
        !hasFatalErrorRef.current &&
        hasDispatchedRef.current // Only restart after speech has completed or if user is still in voice mode
      ) {
        // Auto-restart will be driven by Maya's speech completion in App.tsx
      } else if (
        continuousVoiceRef.current &&
        !manualStopRef.current &&
        !isSpeakingRef.current &&
        !hasFatalErrorRef.current &&
        !hasDispatchedRef.current
      ) {
        // Natural no-speech timeout restart after brief pause
        setTimeout(() => {
          if (
            continuousVoiceRef.current &&
            !manualStopRef.current &&
            !isSpeakingRef.current &&
            !hasFatalErrorRef.current &&
            recognitionRef.current &&
            !isStartingRef.current
          ) {
            try {
              isStartingRef.current = true;
              recognitionRef.current.start();
            } catch (err) {
              isStartingRef.current = false;
            }
          }
        }, 400);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, [language, dispatchTranscript]);

  const startListening = useCallback(async () => {
    // Avoid double-start if already starting or active
    if (isStartingRef.current || (recognitionRef.current && isListening)) {
      return;
    }

    manualStopRef.current = false;
    hasFatalErrorRef.current = false;
    hasDispatchedRef.current = false;
    accumulatedTextRef.current = '';
    setPermissionError(null);
    clearTimeout(silenceTimerRef.current);

    // Verify microphone permission only once to avoid audio device locking
    if (!micPermissionVerifiedRef.current && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        micPermissionVerifiedRef.current = true;
      } catch (err) {
        const msg = 'Microphone permission blocked. Please allow mic in Android settings.';
        setPermissionError(msg);
        onErrorRef.current?.(msg);
        return;
      }
    }

    if (recognitionRef.current && !isStartingRef.current) {
      try {
        isStartingRef.current = true;
        recognitionRef.current.start();
      } catch (e: any) {
        isStartingRef.current = false;
        // InvalidStateError means already started
        if (e?.name !== 'InvalidStateError') {
          console.warn('SpeechRecognition start error:', e);
        }
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    isStartingRef.current = false;
    clearTimeout(silenceTimerRef.current);

    // If there is pending speech when user manually stops, dispatch it!
    if (accumulatedTextRef.current.trim().length > 0 && !hasDispatchedRef.current) {
      dispatchTranscript(accumulatedTextRef.current);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [dispatchTranscript]);

  const toggleListening = useCallback(() => {
    // Throttle rapid repeated button taps within 300ms
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      return;
    }
    lastTapTimeRef.current = now;

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    interimTranscript,
    isSupported,
    permissionError,
    audioLevel,
    startListening,
    stopListening,
    toggleListening,
  };
}
