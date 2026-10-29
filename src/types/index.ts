export type MayaState =
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error'
  | 'disconnected'
  | 'idle'
  | 'processing';

export type LanguageMode = 'en' | 'hi' | 'auto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  language?: 'en' | 'hi';
  grounded?: boolean;
}

export type VoicePersona = 'Zephyr' | 'Aoede' | 'Kore' | 'Fenrir' | 'Puck';

export interface VoiceConfig {
  persona: VoicePersona;
  pitch: number; // 0.6 - 1.4, default 1.0
  rate: number; // 0.6 - 1.4, default 1.05
}

export type MemoryCategory = 'profile' | 'preference' | 'fact' | 'work' | 'custom';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  confirmedByUser: boolean;
  source?: 'user_explicit' | 'voice_consent' | 'manual_entry';
}

export interface PendingMemoryProposal {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  originalText: string;
  timestamp: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AssistantTask {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: TaskPriority;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface AssistantReminder {
  id: string;
  title: string;
  triggerAt: number; // timestamp in ms
  triggered: boolean;
  dismissed: boolean;
  createdAt: number;
}

export interface PendingActionConfirmation {
  id: string;
  type: 'delete_task' | 'clear_tasks' | 'delete_reminder' | 'purge_all';
  title: string;
  description: string;
  targetId?: string;
  onConfirm: () => void;
}

export interface SystemStatus {
  coreTemp: number; // e.g. 38.4 °C
  neuralSync: number; // e.g. 99.8 %
  quantumFrequencies: number; // GHz
  batteryLevel: number; // 0 - 100
  isCharging: boolean;
  networkType: string;
  activeLanguage: LanguageMode;
  audioEngine: 'gemini-tts' | 'native-tts';
  continuousVoice: boolean;
  activeMemoriesCount?: number;
  activeTasksCount?: number;
  pendingRemindersCount?: number;
}


