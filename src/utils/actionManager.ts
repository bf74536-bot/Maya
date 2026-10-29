import { AssistantReminder, AssistantTask, LanguageMode, PendingActionConfirmation, TaskPriority } from '../types';
import {
  getGoogleAccessToken,
  fetchUpcomingCalendarEvents,
  createGoogleCalendarEvent,
  CalendarEvent,
} from '../services/googleCalendar';

export const STORAGE_KEY_TASKS = 'maya_jarvis_tasks_v1';
export const STORAGE_KEY_REMINDERS = 'maya_jarvis_reminders_v1';

const DEFAULT_TASKS: AssistantTask[] = [
  {
    id: 'task-seed-1',
    title: 'Review Jarvis Subsystem Telemetry',
    priority: 'high',
    completed: false,
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'task-seed-2',
    title: 'Audit Neural Memory Matrix Records',
    priority: 'medium',
    completed: false,
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'task-seed-3',
    title: 'Calibrate Holographic Voice Frequency',
    priority: 'low',
    completed: true,
    createdAt: Date.now() - 86400000,
    completedAt: Date.now() - 43200000,
  },
];

/* =========================================================================
   TASK STORAGE & CRUD
   ========================================================================= */

export function getStoredTasks(): AssistantTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(DEFAULT_TASKS));
      return DEFAULT_TASKS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading tasks:', err);
    return [];
  }
}

export function saveStoredTasks(tasks: AssistantTask[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    return true;
  } catch (err) {
    console.error('Error saving tasks:', err);
    return false;
  }
}

export function addTask(
  title: string,
  priority: TaskPriority = 'medium',
  dueDate?: string,
  description?: string
): AssistantTask | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  const current = getStoredTasks();
  const newTask: AssistantTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: trimmedTitle,
    priority,
    dueDate,
    description,
    completed: false,
    createdAt: Date.now(),
  };

  const updated = [newTask, ...current];
  if (saveStoredTasks(updated)) {
    return newTask;
  }
  return null;
}

export function toggleTask(id: string): AssistantTask | null {
  const current = getStoredTasks();
  const idx = current.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const updatedTask: AssistantTask = {
    ...current[idx],
    completed: !current[idx].completed,
    completedAt: !current[idx].completed ? Date.now() : undefined,
  };

  current[idx] = updatedTask;
  saveStoredTasks(current);
  return updatedTask;
}

export function deleteTask(id: string): boolean {
  const current = getStoredTasks();
  const filtered = current.filter((t) => t.id !== id);
  return saveStoredTasks(filtered);
}

export function clearCompletedTasks(): number {
  const current = getStoredTasks();
  const pending = current.filter((t) => !t.completed);
  const clearedCount = current.length - pending.length;
  saveStoredTasks(pending);
  return clearedCount;
}

/* =========================================================================
   REMINDER STORAGE & SCHEDULING
   ========================================================================= */

export function getStoredReminders(): AssistantReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REMINDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading reminders:', err);
    return [];
  }
}

export function saveStoredReminders(reminders: AssistantReminder[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY_REMINDERS, JSON.stringify(reminders));
    return true;
  } catch (err) {
    console.error('Error saving reminders:', err);
    return false;
  }
}

