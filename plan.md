# IterateMe 기능 고도화 실행 계획서

> **작성일**: 2026-04-07 (피드백 반영 업데이트)
> **범위**: 대시보드 실데이터 연동 / 인사이트 고도화 / 면접 훈련 개선 / 이력서 관리

---

## 우선순위 및 의존성 순서

```
Phase 1 (DB 스키마 & API 기반)
  └─ [BE] DailyInsight 엔티티에 category, body, user_id 컬럼 추가
  └─ [BE] GET /users/stats API 신규 구현 (누적 학습일 기준)
  └─ [BE] PATCH /users/me/resume API 신규 구현
  └─ [BE] POST /insights/trigger API 신규 구현
  └─ [BE] GET /insights 멀티 카테고리 필터 + 페이지네이션 파라미터 확장
  └─ [BE] InterviewsService topic optional + RAG 분기 처리

Phase 2 (프론트엔드 구현)
  └─ [FE] 대시보드 스탯 카드 실데이터 연동
  └─ [FE] /notes, /analytics 404 수정 (Shell 페이지)
  └─ [FE] 인사이트 블로그 형태 + 전체보기 + 멀티 카테고리 필터
  └─ [FE] 면접 훈련 빈 주제 처리 (이력서 기반 자동 생성)
  └─ [FE] /resume 이력서 관리 페이지 신규 구현
```

---

## 1. 대시보드 — 실데이터 연동

### 1.1 현황 분석

현재 `frontend/src/app/page.tsx` 스탯 카드가 하드코딩 값:
```typescript
{ label: '연속 학습', value: '4일' },     // ← 하드코딩
{ label: '오늘의 목표', value: '10문제' }, // ← 하드코딩
{ label: '평균 점수', value: '82점' },     // ← 하드코딩
{ label: '총 훈련 횟수', value: '47회' },  // ← 하드코딩
```

### 1.2 [NEW] 백엔드: GET /users/stats API

**파일**: `backend/src/users/users.controller.ts`, `users.service.ts`

응답 DTO:
```json
{
  "totalStudyDays": 12,  // 누적 학습일 수 (면접 기록이 존재하는 날짜의 총 개수)
  "totalSessions": 47,   // 전체 훈련 횟수
  "avgScore": 82,        // 평균 점수 (소수점 반올림)
  "todayCount": 3        // 오늘 훈련 횟수
}
```

**totalStudyDays 계산 로직**:
- 연속 여부 관계없이 `interview_history.createdAt`에서 `DATE()` 단위로 DISTINCT 날짜 수 집계
- `SELECT COUNT(DISTINCT DATE(createdAt)) FROM interview_history WHERE user_id = ?`

**구현 위치**:
- `UsersService.getStats(userId: number)` 메서드 추가
- `UsersController`에 `@Get('stats') @UseGuards(JwtAuthGuard)` 추가

### 1.3 [MODIFY] 프론트엔드: 대시보드 스탯 카드

**파일**: `frontend/src/app/page.tsx`

- `useEffect`에서 `api.get('/users/stats')` 병렬 호출 추가
- 스탯 카드 동적 렌더링:
  ```
  { label: '누적 학습일', value: `${stats.totalStudyDays}일` }
  { label: '오늘의 훈련', value: `${stats.todayCount}회 완료` }
  { label: '평균 점수',   value: `${stats.avgScore}점` }
  { label: '총 훈련 횟수', value: `${stats.totalSessions}회` }
  ```
- 로딩 중 `animate-pulse` 스켈레톤 표시 (숫자 영역)

### 1.4 [NEW] /notes, /analytics 404 수정

**신규 파일**:
- `frontend/src/app/notes/page.tsx`
- `frontend/src/app/analytics/page.tsx`

구성: 헤더(대시보드 뒤로가기) + 중앙 아이콘/안내 메시지 + "대시보드로 돌아가기" Link

> `middleware.ts`의 matcher에 `/notes`, `/analytics` 이미 포함 → 인증 체크 그대로 유지

---

## 2. 오늘의 기술 인사이트 고도화

### 2.1 현황 분석

**기존 API**:
- `GET /insights?limit=N` — DailyInsight[] 반환 ✅ (이미 존재)
- `POST /insights/trigger` — 없음 ❌ (즉시 업데이트 API, 신규)

