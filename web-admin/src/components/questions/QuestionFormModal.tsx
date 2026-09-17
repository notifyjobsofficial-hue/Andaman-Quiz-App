import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Question, Exam, Subject } from '../../types';
import { ImageUploader } from '../common/ImageUploader';
import { saveQuestion } from '../../firebase/firestore';

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  questionToEdit?: Question | null;
  onSaved: (q: Question) => void;
  exams: Exam[];
  subjects: Subject[];
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  isOpen,
  onClose,
  questionToEdit,
  onSaved,
  exams,
  subjects,
}) => {
  const [formData, setFormData] = useState<Partial<Question>>({
    question_text: '',
    option_a_text: '',
    option_b_text: '',
    option_c_text: '',
    option_d_text: '',
    correct_answer: 'A',
    explanation_text: '',
    exam: exams[0]?.code || 'ANCHSL',
    subject: subjects[0]?.name || 'General Awareness',
    topic: 'General',
    difficulty: 'Medium',
    positive_marks: 2.0,
    negative_marks: 0.5,
    language: 'both',
    status: 'published',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    if (questionToEdit) {
      setFormData(questionToEdit);
    } else {
      setFormData({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        question_text: '',
        option_a_text: '',
        option_b_text: '',
        option_c_text: '',
        option_d_text: '',
        correct_answer: 'A',
        explanation_text: '',
        exam: exams[0]?.code || 'ANCHSL',
        subject: subjects[0]?.name || 'General Awareness',
        topic: 'General',
        difficulty: 'Medium',
        positive_marks: 2.0,
        negative_marks: 0.5,
        language: 'both',
        status: 'published',
      });
    }
  }, [questionToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.question_text?.trim() && !formData.question_image_url?.trim()) {
      setFormError('Please provide either Question Text or a Question Image.');
      return;
    }

    try {
      setIsSaving(true);
      const q: Question = {
        id: formData.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        question_text: formData.question_text || '',
        question_image_url: formData.question_image_url || undefined,
        option_a_text: formData.option_a_text || '',
        option_a_image_url: formData.option_a_image_url || undefined,
        option_b_text: formData.option_b_text || '',
        option_b_image_url: formData.option_b_image_url || undefined,
        option_c_text: formData.option_c_text || '',
        option_c_image_url: formData.option_c_image_url || undefined,
        option_d_text: formData.option_d_text || '',
        option_d_image_url: formData.option_d_image_url || undefined,
        correct_answer: formData.correct_answer || 'A',
        explanation_text: formData.explanation_text || '',
        explanation_image_url: formData.explanation_image_url || undefined,
        exam: formData.exam || 'ANCHSL',
        subject: formData.subject || 'General Awareness',
        topic: formData.topic || 'General',
        difficulty: formData.difficulty || 'Medium',
        positive_marks: Number(formData.positive_marks) || 2.0,
        negative_marks: Number(formData.negative_marks) || 0.5,
        language: formData.language || 'both',
        status: formData.status || 'published',
      };

      await saveQuestion(q);
      onSaved(q);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error saving question.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={questionToEdit ? 'Edit Question' : 'Add New Question'}
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        {/* Meta Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Exam</label>
            <select
              value={formData.exam}
              onChange={(e) => setFormData({ ...formData, exam: e.target.value })}
              className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-white"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.code}>{ex.name} ({ex.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-white"
            >
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.name}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
            <input
              type="text"
              value={formData.topic || ''}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g. Geography, Algebra"
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
              className="w-full text-xs font-semibold p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Question Text & Diagram */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">Question Content</label>
          <textarea
            rows={3}
            value={formData.question_text || ''}
            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
            placeholder="Type question text in English or Hindi (supports unicode & math)..."
            className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
          />
          <ImageUploader
            label="Question Diagram / Image"
            value={formData.question_image_url}
            onChange={(url) => setFormData({ ...formData, question_image_url: url })}
          />
        </div>

        {/* Options (A, B, C, D) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Options & Correct Answer</span>
            <span className="text-[11px] text-slate-500">Select radio button for the correct option</span>
          </div>

          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
            const textFieldKey = `option_${opt.toLowerCase()}_text` as keyof Question;
            const imgFieldKey = `option_${opt.toLowerCase()}_image_url` as keyof Question;
            const isCorrect = formData.correct_answer === opt;

            return (
              <div
                key={opt}
                className={`p-3.5 rounded-xl border transition ${
                  isCorrect ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={isCorrect}
                      onChange={() => setFormData({ ...formData, correct_answer: opt })}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {opt}
                    </span>
                  </label>

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={(formData[textFieldKey] as string) || ''}
                      onChange={(e) => setFormData({ ...formData, [textFieldKey]: e.target.value })}
                      placeholder={`Option ${opt} text`}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-brand-500"
                    />
                    <ImageUploader
                      label={`Option ${opt} Image`}
                      value={formData[imgFieldKey] as string}
                      onChange={(url) => setFormData({ ...formData, [imgFieldKey]: url })}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block text-xs font-bold text-slate-700">Detailed Solution / Explanation</label>
          <textarea
            rows={3}
            value={formData.explanation_text || ''}
            onChange={(e) => setFormData({ ...formData, explanation_text: e.target.value })}
            placeholder="Step-by-step solution, historical background, or formula..."
            className="w-full text-xs p-3 border border-slate-200 rounded-lg bg-white outline-none focus:border-brand-500"
          />
          <ImageUploader
            label="Explanation Diagram"
            value={formData.explanation_image_url}
            onChange={(url) => setFormData({ ...formData, explanation_image_url: url })}
          />
        </div>

        {/* Marks & Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Positive Marks (+)</label>
            <input
              type="number"
              step="0.25"
              value={formData.positive_marks}
              onChange={(e) => setFormData({ ...formData, positive_marks: parseFloat(e.target.value) })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Negative Marks (-)</label>
            <input
              type="number"
              step="0.25"
              value={formData.negative_marks}
              onChange={(e) => setFormData({ ...formData, negative_marks: parseFloat(e.target.value) })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Language</label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value as any })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="both">Both (Bilingual)</option>
              <option value="en">English Only</option>
              <option value="hi">Hindi Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition disabled:opacity-50"
          >
            {isSaving ? 'Saving to Firestore...' : questionToEdit ? 'Update Question' : 'Save to Question Bank'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
