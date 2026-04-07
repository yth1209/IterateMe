# IterateMe 프로젝트 심층 분석 보고서

> **분석 일시**: 2026-04-07 (최종 업데이트)
> **분석 기반**: 실제 소스 코드 전체 파일 직접 검토
> **프로젝트 목적**: 서버 개발자 취업을 위한 AI 기반 데일리 성장 플랫폼

---

## 1. 프로젝트 전체 구조

```
IterateMe/
├── backend/                        # NestJS 서버 (Port: 4000)
│   ├── .env                        # DB, JWT, Gemini, Pinecone 시크릿
│   ├── package.json
│   └── src/
│       ├── main.ts                 # 진입점 (cookieParser, CORS 설정)
│       ├── app.module.ts           # 루트 모듈 (TypeORM, Schedule 등록)
│       ├── app.controller.ts       # GET / 헬스체크
│       ├── auth/                   # JWT 인증 모듈
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.module.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   └── jwt-refresh.guard.ts
│       │   └── strategies/
│       │       ├── jwt.strategy.ts
│       │       └── jwt-refresh.strategy.ts
│       ├── users/                  # 사용자 도메인
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   ├── users.module.ts
│       │   └── entities/user.entity.ts
│       ├── interviews/             # 면접 세션 핵심 로직
│       │   ├── interviews.controller.ts
│       │   ├── interviews.service.ts
│       │   ├── interviews.module.ts
│       │   └── entities/interview-history.entity.ts
│       ├── ai/                     # Gemini API 래퍼
│       │   ├── ai.service.ts
│       │   └── ai.module.ts
│       ├── pinecone/               # Vector DB 래퍼
│       │   ├── pinecone.service.ts
│       │   └── pinecone.module.ts
│       └── scraper/                # 채용 정보 크롤러 + Cron
│           ├── scraper.controller.ts   # GET /insights 엔드포인트
│           ├── scraper.service.ts      # 자정 Cron Job
│           ├── scraper.module.ts
│           └── entities/daily-insight.entity.ts
└── frontend/                       # Next.js 앱 (Port: 4100)
    ├── next.config.ts              # API 프록시 (/api/* → localhost:4000)
    └── src/
        ├── middleware.ts           # 라우트 보호 (refresh_token 쿠키 확인)
        ├── lib/
        │   ├── api.ts              # Axios 인스턴스 (인터셉터 기반 토큰 관리)
        │   └── auth.ts             # localStorage 토큰 유틸리티
        └── app/
            ├── layout.tsx          # 루트 레이아웃
            ├── globals.css         # 전역 스타일
            ├── page.tsx            # 대시보드 (/)
            ├── login/page.tsx      # 로그인 (/login)
            ├── register/page.tsx   # 회원가입 (/register)
            └── interview/page.tsx  # AI 면접 세션 (/interview)
```

---

## 2. 백엔드 아키텍처 (NestJS)

### 2.1 모듈 의존성 그래프

```
AppModule
├── ConfigModule (isGlobal: true)    — .env 환경 변수 전역 주입
├── ScheduleModule.forRoot()         — Cron 스케줄러
├── TypeOrmModule.forRootAsync()     — MariaDB (AWS RDS, SSL)
│
├── AuthModule
│   ├── JwtModule
│   ├── PassportModule
│   ├── JwtStrategy              — Bearer Access Token 검증
│   ├── JwtRefreshStrategy       — HttpOnly 쿠키 Refresh Token 검증
│   └── → User 엔티티 (TypeORM)
│
├── UsersModule
│   └── User 엔티티
│
├── InterviewsModule
│   ├── → AiModule               (질문 생성 + 채점용 Gemini 호출)
│   ├── → PineconeModule         (오답 벡터 저장 + 유사 오답 검색)
│   └── InterviewHistory 엔티티
│
├── AiModule (export: AiService)
│   └── AiService                — @google/genai SDK (@1.48.0)
│                                  - generateEmbedding(): text-embedding-004 (768차원)
│                                  - generateContent(): gemini-2.5-flash
│
├── PineconeModule (export: PineconeService)
│   └── PineconeService          — @pinecone-database/pinecone SDK (@7.1.0)
│                                  - upsertVectors(): 오답 저장
│                                  - queryVectors(): 유사 오답 검색
│
└── ScraperModule
    ├── → AiModule               (크롤된 텍스트 요약용)
    └── DailyInsight 엔티티
```

