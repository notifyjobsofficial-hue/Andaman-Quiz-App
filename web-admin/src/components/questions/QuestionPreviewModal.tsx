import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Question } from '../../types';
import { CheckCircle, BookOpen, AlertCircle } from 'lucide-react';
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
  const [qImgError, setQImgError] = useState(false);
  const [expImgError, setExpImgError] = useState(false);
  const [optImgErrors, setOptImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setQImgError(false);
    setExpImgError(false);
    setOptImgErrors({});
  }, [question, isOpen]);

  if (!question) return null;

  const qImage = (question.questionImageUrl || question.question_image_url || '').trim();
  const expImage = (question.explanationImageUrl || question.explanation_image_url || '').trim();

  const options = [
    {
      label: 'A',
      text: question.option_a_text,
      image: (question.optionAImageUrl || question.option_a_image_url || question.optionImages?.[0] || '').trim(),
    },
    {
      label: 'B',
      text: question.option_b_text,
      image: (question.optionBImageUrl || question.option_b_image_url || question.optionImages?.[1] || '').trim(),
    },
    {
      label: 'C',
      text: question.option_c_text,
      image: (question.optionCImageUrl || question.option_c_image_url || question.optionImages?.[2] || '').trim(),
    },
    {
      label: 'D',
      text: question.option_d_text,
      image: (question.optionDImageUrl || question.option_d_image_url || question.optionImages?.[3] || '').trim(),
    },
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
            <Badge
              variant={
                question.difficulty === 'Easy'
                  ? 'success'
                  : question.difficulty === 'Hard'
                  ? 'danger'
                  : 'warning'
              }
            >
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

          {/* Zero container if no image */}
          {qImage && !qImgError && (
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50 p-2 flex justify-center">
              <img
                src={qImage}
                alt="Question Diagram"
                className="max-h-72 object-contain rounded-lg"
                onError={() => setQImgError(true)}
              />
            </div>
          )}

          {/* Graceful error box if image fails to load — never broken browser icon */}
          {qImage && qImgError && (
            <div className="border border-rose-100 bg-rose-50/50 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-rose-600 font-medium">
              <AlertCircle size={15} />
              <span>Question diagram could not be loaded</span>
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Choices</div>
          {options.map((opt) => {
            const isCorrect = opt.label === question.correct_answer;
            const hasOptImg = Boolean(opt.image);
            const hasOptErr = optImgErrors[opt.label];

            return (
              <div
                key={opt.label}
                className={`flex items-start gap-4 p-3.5 rounded-xl border transition-all ${
                  isCorrect
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${
                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {opt.label}
                </div>

                <div className="flex-1 min-w-0">
                  {opt.text && (
                    <span
                      className={`text-sm font-medium ${
                        isCorrect ? 'text-emerald-950 font-semibold' : 'text-slate-800'
                      }`}
                    >
                      {opt.text}
                    </span>
                  )}

                  {/* Zero container if no option image */}
                  {hasOptImg && !hasOptErr && (
                    <div className="mt-2">
                      <img
                        src={opt.image}
                        alt={`Option ${opt.label}`}
                        className="max-h-24 object-contain rounded-md border border-slate-200 bg-white p-1"
                        onError={() =>
                          setOptImgErrors((prev) => ({ ...prev, [opt.label]: true }))
                        }
                      />
                    </div>
                  )}

                  {/* Graceful fallback if option image fails */}
                  {hasOptImg && hasOptErr && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-600">
                      <AlertCircle size={12} />
                      <span>Option image unavailable</span>
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
        {(question.explanation_text || expImage) && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700">
              <BookOpen size={16} /> Detailed Explanation
            </div>
            {question.explanation_text && (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {question.explanation_text}
              </p>
            )}
            {expImage && !expImgError && (
              <div className="pt-2 flex justify-center">
                <img
                  src={expImage}
                  alt="Explanation Diagram"
                  className="max-h-48 object-contain rounded-lg border border-slate-200"
                  onError={() => setExpImgError(true)}
                />
              </div>
            )}
            {expImage && expImgError && (
              <div className="border border-rose-100 bg-rose-50/50 rounded-xl p-2.5 flex items-center justify-center gap-1.5 text-xs text-rose-600">
                <AlertCircle size={14} />
                <span>Explanation diagram could not be loaded</span>
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
