# IterateMe — LoggingInterceptor 구현 계획

> lululala(`@lactea-blue/lululala`) 패키지의 동작을 NestJS v11 호환 코드로 직접 재구현하고, 프로젝트에 적용하는 전체 계획.
> 참고: `lululala_research.md` (상세 분석 문서)

---

## 현황

- `main.ts`: 기존 lululala 코드 제거됨, LoggingInterceptor 미적용 상태
- `app.module.ts`: 삭제된 `LoggingMiddleware`를 여전히 import 중 → 컴파일 에러
- `src/common/interceptor/logging.interceptor.ts`: 현재 임시 구현체 존재 (lululala 구조와 불일치)
- `src/common/middleware/logging.middleware.ts`: 삭제됨

---

## 구현 목표

lululala의 동작을 그대로 재현. 단, 아래 버그는 수정:
1. `status` 계산 로직 반전 (`!exception.status ? ... : 500` → `exception.status ?? 500`)
2. `duration` 계산 오류 (`getMilliseconds()` → `Date.now()` 차이로 수정)

---

## 파일 구성 계획

```
src/common/
├── logger/
│   ├── logger.interface.ts       ← 추상 기반 클래스 (Winston 설정 공통 로직)
│   ├── api-logger.ts             ← API 정상 응답 로그 전용
│   ├── exception-logger.ts       ← 예외 로그 전용
│   └── custom-logger.ts          ← 외부 공개용 범용 logger (향후 사용)
├── interceptor/
│   └── logging.interceptor.ts    ← NestInterceptor 구현체
└── model/
    └── api-log.model.ts          ← RequestLog, ResponseLog, Duration 타입 정의
```

---

## 1. `api-log.model.ts`

```typescript
export interface RequestLog {
  uri: string;            // 쿼리스트링 제거된 경로
  httpMethod: string;     // GET, POST 등
  queryString: string | undefined;    // ?이후 문자열
  controllerMethodArgs: string;       // {"body":{...},"query":{...}} JSON 문자열
  requestHeader: string;              // 전체 헤더 JSON 문자열
}

export interface ResponseLog {
  responseBody: string;   // 응답 객체 JSON 문자열
  httpStatusCode: number; // 응답 statusCode
}

export interface Duration {
  time: number;           // 경과 밀리초 (Date.now() 차이, 버그 수정)
  unit: 'MILLIS';
  readableString: string; // "0시간 0분 1.234초"
}
```

---

## 2. `logger.interface.ts` (추상 기반 클래스)

lululala의 `LoggerInterface`를 그대로 재현.

```typescript
// 핵심 속성 (서브클래스에서 반드시 구현)
protected abstract readonly formatter: Format;
protected abstract readonly dirname: string;
protected abstract readonly filename: string;

// Winston DailyRotateFile transport 생성
getFileTransport(): Transport {
  return new DailyRotateFile({
    datePattern: 'YYYY-MM-DD',
    dirname: this.dirname,
    filename: this.filename + '_%DATE%.txt',
    maxSize: '10m',
    maxFiles: '2',        // 2일치만 유지
    createSymlink: true,
    symlinkName: this.filename + '.log',
  });
}

// Console transport 생성 (colorize + pretty print)
// timestamp format: 'YYYY-MM-DD hh:mm:ss.SSS' (12시간제, lululala 원본과 동일)
getConsoleTransport(): Transport { ... }

// NODE_ENV가 dev/development/prod/production이 아니면 true
isLocalEnv(): boolean { ... }

// 실제 winston.Logger 인스턴스 생성
createLoggerByTransports(transports): Logger { ... }
```

**환경별 동작**:
| NODE_ENV | 콘솔 출력 | 파일 저장 |
|---|---|---|
| `local` / 미설정 | O | X |
| `dev` / `development` | O | O |
| `prod` / `production` | O | O |

---

## 3. `api-logger.ts`

```typescript
class ApiLogger extends LoggerInterface {
  dirname = '/logs/api/';
  filename = configService.get('API_LOG_FILE_NAME_PREFIX');

  // 파일 저장 포맷
  formatter = winston.format.printf((info) => JSON.stringify({
    '@timestamp': new Date(),
    apiLog: info.message,
  }));

  createLogger(): Logger { ... }
}
```

**파일 저장 JSON 구조**:
```json
{
  "@timestamp": "2026-04-08T...",
  "apiLog": {
    "requestLog": { "uri", "httpMethod", "queryString", "controllerMethodArgs", "requestHeader" },
    "responseLog": { "responseBody", "httpStatusCode" },
    "apiStartTime": "...",
    "apiEndTime": "...",
    "duration": { "time", "unit", "readableString" }
  }
}
```

로그 파일 경로: `/logs/api/{API_LOG_FILE_NAME_PREFIX}_2026-04-08.txt`  
symlink: `/logs/api/{API_LOG_FILE_NAME_PREFIX}.log`