### 2.2 서버 진입점 설정 (`main.ts`)

```typescript
// 핵심 미들웨어 3가지
app.use(cookieParser());                     // Refresh Token 쿠키 파싱
app.enableCors({
  origin: ['http://localhost:4100', 'http://127.0.0.1:4100'],
  credentials: true,                         // 쿠키 포함 크로스오리진 허용
});
await app.listen(process.env.PORT ?? 4000);
```

> ⚠️ `PORT` 환경 변수 없으면 4000 기본값. `start:dev` 스크립트가 `nest start`와 동일 (watch 모드 없음)

### 2.3 데이터베이스 스키마 (TypeORM 엔티티)

#### `users` 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT (PK) | AUTO_INCREMENT | 기본키 |
| `email` | VARCHAR | UNIQUE | 로그인 식별자 |
| `name` | VARCHAR | nullable | 표시명 |
| `password` | VARCHAR | `select: false` | bcrypt 해시 (기본 조회 제외) |
| `resume` | TEXT | nullable | 이력서 텍스트 (Adaptive 질문에 활용) |
| `hashedRefreshToken` | TEXT | nullable, `select: false` | bcrypt 해시된 Refresh Token |
| `createdAt` | DATETIME | auto | 생성일 |
| `updatedAt` | DATETIME | auto | 수정일 |
| **관계** | OneToMany | — | `interviewHistories: InterviewHistory[]` |

#### `interview_history` 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | INT (PK) | AUTO_INCREMENT | 기본키 |
| `user_id` | INT (FK) | `onDelete: CASCADE` | users 참조 |
| `question` | TEXT | — | AI가 생성한 면접 질문 |
| `userAnswer` | TEXT | nullable | 사용자 답변 |
| `aiScore` | INT | default: 0 | 0~100 점수 |
| `aiFeedback` | TEXT | nullable | AI 피드백 텍스트 |
| `isCorrect` | BOOLEAN | default: false | 70점 이상 = true |
| `createdAt` | DATETIME | auto | 생성일 |
| **관계** | ManyToOne → User | CASCADE | 유저 삭제 시 이력 함께 삭제 |

#### `daily_insights` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK) | 기본키 |
| `source` | VARCHAR | 'Wanted' / 'Programmers' / 'JobKorea' |
| `originalTitle` | TEXT | 원본 채용 공고 제목 |
| `summary` | TEXT | Gemini 1줄 요약 |
| `url` | TEXT | 원본 URL |
| `createdAt` | DATETIME | 스크래핑 시각 |

**DB 연결**: AWS RDS MariaDB (`hitori.csqqgw7388qj.ap-northeast-2.rds.amazonaws.com:3306`)
**SSL**: `rejectUnauthorized: false`
**TypeORM synchronize**: `true` (개발 환경에서 스키마 자동 동기화 ⚠️ 운영 위험)

---

## 3. API 엔드포인트 완전 명세

| 메서드 | 경로 | 가드 | 입력 | 출력 | 설명 |
|--------|------|------|------|------|------|
| POST | `/auth/register` | 없음 | `{ email, password, name, resume? }` | `{ id, email, name }` | 회원가입, 이메일 중복 검사 |
| POST | `/auth/login` | 없음 | `{ email, password }` | `{ accessToken }` + Set-Cookie | 로그인, RT HttpOnly 쿠키 설정 |
| POST | `/auth/refresh` | JwtRefreshGuard | 없음 (쿠키) | `{ accessToken }` + Set-Cookie | AT 재발급 + RT 갱신 (Rotation) |
| POST | `/auth/logout` | JwtAuthGuard | 없음 | `{ message }` | DB RT null화 + 쿠키 삭제 |
| GET | `/users/me` | JwtAuthGuard | 없음 (JWT) | User 객체 | JWT에서 userId 추출 → 사용자 조회 |
| POST | `/interviews/generate` | JwtAuthGuard | `{ topic }` | `{ question }` | Adaptive 질문 생성 (RAG 활용) |
| POST | `/interviews/evaluate` | JwtAuthGuard | `{ question, answer }` | InterviewHistory | 채점 + DB 저장 + 오답 Pinecone upsert |
| GET | `/insights` | JwtAuthGuard | `?limit=N` (max 50) | DailyInsight[] | 최신 인사이트 N개 (DESC) |

