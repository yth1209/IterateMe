# IterateMe 프로젝트 심층 분석 보고서

> **분석 일시**: 2026-04-07  
> **프로젝트 설명**: 서버 개발자 취업을 위한 AI 기반 데일리 성장 플랫폼

---

## 1. 프로젝트 구조 개요

```
IterateMe/
├── backend/          # NestJS 서버 (Port: 4000)
│   └── src/
│       ├── auth/         # JWT 인증 모듈
│       ├── users/        # 사용자 엔티티 + 서비스
│       ├── interviews/   # 면접 세션 핵심 로직
│       ├── ai/           # Gemini 2.5 Flash 연동
│       ├── pinecone/     # Vector DB 연동
│       └── scraper/      # 채용 정보 크롤러 + Cron 스케줄러
└── frontend/         # Next.js 앱 (Port: 4100)
    └── src/
        ├── app/
        │   ├── page.tsx         # 대시보드 (홈)
        │   ├── login/           # 로그인 페이지
        │   ├── register/        # 회원가입 페이지
        │   └── interview/       # AI 면접 세션
        └── lib/
            └── api.ts           # Axios 인스턴스 (공통 HTTP 클라이언트)
```

---

## 2. 백엔드 아키텍처 분석 (NestJS)

### 2.1 모듈 의존성 그래프

```
AppModule
├── ConfigModule (global)      — .env 환경 변수
├── ScheduleModule             — Cron 스케줄러
├── TypeOrmModule              — MariaDB 커넥션 (AWS RDS)
│
├── AuthModule
│   ├── JwtModule
│   ├── PassportModule
│   ├── JwtStrategy            — Bearer Access Token 검증
│   ├── JwtRefreshStrategy     — HttpOnly 쿠키 Refresh Token 검증
│   └── → User (TypeORM 엔티티 사용)
│
├── UsersModule
│   └── User 엔티티 (TypeORM)
│
├── InterviewsModule
│   ├── → AiModule             (질문 생성 + 채점용 Gemini 호출)
│   ├── → PineconeModule       (오답 벡터 저장 + 유사 오답 검색)
│   └── 엔티티: InterviewHistory
│
├── AiModule
│   └── AiService              (Gemini API: embedContent, generateContent)
│
├── PineconeModule
│   └── PineconeService        (Pinecone SDK: upsert, query)
│
└── ScraperModule
    ├── → AiModule             (크롤된 텍스트 요약용)
    └── 엔티티: DailyInsight
```

### 2.2 데이터베이스 스키마

| 테이블 | 주요 컬럼 | 특이사항 |
|--------|-----------|----------|
| `users` | id, email(unique), name, resume, password, hashedRefreshToken, createdAt, updatedAt | `password`, `hashedRefreshToken`은 `select: false` (보안) |
| `interview_history` | id, user_id(FK), question, userAnswer, aiScore, aiFeedback, isCorrect, createdAt | `user_id`에 CASCADE DELETE |
| `daily_insights` | id, source, originalTitle, summary, url, createdAt | Scraper가 매일 자정 채움 |

**DB 연결**: AWS RDS MariaDB (`hitori.csqqgw7388qj.ap-northeast-2.rds.amazonaws.com:3306`)  
**SSL**: `rejectUnauthorized: false` (RDS SSL 필수 환경에 대응)  
**TypeORM synchronize**: `true` (개발 환경에서 스키마 자동 동기화)

### 2.3 API 엔드포인트

| 메서드 | 경로 | 가드 | 설명 |
|--------|------|------|------|
| POST | `/auth/register` | 없음 | 회원가입 (bcrypt 해싱) |
| POST | `/auth/login` | 없음 | 로그인 → Access Token 반환 + Refresh Token HttpOnly 쿠키 |
| POST | `/auth/refresh` | JwtRefreshGuard | 쿠키의 Refresh Token으로 새 Access Token 발급 |
| POST | `/auth/logout` | JwtAuthGuard | DB의 hashedRefreshToken null화 + 쿠키 삭제 |
| GET | `/users/me` | ✅ JwtAuthGuard | JWT에서 userId 추출 → 실제 사용자 조회 |
| POST | `/interviews/generate` | ✅ JwtAuthGuard | Adaptive 면접 질문 생성 (JWT에서 userId 자동 추출) |
| POST | `/interviews/evaluate` | ✅ JwtAuthGuard | 답변 채점 및 결과 저장 (JWT에서 userId 자동 추출) |
| GET | `/insights` | ✅ JwtAuthGuard | 최신 DailyInsight 목록 반환 (limit 파라미터 지원) |

> ✅ **2026-04-07 개선**: 모든 도메인 API에 JwtAuthGuard 적용 완료. IDOR 취약점(`:userId` URL 노출) 제거.

### 2.4 JWT 인증 메커니즘

