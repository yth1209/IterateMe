"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

// ✅ IME(한글 등) 입력이 정상 동작하려면 컴포넌트를 외부에 정의해야 합니다.
//    내부에 정의하면 상태 변경 시마다 React가 새 컴포넌트로 인식하여 unmount/remount → IME 조합 중단
interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

function InputField({ label, name, type = 'text', placeholder, value, onChange, required = true }: InputFieldProps) {
  return (
    <div>
      <label htmlFor={`register-${name}`} className="block text-sm font-medium text-slate-400 mb-2">
        {label}
      </label>
      <input
        id={`register-${name}`}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full bg-slate-950/60 border border-slate-700/60 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-600"
      />
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', resume: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err?.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#070711] flex items-center justify-center overflow-hidden py-16">
      {/* 배경 Orb */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-60 -right-40 w-[700px] h-[700px] rounded-full bg-violet-600/20 blur-[140px]" />
        <div className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/15 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md px-6">
        <div className="text-center mb-8">
          <Link href="/login" className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
            IterateMe
          </Link>
          <p className="mt-2 text-slate-400">시작하는 순간, 성장이 시작됩니다</p>
        </div>

        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-2xl font-bold text-white mb-8">회원가입</h2>

          <form onSubmit={handleRegister} className="space-y-5">
            <InputField label="이름" name="name" placeholder="홍길동"
              value={form.name} onChange={handleChange} />
            <InputField label="이메일" name="email" type="email" placeholder="your@email.com"
              value={form.email} onChange={handleChange} />
            <InputField label="비밀번호 (8자 이상)" name="password" type="password" placeholder="••••••••"
              value={form.password} onChange={handleChange} />

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                이력서 <span className="text-slate-600 font-normal">(선택 — AI 맞춤 면접 활용)</span>
              </label>
              <textarea
                id="register-resume"
                name="resume"
                value={form.resume}
                onChange={handleChange}
                rows={4}
                placeholder="개발 경력, 사용 기술 스택, 주요 프로젝트 등을 자유롭게 작성하세요..."
                className="w-full bg-slate-950/60 border border-slate-700/60 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none placeholder:text-slate-600"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm hover:from-indigo-500 hover:to-violet-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  가입 중...
                </span>
              ) : '회원가입 완료'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-indigo-400 font-semibold hover:text-indigo-300 transition-colors">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