> ✅ **모든 도메인 API에 JwtAuthGuard 적용 완료**. IDOR 취약점 제거 (`:userId` URL 노출 없음).

---

## 4. JWT 인증 메커니즘 상세

### 4.1 토큰 발급 플로우

```
[로그인]
POST /auth/login { email, password }
  → AuthService.login()
    → createQueryBuilder.addSelect('user.password') ← select:false 컬럼 명시 조회
    → bcrypt.compare(입력PW, DB해시PW)
    → issueTokens(user)
      → AT: jwt.sign({ sub: userId, email }, ACCESS_SECRET, { expiresIn: '15m' })
      → RT: jwt.sign({ sub: userId, email }, REFRESH_SECRET, { expiresIn: '7d' })
      → bcrypt.hash(RT) → DB.hashedRefreshToken 저장
  ← Response: { accessToken } + Set-Cookie: refresh_token (HttpOnly, SameSite=Lax, Path=/, maxAge=7d)

[Refresh Token 재발급]
POST /auth/refresh (쿠키 자동 포함)
  → JwtRefreshGuard → JwtRefreshStrategy.validate()
    → DB에서 user 조회 (addSelect('user.hashedRefreshToken'))
    → bcrypt.compare(쿠키RT, DB해시값) ← 원본 RT는 클라이언트에만 존재
    → 검증 성공 시 req.user = { id, email }
  → AuthService.refresh(userId, email) → issueTokens() → 새 토큰 쌍 발급 + DB 교체
  ← Response: { accessToken } + 새 Set-Cookie (RT Rotation)

[로그아웃]
POST /auth/logout
  → authService.logout(userId): DB.hashedRefreshToken = null
  → res.clearCookie('refresh_token')
```

### 4.2 보안 설계 포인트

| 항목 | 구현 방식 | 보안 효과 |
|------|-----------|-----------|
| Refresh Token Rotation | 매 refresh마다 새 RT 발급, DB 교체 | 탈취된 RT 무효화 |
| DB에 해시값만 저장 | 원본 RT는 클라이언트 쿠키에만 존재 | DB 유출 시 RT 복원 불가 |
| `select: false` | password/hashedRefreshToken 기본 조회 제외 | 실수로 개인정보 노출 차단 |
| HttpOnly 쿠키 | RT를 JS로 접근 불가 | XSS로 RT 탈취 불가 |
| SameSite=Lax | CSRF 방지 | 외부 사이트에서 쿠키 자동 전송 차단 |

> ⚠️ **잔존 취약점**: Access Token이 `localStorage`에 저장됨 → XSS 공격 시 AT 탈취 가능. 메모리(React state) 저장 방식으로 개선 권장.

---

## 5. AI 파이프라인 상세

### 5.1 AiService 구현 (`@google/genai` SDK v1.48.0)

```typescript
// OnModuleInit에서 초기화
this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// 임베딩: 768차원 벡터 반환
async generateEmbedding(text: string): Promise<number[]> {
  const response = await this.ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text,
  });
  return response.embeddings?.[0]?.values || [];
}

// 텍스트 생성
async generateContent(prompt: string): Promise<string> {
  const response = await this.ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text || '';
}
```

### 5.2 면접 질문 생성 파이프라인 (RAG 패턴)

