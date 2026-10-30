/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AndroidFrame } from './components/AndroidFrame';
import { FuturisticHUDHeader } from './components/FuturisticHUDHeader';
import { HolographicCore } from './components/HolographicCore';
import { ConversationHUD } from './components/ConversationHUD';
import { VoiceHUDControls } from './components/VoiceHUDControls';
import { SystemDiagnosticsModal } from './components/SystemDiagnosticsModal';
import { APKExportModal } from './components/APKExportModal';
import { AudioTranscribeModal } from './components/AudioTranscribeModal';
import { MemoryMatrixModal } from './components/MemoryMatrixModal';
import { JarvisActionsModal } from './components/JarvisActionsModal';
import { HolographicVisionModal } from './components/HolographicVisionModal';
import { BiometricSecurityModal } from './components/BiometricSecurityModal';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useGeminiLive } from './hooks/useGeminiLive';
import {
  ChatMessage,
  LanguageMode,
  MayaState,
  SystemStatus,
  MemoryItem,
  PendingMemoryProposal,
  AssistantTask,
  AssistantReminder,
  VoiceConfig,
} from './types';
import { isClockQuery, getClockResponse } from './utils/clock';
import { getStoredMemories, addMemory, detectMemoryIntent } from './utils/memoryManager';
import { isVaultProtected, isSessionUnlocked } from './utils/securityVault';
import {
  getStoredTasks,
  getStoredReminders,
  checkDueReminders,
  triggerReminderAlert,
  parseAndExecuteAction,
} from './utils/actionManager';
import { fetchRuntimeConfig, getRuntimeApiKey, getRuntimeLiveModel, getApiHeaders } from './utils/runtimeConfig';
import { Brain, Check } from 'lucide-react';

const STORAGE_KEY_MESSAGES = 'maya_chat_history_v1';
const STORAGE_KEY_LANG = 'maya_lang_preference_v1';
const STORAGE_KEY_VOICE = 'maya_voice_config_v1';
const STORAGE_KEY_SEARCH = 'maya_search_grounding_v1';