```
[로그인 흐름]
POST /auth/login
  → AuthService.login()
    → bcrypt.compare(입력PW, DB해시PW)
    → JwtService.sign({ sub: userId, email }, { expiresIn: '15m' })  ← Access Token
    → JwtService.sign({ sub: userId, email }, { expiresIn: '7d' })   ← Refresh Token
    → bcrypt.hash(refreshToken)  — DB에 저장
  ← Response: { accessToken } + Set-Cookie: refresh_token (HttpOnly, SameSite=Lax)

[Access Token 재발급 흐름]
POST /auth/refresh
  → JwtRefreshGuard (쿠키에서 refresh_token 추출)
    → JwtRefreshStrategy.validate()
      → DB에서 user.hashedRefreshToken 조회 (addSelect로 숨겨진 컬럼 가져옴)
      → bcrypt.compare(쿠키토큰, DB해시값)
    → AuthService.refresh() → 새 토큰 쌍 발급 + DB 갱신
```

#### 보안 설계 특이점
- **Refresh Token Rotation**: 매 refresh마다 새 Refresh Token 발급 및 DB hashedRefreshToken 교체 (탈취 대비)
- **DB에는 해시값만 저장**: 원본 Refresh Token은 클라이언트 쿠키에만 존재
- **`select: false` 보안**: 기본 `find*` 쿼리에서 password/hashedRefreshToken 제외, 필요할 때만 `addSelect`로 명시적 가져오기

### 2.5 AI 파이프라인

```
[면접 질문 생성 파이프라인]
topic 입력
  → AiService.generateEmbedding(topic)   ← text-embedding-004 (768차원)
  → PineconeService.queryVectors(embedding, topK=3, filter={userId})
      ↑ 사용자의 과거 오답 문맥 검색 (RAG)
  → InterviewsService가 Prompt 구성
      = 주제 + 이력서 + 과거 오답 맥락
  → AiService.generateContent(prompt)    ← gemini-2.5-flash
  ← 맞춤형 면접 질문 반환

[답변 채점 파이프라인]
질문 + 답변
  → AiService.generateContent(채점 프롬프트)  ← gemini-2.5-flash
      → JSON 파싱 { score, feedback, isCorrect }
  → InterviewHistory DB 저장
  → isCorrect === false 이면
    → AiService.generateEmbedding(질문+답변)
    → PineconeService.upsertVectors([{ id, values, metadata: {userId, question} }])
        ↑ 오답을 벡터 DB에 저장 → 다음 세션에서 Adaptive Questioning에 활용
```

### 2.6 스크래핑 파이프라인

```
@Cron(EVERY_DAY_AT_MIDNIGHT)
handleDailyScraping()
  → scrapeWanted()         → cheerio로 HTML 파싱 → Gemini 1줄 요약 → DailyInsight DB 저장
  → scrapeProgrammers()    → 상동
  → scrapeJobKorea()       → 상동
```

> ⚠️ **현재 상태**: 실제 HTTP 요청(axios)은 주석 처리, 각 사이트의 샘플 HTML로 구조만 구성됨. 실 서비스 전 실제 크롤링 로직 구현 필요.

---

## 3. 프론트엔드 아키텍처 분석 (Next.js)

### 3.1 페이지 구조 및 역할

| 경로 | 파일 | 설명 |
|------|------|------|
| `/` | `src/app/page.tsx` | 대시보드 — 사이드바, 통계 카드, 오늘의 인사이트 |
| `/login` | `src/app/login/page.tsx` | 로그인 폼 (Access Token → LocalStorage) |
| `/register` | `src/app/register/page.tsx` | 회원가입 폼 (이름/이메일/비밀번호/이력서) |
| `/interview` | `src/app/interview/page.tsx` | 3단계 AI 면접 세션 (주제 선택 → 답변 → 결과) |

### 3.2 공통 HTTP 클라이언트 (`src/lib/api.ts`)

```typescript
// 설계 핵심:
const api = axios.create({ baseURL: 'http://localhost:4000', withCredentials: true });

// 요청 인터셉터: localStorage에서 Access Token 자동 주입
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
});

// 응답 인터셉터: 401 수신 시 자동 토큰 갱신 후 원래 요청 재시도
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !original._retry) {
    const { data } = await axios.post('/auth/refresh', {}, { withCredentials: true });
    localStorage.setItem('access_token', data.accessToken);
    return api(original);  // 원래 요청 재시도
  }
});
```

**Token 저장 전략**:
- **Access Token**: `localStorage` (JavaScript 접근 가능, XSS 취약 — 추후 메모리 저장 고려)
- **Refresh Token**: `HttpOnly Cookie` (JavaScript 접근 불가, 서버에서만 읽힘 — 보안 우수)

### 3.3 UI 디자인 시스템

- **테마**: 최고 어두운 배경 `#070711` 기반 다크 모드
- **색상**: Indigo(`#6366f1`) + Cyan(`#06b6d4`) + Violet 그라디언트 팔레트
- **컴포넌트 패턴**:
  - `backdrop-blur-xl bg-white/[0.04] border border-white/10` → Glassmorphism 카드
  - Orb 효과: 절대 위치 `blur-[120px]` 원형 배경 컬러 블롭
  - 진입 애니메이션: `animate-in fade-in slide-in-from-bottom`
  - 인터랙티브: `shadow-[0_0_20px_rgba(99,102,241,0.4)]` Neon Glow 효과

---

