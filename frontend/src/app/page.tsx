"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { clearAccessToken } from '@/lib/auth';

const NAV_ITEMS = [
  { icon: '⚡', label: '대시보드', href: '/', active: true },
  { icon: '🎯', label: '면접 훈련', href: '/interview', active: false },
  { icon: '📓', label: '오답 노트', href: '/notes', active: false },
  { icon: '📊', label: '성장 분석', href: '/analytics', active: false },
];

interface Insight {
  id: number;
  source: string;
  originalTitle: string;
  summary: string;
  url: string;
  createdAt: string;
}

const SOURCE_STYLE: Record<string, { tag: string; color: string }> = {
  Wanted:      { tag: 'Trend',      color: 'text-cyan-400 bg-cyan-400/10' },
  Programmers: { tag: 'Job Market', color: 'text-violet-400 bg-violet-400/10' },
  JobKorea:    { tag: 'Security',   color: 'text-rose-400 bg-rose-400/10' },
};

export default function Dashboard() {
  const router = useRouter();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  useEffect(() => {
    api.get('/insights?limit=5')
      .then(({ data }) => setInsights(data))
      .catch(() => setInsights([]))
      .finally(() => setInsightsLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearAccessToken();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 flex">
      {/* 사이드바 */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 bg-white/[0.02] shrink-0">
        {/* 로고 */}
        <div className="px-6 py-7 border-b border-white/5">
          <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            IterateMe
          </span>
          <p className="text-xs text-slate-500 mt-1">Daily Growth Platform</p>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 로그아웃 */}
        <div className="px-3 pb-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span>🚪</span> 로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#070711]/80 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white">오늘의 성장 리포트</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]"
          >
            <span>🎯</span> 오늘의 면접 시작
          </Link>
        </header>

        <div className="px-6 py-8 max-w-5xl mx-auto space-y-10">
          {/* 스탯 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '연속 학습', value: '4일', icon: '🔥', color: 'from-orange-500/20 to-rose-500/20 border-orange-500/20' },
              { label: '오늘의 목표', value: '10문제', icon: '🎯', color: 'from-indigo-500/20 to-violet-500/20 border-indigo-500/20' },
              { label: '평균 점수', value: '82점', icon: '📈', color: 'from-emerald-500/20 to-cyan-500/20 border-emerald-500/20' },
              { label: '총 훈련 횟수', value: '47회', icon: '⚡', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/20' },
            ].map((stat) => (
              <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border rounded-2xl p-5`}>
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-slate-400 mt-1 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 오늘의 인사이트 */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-400 to-cyan-400 rounded-full inline-block" />
                오늘의 기술 인사이트
              </h2>
              <button className="text-xs text-slate-500 hover:text-indigo-400 transition-colors font-medium">전체 보기 →</button>
            </div>

            <div className="space-y-3">
              {insightsLoading ? (
                // 로딩 스켈레톤
                [...Array(3)].map((_, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse">
                    <div className="h-4 bg-slate-800 rounded w-16 mb-3" />
                    <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-800 rounded w-full" />
                  </div>
                ))
              ) : insights.length > 0 ? (
                insights.map((item) => {
                  const style = SOURCE_STYLE[item.source] ?? { tag: item.source, color: 'text-slate-400 bg-slate-400/10' };
                  return (
                    <article
                      key={item.id}
                      className="group relative p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all cursor-pointer overflow-hidden"
                    >
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-indigo-600/5 to-transparent pointer-events-none" />
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg mb-2 ${style.color}`}>
                            {style.tag}
                          </div>
                          <h3 className="text-base font-semibold text-slate-100 mb-2 leading-snug">{item.originalTitle}</h3>
                          <p className="text-sm text-slate-400 line-clamp-2">{item.summary}</p>
                          <div className="mt-3 text-xs text-slate-600 font-medium">{item.source} 스크래핑</div>
                        </div>
                        <div className="text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0 text-lg">→</div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm rounded-2xl border border-white/5">
                  아직 스크래핑된 인사이트가 없습니다. 잠시 후 다시 확인해주세요.
                </div>
              )}
            </div>
          </section>

          {/* 취약점 분석 CTA */}
          <section className="relative rounded-3xl overflow-hidden p-8 bg-gradient-to-br from-indigo-900/40 via-violet-900/20 to-transparent border border-indigo-500/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3">AI 분석 준비 완료</div>
              <h3 className="text-2xl font-black text-white mb-2">오늘의 맞춤형 면접 세션</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-lg">
                지난 3회의 오답 패턴을 분석했습니다. <strong className="text-slate-200">DB 인덱스 설계</strong>와 <strong className="text-slate-200">비동기 처리</strong> 개념에 집중한 Adaptive 질문을 준비했습니다.
              </p>
              <Link
                href="/interview"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
              >
                <span>🚀</span> 지금 바로 훈련하기
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