**DB 현황**: `source` 필드만 존재, `user_id` / `category` / `body` 필드 없음.

### 2.2 [MODIFY] 백엔드 DB 스키마: DailyInsight 확장

**파일**: `backend/src/scraper/entities/daily-insight.entity.ts`

추가 컬럼:
```typescript
export enum InsightCategory {
  COMPANY_TRENDS = 'company_trends', // 기업 동향
  VIBE_CODING    = 'vibe_coding',    // 바이브 코딩
  CSE            = 'cse',            // CSE 지식
}

@Entity('daily_insights')
export class DailyInsight {
  @PrimaryGeneratedColumn()
  id: number;

  // ✅ 신규: 사용자별 맞춤 인사이트 (user_id FK)
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ✅ 신규: 카테고리
  @Column({ type: 'enum', enum: InsightCategory, default: InsightCategory.COMPANY_TRENDS })
  category: InsightCategory;

  @Column()
  source: string;

  @Column({ type: 'text' })
  originalTitle: string;           // 블로그 제목

  @Column({ type: 'longtext' })
  body: string;                    // 블로그 본문 전체 (500~1000자)

  @Column({ type: 'text' })
  url: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

> `synchronize: true` 환경이므로 서버 재시작 시 자동 ALTER TABLE 적용됨.

> ⚠️ **기존 `summary` 컬럼 제거**: 이전엔 `summary` (1줄 짧은 요약)와 `body` (긴 본문)를 분리하려 했으나, 인사이트를 처음부터 블로그 글 형태의 전체 본문(`body`)으로만 관리하는 것으로 단일화. 대시보드 preview엔 `body`의 앞 100~150자를 잘라 표시함.

### 2.3 [MODIFY] 백엔드: ScraperService 카테고리 분리

**파일**: `backend/src/scraper/scraper.service.ts`

기존 3개 메서드를 카테고리 기반으로 재구성. **인사이트는 사용자 단위로 생성**:

```typescript
// trigger 시 userId를 받아 해당 유저의 인사이트를 생성
async generateAllInsights(userId: number): Promise<void> {
  await this.scrapeCompanyTrends(userId);
  await this.generateVibeCodingInsight(userId);
  await this.generateCSEInsight(userId);
}
```

**각 메서드의 프롬프트 설계**:

```
scrapeCompanyTrends(userId)       → category: COMPANY_TRENDS
  소스: Wanted, Programmers, JobKorea 기반 (기존 로직 이동)
  프롬프트:
    "취준생/주니어 서버 개발자 관점에서 국내 IT 기업 채용 동향을 분석한 블로그 포스팅을 작성해줘.
     제목 1줄 + 본문 500자 이상. 이미 잘 알려진 뻔한 내용보다 새로운 시각이나 인사이트를 담아줘.
     [아래는 최근 채용 공고 내용]: {크롤 결과}"

generateVibeCodingInsight(userId)  → category: VIBE_CODING
  소스: Gemini 자체 생성
  프롬프트:
    "바이브 코딩(Vibe Coding) 관련 블로그 포스팅을 작성해줘.
     단순 공식 문서 요약이 아닌, 실제 개발자들의 노하우, 팁, 경험담, 도구 활용법을 포함해.
     제목 1줄 + 본문 500자 이상.
     [중요] 아래 목록에 이미 다뤄진 주제는 제외하고 새로운 주제를 선택할 것:
     {기존 바이브코딩 인사이트 제목 목록}"

generateCSEInsight(userId)         → category: CSE
  소스: Gemini 자체 생성
  프롬프트:
    "서버 개발자 면접 대비 또는 실무에 유용한 CS 지식 블로그 포스팅을 작성해줘.
     OS, 네트워크, DB, 자료구조, 서버 아키텍처, 인프라, 데이터 엔지니어링 중 1주제 선택.
     제목 1줄 + 본문 500자 이상. 기초 개념도 좋고 최신 트렌드도 좋음.
     [중요] 아래 목록에 이미 다뤄진 주제는 제외하고 새로운 주제를 선택할 것:
     {기존 CSE 인사이트 제목 목록}"
