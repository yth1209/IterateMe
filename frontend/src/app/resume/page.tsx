"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ResumePage() {
  const [resume, setResume] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me')
      .then(({ data }) => {
        const value = data.resume ?? '';
        setResume(value);
        setOriginal(value);
      })
      .catch(() => setError('이력서를 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (resume !== original) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [resume, original]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.patch('/users/me/resume', { resume });
      setOriginal(resume);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setResume(original);
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 flex flex-col">
      <header className="border-b border-white/5 bg-[#070711]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <span>←</span> 대시보드
        </Link>
        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">IterateMe</span>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
          📄 이력서
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-black text-white mb-1">📄 나의 이력서</h2>
          <p className="text-sm text-slate-400">
            이력서는 AI 면접 질문 생성 및 Adaptive 질문 최적화에 활용됩니다.
          </p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            ⚠ {error}
          </div>
        )}

        {saved && (
          <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            ✅ 저장 완료
          </div>
        )}

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-6 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 bg-slate-800 rounded mb-2 w-full" />
              ))}
            </div>
          ) : (
            <textarea
              value={resume}
              onChange={(e) => { setResume(e.target.value); setSaved(false); }}
              placeholder="마크다운 형식으로 이력서를 입력하세요.&#10;&#10;예)&#10;## 기술 스택&#10;- Java, Spring Boot, MySQL&#10;&#10;## 경력&#10;- XX회사 백엔드 개발 2년"
              rows={20}
              className="w-full bg-transparent p-6 text-slate-200 text-sm focus:outline-none resize-none placeholder:text-slate-600 font-mono leading-relaxed"
            />
          )}
        </div>

        <div className="text-xs text-slate-600">
          💡 마크다운 형식 권장 — 헤더(##), 리스트(-), 강조(**) 등을 활용하면 AI가 더 잘 인식합니다.
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                저장 중...
              </span>
            ) : '저장하기'}
          </button>
          <button
            onClick={handleReset}
            disabled={saving || loading || resume === original}
            className="px-6 py-3 rounded-xl border border-slate-700 hover:bg-slate-800/50 disabled:opacity-30 text-slate-300 font-bold text-sm transition-all"
          >
            초기화
          </button>
        </div>
      </main>
    </div>
  );
}