export function addReminder(title: string, triggerAt: number): AssistantReminder | null {
  const trimmed = title.trim();
  if (!trimmed || triggerAt <= Date.now()) return null;

  const current = getStoredReminders();
  const newReminder: AssistantReminder = {
    id: `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: trimmed,
    triggerAt,
    triggered: false,
    dismissed: false,
    createdAt: Date.now(),
  };

  const updated = [newReminder, ...current];
  if (saveStoredReminders(updated)) {
    return newReminder;
  }
  return null;
}

export function dismissReminder(id: string): boolean {
  const current = getStoredReminders();
  const updated = current.map((r) => (r.id === id ? { ...r, dismissed: true } : r));
  return saveStoredReminders(updated);
}

export function deleteReminder(id: string): boolean {
  const current = getStoredReminders();
  const updated = current.filter((r) => r.id !== id);
  return saveStoredReminders(updated);
}

/**
 * Checks for due reminders and marks them triggered.
 */
export function checkDueReminders(): AssistantReminder[] {
  const now = Date.now();
  const current = getStoredReminders();
  const due: AssistantReminder[] = [];

  let changed = false;
  const updated = current.map((r) => {
    if (!r.triggered && !r.dismissed && r.triggerAt <= now) {
      due.push(r);
      changed = true;
      return { ...r, triggered: true };
    }
    return r;
  });

  if (changed) {
    saveStoredReminders(updated);
  }
  return due;
}

/* =========================================================================
   NOTIFICATION & AUDIO CHIME
   ========================================================================= */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return 'denied';
  }
}

export function playJarvisChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.2); // D6

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    // Ignore audio error
  }
}

export function triggerReminderAlert(reminder: AssistantReminder) {
  playJarvisChime();
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Maya AI // Operational Alert', {
        body: `Reminder: ${reminder.title}`,
        icon: '/favicon.ico',
      });
    } catch (e) {
      // ignore
    }
  }
}

/* =========================================================================
   ACTION INTENT PARSING & DETERMINISTIC EXECUTION
   ========================================================================= */

export interface ActionExecutionResult {
  handled: boolean;
  responseText?: string;
  needsConfirmation?: PendingActionConfirmation;
  actionType?: string;
  refreshedTasks?: boolean;
  refreshedReminders?: boolean;
}

/**
 * Parses user input for actionable assistant commands (tasks, reminders, calendar, queries)
 * and executes them with verified outcomes.
 */
export async function parseAndExecuteAction(
  prompt: string,
  language: LanguageMode,
  callbacks?: {
    onOpenTasksModal?: () => void;
    onOpenCalendarModal?: () => void;
  }
): Promise<ActionExecutionResult> {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // 1. GOOGLE CALENDAR QUERIES
  // Patterns: "what's on my calendar", "check my calendar", "list calendar events", "show calendar"
  const calendarQueryRegex = /^(?:maya\s*,?\s*)?(?:please\s*)?(?:what(?:'s|\s+is)\s+on\s+my\s+calendar|check\s+(?:my\s+)?calendar|list\s+(?:my\s+)?(?:calendar\s+)?events|show\s+(?:my\s+)?calendar|what\s+are\s+my\s+meetings|mere\s+calendar\s+mein\s+kya\s+hai)/i;
  if (calendarQueryRegex.test(lower)) {
    const token = await getGoogleAccessToken();
    if (!token) {
      callbacks?.onOpenCalendarModal?.();
      const resp =
        language === 'hi'
          ? 'कमांडर, गूगल कैलेंडर एक्सेस के लिए प्रमाणीकरण की आवश्यकता है। कृपया कैलेंडर मैट्रिक्स खोलें और Google से साइन इन करें।'
          : 'Commander, accessing your Google Calendar requires authorization. Please sign in with Google in the Calendar Matrix.';
      return { handled: true, responseText: resp, actionType: 'calendar_auth_needed' };
    }

    try {
      const events = await fetchUpcomingCalendarEvents(5);
      callbacks?.onOpenCalendarModal?.();

      if (events.length === 0) {
        const resp =
          language === 'hi'
            ? 'कमांडर, आपके Google कैलेंडर में वर्तमान में कोई आगामी कार्यक्रम निर्धारित नहीं हैं।'
            : 'Commander, you have no upcoming events scheduled on your Google Calendar.';
        return { handled: true, responseText: resp, actionType: 'calendar_list' };
      }

      const eventSummaries = events.map((ev, i) => {
        let timeStr = 'All day';
        if (ev.start.dateTime) {
          const d = new Date(ev.start.dateTime);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST';
        }
        return `${i + 1}. ${ev.summary} (${timeStr})`;
      }).join('; ');

      const resp =
        language === 'hi'
          ? `कमांडर, आपके आगामी Google कैलेंडर कार्यक्रम: ${eventSummaries}। विवरण स्क्रीन पर प्रदर्शित कर दिया गया है।`
          : `Commander, your upcoming Google Calendar schedule: ${eventSummaries}. Displayed on HUD.`;
      return { handled: true, responseText: resp, actionType: 'calendar_list' };
    } catch (err: any) {
      console.warn('Google Calendar fetch error:', err);
      const resp =
        language === 'hi'
          ? `गूगल कैलेंडर से कनेक्ट करने में त्रुटि: ${err.message}`
          : `Unable to access Google Calendar: ${err.message}`;
      return { handled: true, responseText: resp, actionType: 'calendar_error' };
    }
  }

  // 2. ADD / CREATE TASK
  // Patterns: "add task [x]", "create task [x]", "add to my tasks [x]", "add to todo [x]"
  const addTaskMatch = lower.match(/^(?:maya\s*,?\s*)?(?:please\s*)?(?:add\s+task|create\s+task|add\s+to\s+(?:my\s+)?tasks?|add\s+to\s+to-?do)\s+(.+)$/i);
  if (addTaskMatch && addTaskMatch[1]) {
    const rawTitle = addTaskMatch[1].trim();
    // Check if priority specified: e.g. "priority high"
    let priority: TaskPriority = 'medium';
    let cleanTitle = rawTitle;

    if (rawTitle.toLowerCase().includes('high priority') || rawTitle.toLowerCase().includes('priority high') || rawTitle.toLowerCase().includes('urgent')) {
      priority = 'high';
      cleanTitle = rawTitle.replace(/(?:high\s+priority|priority\s+high|urgent)/gi, '').trim();
    } else if (rawTitle.toLowerCase().includes('critical priority')) {
      priority = 'critical';
      cleanTitle = rawTitle.replace(/(?:critical\s+priority)/gi, '').trim();
    } else if (rawTitle.toLowerCase().includes('low priority')) {
      priority = 'low';
      cleanTitle = rawTitle.replace(/(?:low\s+priority)/gi, '').trim();
    }

    const created = addTask(cleanTitle, priority);
    if (created) {
      const resp =
        language === 'hi'
          ? `कार्य जोड़ दिया गया है: "${created.title}" [प्राथमिकता: ${created.priority.toUpperCase()}]। सिस्टम में सहेज लिया गया है, कमांडर।`
          : `Task logged: "${created.title}" [Priority: ${created.priority.toUpperCase()}]. Added to your operational matrix, Commander.`;
      return { handled: true, responseText: resp, actionType: 'create_task', refreshedTasks: true };
    }
  }

  // 3. LIST TASKS
  // Patterns: "list tasks", "show tasks", "what are my tasks", "show my to-do list", "kya tasks hain"
  const listTasksRegex = /^(?:maya\s*,?\s*)?(?:please\s*)?(?:list\s+(?:my\s+)?tasks?|show\s+(?:my\s+)?tasks?|what\s+are\s+my\s+(?:pending\s+)?tasks?|show\s+(?:my\s+)?to-?do\s*(?:list)?|mere\s+tasks?\s+dikhao)$/i;
  if (listTasksRegex.test(lower)) {
    const tasks = getStoredTasks();
    const pending = tasks.filter((t) => !t.completed);

    callbacks?.onOpenTasksModal?.();

    if (pending.length === 0) {
      const resp =
        language === 'hi'
          ? 'कमांडर, वर्तमान में कोई लंबित कार्य नहीं हैं। सभी ऑपरेशन पूरे हो चुके हैं।'
          : 'Commander, your task matrix is currently clear. No pending items.';
      return { handled: true, responseText: resp, actionType: 'list_tasks' };
    }

    const taskBulletList = pending
      .slice(0, 5)
      .map((t, idx) => `${idx + 1}. ${t.title} (${t.priority.toUpperCase()})`)
      .join(', ');

    const resp =
      language === 'hi'
        ? `कमांडर, आपके पास ${pending.length} लंबित कार्य हैं: ${taskBulletList}. मैंने कार्य सूची खोल दी है।`
        : `Commander, you have ${pending.length} pending tasks: ${taskBulletList}. Task matrix displayed.`;
    return { handled: true, responseText: resp, actionType: 'list_tasks' };
  }

  // 4. COMPLETE TASK
  // Patterns: "complete task [title]", "check off task [title]", "finish task [title]"
  const completeMatch = lower.match(/^(?:maya\s*,?\s*)?(?:please\s*)?(?:complete\s+task|check\s+off\s+task|finish\s+task|mark\s+task\s+done)\s+(.+)$/i);
  if (completeMatch && completeMatch[1]) {
    const searchStr = completeMatch[1].trim().toLowerCase();
    const tasks = getStoredTasks();
    const target = tasks.find(
      (t) => !t.completed && t.title.toLowerCase().includes(searchStr)
    );

    if (target) {
      toggleTask(target.id);
      const resp =
        language === 'hi'
          ? `कार्य पूर्ण चिह्नित किया गया: "${target.title}", कमांडर।`
          : `Task completed: "${target.title}", Commander.`;
      return { handled: true, responseText: resp, actionType: 'complete_task', refreshedTasks: true };
    } else {
      const resp =
        language === 'hi'
          ? `शीर्षक "${completeMatch[1]}" से मेल खाता कोई लंबित कार्य नहीं मिला, कमांडर।`
          : `No pending task matching "${completeMatch[1]}" was found in your matrix, Commander.`;
      return { handled: true, responseText: resp, actionType: 'complete_task' };
    }
  }

  // 5. REMINDERS
  // Patterns: "remind me to [x] in [n] minutes/hours", "set a reminder for [x] in [n] minutes"
  const reminderTimeMatch = lower.match(/^(?:maya\s*,?\s*)?(?:please\s*)?remind\s+me\s+to\s+(.+)\s+in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)$/i);
  if (reminderTimeMatch) {
    const reminderTitle = reminderTimeMatch[1].trim();
    const amount = parseInt(reminderTimeMatch[2], 10);
    const unit = reminderTimeMatch[3].toLowerCase();

    let ms = 60000;
    if (unit.startsWith('sec')) ms = 1000;
    else if (unit.startsWith('min')) ms = 60000;
    else if (unit.startsWith('hour') || unit.startsWith('hr')) ms = 3600000;

    const triggerAt = Date.now() + amount * ms;
    const created = addReminder(reminderTitle, triggerAt);

    if (created) {
      // Check notification permission
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        requestNotificationPermission().catch(() => {});
      }

      const resp =
        language === 'hi'
          ? `रिमाइंडर सेट हो गया है: "${reminderTitle}", ${amount} ${unit} बाद अलार्म सक्रिय होगा, कमांडर।`
          : `Reminder initiated: "${reminderTitle}" in ${amount} ${unit}. I will alert your HUD and sound the chime, Commander.`;
      return { handled: true, responseText: resp, actionType: 'create_reminder', refreshedReminders: true };
    }
  }

  // 6. CLEAR ALL COMPLETED TASKS
  const clearCompletedRegex = /^(?:maya\s*,?\s*)?(?:please\s*)?(?:clear\s+completed\s+tasks|purge\s+done\s+tasks)$/i;
  if (clearCompletedRegex.test(lower)) {
    const cleared = clearCompletedTasks();
    const resp =
      language === 'hi'
        ? `${cleared} पूर्ण किए गए कार्य हटा दिए गए हैं, कमांडर।`
        : `Purged ${cleared} completed tasks from your matrix, Commander.`;
    return { handled: true, responseText: resp, actionType: 'clear_tasks', refreshedTasks: true };
  }

  // 7. HONEST REPORTING FOR UNSUPPORTED EXTERNAL ACTIONS (Real Assistant Discipline)
  // Check if user is asking to send emails, order food, control physical lights, or buy items without integration:
  const unsupportedAction = checkUnsupportedIntegration(lower, language);
  if (unsupportedAction) {
    return { handled: true, responseText: unsupportedAction, actionType: 'unsupported_service' };
  }

  return { handled: false };
}

function checkUnsupportedIntegration(lower: string, language: LanguageMode): string | null {
  if (lower.startsWith('send an email to') || lower.startsWith('send email to')) {
    return language === 'hi'
      ? 'कमांडर, ईमेल प्रेषण के लिए वास्तविक Google Workspace OAuth क्रेडेंशियल की आवश्यकता है। कोई अमान्य सिम्युलेटेड ईमेल नहीं भेजा गया।'
      : 'Commander, direct email dispatch requires authorized Google Workspace OAuth credentials. To maintain integrity, no unverified email was dispatched.';
  }

  if (lower.includes('order a ride') || lower.includes('book an uber') || lower.includes('order from')) {
    return language === 'hi'
      ? 'कमांडर, राइड या वाणिज्यिक ऑर्डर के लिए तृतीय-पक्ष एपीआई और भुगतान गेटवे की आवश्यकता है, जो वर्तमान में सक्रिय नहीं है।'
      : 'Commander, ride-hailing and external commercial orders require authenticated third-party service APIs and payment credentials, which are currently unconfigured.';
  }

  if (lower.startsWith('turn on the lights') || lower.startsWith('turn off the lights')) {
    return language === 'hi'
      ? 'कमांडर, होम ऑटोमेशन आईओटी हब से कोई सक्रिय कनेक्शन नहीं मिला।'
      : 'Commander, IoT Smart Home Hub is not currently paired with this holographic terminal.';
  }

  return null;
}