```
입력: topic (예: "Redis 캐싱")
  │
  ├─ 1. AiService.generateEmbedding(topic)
  │      → text-embedding-004 → 768차원 벡터
  │
  ├─ 2. PineconeService.queryVectors(embedding, topK=3, filter={userId})
  │      → 해당 유저의 과거 오답 중 topic과 유사한 3개 검색
  │      → matches[].metadata.question 리스트 반환
  │
  ├─ 3. 프롬프트 조립
  │      = "시니어 면접관 프롬프트"
  │      + topic
  │      + user.resume (있을 경우 연관 질문 생성)
  │      + pastMistakes (있을 경우 Adaptive 변형 요청)
  │      + "형식: [면접 질문만 출력]"
  │
  └─ 4. AiService.generateContent(prompt) → gemini-2.5-flash → 질문 1개
```

### 5.3 답변 채점 파이프라인

```
입력: question + answer
  │
  ├─ 1. AiService.generateContent(채점 프롬프트)
  │      프롬프트: "아래 질문과 답변을 평가해줘. JSON만 출력:"
  │               { score: 0~100, feedback: "보완점", isCorrect: boolean }
  │
  ├─ 2. JSON 파싱
  │      → 정규식 /\{[\s\S]*?\}/ 로 마크다운 래핑 제거
  │      → 파싱 실패 시 기본값 { score: 0, isCorrect: false } 반환
  │
  ├─ 3. InterviewHistory DB 저장
  │      { user, question, userAnswer, aiScore, aiFeedback, isCorrect }
  │
  └─ 4. isCorrect === false 이면 (70점 미만)
         → AiService.generateEmbedding(question + ' ' + answer)
         → PineconeService.upsertVectors([{
             id: `history_${savedHistory.id}`,
             values: vector,
             metadata: { userId, question, isCorrect: false }
           }])
         → 다음 면접 세션에서 Adaptive Questioning에 활용됨
```

> ⚠️ **Pinecone 타입 우회**: `(index.upsert as any)(vectors)` — SDK v7.x 타입과 실제 API 불일치로 인한 임시 처리

### 5.4 스크래핑 파이프라인

```
@Cron(EVERY_DAY_AT_MIDNIGHT)  ← @nestjs/schedule
handleDailyScraping()
  ├─ scrapeWanted()
  │    샘플HTML → cheerio 파싱 → Gemini 요약 → DailyInsight 저장
  ├─ scrapeProgrammers()
  │    동일 패턴
  └─ scrapeJobKorea()
       동일 패턴
```

> ⚠️ **중요**: `axios` import가 주석 처리되어 있음. 현재 하드코딩된 샘플 HTML만 처리. 실서비스 전 실제 HTTP 크롤링 구현 필수.

---

## 6. 프론트엔드 아키텍처 (Next.js 16)

### 6.1 핵심 설정

**`next.config.ts` — API 프록시**
```typescript
rewrites() {
  return [{ source: '/api/:path*', destination: 'http://localhost:4000/:path*' }]
}
// /api/auth/login → http://localhost:4000/auth/login
// 프록시 덕분에 CORS 없이 동일 오리진(4100)으로 백엔드 호출 가능
```

**`src/middleware.ts` — 라우트 가드**
```typescript
const PUBLIC_PATHS = ['/login', '/register'];
// 보호 대상: ['/', '/interview', '/notes', '/analytics']
// 검사: request.cookies.has('refresh_token')
// 인증 없으면 → /login?from=원래경로 리다이렉트
// HttpOnly 쿠키라 서버(Edge Runtime)에서만 읽기 가능 → 보안 우수
```

### 6.2 HTTP 클라이언트 (`src/lib/api.ts`)

```typescript
const api = axios.create({ baseURL: '/api', withCredentials: true });

// 요청 인터셉터: Axios 1.x 규격 준수
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`); // ← set() 명시 필수 (1.x)
  return config;
});

