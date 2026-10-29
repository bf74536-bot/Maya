import { MemoryCategory, MemoryItem, PendingMemoryProposal } from '../types';

export const STORAGE_KEY_PERSISTENT_MEMORY = 'maya_persistent_memory_v2';

const DEFAULT_MEMORIES: MemoryItem[] = [
  {
    id: 'mem-seed-1',
    category: 'profile',
    key: 'Preferred Title',
    value: 'Commander',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    confirmedByUser: true,
    source: 'manual_entry',
  },
  {
    id: 'mem-seed-2',
    category: 'preference',
    key: 'Voice Persona',
    value: 'Crisp, articulate Jarvis holographic tone with rapid brevity',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    confirmedByUser: true,
    source: 'manual_entry',
  },
  {
    id: 'mem-seed-3',
    category: 'work',
    key: 'Primary Directive',
    value: 'Personal AI Engineering and Operational Command',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    confirmedByUser: true,
    source: 'manual_entry',
  },
];

/**
 * Retrieves all stored persistent memories from localStorage.
 */
export function getStoredMemories(): MemoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PERSISTENT_MEMORY);
    if (!raw) {
      // Seed default memories on first initialization so the matrix is operational
      localStorage.setItem(STORAGE_KEY_PERSISTENT_MEMORY, JSON.stringify(DEFAULT_MEMORIES));
      return DEFAULT_MEMORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && item.id && item.key && item.value);
    }
    return [];
  } catch (err) {
    console.error('Error reading persistent memory matrix:', err);
    return [];
  }
}

/**
 * Persists updated memories list to localStorage.
 */
export function saveStoredMemories(memories: MemoryItem[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY_PERSISTENT_MEMORY, JSON.stringify(memories));
    return true;
  } catch (err) {
    console.error('Failed to write to persistent memory storage:', err);
    return false;
  }
}

/**
 * Adds an explicitly authorized memory to persistent storage.
 */
export function addMemory(
  item: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt' | 'confirmedByUser'>
): MemoryItem | null {
  try {
    const memories = getStoredMemories();
    const newMemory: MemoryItem = {
      ...item,
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      confirmedByUser: true,
    };
    const updated = [newMemory, ...memories];
    if (saveStoredMemories(updated)) {
      return newMemory;
    }
    return null;
  } catch (err) {
    console.error('Failed to add memory:', err);
    return null;
  }
}

/**
 * Updates an existing memory item.
 */
export function updateMemory(id: string, updates: Partial<Omit<MemoryItem, 'id' | 'createdAt'>>): boolean {
  try {
    const memories = getStoredMemories();
    const idx = memories.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    memories[idx] = {
      ...memories[idx],
      ...updates,
      updatedAt: Date.now(),
    };

    return saveStoredMemories(memories);
  } catch (err) {
    console.error('Failed to update memory:', err);
    return false;
  }
}

/**
 * Deletes a memory item by ID.
 */
export function deleteMemory(id: string): boolean {
  try {
    const memories = getStoredMemories();
    const filtered = memories.filter((m) => m.id !== id);
    return saveStoredMemories(filtered);
  } catch (err) {
    console.error('Failed to delete memory:', err);
    return false;
  }
}

/**
 * Clears all persistent memories.
 */
export function clearAllMemories(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY_PERSISTENT_MEMORY);
    return true;
  } catch (err) {
    console.error('Failed to clear memories:', err);
    return false;
  }
}

/**
 * Generates formatted JSON data for download/export.
 */
export function exportMemoriesJSON(): string {
  const memories = getStoredMemories();
  return JSON.stringify(
    {
      app: 'Maya AI v4.2 Holographic Core',
      format: 'Jarvis Neural Memory Matrix',
      exportedAt: new Date().toISOString(),
      count: memories.length,
      memories,
    },
    null,
    2
  );
}

/**
 * Validates and imports memories from JSON.
 */
export function importMemoriesJSON(jsonString: string): { success: boolean; importedCount: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    const rawList = Array.isArray(parsed) ? parsed : parsed.memories;
    if (!Array.isArray(rawList)) {
      return { success: false, importedCount: 0, error: 'Invalid JSON format: expected list of memories.' };
    }

    const validItems: MemoryItem[] = [];
    for (const item of rawList) {
      if (item && typeof item.key === 'string' && typeof item.value === 'string') {
        validItems.push({
          id: item.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          category: (item.category as MemoryCategory) || 'fact',
          key: item.key.trim(),
          value: item.value.trim(),
          createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
          updatedAt: Date.now(),
          confirmedByUser: true,
          source: item.source || 'manual_entry',
        });
      }
    }

    if (validItems.length === 0) {
      return { success: false, importedCount: 0, error: 'No valid memory records found.' };
    }

    // Merge with existing avoiding exact duplicate keys
    const current = getStoredMemories();
    const currentKeyMap = new Set(current.map((m) => `${m.category}:${m.key.toLowerCase()}`));
    const toAdd = validItems.filter((m) => !currentKeyMap.has(`${m.category}:${m.key.toLowerCase()}`));

    const merged = [...toAdd, ...current];
    saveStoredMemories(merged);
    return { success: true, importedCount: toAdd.length };
  } catch (err: any) {
    return { success: false, importedCount: 0, error: err.message || 'JSON parsing failed' };
  }
}