```

**중복 방지 로직 (각 메서드 내부)**:
- 생성 전 해당 userId + category 조합의 기존 `originalTitle` 목록을 DB에서 조회
- 조회 결과를 프롬프트에 포함하여 Gemini가 중복 주제를 피하도록 함

**Cron Job**: `handleDailyScraping()`은 **모든 사용자에 대해** 각각 실행:
```typescript
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async handleDailyScraping() {
  const users = await this.userRepo.find();
  for (const user of users) {
    await this.generateAllInsights(user.id);
  }
}
```

### 2.4 [NEW] 백엔드: POST /insights/trigger

**파일**: `backend/src/scraper/scraper.controller.ts`

```typescript
@Post('trigger')
@UseGuards(JwtAuthGuard)         // 로그인한 모든 사용자 가능
@HttpCode(202)
async triggerScraping(
  @Req() req: Request & { user: { id: number } }
) {
  // 자신의 인사이트만 생성 (비동기 백그라운드 실행, 응답 즉시 반환)
  this.scraperService.generateAllInsights(req.user.id)
    .catch(err => this.logger.error('트리거 스크래핑 실패', err));
  return { message: '인사이트 생성을 시작했습니다. 잠시 후 새로고침 해주세요.' };
}
```

### 2.5 [MODIFY] 백엔드: GET /insights 확장

**파일**: `backend/src/scraper/scraper.controller.ts`

```
기존: GET /insights?limit=N               → DailyInsight[]
변경: GET /insights?limit=N&categories=vibe_coding,cse&page=1
           (멀티 카테고리: 쉼표 구분)
     → { items: DailyInsight[], total: number, page: number, totalPages: number }
```

구현:
```typescript
@Get()
async getInsights(
  @Req() req,
  @Query('limit') limit = '10',
  @Query('categories') categories?: string,  // "vibe_coding,cse" 형태
  @Query('page') page = '1',
) {
  const take = Math.min(parseInt(limit) || 10, 50);
  const skip = (parseInt(page) - 1) * take;
  const categoryFilter = categories
    ? categories.split(',') as InsightCategory[]
    : undefined;

  const where: any = { user: { id: req.user.id } };
  if (categoryFilter?.length) {
    where.category = In(categoryFilter);  // TypeORM In() 연산자
  }

  const [items, total] = await this.insightRepo.findAndCount({
    where, order: { createdAt: 'DESC' }, take, skip,
  });
  return { items, total, page: parseInt(page), totalPages: Math.ceil(total / take) };
}
```

> ⚠️ **응답 형태 변경**: 프론트엔드 대시보드의 `data` → `data.items` 파싱 수정 필요

### 2.6 [NEW] 프론트엔드: /insights 전체보기 페이지

**신규 파일**: `frontend/src/app/insights/page.tsx`

구성:
- 헤더: 대시보드 뒤로가기 + **"지금 인사이트 업데이트"** 버튼 (POST /insights/trigger)
- **멀티 카테고리 필터**: 체크박스 또는 토글 버튼 방식
  - `[ ] 전체` / `[✓] 🏢 기업 동향` / `[✓] 🤖 바이브 코딩` / `[✓] 📚 CSE 지식`
  - 선택된 카테고리를 쉼표로 조합 → `?categories=vibe_coding,cse`
- **블로그 카드 레이아웃**:
  - 제목(`originalTitle`) + 본문 앞부분(150자) 미리보기
  - 클릭 시 body 전체 인라인 펼치기 (accordion)
  - 카테고리 뱃지, 생성일 표시
- **페이지네이션** (`?page=N`)
- "업데이트" 버튼 클릭 시 로딩 스피너 → 성공 메시지 → 목록 자동 갱신

**파일**: `frontend/src/app/page.tsx` (대시보드)
- "전체 보기" 버튼 → `/insights` 링크로 변경
- 인사이트 fetch 응답 파싱을 `data.items`로 수정
- 대시보드 카드 preview는 `body.slice(0, 150) + '...'` 로 표시

---

## 3. 면접 훈련 — N개 문제 일괄 생성 + DB 기반 맥락 활용

### 3.1 현황 분석 및 문제점

**AS-IS 구조 문제점**:
1. **한 번에 1개 질문만** 생성 → 세션이 짧고 비효율적
2. **topic 있을 때만 Pinecone RAG 사용** → topic 없이 시작하면 과거 정답 문제가 중복 출제될 수 있음
3. **중복 방지 로직 없음** → 이미 맞춘 문제가 반복 출제 가능

**TO-BE 구조**:
- 사용자가 문제 수(N) 직접 입력 → **N개를 한 번에 생성·반환**
- topic 유무와 무관하게 **DB에서 과거 기록 전체 조회** → 프롬프트에 맥락 제공
  - **정답 문제 목록** → "이미 아는 주제이므로 제외" (중복 방지)
  - **오답 문제 목록** → "약점이므로 변형하여 포함" (Adaptive 강화)
- Pinecone은 **topic이 있을 때만** 여전히 사용 (topic 관련 과거 오답 벡터 검색)

### 3.2 [MODIFY] 백엔드: InterviewsService — generateQuestions

**파일**: `backend/src/interviews/interviews.service.ts`

**함수 시그니처 변경**:
```typescript
// 기존
async generateQuestion(userId: number, topic: string): Promise<string>