// 응답 인터셉터: isRefreshing 플래그로 무한루프 방지
let isRefreshing = false;
api.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401 && !original._retry && !isRefreshing) {
    original._retry = true;
    isRefreshing = true;
    try {
      const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      setAccessToken(data.accessToken);
      original.headers.set('Authorization', `Bearer ${data.accessToken}`);
      return api(original); // 원래 요청 재시도
    } catch {
      clearAccessToken();
      window.location.href = '/login'; // Refresh 실패 시 강제 로그인
    } finally { isRefreshing = false; }
  }
});
```

> ✅ **과거 버그 수정**: `config.headers.Authorization = ...` → `config.headers.set('Authorization', ...)` 로 변경하여 Axios 1.x 엄격한 AxiosHeaders 객체 문제 해결 (무한 API 재시도 루프 차단)

**`src/lib/auth.ts` — 토큰 유틸리티**

```typescript
const ACCESS_TOKEN_KEY = 'access_token';
export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const setAccessToken = (token) => localStorage.setItem(ACCESS_TOKEN_KEY, token);
export const clearAccessToken = () => localStorage.removeItem(ACCESS_TOKEN_KEY);
export const isLoggedIn = () => !!getAccessToken();
```

### 6.3 페이지 컴포넌트 상세

#### 대시보드 (`/` — `page.tsx`, 200줄)

| 기능 | 구현 |
|------|------|
| 인사이트 로딩 | `useEffect → api.get('/insights?limit=5')` |
| 로딩 스켈레톤 | `animate-pulse` CSS로 3개 플레이스홀더 표시 |
| 소스별 태그 스타일 | `SOURCE_STYLE` 맵: Wanted=cyan, Programmers=violet, JobKorea=rose |
| 스탯 카드 | 하드코딩 (연속학습4일, 목표10문제, 평균82점, 총47회) ← **미연동** |
| 사이드바 | `lg:` 이상에서만 표시 (반응형) |
| 로그아웃 | `api.post('/auth/logout')` → `clearAccessToken()` → `/login` 이동 |

#### 면접 세션 (`/interview` — `page.tsx`, 245줄)

3단계 `stage` 상태 머신:

```
'topic' → 주제 선택 + 빠른 선택 태그 6개 (Redis 캐싱, JVM GC, DB 인덱스 등)
    ↓ startInterview(): api.post('/interviews/generate', { topic })
'answering' → 질문 표시 (AI 면접관 버블) + 텍스트에어리어 (지원자 버블)
    ↓ submitAnswer(): api.post('/interviews/evaluate', { question, answer })
'result' → SVG 원형 게이지 (점수 시각화) + 피드백 텍스트
              → "다시 훈련하기" (stage 리셋) / "대시보드로 이동"
```

#### 로그인 (`/login` — `page.tsx`, 113줄)

```typescript
api.post('/auth/login', { email, password })
  → setAccessToken(data.accessToken)   // localStorage 저장
  → router.push('/')                    // 대시보드로 이동
```

- 배경 Orb 효과: `blur-[120px] animate-pulse` 둥근 색상 블롭
- Glassmorphism 카드: `backdrop-blur-xl bg-white/[0.04] border border-white/10`

### 6.4 UI 디자인 시스템

| 요소 | 구현 값 |
|------|---------|
| 배경색 | `#070711` (거의 검정에 가까운 인디고) |
| 주 색상 | Indigo `#6366f1` / Cyan `#06b6d4` / Violet 그라디언트 |
| 카드 패턴 | `backdrop-blur-xl bg-white/[0.04] border border-white/10 rounded-3xl` |
| Orb 효과 | `absolute blur-[120px] animate-pulse` 원형 색상 블롭 |
| 진입 애니메이션 | `animate-in fade-in slide-in-from-bottom-4 duration-500` |
| Neon Glow | `shadow-[0_0_20px_rgba(99,102,241,0.4)]` |
| 폰트 | Tailwind 기본 (system-ui) |

---

## 7. 시스템 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 관점 전체 흐름                      │
└─────────────────────────────────────────────────────────────────┘

① 회원가입 /register
   FE → POST /api/auth/register  (Next.js 프록시 → :4000/auth/register)
   BE → 이메일 중복 확인 → bcrypt.hash(PW, 10) → DB 저장
   ← { id, email, name }

