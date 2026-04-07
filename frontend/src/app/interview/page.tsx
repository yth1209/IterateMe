"use client";

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Stage = 'setup' | 'answering' | 'result';

interface FeedbackResult {
  aiScore: number;
  aiFeedback: string;
  isCorrect: boolean;
}

const QUICK_TOPICS = ['Redis 캐싱', 'JVM GC', 'DB 인덱스', 'MSA 패턴', 'JWT 인증', 'Spring Bean'];
const N_PRESETS = [3, 5, 10];

export default function InterviewSession() {
  const [stage, setStage] = useState<Stage>('setup');
  const [topic, setTopic] = useState('');
  const [n, setN] = useState(5);
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [results, setResults] = useState<FeedbackResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const startInterview = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/interviews/generate', {
        ...(topic.trim() ? { topic: topic.trim() } : {}),
        n,
      });
      setQuestions(data.questions);
      setAnswers(Array(data.questions.length).fill(''));
      setCurrentIdx(0);
      setResults([]);
      setCurrentAnswer('');
      setStage('answering');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'AI 질문 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await api.post('/interviews/evaluate', {
        question: questions[currentIdx],
        answer: currentAnswer,
      });
      const newResults = [...results, {
        aiScore: data.aiScore,
        aiFeedback: data.aiFeedback,
        isCorrect: data.isCorrect,
      }];
      const newAnswers = [...answers];
      newAnswers[currentIdx] = currentAnswer;
      setAnswers(newAnswers);
      setResults(newResults);

      if (currentIdx < questions.length - 1) {
        setCurrentIdx(currentIdx + 1);
        setCurrentAnswer('');
      } else {
        setStage('result');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || '채점 요청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStage('setup');
    setTopic('');
    setN(5);
    setQuestions([]);
    setCurrentIdx(0);
    setAnswers([]);
    setCurrentAnswer('');
    setResults([]);
    setError('');
  };

  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.aiScore, 0) / results.length)
    : 0;
  const correctCount = results.filter((r) => r.isCorrect).length;

  const stageLabels: { key: Stage; label: string }[] = [
    { key: 'setup',    label: '훈련 설정' },
    { key: 'answering', label: '답변 작성' },
    { key: 'result',   label: '결과 확인' },
  ];

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

      {/* 진행 단계 */}
      <div className="flex items-center justify-center gap-3 py-4 border-b border-white/5 text-xs font-medium">
        {stageLabels.map(({ key, label }, i) => {
          const stageOrder: Stage[] = ['setup', 'answering', 'result'];
          const isCurrent = key === stage;
          const isDone = stageOrder.indexOf(stage) > i;
          return (
            <div key={key} className={`flex items-center gap-1.5 transition-all ${isCurrent ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-600'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${isCurrent ? 'border-indigo-500 bg-indigo-500/20' : isDone ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-700'}`}>
                {isDone ? '✓' : i + 1}
              </div>
              {label}
              {i < 2 && <span className="text-slate-700 mx-1">—</span>}
            </div>
          );
        })}
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 flex flex-col gap-8">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3">
            <span>⚠</span> {error}
          </div>
        )}

        {/* STAGE 1: 훈련 설정 */}
        {stage === 'setup' && (
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/8 rounded-3xl p-10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-3xl font-black mb-2">새로운 훈련 시작</div>
            <p className="text-slate-400 mb-8">주제와 문제 수를 선택하고 시작하세요.</p>

            {/* 주제 입력 */}
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              주제 <span className="text-slate-600 normal-case font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startInterview()}
              placeholder="비워두면 AI가 과거 오답 중심으로 자동 출제합니다 ✨"
              className="w-full bg-slate-950/60 border border-slate-700/60 text-slate-100 rounded-2xl px-6 py-4 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all mb-4 placeholder:text-slate-600"
            />

            {/* 빠른 주제 선택 */}
            <div className="flex flex-wrap gap-2 mb-8">
              {QUICK_TOPICS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTopic(tag)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 border border-white/5 hover:border-indigo-500/30 rounded-lg transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* 문제 수 선택 */}
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              문제 수
            </label>
            <div className="flex gap-3 mb-8">
              {N_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setN(preset)}
                  className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all ${
                    n === preset
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {preset}문제
                </button>
              ))}
            </div>

            <button
              onClick={startInterview}
              disabled={isLoading}
              className="w-full py-4 relative group bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold text-base transition-all disabled:opacity-50 shadow-[0_0_30px_rgba(99,102,241,0.3)] overflow-hidden"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  AI가 질문을 생성하고 있습니다...
                </span>
              ) : `${n}문제 시작하기 →`}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          </div>
        )}

        {/* STAGE 2: 순차 답변 */}
        {stage === 'answering' && questions.length > 0 && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-6 duration-600">
            {/* 진행 표시 */}
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span className="font-bold text-white">문제 {currentIdx + 1} / {questions.length}</span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i < currentIdx ? 'bg-emerald-400' : i === currentIdx ? 'bg-indigo-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 면접관 버블 */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.4)]">
                🤵
              </div>
              <div className="flex-1 bg-gradient-to-br from-indigo-900/40 to-violet-900/20 border border-indigo-500/20 rounded-3xl rounded-tl-sm p-6">
                <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-3">AI 면접관</div>
                <p className="text-lg text-slate-100 leading-relaxed font-medium">{questions[currentIdx]}</p>
              </div>
            </div>

            {/* 답변 입력 */}
            <div className="flex items-start gap-4 flex-row-reverse">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-lg shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                🧑‍💻
              </div>
              <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-3xl rounded-tr-sm overflow-hidden">
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="논리적으로 답변해 주세요. 경험, 개념 설명, 트레이드오프까지 담으면 더 좋습니다..."
                  rows={7}
                  className="w-full bg-transparent p-6 text-slate-200 text-base focus:outline-none resize-none placeholder:text-slate-600"
                />
                <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-600">{currentAnswer.length}자</span>
                  <button
                    onClick={submitAnswer}
                    disabled={!currentAnswer.trim() || isLoading}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50"
                  >
                    {isLoading
                      ? '채점 중...'
                      : currentIdx < questions.length - 1
                        ? '다음 문제 →'
                        : '최종 제출 →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3: 전체 결과 */}
        {stage === 'result' && results.length > 0 && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
            {/* 총점 요약 */}
            <div className="backdrop-blur-xl bg-white/[0.03] border border-white/8 rounded-3xl p-8">
              <div className="flex items-center gap-6 mb-6">
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e1b4b" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={avgScore >= 70 ? '#6366f1' : '#f43f5e'}
                      strokeWidth="3"
                      strokeDasharray={`${avgScore} ${100 - avgScore}`}
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 6px ${avgScore >= 70 ? '#6366f1' : '#f43f5e'})` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{avgScore}</span>
                    <span className="text-xs text-slate-500">평균</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white mb-1">세션 완료</h2>
                  <p className="text-slate-400 text-sm">
                    {questions.length}문제 중 <span className="text-emerald-400 font-bold">{correctCount}문제</span> 통과
                  </p>
                </div>
              </div>

              {/* 문제별 결과 */}
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const r = results[i];
                  if (!r) return null;
                  return (
                    <div key={i} className="bg-slate-950/50 rounded-2xl p-5 border border-slate-800">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-slate-500 font-medium">문제 {i + 1}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {r.isCorrect ? `✓ ${r.aiScore}점` : `✗ ${r.aiScore}점`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 font-medium mb-2 leading-snug">{q}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{r.aiFeedback}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={reset}
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
