import React, { useState } from 'react';
import { ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Question, Subject, Topic } from '../../types';
import { moveQuestionsToTopic } from '../../utils/practiceQuestions';

interface MoveToTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionIds: string[];
  currentSubject?: Subject | null;
  allSubjects: Subject[];
  allTopics: Topic[];
  allQuestions: Question[];
  onMoved: (updatedQuestions: Question[]) => void;
}

export const MoveToTopicModal: React.FC<MoveToTopicModalProps> = ({
  isOpen,
  onClose,
  questionIds,
  currentSubject,
  allSubjects,
  allTopics,
  allQuestions,
  onMoved,
}) => {
  const initialSubId = currentSubject?.id || allSubjects[0]?.id || '';
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubId);

  const availableTopics = allTopics.filter((t) => t.subjectId === selectedSubjectId);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(availableTopics[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubjectChange = (newSubId: string) => {
    setSelectedSubjectId(newSubId);
    const subTopics = allTopics.filter((t) => t.subjectId === newSubId);
    setSelectedTopicId(subTopics[0]?.id || '');
  };

  const handleMove = async () => {
    if (!selectedTopicId) {
      setErrorMsg('Please select a target topic.');
      return;
    }
    const targetTopic = allTopics.find((t) => t.id === selectedTopicId);
    const targetSub = allSubjects.find((s) => s.id === selectedSubjectId);
    if (!targetTopic) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await moveQuestionsToTopic(
        questionIds,
        targetTopic,
        targetSub,
        allQuestions
      );
      onMoved(updated);
      onClose();
    } catch (err: any) {
      console.error('MoveToTopic error:', err);
      setErrorMsg(err?.message || 'Failed to move questions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Questions to Another Topic"
      maxWidth="md"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600">
          Moving <span className="font-bold text-slate-900">{questionIds.length}</span> question{questionIds.length > 1 ? 's' : ''}.
          Their question IDs and test relationships will be preserved.
        </p>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
            >
              {allSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Topic</label>
            {availableTopics.length === 0 ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400">
                No topics found under this subject. Please create a topic first.
              </div>
            ) : (
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                {availableTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={!selectedTopicId || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-xs"
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            <span>Move Questions</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
