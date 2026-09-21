import React, { useState } from 'react';
import { Plus, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Subject, Topic } from '../../types';
import { saveTopic } from '../../firebase/firestore';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  onTopicCreated: (topic: Topic) => void;
}

export const AddTopicModal: React.FC<AddTopicModalProps> = ({
  isOpen,
  onClose,
  subject,
  onTopicCreated,
}) => {
  const [topicName, setTopicName] = useState('');
  const [topicHindi, setTopicHindi] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicName.trim()) {
      setErrorMsg('Topic Name is required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const safeId = `top_${topicName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    const newTopic: Topic = {
      id: safeId,
      subjectId: subject.id,
      name: topicName.trim(),
      hindiName: topicHindi.trim(),
      questionCount: 0,
    };

    try {
      await saveTopic(newTopic);
      onTopicCreated(newTopic);
      setTopicName('');
      setTopicHindi('');
      onClose();
    } catch (err: any) {
      console.error('Failed to create topic:', err);
      setErrorMsg(err?.message || 'Failed to save topic.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Topic to ${subject.name}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Topic Name (English) *
          </label>
          <input
            type="text"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            placeholder="e.g. Percentage, Indus Valley Civilization"
            className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Topic Name (Hindi)
          </label>
          <input
            type="text"
            value={topicHindi}
            onChange={(e) => setTopicHindi(e.target.value)}
            placeholder="e.g. प्रतिशतता, सिंधु घाटी सभ्यता"
            className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !topicName.trim()}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <span>Create Topic</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