## 4. 시스템 전체 데이터 흐름

```
[사용자 관점 전체 흐름]

  1. 회원가입 /register
     FE → POST /auth/register { email, password, name, resume }
     BE → bcrypt 해싱 → DB 저장

  2. 로그인 /login
     FE → POST /auth/login { email, password }
     BE → 검증 → Access Token (15분) + Refresh Token (7일, HttpOnly Cookie)
     FE → localStorage.access_token = accessToken

  3. 대시보드 /
     FE → GET Daily Insight 데이터 렌더링 (현재 하드코딩, API 연동 필요)
     BE → Cron Job (자정 실행): 채용 플랫폼 스크래핑 → Gemini 요약 → DailyInsight DB

  4. 면접 시작 /interview
     FE → POST /interviews/generate/1 { topic }
     BE → Gemini 임베딩(topic) → Pinecone 오답 검색(RAG) → Gemini 질문 생성 → 반환

  5. 답변 제출
     FE → POST /interviews/evaluate/1 { question, answer }
     BE → Gemini 채점 → DB 저장 → 오답이면 Pinecone upsert
     FE → 점수 + 피드백 시각화 (원형 게이지)

  6. 토큰 만료 (401)
     api.ts 인터셉터 → POST /auth/refresh (쿠키 자동 포함)
     BE → Refresh Token 검증 → 새 Access Token 반환
     FE → localStorage 갱신 → 원래 요청 재시도
```

---

## 5. 현재 코드의 주요 한계 및 개선 필요 사항

### 5.1 ✅ 해결 완료 (2026-04-07)

| 항목 | 변경 내용 |
|------|-----------|
| 인터뷰 API 인증 없음 | `JwtAuthGuard` 적용 + `:userId` URL 파라미터 제거 |
| 프론트 API 실제 미연동 | `setTimeout` Mock 제거 → 실제 `api.post()` 연동 |
| 대시보드 하드코딩 데이터 | `GET /insights` API 신규 구현 + 동적 렌더링 연동 |
| 라우트 보호 및 파일명 | `proxy.ts` (Next.js 16 규격) 적용 + `proxy` 함수 export |
| 한글 입력(IME) 장애 | `InputField` 컴포넌트 외부 추출로 리렌더링 최적화 완료 |
| localStorage 산재 | `lib/auth.ts` 유틸 중앙화 → 일관된 토큰 관리 |

### 5.2 🔴 Critical (잔여)

| 항목 | 현황 | 해결책 |
|------|------|--------|
| 인터뷰 API 인증 없음 | `/interviews`, `/users/me` 에 가드 없음 | `@UseGuards(JwtAuthGuard)` 적용 |
| 프론트 API 실제 미연동 | `/interview`의 질문/채점이 setTimeout Mock 데이터 | Axios api 인스턴스로 실제 연결 |
| Access Token XSS 취약 | localStorage 저장 방식 | 메모리(React state) 또는 httpOnly 쿠키 전환 고려 |
| 스크래핑 실미구현 | axios 주석 처리, 샘플 HTML | 실제 크롤링 로직 구현 |

### 5.2 🟡 Medium (개선 권장)

| 항목 | 현황 | 해결책 |
|------|------|--------|
| `synchronize: true` | 자동 스키마 변경 (운영 위험) | migration 방식으로 전환 |
| userId URL 파라미터 | `/interviews/generate/:userId` (외부 노출) | JWT에서 userId 추출하도록 변경 |
| 대시보드 API 미연동 | 하드코딩된 인사이트 데이터 | `GET /insights` API 구현 후 연동 |
| Pinecone upsert 타입 우회 | `(index.upsert as any)` | SDK 버전 확인 후 타입 정리 |

### 5.3 🟢 향후 구현 예정

- 이력서 없이 면접 질문 생성 시 기본 프롬프트 fallback
- 달력 기반 오답 노트 이력 페이지 (`/notes`)
- 성장 분석 차트 페이지 (`/analytics`)
- 실제 소셜 로그인 (GitHub OAuth 등)
- CI/CD 파이프라인 (GitHub Actions + AWS)

---

## 6. 기술 스택 정리

| 영역 | 기술 | 버전/메모 |
|------|------|-----------|
| 백엔드 프레임워크 | NestJS | TypeScript, DI 기반 모듈화 |
| 데이터베이스 | MariaDB (AWS RDS) | TypeORM, SSL 연결 |
| AI 모델 | Google Gemini 2.5 Flash | 질문 생성, 채점, 요약 |
| 임베딩 모델 | text-embedding-004 | 768차원, 오답 벡터화 |
| Vector DB | Pinecone (Serverless) | AWS 리전, RAG 패턴 |
| 인증 | JWT (Access 15분 + Refresh 7일) | Passport.js, Bcrypt |
| 스케줄러 | @nestjs/schedule | 자정 Cron Job |
| HTML 파싱 | cheerio | 스크래핑 전처리 |
| 프론트 프레임워크 | Next.js 16 (App Router) | TailwindCSS, TypeScript |
| HTTP 클라이언트 | Axios | 인터셉터 기반 자동 토큰 관리 |
