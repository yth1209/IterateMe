"use client";

import Link from 'next/link';

export default function NotesPage() {
  return (
    <div className="min-h-screen bg-[#070711] text-slate-100 flex flex-col">
      <header className="border-b border-white/5 bg-[#070711]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <span>←</span> 대시보드
        </Link>
        <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">IterateMe</span>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
          📓 오답 노트
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-6xl">📓</div>
        <h2 className="text-2xl font-black text-white">오답 노트</h2>
        <p className="text-slate-400 text-sm text-center max-w-sm">
          면접 훈련에서 틀린 문제들을 모아 복습할 수 있는 공간입니다.<br />
          곧 서비스될 예정입니다.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 font-bold text-sm transition-all"
        >
          ← 대시보드로 돌아가기
        </Link>
      </main>
    </div>
  );
}
