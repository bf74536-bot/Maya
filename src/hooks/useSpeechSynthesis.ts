import { useState, useRef, useEffect, useCallback } from 'react';
import { LanguageMode, VoiceConfig } from '../types';
import { getApiHeaders, getRuntimeApiKey } from '../utils/runtimeConfig';

interface UseSpeechSynthesisProps {
  language: LanguageMode;
  useGeminiTTS: boolean;
  voiceConfig?: VoiceConfig;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (err: string) => void;
}

export function useSpeechSynthesis({
  language,
  useGeminiTTS,
  voiceConfig,
  onSpeechStart,
  onSpeechEnd,
  onError,
}: UseSpeechSynthesisProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart;
    onSpeechEndRef.current = onSpeechEnd;
    onErrorRef.current = onError;
  }, [onSpeechStart, onSpeechEnd, onError]);

  // Load available browser voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          setAvailableVoices(voices);
        }
      } catch (e) {
        // ignore
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const cancelSpeech = useCallback(() => {
    // Stop server audio if playing
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {
        // ignore
      }
      audioRef.current = null;
    }

    // Stop browser synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        // ignore
      }
      currentUtteranceRef.current = null;
      (window as any).__mayaCurrentUtterance = null;
    }

    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      onSpeechEndRef.current?.();
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, [cancelSpeech]);

  const speakWithBrowser = useCallback(
    (text: string, lang: LanguageMode) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        const err = 'Speech Synthesis API not available on this browser.';
        onErrorRef.current?.(err);
        onSpeechEndRef.current?.();
        return;
      }

      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {
        // ignore
      }

      // Clean text for speech
      const cleanText = text
        .replace(/[*_#`~[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onSpeechEndRef.current?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      currentUtteranceRef.current = utterance;
      // Chrome/Android garbage-collection bug workaround
      (window as any).__mayaCurrentUtterance = utterance;

      // Select voice based on language
      const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
      const isHindiText = /[\u0900-\u097F]/.test(cleanText) || lang === 'hi';

      if (isHindiText) {
        utterance.lang = 'hi-IN';
        const hindiVoice = voices.find(
          (v) => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
        );
        if (hindiVoice) utterance.voice = hindiVoice;
      } else {
        utterance.lang = 'en-US';
        const englishVoice =
          voices.find(
            (v) =>
              v.lang.startsWith('en') &&
              (v.name.includes('Google') ||
                v.name.includes('Natural') ||
                v.name.includes('Jarvis') ||
                v.name.includes('Samantha') ||
                v.name.includes('Siri') ||
                v.name.includes('Neural'))
          ) || voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }

      utterance.pitch = voiceConfig?.pitch ?? 0.98;
      utterance.rate = voiceConfig?.rate ?? 1.05;

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        onSpeechStartRef.current?.();
      };

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        (window as any).__mayaCurrentUtterance = null;
        onSpeechEndRef.current?.();
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis event error:', e);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        (window as any).__mayaCurrentUtterance = null;
        onSpeechEndRef.current?.();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        console.warn('speechSynthesis.speak error:', err);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        onErrorRef.current?.(err?.message || 'Failed to initialize browser speech.');
        onSpeechEndRef.current?.();
      }
    },
    [availableVoices, voiceConfig]
  );

  const speak = useCallback(
    async (text: string, customLang?: LanguageMode) => {
      cancelSpeech();

      const activeLang = customLang || language;
      const cleanText = text
        .replace(/[*_#`~[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        onSpeechEndRef.current?.();
        return;
      }

      // Try server-side Gemini 3.8 Flash Lite TTS if enabled (with 3.5s timeout)
      if (useGeminiTTS) {
        try {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
          onSpeechStartRef.current?.();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              text: cleanText,
              language: activeLang,
              voiceName: voiceConfig?.persona || (activeLang === 'hi' ? 'Aoede' : 'Zephyr'),
              apiKey: getRuntimeApiKey(),
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data = await res.json();
          if (data.fallbackToBrowser || data.quotaExceeded) {
            speakWithBrowser(cleanText, activeLang);
            return;
          }

          if (data.audioBase64) {
            const audioUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              audioRef.current = null;
              onSpeechEndRef.current?.();
            };

            audio.onerror = () => {
              audioRef.current = null;
              speakWithBrowser(cleanText, activeLang);
            };

            // Attempt to play; if autoplay policy blocks audio element, fall back to browser speech
            try {
              await audio.play();
              return;
            } catch (playErr) {
              console.warn('Audio element play blocked by autoplay policy, falling back to Web Speech API:', playErr);
              audioRef.current = null;
              speakWithBrowser(cleanText, activeLang);
              return;
            }
          } else {
            throw new Error('No audio data received');
          }
        } catch (err: any) {
          // Fall back gracefully to browser Web Speech API
          console.log('Gemini TTS fallback triggered:', err?.message);
          speakWithBrowser(cleanText, activeLang);
          return;
        }
      }

      // Default to Browser Web Speech Synthesis
      speakWithBrowser(cleanText, activeLang);
    },
    [cancelSpeech, language, useGeminiTTS, speakWithBrowser]
  );

  return {
    isSpeaking,
    speak,
    cancelSpeech,
    availableVoices,
  };
}