② 로그인 /login
   FE → POST /api/auth/login { email, password }
   BE → addSelect('user.password') → bcrypt.compare → issueTokens()
   ← { accessToken (15분) } + Set-Cookie: refresh_token (HttpOnly, 7일)
   FE → localStorage.setItem('access_token', ...) → router.push('/')

③ 미들웨어 라우트 가드
   브라우저 → GET /  (Next.js Edge Runtime에서 먼저 처리)
   middleware.ts: request.cookies.has('refresh_token') 확인
     → 없으면 → 302 redirect /login?from=/
     → 있으면 → NextResponse.next() (페이지 렌더링 허용)

④ 대시보드 / 인사이트 로딩
   FE → GET /api/insights?limit=5  (Bearer AT 헤더 자동 첨부)
   BE → JwtAuthGuard 검증 → insightRepo.find({ order: DESC, take: 5 })
   ← DailyInsight[] (자정 Cron이 채워둔 데이터)
   FE → 인사이트 카드 렌더링

⑤ 면접 훈련 /interview
   [질문 생성]
   FE → POST /api/interviews/generate { topic }
   BE → generateEmbedding(topic) → queryVectors(3, {userId}) → 프롬프트 조립 → gemini-2.5-flash
   ← { question: "적응형 면접 질문" }

   [답변 채점]
   FE → POST /api/interviews/evaluate { question, answer }
   BE → gemini-2.5-flash 채점 → { score, feedback, isCorrect }
      → InterviewHistory DB 저장
      → isCorrect=false 이면 Pinecone upsert (다음 세션 Adaptive 자료)
   ← { aiScore, aiFeedback, isCorrect }

⑥ 토큰 만료 시 자동 갱신
   FE 인터셉터: 401 수신 → isRefreshing=true → POST /api/auth/refresh (쿠키 자동 포함)
   BE → JwtRefreshGuard → bcrypt.compare(RT, DB해시) → 새 토큰 쌍 발급 + DB 갱신
   ← { accessToken } + 새 Set-Cookie (RT Rotation)
   FE → setAccessToken(새AT) → 원래 요청 재시도

⑦ 매일 자정 백그라운드 작업
   ScraperService.@Cron(EVERY_DAY_AT_MIDNIGHT)
     → scrapeWanted / scrapeProgrammers / scrapeJobKorea
     → cheerio HTML 파싱 → Gemini 1줄 요약 → DailyInsight DB 저장
   (현재: 샘플 HTML 사용, 실제 HTTP 미구현)
```

---

## 8. 기술 스택 및 버전 정보

### 백엔드

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@nestjs/core` | ^11.0.1 | NestJS 프레임워크 |
| `@nestjs/typeorm` | ^11.0.1 | TypeORM 통합 |
| `@nestjs/schedule` | ^6.1.1 | Cron 스케줄러 |
| `@nestjs/jwt` | ^11.0.2 | JWT 발급/검증 |
| `@nestjs/passport` | ^11.0.5 | Passport.js 통합 |
| `@google/genai` | ^1.48.0 | Gemini API (text-embedding-004, gemini-2.5-flash) |
| `@pinecone-database/pinecone` | ^7.1.0 | Vector DB |
| `typeorm` | ^0.3.28 | ORM |
| `mysql2` | ^3.20.0 | MariaDB 드라이버 |
| `bcrypt` | ^6.0.0 | 패스워드/토큰 해싱 |
| `passport-jwt` | ^4.0.1 | JWT 전략 |
| `cookie-parser` | ^1.4.7 | 쿠키 파싱 미들웨어 |
| `cheerio` | ^1.2.0 | HTML 파싱 |
| `axios` | ^1.14.0 | HTTP 클라이언트 (스크래퍼용, 현재 미사용) |

### 프론트엔드

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `next` | 16.2.2 | React 프레임워크 (App Router) |
| `react` | 19.2.4 | UI 라이브러리 |
| `axios` | ^1.14.0 | HTTP 클라이언트 (인터셉터 기반) |
| `js-cookie` | ^3.0.5 | (설치됨, 현재 미사용 — localStorage 방식 사용) |
| `tailwindcss` | ^4 | CSS 유틸리티 (v4) |
| `typescript` | ^5 | 타입 안전성 |