// 변경
async generateQuestions(userId: number, n: number, topic?: string): Promise<string[]>
```

**내부 로직**:

```
1. [DB 조회] 해당 유저의 interview_history 전체 가져오기
   → correctQuestions  = isCorrect === true  인 question 텍스트 목록
   → wrongQuestions    = isCorrect === false 인 question 텍스트 목록

2. [Pinecone RAG] topic이 있을 때만 실행
   → AiService.generateEmbedding(topic)
   → PineconeService.queryVectors(embedding, topK=5, { userId })
   → 벡터 유사도 기반 추가 오답 맥락 확보 (wrongQuestions와 합산)

3. [프롬프트 조립]
   시스템: "너는 시니어 서버 개발자 면접관이야."

   [topic 있을 때]
     주제: {topic}

   [이력서 있을 때]
     지원자 이력서: {user.resume}

   [공통 맥락]
     이미 정확히 아는 주제 (출제 금지): [
       {correctQuestions 목록}
     ]
     취약 개념 (변형하여 반드시 포함): [
       {wrongQuestions 목록}
     ]

   지시: "위 조건을 반영하여 면접 질문 {n}개를 생성해.
           JSON 배열 형태로만 출력: [\"질문1\", \"질문2\", ...]"

4. [JSON 파싱] Gemini 응답에서 배열 추출
   → 정규식 /\[.*\]/s 로 JSON array 파싱
   → 파싱 실패 시 줄바꿈 기준 split fallback
```

**DB 기반 맥락 로직 요약**:

| 과거 기록 | 프롬프트 역할 | 효과 |
|-----------|--------------|------|
| 정답 문제 (isCorrect=true) | "출제 금지 목록" | 중복 방지 |
| 오답 문제 (isCorrect=false) | "약점 집중 목록" | Adaptive 강화 |
| Pinecone (topic 있을 때만) | 벡터 유사도 기반 추가 오답 | 주제 관련 약점 강화 |

### 3.3 [MODIFY] 백엔드: InterviewsController — generateQuestions

**파일**: `backend/src/interviews/interviews.controller.ts`

```typescript
// 기존
@Post('generate')
async generateQuestion(
  @Req() req,
  @Body('topic') topic: string,
) {
  const question = await this.interviewsService.generateQuestion(req.user.id, topic);
  return { question };
}

// 변경
@Post('generate')
async generateQuestions(
  @Req() req,
  @Body('topic') topic?: string,   // optional
  @Body('n') n: number = 5,        // 문제 수 (기본값 5)
) {
  const questions = await this.interviewsService.generateQuestions(req.user.id, n, topic);
  return { questions };            // string[] 반환
}
```

**API 변경 요약**:
```
기존: POST /interviews/generate { topic }     → { question: string }
변경: POST /interviews/generate { topic?, n } → { questions: string[] }
```

> `POST /interviews/evaluate`는 **개별 채점 구조 유지** (한 문제씩 submit)

### 3.4 [MODIFY] 프론트엔드: 면접 세션 UI 전면 개편

**파일**: `frontend/src/app/interview/page.tsx`

**Stage 흐름 변경**:

```
기존: topic → 질문 1개 → 답변 → 결과 (3단계)
변경: 설정 → 질문 N개 순차 진행 → 전체 결과 (3단계)
       ↑ topic (optional) + n (문제 수)
```

**Stage 1: 설정 화면 (기존 'topic' stage 확장)**
```
┌─────────────────────────────────────────┐
│  새로운 훈련 시작                        │
│                                         │
│  주제 (선택): [Redis 캐싱 전략...    ]  │  ← optional
│  💡 비워두면 AI가 내 약점 중심으로 출제 │
│                                         │
│  빠른 선택: [Redis] [JVM GC] [DB 인덱스]│
│                                         │
│  문제 수:  [ 3문제 ] [ 5문제 ] [ 10문제 ]│  ← 신규 (preset 버튼)
│                                         │
│  [면접 시작 →]                          │
└─────────────────────────────────────────┘
```

**Stage 2: 순차 답변 화면**
```
[문제 2 / 5]                 ← 진행 상태 표시

AI 면접관: {questions[currentIdx]}

나의 답변: [텍스트에어리어]

[이전 문제]  [다음 문제 / 제출]
```
- `currentIdx` state로 현재 문제 인덱스 관리
- 각 문제 제출 시 `POST /interviews/evaluate` 개별 호출
- 결과(feedback)는 results[] 배열에 누적 저장

**Stage 3: 전체 결과 화면**
```
[문제 1] 85점 ✓ — 피드백 내용...
[문제 2] 42점 ✗ — 피드백 내용...
...
[문제 N] 70점 ✓ — 피드백 내용...

평균 점수: 72점  정답: 3/5
[다시 훈련하기] [대시보드로]
```

**State 구조 변경**:
```typescript
// 기존
const [question, setQuestion] = useState('');
const [feedback, setFeedback] = useState<FeedbackResult | null>(null);

// 변경
const [n, setN] = useState(5);                       // 문제 수
const [questions, setQuestions] = useState<string[]>([]);
const [currentIdx, setCurrentIdx] = useState(0);     // 현재 문제 인덱스
const [answers, setAnswers] = useState<string[]>([]);
const [results, setResults] = useState<FeedbackResult[]>([]);
```

**placeholder 및 버튼 텍스트**:
| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 주제 placeholder | `예: Redis 캐싱 전략...` | `비워두면 AI가 과거 오답 중심으로 자동 출제합니다 ✨` |
| 시작 버튼 비활성 조건 | `!topic \|\| isLoading` | `isLoading` |
| 시작 버튼 텍스트 | `면접 질문 받기 →` | `{n}문제 시작하기 →` |

---

## 4. 나의 이력서 관리 (신규 기능)

### 4.1 [MODIFY] 백엔드: PATCH /users/me/resume

**파일**: `backend/src/users/users.service.ts`, `users.controller.ts`

```typescript
// Service
async updateResume(userId: number, resume: string): Promise<{ resume: string }> {
  await this.userRepo.update(userId, { resume });
  return { resume };
}

// Controller
@Patch('me/resume')
@UseGuards(JwtAuthGuard)
async updateResume(@Req() req, @Body('resume') resume: string) {
  return this.usersService.updateResume(req.user.id, resume);
}
```

> `GET /users/me` 기존 API에 `resume` 필드 이미 포함 → 조회는 추가 구현 불필요

### 4.2 [NEW] 프론트엔드: /resume 이력서 관리 페이지

**신규 파일**: `frontend/src/app/resume/page.tsx`

UI 구성:
```
┌──────────────────────────────────────┐
│ ← 대시보드    IterateMe   📄 이력서  │  ← 헤더
├──────────────────────────────────────┤
│ 📄 나의 이력서                       │
│                                      │
│ 이력서는 AI 면접 질문 생성 및        │
│ Adaptive 질문 최적화에 활용됩니다.   │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ 텍스트에어리어 (rows=20)       │   │
│ │ 현재 저장된 이력서 자동 로드   │   │
│ └────────────────────────────────┘   │
│                                      │
│  [저장하기]  [초기화]                │
│  ✅ 저장 완료 (성공 시 표시)         │
│                                      │
│ 💡 마크다운 형식 권장               │
└──────────────────────────────────────┘
```

기능:
1. 진입 시 `GET /users/me` → `data.resume` 로드
2. 텍스트에어리어 자유 편집
3. "저장하기" → `PATCH /users/me/resume { resume }` 호출
4. 성공 시 인라인 ✅ 메시지 표시
5. 변경 미저장 이탈 시 `beforeunload` 경고

### 4.3 사이드바 + 미들웨어 수정

**파일**: `frontend/src/app/page.tsx`
```typescript
const NAV_ITEMS = [
  { icon: '⚡', label: '대시보드',    href: '/' },
  { icon: '🎯', label: '면접 훈련',  href: '/interview' },
  { icon: '📓', label: '오답 노트',  href: '/notes' },
  { icon: '📊', label: '성장 분석',  href: '/analytics' },
  { icon: '📄', label: '나의 이력서', href: '/resume' },  // 신규 추가
];
```

**파일**: `frontend/src/middleware.ts`
```typescript
matcher: ['/', '/interview', '/notes', '/analytics', '/insights', '/resume'],
```

---

## 5. 파일 변경 목록 요약

### 백엔드

| 파일 | 구분 | 변경 내용 |
|------|------|-----------|
| `scraper/entities/daily-insight.entity.ts` | MODIFY | user_id FK, category enum, body longtext 추가 / summary 컬럼 제거 |
| `scraper/scraper.service.ts` | MODIFY | 카테고리별 메서드 분리, 사용자별 생성, 중복 방지 프롬프트, generateAllInsights(userId) |
| `scraper/scraper.controller.ts` | MODIFY | POST /insights/trigger (JWT userId 활용), GET /insights 멀티 필터/페이지 확장 |
| `users/users.service.ts` | MODIFY | getStats() (누적 학습일), updateResume() 메서드 추가 |
| `users/users.controller.ts` | MODIFY | GET /users/stats, PATCH /users/me/resume 추가 |
| `interviews/interviews.service.ts` | MODIFY | generateQuestions(n, topic?) 으로 전환, DB 과거기록 전체 조회, 중복방지+약점강화 프롬프트 |
| `interviews/interviews.controller.ts` | MODIFY | POST /interviews/generate 응답 string → string[], @Body('n') 추가 |

### 프론트엔드

| 파일 | 구분 | 변경 내용 |
|------|------|-----------|
| `app/page.tsx` | MODIFY | 스탯 실데이터 연동, 인사이트 응답 구조 변경 대응, 사이드바 이력서 추가 |
| `app/notes/page.tsx` | NEW | "준비 중" Shell 페이지 |
| `app/analytics/page.tsx` | NEW | "준비 중" Shell 페이지 |
| `app/insights/page.tsx` | NEW | 전체 인사이트 목록, 멀티 카테고리 필터, 블로그 레이아웃 |
| `app/resume/page.tsx` | NEW | 이력서 조회/편집/저장 |
| `app/interview/page.tsx` | MODIFY | N개 문제 일괄 생성 구조로 전면 개편 (설정→순차 답변→전체 결과), 문제 수 preset 버튼, 빈 주제 허용 |
| `middleware.ts` | MODIFY | /insights, /resume 보호 경로 추가 |

---

## 6. 확정 사항 (피드백 반영)

| 항목 | 결정 내용 |
|------|-----------|
| 인사이트 즉시 업데이트 권한 | 로그인한 모든 사용자 가능 (자신의 인사이트만 생성) |
| 인사이트 본문 구조 | summary 컬럼 제거. `body` 단일 필드로 통일. 대시보드 preview는 body 앞 150자 slice |
| 카테고리 선택 방식 | 처음부터 멀티 선택 구현 (`?categories=vibe_coding,cse` 쉼표 구분) |
| 학습일 계산 방식 | 누적 학습일 (연속 여부 관계없이 면접 기록이 있는 날짜의 총 수) |
| 인사이트 중복 방지 | 기존 생성 제목 목록을 Gemini 프롬프트에 포함하여 새로운 주제 선택 유도 |
| 바이브 코딩 범위 | 공식 Document 요약 외에 실제 개발자 노하우, 팁, 경험담 포함 |
| Pinecone RAG 범위 | topic이 있을 때만 사용. topic 없을 때는 DB에서 오답 목록 직접 조회하여 프롬프트에 추가 |
| 면접 문제 생성 구조 | 한 번에 N개 일괄 생성 (사용자가 3/5/10 중 선택). 정답 문제=중복방지, 오답 문제=약점강화 |
| 면접 세션 흐름 | 설정(topic+N) → N개 순차 답변 → 전체 결과(평균점수+정답수) |