export default function App() {
  // Chat History
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return [];
  });

  // Language Preference
  const [language, setLanguage] = useState<LanguageMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LANG);
      if (saved === 'en' || saved === 'hi' || saved === 'auto') return saved;
    } catch (e) {
      // ignore
    }
    return 'auto';
  });

  // Maya State Management
  const [state, setState] = useState<MayaState>('ready');
  const [activeView, setActiveView] = useState<'core' | 'chat'>('core');
  const [continuousVoice, setContinuousVoice] = useState(true);
  const [useGeminiTTS, setUseGeminiTTS] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Modals
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isAPKModalOpen, setIsAPKModalOpen] = useState(false);
  const [isTranscribeModalOpen, setIsTranscribeModalOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [actionsModalTab, setActionsModalTab] = useState<'tasks' | 'reminders' | 'calendar' | 'registry'>('tasks');
  const [isVisionModalOpen, setIsVisionModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityTargetAction, setSecurityTargetAction] = useState<(() => void) | null>(null);
  const [securityResourceName, setSecurityResourceName] = useState('RESTRICTED NEURAL VAULT');

  // Voice Persona Matrix & Synthesizer Config
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOICE);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return { persona: 'Zephyr', pitch: 1.0, rate: 1.05 };
  });

  // Real-Time Google Search Web Grounding
  const [useSearchGrounding, setUseSearchGrounding] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_SEARCH) === 'true';
    } catch (e) {
      // ignore
    }
    return false;
  });
  const useSearchGroundingRef = useRef(useSearchGrounding);
  useSearchGroundingRef.current = useSearchGrounding;

  // Runtime Gemini Configuration (Loaded from /api/config for Render & local environments)
  const [runtimeConfig, setRuntimeConfig] = useState<{ apiKey: string; liveModel: string }>({
    apiKey: '',
    liveModel: 'gemini-2.0-flash-exp',
  });

  useEffect(() => {
    fetchRuntimeConfig().then((cfg) => {
      setRuntimeConfig(cfg);
    });
  }, []);

  // Persistent Neural Memory Matrix
  const [memories, setMemories] = useState<MemoryItem[]>(() => getStoredMemories());
  const [pendingMemoryProposal, setPendingMemoryProposal] = useState<PendingMemoryProposal | null>(null);
  const memoriesRef = useRef(memories);
  memoriesRef.current = memories;

  // Real Jarvis Tasks & Reminders Matrix
  const [tasks, setTasks] = useState<AssistantTask[]>(() => getStoredTasks());
  const [reminders, setReminders] = useState<AssistantReminder[]>(() => getStoredReminders());

  // Processing & Debounce guard to prevent duplicate requests
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleAutoResumeListeningRef = useRef<(() => void) | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Live Telemetry status
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    coreTemp: 38.4,
    neuralSync: 99.8,
    quantumFrequencies: 4.8,
    batteryLevel: 92,
    isCharging: false,
    networkType: '5G NR',
    activeLanguage: language,
    audioEngine: 'native-tts',
    continuousVoice: true,
  });

  // Network connection monitor for DISCONNECTED state
  useEffect(() => {
    const handleOnline = () => {
      setPipelineError(null);
      setState('ready');
    };
    const handleOffline = () => {
      setPipelineError('Neural uplink offline. Network connection lost.');
      setState('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save history on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  // Save language preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, language);
    } catch (e) {
      // ignore
    }
  }, [language]);

  // Save voice configuration preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(voiceConfig));
    } catch (e) {
      // ignore
    }
  }, [voiceConfig]);

  // Save search grounding preference
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH, String(useSearchGrounding));
      useSearchGroundingRef.current = useSearchGrounding;
    } catch (e) {
      // ignore
    }
  }, [useSearchGrounding]);

  // Keep systemStatus telemetry counts synchronized
  useEffect(() => {
    setSystemStatus((prev) => ({
      ...prev,
      activeMemoriesCount: memories.length,
      activeTasksCount: tasks.filter((t) => !t.completed).length,
      pendingRemindersCount: reminders.filter((r) => !r.dismissed && r.triggerAt > Date.now()).length,
    }));
  }, [memories, tasks, reminders]);

  // Periodic Reminder Alert Monitor & Audio Chime
  useEffect(() => {
    const timer = setInterval(() => {
      const due = checkDueReminders();
      if (due.length > 0) {
        setReminders(getStoredReminders());
        due.forEach((rem) => {
          triggerReminderAlert(rem);
          const alertMsg =
            language === 'hi'
              ? `अलर्ट: आपका रिमाइंडर "${rem.title}" सक्रिय हो गया है, कमांडर।`
              : `Operational alert: your scheduled reminder "${rem.title}" is now due, Commander.`;

          const aiMsg: ChatMessage = {
            id: `msg-${Date.now()}-rem-alert`,
            role: 'model',
            text: alertMsg,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, aiMsg]);
        });
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [language]);

  // Real Device Telemetry: Battery & Network APIs
  useEffect(() => {
    let batteryInstance: any = null;
    const handleBatteryUpdate = () => {
      if (batteryInstance) {
        setSystemStatus((prev) => ({
          ...prev,
          batteryLevel: Math.round(batteryInstance.level * 100),
          isCharging: batteryInstance.charging,
        }));
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          batteryInstance = battery;
          handleBatteryUpdate();
          battery.addEventListener('levelchange', handleBatteryUpdate);
          battery.addEventListener('chargingchange', handleBatteryUpdate);
        })
        .catch(() => {});
    }

    // Network connection telemetry
    const updateNetworkInfo = () => {
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const conn = (navigator as any).connection;
        const effectiveType = conn?.effectiveType ? `${conn.effectiveType.toUpperCase()} NET` : 'ONLINE';
        setSystemStatus((prev) => ({
          ...prev,
          networkType: effectiveType,
        }));
      }
    };

    updateNetworkInfo();
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      (navigator as any).connection?.addEventListener('change', updateNetworkInfo);
    }

    const interval = setInterval(() => {
      setSystemStatus((prev) => ({
        ...prev,
        coreTemp: 38.0 + Math.random() * 0.9,
        neuralSync: 99.4 + Math.random() * 0.5,
      }));
    }, 5000);

    return () => {
      clearInterval(interval);
      if (batteryInstance) {
        batteryInstance.removeEventListener('levelchange', handleBatteryUpdate);
        batteryInstance.removeEventListener('chargingchange', handleBatteryUpdate);
      }
      if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        (navigator as any).connection?.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, []);

  // Prime/Unlock browser audio on any user interaction
  const unlockAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Speech Synthesis Hook
  const { isSpeaking, speak, cancelSpeech } = useSpeechSynthesis({
    language,
    useGeminiTTS,
    voiceConfig,
    onSpeechStart: () => {
      setState('speaking');
      setPipelineError(null);
    },
    onSpeechEnd: () => {
      // SPEAKING → LISTENING / READY transition after speaking completes
      if (continuousVoice && handleAutoResumeListeningRef.current) {
        setState('listening');
        setTimeout(() => {
          handleAutoResumeListeningRef.current?.();
        }, 400); // 400ms decay to prevent microphone feedback
      } else {
        setState('ready');
      }
    },
    onError: (err) => {
      console.warn('TTS playback failure:', err);
      setPipelineError(`Speech Output Notice: ${err}`);
      if (continuousVoice && handleAutoResumeListeningRef.current) {
        setState('listening');
        setTimeout(() => {
          handleAutoResumeListeningRef.current?.();
        }, 400);
      } else {
        setState('ready');
      }
    },
  });

  // Voice frequency testing for Voice Persona Matrix
  const handleTestVoice = useCallback(() => {
    speak(
      `Maya holographic audio frequency online. Persona: ${voiceConfig.persona}. Pitch ${voiceConfig.pitch.toFixed(2)}x, rate ${voiceConfig.rate.toFixed(2)}x. All neural audio sub-systems nominal.`,
      language
    );
  }, [voiceConfig, language, speak]);

  // Biometric Security Gate Action Handler
  const executeSecuredAction = useCallback((resourceName: string, action: () => void) => {
    if (isVaultProtected() && !isSessionUnlocked()) {
      setSecurityResourceName(resourceName);
      setSecurityTargetAction(() => action);
      setIsSecurityModalOpen(true);
    } else {
      action();
    }
  }, []);

  // Core handler: Send Message to AI backend & Auto-speak response
  const handleSendMessage = useCallback(async (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;

    // If already processing, cancel previous network request
    if (isProcessingRef.current && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isProcessingRef.current = true;
    setPipelineError(null);

    // Stop speaking immediately if currently talking
    cancelSpeech();

    // 1. REAL-TIME CLOCK CHECK: If user asks about current time or date, answer instantly using device system clock IST
    if (isClockQuery(prompt)) {
      const clockResponse = getClockResponse(prompt, language);
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };
      const aiClockMessage: ChatMessage = {
        id: `msg-${Date.now()}-clk`,
        role: 'model',
        text: clockResponse,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, aiClockMessage]);
      setState('speaking');
      isProcessingRef.current = false;
      await speak(clockResponse, language);
      return;
    }

    // 2. REAL JARVIS ACTIONS & TASK DISPATCH: Execute real tasks, reminders, and list queries locally
    const actionResult = await parseAndExecuteAction(prompt, language, {
      onOpenTasksModal: () => {
        setActionsModalTab('tasks');
        setIsActionsModalOpen(true);
      },
      onOpenCalendarModal: () => {
        executeSecuredAction('GOOGLE CALENDAR TIMELINE', () => {
          setActionsModalTab('calendar');
          setIsActionsModalOpen(true);
        });
      },
    });

    if (actionResult.handled && actionResult.responseText) {
      if (actionResult.refreshedTasks) {
        setTasks(getStoredTasks());
      }
      if (actionResult.refreshedReminders) {
        setReminders(getStoredReminders());
      }

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-u`,
        role: 'user',
        text: prompt,
        timestamp: Date.now(),
      };
      const aiActionMessage: ChatMessage = {
        id: `msg-${Date.now()}-action`,
        role: 'model',
        text: actionResult.responseText,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, aiActionMessage]);
      setState('speaking');
      isProcessingRef.current = false;
      await speak(actionResult.responseText, language);
      return;
    }

    // 3. EXPLICIT PERSISTENT MEMORY CHECK: Detect personal memory intents and trigger consent card
    const memoryProposal = detectMemoryIntent(prompt);
    if (memoryProposal) {
      setPendingMemoryProposal(memoryProposal);
    }

    // Transition state: LISTENING → THINKING (Immediate visible feedback)
    setState('thinking');

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };

    const aiMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const initialAiMessage: ChatMessage = {
      id: aiMessageId,
      role: 'model',
      text: '', // Start empty for streaming text chunks
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, initialAiMessage]);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

    try {
      const historyPayload = messagesRef.current.slice(-6).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      let accumulatedText = '';
      let streamSucceeded = false;

      // Attempt fast streaming via Server-Sent Events (SSE) with persistent memory matrix
      try {
        const streamResponse = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            message: prompt,
            history: historyPayload,
            language: language,
            memories: memoriesRef.current,
            useSearchGrounding: useSearchGroundingRef.current,
            apiKey: getRuntimeApiKey(),
          }),
          signal: controller.signal,
        });

        if (streamResponse.ok && streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data: ')) {
                const dataJson = trimmedLine.replace('data: ', '').trim();
                if (!dataJson) continue;
                try {
                  const parsed = JSON.parse(dataJson);
                  if (parsed.error) {
                    if (parsed.error === 'quota_exhausted') {
                      throw new Error('QUOTA_EXHAUSTED: ' + (parsed.message || 'Gemini model quota reached.'));
                    }
                    throw new Error(parsed.message || parsed.error);
                  }
                  if (parsed.chunk) {
                    accumulatedText += parsed.chunk;
                    streamSucceeded = true;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMessageId
                          ? { ...m, text: accumulatedText, grounded: useSearchGroundingRef.current }
                          : m
                      )
                    );
                  }
                  if (parsed.done && parsed.fullText) {
                    accumulatedText = parsed.fullText;
                    streamSucceeded = true;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === aiMessageId
                          ? { ...m, text: accumulatedText, grounded: useSearchGroundingRef.current }
                          : m
                      )
                    );
                  }
                } catch (e: any) {
                  if (e.message?.includes('QUOTA_EXHAUSTED')) throw e;
                }
              }
            }
          }
        }
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError') {
          throw streamErr;
        }
        if (streamErr.message?.includes('QUOTA_EXHAUSTED')) {
          throw streamErr;
        }
        console.warn('Streaming failed or incomplete, checking non-streaming fallback...');
      }

      // If streaming didn't produce a response, fallback to standard /api/chat
      if (!streamSucceeded || !accumulatedText.trim()) {
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            message: prompt,
            history: historyPayload,
            language: language,
            memories: memoriesRef.current,
            useSearchGrounding: useSearchGroundingRef.current,
            apiKey: getRuntimeApiKey(),
          }),
          signal: controller.signal,
        });

        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          if (fallbackRes.status === 429 || errData.error === 'quota_exhausted') {
            throw new Error('QUOTA_EXHAUSTED: Gemini API quota exceeded (429).');
          }
          throw new Error(errData.error || `AI server link failure (HTTP ${fallbackRes.status})`);
        }

        const data = await fallbackRes.json();
        accumulatedText = data.text?.trim() || '';
      }

      clearTimeout(timeoutId);

      if (!accumulatedText.trim()) {
        throw new Error('AI backend returned an empty neural response.');
      }

      // Ensure final text is updated in chat
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMessageId ? { ...m, text: accumulatedText } : m))
      );

      // Transition state: PROCESSING → SPEAKING
      setState('speaking');
      await speak(accumulatedText, language);
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error?.name === 'AbortError') {
        console.log('Request aborted by user action or timeout.');
        // Clean up empty message if aborted before any text
        setMessages((prev) =>
          prev.filter((m) => m.id !== aiMessageId || m.text.trim().length > 0)
        );
        setState('interrupted');
        setTimeout(() => {
          setState((s) => (s === 'interrupted' ? 'ready' : s));
        }, 1200);
        return;
      }

      const isQuota =
        error?.message?.includes('QUOTA_EXHAUSTED') ||
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isQuota) {
        console.warn('Gemini AI API Quota limit reached (429):', error?.message);
        const quotaNotice =
          'API Quota Exceeded (429). The Gemini free-tier daily quota limit has been reached. Please check your API plan or retry later.';
        setPipelineError(quotaNotice);
        setState('error');

        const quotaUserMsg =
          language === 'hi'
            ? 'कमांडर, जेमिनी एआई कोटा सीमा समाप्त हो गई है। कृपया कुछ समय बाद पुनः प्रयास करें।'
            : 'Commander, Gemini API quota is currently exhausted. Please retry shortly or check API plan settings.';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: quotaUserMsg }
              : m
          )
        );
        await speak(quotaUserMsg, language);
      } else {
        console.warn('Maya communication pipeline notice:', error?.message);
        const errMsg = error?.message || 'Neural connection disrupted. Please verify connection.';
        setPipelineError(`Backend Failure: ${errMsg}`);
        setState('error');

        const fallbackText =
          language === 'hi'
            ? 'क्षमा करें, तंत्रिका लिंक में समस्या आई है। कृपया पुनः प्रयास करें।'
            : 'Neural connection error encountered. Systems ready for retry.';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMessageId
              ? { ...m, text: fallbackText }
              : m
          )
        );
        await speak(fallbackText, language);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [cancelSpeech, language, speak]);

  // Memory Authorization Handlers (Consent-first persistence)
  const handleConfirmMemoryProposal = useCallback(async () => {
    if (!pendingMemoryProposal) return;
    const proposal = pendingMemoryProposal;
    const added = addMemory({
      category: proposal.category,
      key: proposal.key,
      value: proposal.value,
      source: 'voice_consent',
    });

    if (added) {
      const refreshed = getStoredMemories();
      setMemories(refreshed);
      setPendingMemoryProposal(null);

      const confirmMsg =
        language === 'hi'
          ? `पुष्टि हो गई। "${proposal.key}: ${proposal.value}" को आपकी न्यूरल मेमोरी में सुरक्षित रूप से सहेज लिया गया है, कमांडर।`
          : `Confirmed. Stored "${proposal.key}: ${proposal.value}" in your Neural Memory Matrix, Commander.`;

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-mem-ok`,
        role: 'model',
        text: confirmMsg,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setState('speaking');
      await speak(confirmMsg, language);
    }
  }, [pendingMemoryProposal, language, speak]);

  const handleDeclineMemoryProposal = useCallback(() => {
    setPendingMemoryProposal(null);
    const cancelMsg =
      language === 'hi'
        ? 'मेमोरी प्रस्ताव निरस्त कर दिया गया है। कोई जानकारी संग्रहीत नहीं की गई।'
        : 'Memory proposal declined. No information was recorded in your matrix.';

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now()}-mem-no`,
      role: 'model',
      text: cancelMsg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, aiMsg]);
  }, [language]);

  // Speech Recognition Hook
  const {
    isListening,
    interimTranscript,
    permissionError,
    audioLevel,
    startListening,
    stopListening,
    toggleListening,
  } = useSpeechRecognition({
    language,
    isSpeaking,
    continuousVoice,
    onFinalTranscript: (spokenText) => {
      handleSendMessage(spokenText);
    },
    onError: (err) => {
      setPipelineError(err);
      setState('error');
    },
  });

  // Wire auto-resume reference for standard voice mode
  useEffect(() => {
    handleAutoResumeListeningRef.current = () => {
      if (continuousVoice && !isSpeaking && !isProcessingRef.current) {
        startListening();
      }
    };
  }, [continuousVoice, isSpeaking, startListening]);

  // Synchronize state with listening status when not speaking/thinking
  useEffect(() => {
    if (isListening && state !== 'thinking' && state !== 'processing' && !isSpeaking) {
      setState('listening');
    } else if (!isListening && !isSpeaking && state === 'listening' && !isProcessingRef.current) {
      setState('ready');
    }
  }, [isListening, isSpeaking, state]);

  // Real-Time Gemini Live API Hook
  const {
    isConnected: isLiveConnected,
    isConnecting: isLiveConnecting,
    reconnectAttempt: liveReconnectAttempt,
    error: liveError,
    liveAudioLevel,
    connect: connectLive,
    disconnect: disconnectLive,
    stopAllAudioPlayback: stopLiveAudio,
  } = useGeminiLive({
    memories,
    voiceName: voiceConfig.persona,
    apiKey: runtimeConfig.apiKey || getRuntimeApiKey(),
    liveModel: runtimeConfig.liveModel || getRuntimeLiveModel(),
    onInterrupted: () => {
      setState('interrupted');
      setTimeout(() => setState('ready'), 1000);
    },
    onTextReceived: (text) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
          return [
            ...prev.slice(0, -1),
            { ...last, text: `${last.text} ${text}`.trim() },
          ];
        }
        return [
          ...prev,
          {
            id: `live-${Date.now()}`,
            role: 'model',
            text: text,
            timestamp: Date.now(),
          },
        ];
      });
    },
    onAudioActivity: (lvl) => {
      if (lvl > 0.1) {
        setState('speaking');
      } else {
        setState('listening');
      }
    },
  });

  // Sync state with Live API connection changes
  useEffect(() => {
    if (isLiveConnected) {
      setPipelineError(null);
      setState('listening');
    } else if (liveError) {
      setPipelineError(liveError);
      setState('error');
    }
  }, [isLiveConnected, liveError]);

  // Toggle Live API mode
  const handleToggleLive = useCallback(() => {
    unlockAudio();
    if (isLiveConnected) {
      disconnectLive();
      setState('ready');
    } else {
      cancelSpeech();
      stopListening();
      connectLive();
    }
  }, [cancelSpeech, connectLive, disconnectLive, isLiveConnected, stopListening, unlockAudio]);

  // Master Stop / Abort Button
  const handleStopAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    cancelSpeech();
    stopListening();
    if (isLiveConnected) {
      disconnectLive();
    }
    isProcessingRef.current = false;
    setState('interrupted');
    setTimeout(() => {
      setState((curr) => (curr === 'interrupted' ? 'ready' : curr));
    }, 1200);
    setPipelineError(null);
  }, [cancelSpeech, disconnectLive, isLiveConnected, stopListening]);

  // Clear Chat History
  const handleClearHistory = () => {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
    } catch (e) {
      // ignore
    }
  };

  const handleToggleMic = () => {
    unlockAudio();
    setPipelineError(null);
    // Instant user interruption: if Maya is speaking, interrupt immediately and switch to listening
    if (state === 'speaking') {
      cancelSpeech();
      setState('interrupted');
      setTimeout(() => {
        toggleListening();
      }, 150);
      return;
    }
    toggleListening();
  };

  const activeAudioLevel = isLiveConnected ? liveAudioLevel : audioLevel;
  const activeError = pipelineError || permissionError || liveError;

  return (
    <AndroidFrame>
      <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-black text-cyan-400 select-none">
        {/* Hologram Grid & Scanlines Backdrop */}
        <div className="absolute inset-0 bg-cyber-grid bg-scanlines opacity-90 pointer-events-none z-0" />

        {/* Ambient Radial Glow in background */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-cyan-950/20 rounded-full blur-[90px] pointer-events-none" />

        {/* Top Android & Jarvis HUD Header */}
        <FuturisticHUDHeader
          systemStatus={systemStatus}
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
          onOpenAPKModal={() => setIsAPKModalOpen(true)}
          onOpenVisionModal={() => setIsVisionModalOpen(true)}
          onOpenTranscribeModal={() => setIsTranscribeModalOpen(true)}
          onOpenMemoryModal={() =>
            executeSecuredAction('NEURAL MEMORY MATRIX VAULT', () => setIsMemoryModalOpen(true))
          }
          memoryCount={memories.length}
          onOpenActionsModal={() => setIsActionsModalOpen(true)}
          pendingTasksCount={tasks.filter((t) => !t.completed).length}
          isLiveConnected={isLiveConnected}
          isLiveConnecting={isLiveConnecting}
          onToggleLive={handleToggleLive}
          activeView={activeView}
          onToggleView={() => setActiveView(activeView === 'core' ? 'chat' : 'core')}
          unreadCount={messages.length}
        />

        {/* Active Pipeline Error Notice with Dismiss and Retry */}
        {activeError && (
          <div className="mx-4 mt-2 p-2.5 bg-red-950/90 border border-red-500 rounded-xl text-xs text-red-200 z-30 flex items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-fade-in">
            <span className="truncate pr-2 font-sans">{activeError}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUserMsg) {
                    setPipelineError(null);
                    handleSendMessage(lastUserMsg.text);
                  }
                }}
                className="px-2 py-0.5 rounded bg-amber-900 border border-amber-400 text-amber-100 font-hud font-bold text-[10px] hover:bg-amber-800 transition-colors"
              >
                RETRY
              </button>
              <button
                onClick={() => {
                  setPipelineError(null);
                  handleStopAll();
                }}
                className="px-2 py-0.5 rounded bg-red-900 border border-red-400 text-white font-hud font-bold text-[10px] hover:bg-red-800 transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area: Core View or Conversation HUD View */}
        <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden z-10 w-full min-h-0">
          {activeView === 'core' ? (
            <div className="w-full h-full flex flex-col justify-between py-2">
              {/* Central Holographic Core */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <HolographicCore
                  state={state}
                  audioLevel={activeAudioLevel}
                  onCoreTap={isLiveConnected ? handleToggleLive : handleToggleMic}
                  subText={
                    liveReconnectAttempt > 0
                      ? `LIVE LINK DROPPED // RECONNECTING (${liveReconnectAttempt}/3)...`
                      : isLiveConnected
                      ? 'REAL-TIME GEMINI-3.8-LIVE ACTIVE // SPEAK FREELY'
                      : interimTranscript
                      ? `CAPTURED: "${interimTranscript}"`
                      : activeError
                      ? activeError
                      : undefined
                  }
                  isLiveAPI={isLiveConnected}
                />
              </div>

              {/* Latest Assistant Spoken Snippet Bar in Core View */}
              {messages.length > 0 && (
                <div
                  onClick={() => setActiveView('chat')}
                  className="mx-4 mb-2 p-3 rounded-xl bg-slate-950/80 border border-cyan-800/60 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-md cursor-pointer hover:border-cyan-400/80 transition-all active:scale-98"
                >
                  <div className="flex items-center justify-between text-[10px] font-tech text-cyan-500 mb-1">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      LATEST TRANSMISSION
                    </span>
                    <span className="text-cyan-400 font-hud">VIEW FULL LOG &rarr;</span>
                  </div>
                  <p className="text-xs text-cyan-100 font-sans line-clamp-2 leading-relaxed">
                    {messages[messages.length - 1].text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <ConversationHUD
              messages={messages}
              onReplayAudio={(text) => speak(text, language)}
              onClearHistory={handleClearHistory}
              onQuickPromptSelect={handleSendMessage}
              isProcessing={state === 'processing'}
              isSpeaking={state === 'speaking'}
            />
          )}
        </main>

        {/* Interactive Neural Memory Consent HUD Card (Explicit User Approval Before Storing) */}
        {pendingMemoryProposal && (
          <div className="mx-4 mb-2 p-3 bg-gradient-to-r from-slate-950 via-cyan-950/90 to-slate-950 border border-cyan-400 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] z-30 animate-fade-in flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-cyan-200">
              <span className="flex items-center gap-1.5 font-hud font-bold">
                <Brain className="w-4 h-4 text-cyan-300 animate-pulse" />
                NEURAL MEMORY AUTHORIZATION
              </span>
              <span className="text-[10px] font-mono text-cyan-300 px-1.5 py-0.2 bg-cyan-900/60 border border-cyan-500/40 rounded uppercase">
                {pendingMemoryProposal.category}
              </span>
            </div>
            <p className="text-xs text-cyan-100 font-sans">
              Would you like Maya to persist this in your encrypted Neural Memory Matrix?
            </p>
            <div className="p-2 bg-slate-950/90 rounded border border-cyan-800/80 text-xs font-mono text-cyan-200 flex items-center justify-between">
              <span className="text-cyan-400">{pendingMemoryProposal.key}:</span>
              <span className="font-semibold text-cyan-100 truncate max-w-[210px]">
                "{pendingMemoryProposal.value}"
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-0.5">
              <button
                onClick={handleDeclineMemoryProposal}
                className="px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-hud transition-colors"
              >
                DECLINE & DISCARD
              </button>
              <button
                onClick={handleConfirmMemoryProposal}
                className="px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-hud font-semibold text-xs shadow-[0_0_10px_rgba(6,182,212,0.4)] flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>AUTHORIZE & PERSIST</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Voice & Text HUD Control Deck */}
        <VoiceHUDControls
          state={state}
          isListening={isListening || isLiveConnected}
          isSpeaking={isSpeaking}
          interimTranscript={interimTranscript}
          permissionError={activeError}
          onToggleListening={isLiveConnected ? handleToggleLive : handleToggleMic}
          onStopAll={handleStopAll}
          onSubmitText={handleSendMessage}
          useSearchGrounding={useSearchGrounding}
          onToggleSearchGrounding={setUseSearchGrounding}
        />

        {/* Modals */}
        <SystemDiagnosticsModal
          isOpen={isDiagnosticsOpen}
          onClose={() => setIsDiagnosticsOpen(false)}
          systemStatus={systemStatus}
          useGeminiTTS={useGeminiTTS}
          onToggleTTS={setUseGeminiTTS}
          continuousVoice={continuousVoice}
          onToggleContinuousVoice={setContinuousVoice}
          language={language}
          onLanguageChange={setLanguage}
          voiceConfig={voiceConfig}
          onVoiceConfigChange={setVoiceConfig}
          onTestVoice={handleTestVoice}
        />

        <APKExportModal
          isOpen={isAPKModalOpen}
          onClose={() => setIsAPKModalOpen(false)}
        />

        <AudioTranscribeModal
          isOpen={isTranscribeModalOpen}
          onClose={() => setIsTranscribeModalOpen(false)}
          language={language}
          onSendToChat={handleSendMessage}
        />

        <HolographicVisionModal
          isOpen={isVisionModalOpen}
          onClose={() => setIsVisionModalOpen(false)}
          onSendToChat={(userText, aiText) => {
            const userMsg: ChatMessage = {
              id: `msg-${Date.now()}-u`,
              role: 'user',
              text: userText,
              timestamp: Date.now(),
            };
            const aiMsg: ChatMessage = {
              id: `msg-${Date.now()}-vis`,
              role: 'model',
              text: aiText,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, userMsg, aiMsg]);
            setActiveView('chat');
          }}
          onSpeakText={(text) => speak(text, language)}
          memories={memories}
        />

        <BiometricSecurityModal
          isOpen={isSecurityModalOpen}
          onClose={() => {
            setIsSecurityModalOpen(false);
            setSecurityTargetAction(null);
          }}
          onSuccess={() => {
            setIsSecurityModalOpen(false);
            if (securityTargetAction) {
              securityTargetAction();
              setSecurityTargetAction(null);
            }
          }}
          resourceName={securityResourceName}
        />

        <MemoryMatrixModal
          isOpen={isMemoryModalOpen}
          onClose={() => setIsMemoryModalOpen(false)}
          memories={memories}
          onRefreshMemories={() => setMemories(getStoredMemories())}
        />

        <JarvisActionsModal
          isOpen={isActionsModalOpen}
          onClose={() => setIsActionsModalOpen(false)}
          tasks={tasks}
          reminders={reminders}
          initialTab={actionsModalTab}
          onRefresh={() => {
            setTasks(getStoredTasks());
            setReminders(getStoredReminders());
          }}
        />
      </div>
    </AndroidFrame>
  );
}
