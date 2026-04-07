"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Insight {
  id: number;
  source: string;
  originalTitle: string;
  body: string;
  category: string;
  createdAt: string;
}

interface InsightsResponse {
  items: Insight[];
  total: number;
  page: number;
  totalPages: number;
}

const CATEGORIES = [
  { value: 'company_trends', label: '🏢 기업 동향', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { value: 'vibe_coding',    label: '🤖 바이브 코딩', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
  { value: 'cse',            label: '📚 CSE 지식',    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
];

const CATEGORY_BADGE: Record<string, { label: string; color: string }> = {
  company_trends: { label: '🏢 기업 동향',  color: 'text-cyan-400 bg-cyan-400/10' },
  vibe_coding:    { label: '🤖 바이브 코딩', color: 'text-violet-400 bg-violet-400/10' },
  cse:            { label: '📚 CSE 지식',    color: 'text-rose-400 bg-rose-400/10' },
};

export default function InsightsPage() {
  const [items, setItems] = useState<Insight[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchInsights = useCallback(async (p = 1, cats = selectedCategories) => {
    setLoading(true);
    try {
      const catParam = cats.length > 0 ? `&categories=${cats.join(',')}` : '';
      const { data } = await api.get<InsightsResponse>(`/insights?limit=10&page=${p}${catParam}`);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategories]);

  useEffect(() => {
    fetchInsights(1, selectedCategories);
  }, [selectedCategories]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const { data } = await api.post('/insights/trigger');
      setTriggerMsg(data.message);
      // 3초 후 목록 갱신
      setTimeout(() => fetchInsights(1, selectedCategories), 3000);
    } catch {
      setTriggerMsg('인사이트 생성 요청에 실패했습니다.');
    } finally {
      setTriggering(false);
    }
  };

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-white/5 bg-[#070711]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <span>←</span> 대시보드
        </Link>
        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">IterateMe</span>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all"
        >
          {triggering ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              생성 중...
            </>
          ) : '⚡ 지금 인사이트 업데이트'}
        </button>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        {/* 트리거 메시지 */}
        {triggerMsg && (
          <div className="text-sm text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
            💡 {triggerMsg}
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setSelectedCategories([]); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              selectedCategories.length === 0
                ? 'text-white border-indigo-500/50 bg-indigo-500/20'
                : 'text-slate-400 border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            전체
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                selectedCategories.includes(cat.value)
                  ? cat.color
                  : 'text-slate-400 border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
          {total > 0 && (
            <span className="ml-auto text-xs text-slate-500 self-center">총 {total}개</span>
          )}
        </div>

        {/* 인사이트 목록 */}
        <div className="space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse">
                <div className="h-4 bg-slate-800 rounded w-24 mb-3" />
                <div className="h-5 bg-slate-800 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-800 rounded w-full mb-1" />
                <div className="h-3 bg-slate-800 rounded w-4/5" />
              </div>
            ))
          ) : items.length > 0 ? (
            items.map((item) => {
              const badge = CATEGORY_BADGE[item.category] ?? { label: item.source, color: 'text-slate-400 bg-slate-400/10' };
              const isExpanded = expandedId === item.id;
              return (
                <article
                  key={item.id}
                  className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg ${badge.color}`}>
                          {badge.label}
                        </span>
                        <span className="text-xs text-slate-600">
                          {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-100 mb-2 leading-snug">{item.originalTitle}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                        {isExpanded ? item.body : `${item.body.slice(0, 150)}...`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                  >
                    {isExpanded ? '접기 ▲' : '전체 보기 ▼'}
                  </button>
                </article>
              );
            })
          ) : (
            <div className="p-12 text-center text-slate-500 text-sm rounded-2xl border border-white/5">
              <div className="text-4xl mb-3">💡</div>
              인사이트가 없습니다. "지금 인사이트 업데이트" 버튼을 눌러 생성해보세요.
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => fetchInsights(page - 1, selectedCategories)}
              disabled={page <= 1}
              className="px-4 py-2 text-sm rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← 이전
            </button>
            <span className="text-xs text-slate-500 px-3">{page} / {totalPages}</span>
            <button
              onClick={() => fetchInsights(page + 1, selectedCategories)}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              다음 →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