---

## 9. 현재 코드 이슈 및 개선사항

### 9.1 ✅ 해결 완료 이력

| 날짜 | 문제 | 해결 |
|------|------|------|
| 2026-04-07 | 면접 API 인증 미적용 | `@UseGuards(JwtAuthGuard)` 컨트롤러 레벨 적용 |
| 2026-04-07 | `userId` URL 파라미터 노출 (IDOR) | `req.user.id` (JWT에서 추출) 방식으로 교체 |
| 2026-04-07 | 면접 API Mock 데이터 | 실제 `api.post()` 연동 |
| 2026-04-07 | `GET /insights` API 미구현 | ScraperController에 구현 + 대시보드 연동 |
| 2026-04-07 | `middleware.ts` 파일명 오류 (`proxy.ts`) | 표준 파일명 `middleware.ts`로 복원 |
| 2026-04-07 | Axios 1.x 무한 재시도 루프 | `headers.set()` 명시 + `isRefreshing` 플래그 추가 |
| 2026-04-07 | localStorage 토큰 코드 산재 | `lib/auth.ts` 유틸로 중앙화 |
| 2026-04-07 | 쿠키 `path` 미설정 (`/api`만 적용) | `path: '/'` 명시적 설정 |

### 9.2 🔴 현재 잔존 이슈 (Critical)

| 항목 | 현황 | 권장 해결책 |
|------|------|------------|
| Access Token XSS 취약점 | `localStorage` 저장 | React 메모리(state) 저장 또는 BFF 패턴 |
| 스크래핑 미구현 | `axios` 주석, 샘플 HTML만 | 실제 크롤링 로직 구현 |
| 스탯 카드 하드코딩 | 연속학습/평균점수 모두 고정값 | `interview_history` DB 집계 API 구현 |
| `(index.upsert as any)` | Pinecone SDK 타입 우회 | SDK v7.x API 확인 후 타입 정리 |

### 9.3 🟡 개선 권장 (Medium)

| 항목 | 현황 | 권장 해결책 |
|------|------|------------|
| `synchronize: true` | 자동 스키마 변경 (운영 위험) | TypeORM Migration 방식으로 전환 |
| `start:dev` 스크립트 | `nest start` (watch 없음) | `nest start --watch` 로 변경 |
| Gemini 응답 JSON 파싱 취약 | 정규식으로 마크다운 제거 | `response_format` 또는 structured output 활용 |
| 이력서 없는 경우 | 기본 프롬프트 fallback 없음 | resume null 케이스 프롬프트 분기 추가 |
| `js-cookie` 미사용 | 설치만 되어 있음 | 제거 또는 쿠키 기반 AT 저장 시 활용 |

### 9.4 🟢 향후 구현 예정 (Roadmap)

- **달력 기반 오답 노트** (`/notes`) — `interview_history` 날짜별 시각화
- **성장 분석 차트** (`/analytics`) — 점수 추세, 정답률 통계
- **소셜 로그인** — GitHub OAuth (취업 포트폴리오 연동)
- **실제 스크래핑** — Wanted/Programmers/JobKorea 실 크롤링
- **CI/CD** — GitHub Actions + AWS ECR/ECS 배포
- **스탯 카드 실연동** — DB 집계 쿼리 기반 통계 API

---

## 10. 로컬 개발 환경 실행 방법

```bash
# 백엔드 실행 (Port 4000)
cd backend
npm run start:dev       # nest start (watch 모드 없음 — 소스 변경 시 재시작 필요)

# 프론트엔드 실행 (Port 4100)
cd frontend
npm run dev             # next dev -p 4100

# 올바른 프론트엔드 실행 명령 (주의)
npm run dev    ✅   (package.json scripts.dev)
npm start dev  ❌   (잘못된 명령 — 'dev'를 디렉토리로 해석)
```

**환경 변수 (`backend/.env`)**
```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
GEMINI_API_KEY
PINECONE_API_KEY, PINECONE_INDEX
PORT (optional, default: 4000)
```