/**
 * Formats memories for AI system prompt context injection.
 */
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (!memories || memories.length === 0) return '';

  const lines = memories
    .filter((m) => m.confirmedByUser)
    .map((m) => `• [${m.category.toUpperCase()}] ${m.key}: "${m.value}"`);

  return `\n\n[PERSISTENT NEURAL MEMORY MATRIX - EXPLICITLY AUTHORIZED BY USER]:\nThe user has confirmed and authorized the following persistent memories across sessions. Seamlessly incorporate this knowledge when relevant, addressing the user appropriately:\n${lines.join(
    '\n'
  )}`;
}

/**
 * Heuristic detector for personal memory intents in user speech or text.
 * Triggers an explicit authorization proposal card rather than silently saving.
 */
export function detectMemoryIntent(text: string): PendingMemoryProposal | null {
  const trimmed = text.trim();
  if (trimmed.length < 5) return null;

  // Patterns for explicit memory requests
  // e.g., "Remember that my name is Tony" or "Remember that I like coffee"
  const rememberPrefixRegex = /^(?:maya\s*,?\s*)?(?:please\s*)?remember(?:\s+that|\s+this)?(?:\s*:\s*|\s+)(.+)$/i;
  const rememberMatch = trimmed.match(rememberPrefixRegex);

  if (rememberMatch && rememberMatch[1]) {
    const content = rememberMatch[1].trim();

    // Check for name: "my name is X" / "call me X"
    const nameMatch = content.match(/^(?:my\s+name\s+is|call\s+me)\s+(.+)$/i);
    if (nameMatch) {
      return {
        id: `prop-${Date.now()}`,
        category: 'profile',
        key: 'Name',
        value: cleanMemoryValue(nameMatch[1]),
        originalText: trimmed,
        timestamp: Date.now(),
      };
    }

    // Check for preference: "I prefer X" / "I like X" / "my favorite X is Y"
    const favMatch = content.match(/^my\s+favorite\s+([^is]+)\s+is\s+(.+)$/i);
    if (favMatch) {
      return {
        id: `prop-${Date.now()}`,
        category: 'preference',
        key: `Favorite ${cleanMemoryValue(favMatch[1])}`,
        value: cleanMemoryValue(favMatch[2]),
        originalText: trimmed,
        timestamp: Date.now(),
      };
    }

    const preferMatch = content.match(/^I\s+(?:prefer|like|love)\s+(.+)$/i);
    if (preferMatch) {
      return {
        id: `prop-${Date.now()}`,
        category: 'preference',
        key: 'User Preference',
        value: cleanMemoryValue(preferMatch[1]),
        originalText: trimmed,
        timestamp: Date.now(),
      };
    }

    // Check for work: "I work at / as X"
    const workMatch = content.match(/^I\s+(?:work\s+as|work\s+at|am\s+an?)\s+(.+)$/i);
    if (workMatch) {
      return {
        id: `prop-${Date.now()}`,
        category: 'work',
        key: 'Occupation / Role',
        value: cleanMemoryValue(workMatch[1]),
        originalText: trimmed,
        timestamp: Date.now(),
      };
    }

    // Generic fact memory
    return {
      id: `prop-${Date.now()}`,
      category: 'fact',
      key: 'Noted Fact',
      value: cleanMemoryValue(content),
      originalText: trimmed,
      timestamp: Date.now(),
    };
  }

  // Direct statement: "My name is [Name]"
  const directNameMatch = trimmed.match(/^(?:hi\s*,\s*|hello\s*,\s*)?my\s+name\s+is\s+([A-Za-z0-9\s'-]{2,30})$/i);
  if (directNameMatch) {
    return {
      id: `prop-${Date.now()}`,
      category: 'profile',
      key: 'Name',
      value: cleanMemoryValue(directNameMatch[1]),
      originalText: trimmed,
      timestamp: Date.now(),
    };
  }

  return null;
}

function cleanMemoryValue(val: string): string {
  return val
    .replace(/[.!?]+$/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
}