---

## 4. `exception-logger.ts`

```typescript
class ExceptionLogger extends LoggerInterface {
  dirname = '/logs/exception/';
  filename = configService.get('EXCEPTION_LOG_FILE_NAME_PREFIX');

  formatter = winston.format.printf((info) => JSON.stringify({
    '@timestamp': new Date(),
    level: info.level,
    message: info.message,
  }));
}
```

**파일 저장 JSON 구조**:
```json
{
  "@timestamp": "2026-04-08T...",
  "level": "error",
  "message": {
    "requestLog": { ... },
    "responseLog": { ... },
    "exceptionMessage": "에러 메시지",
    "exceptionStack": "Error: ...\n    at ..."
  }
}
```

---

## 5. `logging.interceptor.ts`

### 생성자

```typescript
constructor(private readonly configService: ConfigService) {
  this.apiLogger = new ApiLogger(configService).createLogger();
  this.exceptionLogger = new ExceptionLogger(configService).createLogger();
}
```

### `intercept()`

```typescript
intercept(context, next) {
  const apiStartTime = new Date();
  return next.handle().pipe(
    tap((responseBody) => this.apiLogSave(context, responseBody, apiStartTime)),
    catchError((err) => this.exceptionLogSave(context, err, apiStartTime)),
  );
}
```

### `apiLogSave()`

정상 응답 시 `apiLogger.debug()` 호출:
```typescript
this.apiLogger.debug({
  requestLog,
  responseLog,
  apiStartTime,
  apiEndTime,
  duration,  // Date.now() 차이 기반 (버그 수정)
});
```

### `exceptionLogSave()`

에러 시 처리 순서:
1. `status = exception.status ?? 500` (버그 수정)
2. response 객체 구성: `{ statusCode, timestamp, path, errorCode, errorMessage }`
   - `errorCode`: `exception.response` 있으면 `exception.code || '99999999'`, 없으면 `'99999999'`
   - `errorMessage`: `exception.response.message` → `exception.response` → `exception.message` 순 폴백
   - TypeORM QueryFailedError 감지: `'sql' in exception`이면 메시지에 `(sql: ...)` 추가
3. `apiLogSave()` 호출 (에러 응답도 API 로그에 기록)
4. `exceptionLogger.error()` 호출 (예외 전용 로그)
5. `throw exception` (NestJS 기본 에러 처리로 전파)

### `getRequestLog()` (static)

```typescript
{
  uri: request.originalUrl.split('?')[0],
  httpMethod: request.method,
  queryString: request.originalUrl.split('?')[1],       // 없으면 undefined
  controllerMethodArgs: JSON.stringify({ body, query }), // JSON 문자열
  requestHeader: JSON.stringify(request.headers),
}
```

### `getResponseLog()` (static)

```typescript
{
  responseBody: JSON.stringify(response),
  httpStatusCode: response.statusCode,
}
```

### `getDuration()` (static, 버그 수정)

```typescript
// 원본 lululala: getMilliseconds() 사용 → 부정확
// 수정: Date.now() 기반
const diff = apiEndTime.getTime() - apiStartTime.getTime();
const hours = Math.floor(diff / 3600000);
const mins  = Math.floor((diff % 3600000) / 60000);
const secs  = (diff % 60000) / 1000;
return {
  time: diff,
  unit: 'MILLIS',
  readableString: `${hours}시간 ${mins}분 ${secs}초`,
};
```

---

## 6. 프로젝트 적용

### `main.ts`

```typescript
import { LoggingInterceptor } from './common/interceptor/logging.interceptor';

const configService = app.get(ConfigService);
app.useGlobalInterceptors(new LoggingInterceptor(configService));
```

### `app.module.ts`

- `LoggingMiddleware` import 및 `NestModule`, `MiddlewareConsumer` 제거
- `AppModule`을 다시 일반 `@Module` 클래스로 복원

---

## 7. `.env` 필요 키

```env
API_LOG_FILE_NAME_PREFIX=api-iterateme-server
EXCEPTION_LOG_FILE_NAME_PREFIX=exception-iterateme-server
CONSOLE_FILE_NAME_PREFIX=console-iterateme-server
NODE_ENV=local   # local: 파일 미저장 / dev,prod: 파일 저장
```

---

## 8. 구현 순서

1. `src/common/model/api-log.model.ts` — 타입 정의
2. `src/common/logger/logger.interface.ts` — 추상 기반 클래스
3. `src/common/logger/api-logger.ts`
4. `src/common/logger/exception-logger.ts`
5. `src/common/logger/custom-logger.ts`
6. `src/common/interceptor/logging.interceptor.ts` — 기존 임시 구현 교체
7. `app.module.ts` — LoggingMiddleware 잔재 제거
8. `main.ts` — LoggingInterceptor 등록
