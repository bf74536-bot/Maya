import React, { useState, useRef } from 'react';
import {
  X,
  Brain,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Search,
  Check,
  Shield,
  AlertTriangle,
  FolderLock,
} from 'lucide-react';
import { MemoryCategory, MemoryItem } from '../types';
import {
  addMemory,
  updateMemory,
  deleteMemory,
  clearAllMemories,
  exportMemoriesJSON,
  importMemoriesJSON,
} from '../utils/memoryManager';

interface MemoryMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryItem[];
  onRefreshMemories: () => void;
}

const CATEGORIES: { id: MemoryCategory | 'all'; label: string; color: string }[] = [
  { id: 'all', label: 'ALL MATRIX', color: 'text-cyan-400 border-cyan-500/40' },
  { id: 'profile', label: 'PROFILE', color: 'text-blue-400 border-blue-500/40' },
  { id: 'preference', label: 'PREFERENCES', color: 'text-emerald-400 border-emerald-500/40' },
  { id: 'work', label: 'WORK & ROLES', color: 'text-amber-400 border-amber-500/40' },
  { id: 'fact', label: 'FACTS', color: 'text-purple-400 border-purple-500/40' },
  { id: 'custom', label: 'CUSTOM', color: 'text-pink-400 border-pink-500/40' },
];

