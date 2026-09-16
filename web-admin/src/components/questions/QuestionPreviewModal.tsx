import React from 'react';
import { Modal } from '../common/Modal';
import { Question } from '../../types';
import { CheckCircle, Info, BookOpen } from 'lucide-react';
import { Badge } from '../common/Badge';

interface QuestionPreviewModalProps {
  question: Question | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({
  question,
  isOpen,
  onClose,
}) => {
  if (!question) return null;

  const options = [
    { label: 'A', text: question.option_a_text, image: question.option_a_image_url },
    { label: 'B', text: question.option_b_text, image: question.option_b_image_url },
    { label: 'C', text: question.option_c_text, image: question.option_c_image_url },
    { label: 'D', text: question.option_d_text, image: question.option_d_image_url },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Student CBT Exam Preview" maxWidth="2xl">
      <div className="space-y-6">
        {/* Meta Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="info">{question.exam}</Badge>
            <Badge variant="neutral">{question.subject}</Badge>
            {question.topic && <span className="text-slate-500 font-medium">• {question.topic}</span>}
          </div>
          <div className="flex items-center gap-3 font-semibold text-slate-700">
            <span className="text-emerald-600">+{question.positive_marks}</span>
            <span className="text-rose-600">-{question.negative_marks}</span>
            <Badge variant={question.difficulty === 'Easy' ? 'success' : question.difficulty === 'Hard' ? 'danger' : 'warning'}>
              {question.difficulty}
            </Badge>
          </div>
        </div>

        {/* Question Card (Student Exam Box) */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question</div>
          {question.question_text && (
            <p className="text-base font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
              {question.question_text}
            </p>
          )}

          {question.question_image_url && (
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50 p-2 flex justify-center">
              <img
                src={question.question_image_url}
                alt="Question Diagram"
                className="max-h-72 object-contain rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Choices</div>
          {options.map((opt) => {
            const isCorrect = opt.label === question.correct_answer;
            return (
              <div
                key={opt.label}
                className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${
                  isCorrect
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {opt.label}
                </div>

                <div className="flex-1 min-w-0">
                  {opt.text && (
                    <span className={`text-sm font-medium ${isCorrect ? 'text-emerald-950 font-semibold' : 'text-slate-800'}`}>
                      {opt.text}
                    </span>
                  )}
                  {opt.image && (
                    <div className="mt-2">
                      <img
                        src={opt.image}
                        alt={`Option ${opt.label}`}
                        className="max-h-24 object-contain rounded-md border border-slate-200 bg-white p-1"
                      />
                    </div>
                  )}
                </div>

                {isCorrect && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full shrink-0">
                    <CheckCircle size={14} /> Correct Answer
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation Box */}
        {(question.explanation_text || question.explanation_image_url) && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700">
              <BookOpen size={16} /> Detailed Explanation
            </div>
            {question.explanation_text && (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {question.explanation_text}
              </p>
            )}
            {question.explanation_image_url && (
              <div className="pt-2 flex justify-center">
                <img
                  src={question.explanation_image_url}
                  alt="Explanation Diagram"
                  className="max-h-48 object-contain rounded-lg border border-slate-200"
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-900 transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </Modal>
  );
};
