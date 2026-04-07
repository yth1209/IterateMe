"use client";

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Stage = 'topic' | 'answering' | 'result';

interface FeedbackResult {
  score: number;
  feedback: string;
  isCorrect: boolean;
}

export default function InterviewSession() {
  const [stage, setStage] = useState<Stage>('topic');
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [error, setError] = useState('');

  const startInterview = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/interviews/generate', { topic });
      setQuestion(data.question);
      setStage('answering');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'AI 질문 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/interviews/evaluate', { question, answer });
      setFeedback({
        score: data.aiScore,
        feedback: data.aiFeedback,
        isCorrect: data.isCorrect,
      });
      setStage('result');
    } catch (err: any) {
      setError(err?.response?.data?.message || '채점 요청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-white/5 bg-[#070711]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <span>←</span> 대시보드
        </Link>
        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">IterateMe</span>
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">
          🎯 AI 면접 세션
        </div>
      </header>

      {/* 진행 단계 표시 */}
      <div className="flex items-center justify-center gap-3 py-4 border-b border-white/5 text-xs font-medium">
        {['주제 선택', '답변 작성', '결과 확인'].map((step, i) => {
          const stages: Stage[] = ['topic', 'answering', 'result'];
          const isCurrent = stages[i] === stage;
          const isDone = stages.indexOf(stage) > i;
          return (
            <div key={step} className={`flex items-center gap-1.5 transition-all ${isCurrent ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${isCurrent ? 'border-indigo-500 bg-indigo-500/20' : isDone ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-700'}`}>
                {isDone ? '✓' : i + 1}
              </div>
              {step}
              {i < 2 && <span className="text-slate-700 mx-1">—</span>}
            </div>
          );
        })}
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3">
            <span>⚠</span> {error}
          </div>
        )}

        {/* STAGE 1: 주제 선택 */}
        {stage === 'topic' && (
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/8 rounded-3xl p-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-3xl font-black mb-2">새로운 훈련 시작</div>
            <p className="text-slate-400 mb-8">어떤 기술 주제로 면접 훈련을 시작할까요?</p>

            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startInterview()}
              placeholder="예: Redis 캐싱 전략, JVM 메모리 구조, DB 인덱스..."
              className="w-full bg-slate-950/60 border border-slate-700/60 text-slate-100 rounded-2xl px-6 py-4 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all mb-8 placeholder:text-slate-600"
            />

            <div className="flex flex-wrap gap-2 mb-8">
              {['Redis 캐싱', 'JVM GC', 'DB 인덱스', 'MSA 패턴', 'JWT 인증', 'Spring Bean'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTopic(tag)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 border border-white/5 hover:border-indigo-500/30 rounded-lg transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>

            <button
              onClick={startInterview}
              disabled={!topic || isLoading}
              className="w-full py-4 relative group bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-base transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(99,102,241,0.3)] overflow-hidden"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI가 질문을 생성하고 있습니다...
                </span>
              ) : '면접 질문 받기 →'}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          </div>
        )}

        {/* STAGE 2: 답변 작성 */}
        {stage === 'answering' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-6 duration-600">
            {/* 면접관 버블 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                🤵
              </div>
              <div className="flex-1 bg-gradient-to-br from-indigo-900/40 to-violet-900/20 border border-indigo-500/20 rounded-3xl rounded-tl-sm p-6">
                <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-3">AI 면접관</div>
                <p className="text-lg text-slate-100 leading-relaxed font-medium">{question}</p>
              </div>
            </div>

            {/* 답변 입력 버블 */}
            <div className="flex items-start gap-4 flex-row-reverse">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                🧑‍💻
              </div>
              <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-3xl rounded-tr-sm overflow-hidden">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="논리적으로 답변해 주세요. 경험, 개념 설명, 트레이드오프까지 담으면 더 좋습니다..."
                  rows={7}
                  className="w-full bg-transparent p-6 text-slate-200 text-base focus:outline-none resize-none placeholder:text-slate-600"
                />
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-600">{answer.length}자</span>
                  <button
                    onClick={submitAnswer}
                    disabled={!answer || isLoading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                  >
                    {isLoading ? '채점 중...' : '답변 제출 →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: 결과 */}
        {stage === 'result' && feedback && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
            {/* 점수 카드 */}
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/8 rounded-3xl p-8">
              <div className="flex items-center gap-6 mb-8">
                {/* 원형 게이지 */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e1b4b" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={feedback.score >= 70 ? '#6366f1' : '#f43f5e'}
                      strokeWidth="3"
                      strokeDasharray={`${feedback.score} ${100 - feedback.score}`}
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 6px ${feedback.score >= 70 ? '#6366f1' : '#f43f5e'})` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{feedback.score}</span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                </div>

                <div>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold mb-2 ${feedback.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {feedback.isCorrect ? '✓ 통과' : '✗ 재학습 필요'}
                  </div>
                  <h2 className="text-2xl font-black text-white">채점 완료</h2>
                  <p className="text-slate-400 text-sm mt-1">{feedback.isCorrect ? '훌륭한 답변입니다!' : '조금 더 보완이 필요합니다.'}</p>
                </div>
              </div>

              <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-800">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-4 bg-emerald-400 rounded-full inline-block" /> 피드백 및 개선 포인트
                </div>
                <p className="text-slate-300 leading-relaxed">{feedback.feedback}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setStage('topic'); setTopic(''); setAnswer(''); setFeedback(null); }}
                className="py-4 rounded-2xl border border-slate-700 hover:bg-slate-800/50 text-white font-bold text-sm transition-all"
              >
                🔄 다시 훈련하기
              </button>
              <Link
                href="/"
                className="py-4 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 font-bold text-sm transition-all text-center"
              >
                📊 대시보드로 이동
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