export const MemoryMatrixModal: React.FC<MemoryMatrixModalProps> = ({
  isOpen,
  onClose,
  memories,
  onRefreshMemories,
}) => {
  const [activeFilter, setActiveFilter] = useState<MemoryCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for Add / Edit
  const [formCategory, setFormCategory] = useState<MemoryCategory>('fact');
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setFormCategory('fact');
    setFormKey('');
    setFormValue('');
    setIsAddingNew(true);
  };

  const handleStartEdit = (mem: MemoryItem) => {
    setIsAddingNew(false);
    setEditingId(mem.id);
    setFormCategory(mem.category);
    setFormKey(mem.key);
    setFormValue(mem.value);
  };

  const handleCancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setFormKey('');
    setFormValue('');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formValue.trim()) {
      showFeedback('Both key and description value are required.', 'error');
      return;
    }

    if (editingId) {
      const ok = updateMemory(editingId, {
        category: formCategory,
        key: formKey.trim(),
        value: formValue.trim(),
      });
      if (ok) {
        showFeedback('Memory record successfully updated.');
        onRefreshMemories();
        handleCancelForm();
      } else {
        showFeedback('Failed to update memory in neural storage.', 'error');
      }
    } else {
      const created = addMemory({
        category: formCategory,
        key: formKey.trim(),
        value: formValue.trim(),
        source: 'manual_entry',
      });
      if (created) {
        showFeedback('New memory record authorized and encrypted.');
        onRefreshMemories();
        handleCancelForm();
      } else {
        showFeedback('Failed to persist new memory.', 'error');
      }
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Permanently purge this memory record from Maya’s neural matrix?')) {
      const ok = deleteMemory(id);
      if (ok) {
        showFeedback('Memory record deleted from storage.');
        onRefreshMemories();
      }
    }
  };

  const handleExport = () => {
    const jsonStr = exportMemoriesJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maya_neural_memory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('Memory backup JSON exported successfully.');
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importMemoriesJSON(content);
        if (res.success) {
          showFeedback(`Imported ${res.importedCount} memory entries into Neural Matrix.`);
          onRefreshMemories();
        } else {
          showFeedback(`Import failed: ${res.error}`, 'error');
        }
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleClearAll = () => {
    if (confirmClearAll) {
      clearAllMemories();
      setConfirmClearAll(false);
      showFeedback('All persistent memories purged.', 'success');
      onRefreshMemories();
    } else {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 5000);
    }
  };

  // Filtered and searched memories
  const filteredMemories = memories.filter((mem) => {
    const matchesFilter = activeFilter === 'all' || mem.category === activeFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      mem.key.toLowerCase().includes(query) ||
      mem.value.toLowerCase().includes(query) ||
      mem.category.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const getCategoryBadge = (cat: MemoryCategory) => {
    switch (cat) {
      case 'profile':
        return <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-950/70 border border-blue-500/40 text-blue-300 font-mono">PROFILE</span>;
      case 'preference':
        return <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono">PREFERENCE</span>;
      case 'work':
        return <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/70 border border-amber-500/40 text-amber-300 font-mono">WORK</span>;
      case 'custom':
        return <span className="px-1.5 py-0.5 rounded text-[9px] bg-pink-950/70 border border-pink-500/40 text-pink-300 font-mono">CUSTOM</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-950/70 border border-purple-500/40 text-purple-300 font-mono">FACT</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-950 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.35)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-900/60 bg-gradient-to-r from-cyan-950/80 via-slate-950 to-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400 flex items-center justify-center glow-box-cyan">
              <Brain className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-hud font-bold text-sm text-cyan-100 tracking-wider">
                  NEURAL MEMORY MATRIX
                </h2>
                <span className="px-1.5 py-0.2 bg-cyan-900/50 border border-cyan-400 text-cyan-200 text-[10px] font-mono rounded">
                  {memories.length} RECORDS
                </span>
              </div>
              <p className="text-[10px] font-tech text-cyan-400/80 tracking-widest">
                EXPLICIT PERSISTENT MEMORY & PRIVACY VAULT
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

        {/* Privacy & Governance Notice Banner */}
        <div className="px-4 py-2 bg-cyan-950/40 border-b border-cyan-900/40 flex items-center justify-between gap-3 text-[11px] text-cyan-300">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Explicit consent architecture: Maya only stores memories you confirm. Saved locally in your browser.
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleExport}
              title="Download backup JSON"
              className="p-1 rounded bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-700 text-cyan-200 text-[10px] flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>EXPORT</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import backup JSON"
              className="p-1 rounded bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-700 text-cyan-200 text-[10px] flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              <span>IMPORT</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFileChange}
            />
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`px-4 py-1.5 text-xs flex items-center gap-2 ${
              feedbackMsg.type === 'error'
                ? 'bg-red-950/80 text-red-200 border-b border-red-800'
                : 'bg-emerald-950/80 text-emerald-200 border-b border-emerald-800'
            }`}
          >
            {feedbackMsg.type === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Toolbar: Search, Filters, Add Button */}
        <div className="p-3 border-b border-cyan-950/80 bg-slate-900/50 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-cyan-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search neural memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/90 border border-cyan-900/70 rounded-lg text-xs text-cyan-100 placeholder-cyan-600 focus:outline-none focus:border-cyan-400 font-sans"
            />
          </div>

          {/* New Memory Button */}
          {!isAddingNew && !editingId && (
            <button
              onClick={handleStartAdd}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-hud font-semibold text-xs rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.4)] active:scale-95 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>AUTHORIZE NEW MEMORY</span>
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-cyan-950/60 bg-slate-950/40 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`px-2.5 py-1 rounded text-[10px] font-tech tracking-wider border whitespace-nowrap transition-all ${
                activeFilter === cat.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/60 border-cyan-950 text-cyan-500 hover:border-cyan-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add / Edit Form Card */}
        {(isAddingNew || editingId) && (
          <form
            onSubmit={handleSaveForm}
            className="p-4 bg-cyan-950/30 border-b border-cyan-500/40 animate-fade-in space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-cyan-200 font-bold flex items-center gap-1.5">
                <FolderLock className="w-3.5 h-3.5 text-cyan-400" />
                {editingId ? 'EDIT AUTHORIZED MEMORY' : 'AUTHORIZE NEW PERSISTENT MEMORY'}
              </span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-[11px] text-cyan-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-tech text-cyan-400 mb-1">CATEGORY</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-800 rounded-lg text-cyan-100 text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="profile">Profile (Name, Title, Bio)</option>
                  <option value="preference">Preference (Tone, Habits)</option>
                  <option value="work">Work & Roles (Project, Directive)</option>
                  <option value="fact">Fact (Location, Knowledge)</option>
                  <option value="custom">Custom Record</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-tech text-cyan-400 mb-1">
                  KEY / SUBJECT (e.g. "Nickname", "Favorite Coffee", "Home City")
                </label>
                <input
                  type="text"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. Nickname"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-800 rounded-lg text-cyan-100 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-tech text-cyan-400 mb-1">
                VALUE / DETAIL TO REMEMBER
              </label>
              <textarea
                rows={2}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="e.g. Address me as Commander Tony, and keep answers concise."
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-800 rounded-lg text-cyan-100 text-xs focus:outline-none focus:border-cyan-400 font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 rounded border border-cyan-900/60 text-cyan-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-semibold text-xs flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.4)]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingId ? 'COMMIT CHANGES' : 'AUTHORIZE & STORE'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Memories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {filteredMemories.length === 0 ? (
            <div className="text-center py-10 px-4 border border-dashed border-cyan-900/50 rounded-xl bg-slate-950/30">
              <Brain className="w-10 h-10 text-cyan-700 mx-auto mb-2 opacity-50" />
              <p className="font-hud text-sm text-cyan-300">NO MATCHING MEMORIES</p>
              <p className="text-xs text-cyan-500/80 mt-1 max-w-sm mx-auto">
                Maya will never silently store your data. Click "AUTHORIZE NEW MEMORY" or tell Maya in conversation to remember something with explicit confirmation.
              </p>
            </div>
          ) : (
            filteredMemories.map((mem) => (
              <div
                key={mem.id}
                className="p-3 bg-slate-900/60 border border-cyan-900/60 hover:border-cyan-500/50 rounded-xl transition-all group flex flex-col sm:flex-row sm:items-start justify-between gap-2.5"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    {getCategoryBadge(mem.category)}
                    <span className="font-hud font-bold text-xs text-cyan-100 tracking-wide">
                      {mem.key}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-200/90 font-sans leading-relaxed">
                    {mem.value}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-cyan-600 font-mono pt-1">
                    <span>Authorized {new Date(mem.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="text-emerald-400/80">Consent Verified</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleStartEdit(mem)}
                    title="Edit Memory"
                    className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:text-white hover:border-cyan-400 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(mem.id)}
                    title="Purge Memory"
                    className="p-1.5 rounded-lg bg-red-950/40 border border-red-900 text-red-300 hover:text-white hover:border-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Status Controls */}
        <div className="p-3 border-t border-cyan-900/60 bg-slate-950/90 flex items-center justify-between text-xs">
          <span className="text-[11px] text-cyan-500 font-mono">
            {filteredMemories.length} OF {memories.length} ACTIVE NEURAL KEYS
          </span>

          <div className="flex items-center gap-2">
            {memories.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`px-2.5 py-1 rounded text-[11px] font-tech border transition-all ${
                  confirmClearAll
                    ? 'bg-red-600 text-white border-red-400 animate-pulse'
                    : 'bg-red-950/30 border-red-900/60 text-red-300 hover:border-red-500'
                }`}
              >
                {confirmClearAll ? 'CLICK TO CONFIRM PURGE ALL' : 'PURGE ALL'}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1 rounded bg-cyan-950 border border-cyan-700 text-cyan-200 hover:border-cyan-400 font-hud text-xs"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
