# @lactea-blue/lululala 라이브러리 완전 분석 문서

> 분석일: 2026-04-07  
> 버전: 1.2.0  
> 패키지 경로: `backend/node_modules/@lactea-blue/lululala`

---

## 1. 전체 구조

### 파일 구조

```
dist/
├── index.js / index.d.ts              ← 진입점 (re-export 전용)
├── interceptor.js / interceptor.d.ts  ← NestJS HTTP 로깅 인터셉터
├── logger/
│   ├── logger.interface.js/.d.ts      ← 추상 기반 클래스 (Winston 설정 핵심)
│   ├── api-logger.js/.d.ts            ← HTTP API 로그 전용 logger
│   ├── custom-logger.js/.d.ts         ← 일반 콘솔/파일 logger (외부 공개)
│   └── exception-logger.js/.d.ts      ← 예외 전용 logger
└── model/
    └── api-log.model.js/.d.ts         ← 로그 데이터 모델 (RequestLog, ResponseLog, Duration)
```

### 공개 API (index.d.ts에서 export되는 것)

```typescript
// index.d.ts
export * from "./interceptor";          // → LoggingInterceptor
export * from "./logger/custom-logger"; // → CustomLogger
```

- `LoggingInterceptor`: NestJS `NestInterceptor` 구현체. HTTP 요청/응답/예외를 자동 로깅.
- `CustomLogger`: 사용자가 직접 주입해서 쓸 수 있는 범용 Winston logger wrapper.

`ExceptionLogger`, `ApiLogger`, `LoggerInterface`는 내부 전용이며 외부에서 직접 import 불가.

---

## 2. 각 클래스의 역할과 메서드 상세 분석

---

### 2-1. `LoggerInterface` (추상 기반 클래스)

**파일**: `dist/logger/logger.interface.js`

모든 Logger 클래스의 공통 추상 기반 클래스. Winston과 winston-daily-rotate-file을 직접 wrapping.

#### 추상 속성 (서브클래스에서 반드시 구현)

```typescript
protected readonly abstract formatter: Format;   // winston logform Format
protected readonly abstract dirname: string;      // 로그 파일 저장 디렉토리
protected readonly abstract filename: string;     // 로그 파일명 prefix
```

#### `getFileTransfer(): Transport`

winston-daily-rotate-file Transport를 생성해 반환한다.

```javascript
getFileTransfer() {
    return new winstonDaily({
        datePattern: 'YYYY-MM-DD',
        dirname: this.dirname,
        filename: this.filename + "_%DATE%.txt",
        maxSize: "10m",
        maxFiles: '2',
        createSymlink: true,
        symlinkName: this.filename + ".log"
    });
}
```

| 옵션 | 값 | 의미 |
|---|---|---|
| `datePattern` | `'YYYY-MM-DD'` | 파일명의 날짜 부분 포맷 |
| `dirname` | 서브클래스에서 지정 | 저장 디렉토리 |
| `filename` | `{prefix}_%DATE%.txt` | 실제 파일명 패턴 |
| `maxSize` | `"10m"` | 파일당 최대 크기 10MB |
| `maxFiles` | `'2'` | 최대 파일 수 2개 (오래된 것 자동 삭제) |
| `createSymlink` | `true` | 최신 로그 파일로 향하는 symlink 생성 |
| `symlinkName` | `{prefix}.log` | symlink 파일명 |

**중요**: maxFiles가 `'2'`(문자열)이므로, 날짜 기준 2일치 파일만 유지된다.

#### `getConsoleTransfer(): Transport`

콘솔(stdout) Transport를 생성한다. 레벨은 `'debug'`로 고정.

```javascript
getConsoleTransfer() {
    return new winston.transports.Console({
        level: 'debug',
        format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS' }),
            winston.format.colorize({ level: true }),
            winston.format.printf((info) => {
                if ('exceptionStack' in info.message) {
                    // 예외 로그: message와 stack만 별도 출력
                    const message = {
                        message: info.message.exceptionMessage,
                        stack: info.message.exceptionStack
                    };
                    return `[${info.timestamp}] [${info.level}] ${JSON.stringify(message, null, 2)}`;
                } else {
                    return `[${info.timestamp}] [${info.level}] ${JSON.stringify(info.message)}`;
                }
            })
        )
    });
}
```

콘솔 출력 포맷:
- 일반 로그: `[2026-04-07 09:30:00.123] [debug] {"requestLog": {...}, ...}`
- 예외 로그: `[2026-04-07 09:30:00.123] [error] {\n  "message": "...",\n  "stack": "..."\n}`

**주의**: 타임스탬프 포맷이 `hh:mm:ss` (12시간제)이다. `HH:mm:ss` (24시간제)가 아님.

#### `createLoggerByTransfers(transports): Logger`

실제 Winston logger 인스턴스를 생성한다.

```javascript
createLoggerByTransfers(transports) {
    return winston.createLogger({
        level: 'debug',
        format: this.formatter,   // 서브클래스가 정의한 파일 출력 formatter
        transports: transports
    });
}
```

- `level: 'debug'`: debug 이상 모든 레벨 로그 기록
- `format`: 파일 저장 시 사용되는 formatter (JSON 직렬화)
- `transports`: 콘솔 + (비로컬 환경에서만) 파일

#### `isLocalEnv(): boolean`

```javascript
isLocalEnv() {
    const nodeEnv = process.env.NODE_ENV;
    return !(nodeEnv === "dev" || nodeEnv === "development" ||
             nodeEnv === "prod" || nodeEnv === "production");
}
```

`NODE_ENV`가 `dev`, `development`, `prod`, `production` 중 하나가 아니면 `true`(로컬 환경)로 판단.  
로컬 환경에서는 파일 Transport를 추가하지 않아 파일에 저장하지 않는다.

**환경별 동작 정리**:
| NODE_ENV | 콘솔 출력 | 파일 저장 |
|---|---|---|
| `local` (또는 undefined 등) | O | X |
| `dev` / `development` | O | O |
| `prod` / `production` | O | O |

---

### 2-2. `ApiLogger`

**파일**: `dist/logger/api-logger.js`

HTTP API 요청/응답 로그 전용. `LoggingInterceptor` 내부에서만 사용된다 (외부 공개 안 됨).

```javascript
class ApiLogger extends LoggerInterface {
    constructor(configService) {
        super();
        this.configService = configService;
        this.dirname = "/logs/api/";
        this.filename = this.configService.get('API_LOG_FILE_NAME_PREFIX');
        this.formatter = winston.format.printf((info) => {
            let res = {
                "@timestamp": new Date(),
                "apiLog": info.message
            };
            return JSON.stringify(res);
        });
    }

    createLogger() {
        let transfers = [this.getConsoleTransfer()];
        if (!this.isLocalEnv()) transfers.push(this.getFileTransfer());
        return super.createLoggerByTransfers(transfers);
    }
}
```

| 속성 | 값 |
|---|---|
| `dirname` | `/logs/api/` (절대경로 하드코딩) |
| `filename` | `ConfigService.get('API_LOG_FILE_NAME_PREFIX')` |
| 파일 출력 포맷 | `{"@timestamp": Date, "apiLog": <message_object>}` |
| 사용 레벨 | `debug` (apiLogSave에서 `.debug()` 호출) |

파일에 저장되는 JSON 구조:
```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
  "apiLog": {
    "requestLog": { ... },
    "responseLog": { ... },
    "apiStartTime": "...",
    "apiEndTime": "...",
    "duration": { ... }
  }
}
```

---

### 2-3. `ExceptionLogger`

**파일**: `dist/logger/exception-logger.js`

예외(에러) 로그 전용. `LoggingInterceptor` 내부에서만 사용된다 (외부 공개 안 됨).

```javascript
class ExceptionLogger extends LoggerInterface {
    constructor(configService) {
        super();
        this.configService = configService;
        this.dirname = "/logs/exception/";
        this.filename = this.configService.get('EXCEPTION_LOG_FILE_NAME_PREFIX');
        this.formatter = winston.format.printf((info) => {
            let res = {
                "@timestamp": new Date(),
                "level": info.level,
                "message": info.message
            };
            return JSON.stringify(res);
        });
    }

    createLogger() {
        let transfers = [this.getConsoleTransfer()];
        if (!this.isLocalEnv()) transfers.push(this.getFileTransfer());
        return super.createLoggerByTransfers(transfers);
    }
}
```

| 속성 | 값 |
|---|---|
| `dirname` | `/logs/exception/` (절대경로 하드코딩) |
| `filename` | `ConfigService.get('EXCEPTION_LOG_FILE_NAME_PREFIX')` |
| 파일 출력 포맷 | `{"@timestamp": Date, "level": "error", "message": <exception_object>}` |
| 사용 레벨 | `error` (exceptionLogSave에서 `.error()` 호출) |

파일에 저장되는 JSON 구조:
```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
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

### 2-4. `CustomLogger`

**파일**: `dist/logger/custom-logger.js`

유일하게 외부로 공개(export)되는 logger 클래스. 사용자가 직접 NestJS에 주입해서 원하는 곳에서 쓸 수 있다.

```javascript
class CustomLogger extends LoggerInterface {
    constructor(configService) {
        super();
        this.configService = configService;
        this.dirname = "/logs/console/";
        this.filename = this.configService.get('CONSOLE_FILE_NAME_PREFIX');
        this.formatter = winston.format.printf((info) => {
            let res = {
                "@timestamp": new Date(),
                "level": info.level,
                "message": info.message,
            };
            return JSON.stringify(res);
        });
    }

    createLogger() {
        let transfers = [this.getConsoleTransfer()];
        if (!this.isLocalEnv()) transfers.push(this.getFileTransfer());
        return super.createLoggerByTransfers(transfers);
    }
}
```

| 속성 | 값 |
|---|---|
| `dirname` | `/logs/console/` (절대경로 하드코딩) |
| `filename` | `ConfigService.get('CONSOLE_FILE_NAME_PREFIX')` |
| 파일 출력 포맷 | `{"@timestamp": Date, "level": "...", "message": <any>}` |

파일에 저장되는 JSON 구조 (ExceptionLogger와 동일한 포맷):
```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
  "level": "debug",
  "message": "사용자가 로깅한 내용"
}
```

---

### 2-5. `LoggingInterceptor`

**파일**: `dist/interceptor.js`

NestJS `NestInterceptor` 인터페이스를 구현하는 핵심 인터셉터.

```typescript
export declare class LoggingInterceptor implements NestInterceptor {
    private readonly configService;
    constructor(configService: ConfigService);
    private apiLogger;
    private exceptionLogger;
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> | Promise<Observable<any>>;
    exceptionLogSave(context: ExecutionContext, exception: any, apiStartTime: Date): Promise<void>;
    apiLogSave(context: ExecutionContext, response: any | null, apiStartTime: Date): Promise<void>;
    private static getResponseLog;
    private static getRequestLog;
    private static getDuration;
}
```

#### `constructor(configService: ConfigService)`

```javascript
constructor(configService) {
    this.configService = configService;
    this.apiLogger = new ApiLogger(this.configService).createLogger();
    this.exceptionLogger = new ExceptionLogger(this.configService).createLogger();
}
```

생성 시 `ApiLogger`와 `ExceptionLogger` 두 개의 Winston logger 인스턴스를 즉시 초기화한다.

#### `intercept(context, next): Observable`

```javascript
intercept(context, next) {
    let apiStartTime = new Date();
    return next
        .handle()
        .pipe(
            tap((responseBody) => this.apiLogSave(context, responseBody, apiStartTime)),
            catchError(err => this.exceptionLogSave(context, err, apiStartTime))
        );
}
```

- 요청 진입 시점에 `apiStartTime` 기록
- `tap`: 정상 응답 시 `apiLogSave` 호출 (응답 body 전달)
- `catchError`: 에러 발생 시 `exceptionLogSave` 호출 (에러 객체 전달)

#### `apiLogSave(context, response, apiStartTime): Promise<void>`

정상 응답 로그를 `apiLogger.debug()`로 기록.

```javascript
async apiLogSave(context, response, apiStartTime) {
    const request = LoggingInterceptor.getRequestLog(context);
    let apiEndTime = new Date();
    let duration = LoggingInterceptor.getDuration(apiStartTime, apiEndTime);
    this.apiLogger.debug({
        requestLog: request,
        responseLog: LoggingInterceptor.getResponseLog(context, response),
        apiStartTime: apiStartTime,
        apiEndTime: apiEndTime,
        duration: duration,
    });
}
```

#### `exceptionLogSave(context, exception, apiStartTime): Promise<void>`

에러 발생 시 두 가지 로그를 동시에 기록한다.

```javascript
async exceptionLogSave(context, exception, apiStartTime) {
    let status = !exception.status ? exception.status : 500;
    context.switchToHttp().getResponse().statusCode = status;

    let errorCode = ('response' in exception)
        ? exception.code || '99999999'
        : '99999999';

    let errorCustomMessage = ('response' in exception)
        ? exception.response.message || exception.response
        : exception.message;

    if ('sql' in exception)
        errorCustomMessage += (" (sql: " + exception.sql + ")");

    let response = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: context.switchToHttp().getRequest().url,
        errorCode: errorCode,
        errorMessage: errorCustomMessage || ''
    };

    // 1) API 로그에도 에러 응답 기록
    await this.apiLogSave(context, response, apiStartTime);

    // 2) 예외 전용 로그에 상세 기록
    this.exceptionLogger.error({
        "requestLog": LoggingInterceptor.getRequestLog(context),
        "responseLog": LoggingInterceptor.getResponseLog(context, response),
        "exceptionMessage": errorCustomMessage,
        "exceptionStack": exception.stack
    });

    // 3) 예외를 다시 throw하여 NestJS 기본 에러 처리로 전파
    throw exception;
}
```

**버그 주의**: `status` 계산 로직이 반전되어 있다.

```javascript
let status = !exception.status ? exception.status : 500;
```

- `exception.status`가 falsy(0, undefined, null)이면 → `exception.status` (즉 falsy 값)
- `exception.status`가 truthy(예: 404, 500)이면 → `500` 고정

즉 `HttpException`처럼 `.status`가 있는 경우에도 항상 500을 반환한다. 실제 HTTP status code를 그대로 전달하려면 `exception.status || 500`이 되었어야 한다.

**errorCode 결정 로직**:
- `exception.response` 속성이 있으면: `exception.code` 또는 `'99999999'`
- `exception.response` 속성이 없으면: `'99999999'` 고정

**errorCustomMessage 결정 로직**:
- `exception.response` 있음: `exception.response.message` → `exception.response` 순서로 폴백
- `exception.response` 없음: `exception.message`
- `exception.sql` 속성이 있으면(TypeORM QueryFailedError 등): ` (sql: {쿼리})` 를 메시지에 추가

#### `static getRequestLog(context): object`

```javascript
static getRequestLog(context) {
    const request = context.switchToHttp().getRequest();
    let uri = request.originalUrl.split("?")[0];
    let httpMethod = request.method;
    let queryString = request.originalUrl.split("?")[1];
    let body = request.body;
    let query = request.query;
    let controllerMethodArgs = JSON.stringify({ "body": body, "query": query });
    let requestHeader = JSON.stringify(request.headers);
    return { uri, httpMethod, queryString, controllerMethodArgs, requestHeader };
}
```

반환 필드:
- `uri`: 쿼리스트링 제거된 경로 (예: `/api/users`)
- `httpMethod`: HTTP 메서드 (예: `GET`, `POST`)
- `queryString`: `?` 이후 문자열 (예: `page=1&size=10`), 없으면 `undefined`
- `controllerMethodArgs`: `{"body": {...}, "query": {...}}` JSON 문자열
- `requestHeader`: 전체 요청 헤더 JSON 문자열

#### `static getResponseLog(context, response): object`

```javascript
static getResponseLog(context, response) {
    return {
        "responseBody": JSON.stringify(response),
        "httpStatusCode": context.switchToHttp().getResponse().statusCode
    };
}
```

반환 필드:
- `responseBody`: 응답 객체의 JSON 문자열
- `httpStatusCode`: 현재 응답 객체의 statusCode (숫자)

#### `static getDuration(apiStartTime, apiEndTime): object`

```javascript
static getDuration(apiStartTime, apiEndTime) {
    const oneHour = 1000 * 60 * 60;
    const oneMin = 1000 * 60;
    const oneSec = 1000;
    let diff = Math.abs(apiEndTime.getMilliseconds() - apiStartTime.getMilliseconds());
    const diffHours = Math.floor(diff / oneHour);
    diff -= diffHours * oneHour;
    const diffMin = Math.floor(diff / oneMin);
    diff -= diffMin * oneMin;
    const diffSec = diff / oneSec;
    return {
        "time": diff,
        "unit": "MILLIS",
        "readableString": diffHours + "시간 " + diffMin + "분 " + diffSec + "초"
    };
}
```

**버그 주의**: `getMilliseconds()`는 0~999 사이의 밀리초 부분만 반환한다. 초(seconds) 차이가 포함되지 않는다. `getTime()`을 썼어야 올바른 elapsed time이 된다.  
예: 1.5초 걸린 요청 → `diff = |500 - 0| = 500ms`로 계산될 수 있음.

반환 필드:
- `time`: 밀리초 차이값 (버그로 인해 부정확할 수 있음)
- `unit`: 고정값 `"MILLIS"`
- `readableString`: 한국어 readable 형식 (예: `"0시간 0분 0.5초"`)

---

### 2-6. 데이터 모델 (`api-log.model`)

```typescript
class RequestLog {
    "uri": string;
    "httpMethod": string;
    "queryString": string;
    "controllerMethodArgs": string;
    "requestHeader": string;
}

class ResponseLog {
    responseBody: string | null;
    httpStatusCode: number;
}

class Duration {
    "time": number;
    "unit": string;
    "readableString": string;
}
```

이 클래스들은 선언만 있고 실제 로직이 없는 단순 data class이다. 타입 힌트용.

---

## 3. ConfigService에서 읽는 환경변수 키 목록

| 환경변수 키 | 사용하는 클래스 | 용도 | 파일 경로 구성 예시 |
|---|---|---|---|
| `API_LOG_FILE_NAME_PREFIX` | `ApiLogger` | API 로그 파일명 prefix | `/logs/api/{prefix}_%DATE%.txt` |
| `EXCEPTION_LOG_FILE_NAME_PREFIX` | `ExceptionLogger` | 예외 로그 파일명 prefix | `/logs/exception/{prefix}_%DATE%.txt` |
| `CONSOLE_FILE_NAME_PREFIX` | `CustomLogger` | 콘솔(커스텀) 로그 파일명 prefix | `/logs/console/{prefix}_%DATE%.txt` |

모두 `configService.get(키명)` 방식으로 읽으며, ConfigModule이 로드한 값이어야 한다. `.env` 파일이나 환경변수로 주입 가능.

**사용 예**:
```
API_LOG_FILE_NAME_PREFIX=myapp-api
EXCEPTION_LOG_FILE_NAME_PREFIX=myapp-exception
CONSOLE_FILE_NAME_PREFIX=myapp-console
```
→ 생성되는 파일: `/logs/api/myapp-api_2026-04-07.txt`

---

## 4. Winston 설정

### Transport 종류

1. **Console Transport** (항상 활성): 모든 환경에서 stdout에 출력
2. **DailyRotateFile Transport** (비로컬 환경만): NODE_ENV가 dev/development/prod/production일 때만 활성

### Console Transport Format

```javascript
winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS' }),
    winston.format.colorize({ level: true }),
    winston.format.printf(...)
)
```

- timestamp: 12시간제 (`hh:mm:ss.SSS`)
- colorize: 레벨 부분 색상 적용
- 출력 형식: `[타임스탬프] [레벨] JSON내용`

### File Transport Format (서브클래스별 고유 formatter)

각 logger별로 파일에 기록되는 JSON 구조:

**ApiLogger**:
```json
{ "@timestamp": "ISO날짜", "apiLog": { ...메시지_객체 } }
```

**ExceptionLogger**:
```json
{ "@timestamp": "ISO날짜", "level": "error", "message": { ...메시지_객체 } }
```

**CustomLogger**:
```json
{ "@timestamp": "ISO날짜", "level": "레벨", "message": ...메시지 }
```

**주의**: `@timestamp`에 `new Date()`가 들어가는데, JSON.stringify하면 ISO 8601 형식(`"2026-04-07T00:30:00.000Z"`)이 된다. 타임존은 서버 환경 종속.

### 파일 로테이션 설정

| 설정 | 값 |
|---|---|
| 파일명 패턴 | `{prefix}_%DATE%.txt` |
| 날짜 포맷 | `YYYY-MM-DD` (일별 로테이션) |
| 최대 파일 크기 | `10m` (10MB) |
| 최대 보관 파일 수 | `'2'` (2개, 즉 2일치) |
| Symlink 생성 | O (`{prefix}.log`로 최신 파일 가리킴) |

### Logger 레벨

모든 logger 인스턴스의 레벨: `'debug'` (debug, info, warn, error 모두 수집)

---

## 5. 로그 데이터 구조

### API 로그 (apiLogger.debug로 기록)

```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
  "apiLog": {
    "requestLog": {
      "uri": "/api/users",
      "httpMethod": "POST",
      "queryString": "page=1",
      "controllerMethodArgs": "{\"body\":{\"name\":\"홍길동\"},\"query\":{\"page\":\"1\"}}",
      "requestHeader": "{\"content-type\":\"application/json\", ...}"
    },
    "responseLog": {
      "responseBody": "{\"id\":1,\"name\":\"홍길동\"}",
      "httpStatusCode": 201
    },
    "apiStartTime": "2026-04-07T00:30:00.000Z",
    "apiEndTime": "2026-04-07T00:30:00.050Z",
    "duration": {
      "time": 50,
      "unit": "MILLIS",
      "readableString": "0시간 0분 0.05초"
    }
  }
}
```

### 예외 로그 파일 (exceptionLogger.error로 기록)

```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
  "level": "error",
  "message": {
    "requestLog": {
      "uri": "/api/users",
      "httpMethod": "POST",
      "queryString": undefined,
      "controllerMethodArgs": "{\"body\":{...},\"query\":{}}",
      "requestHeader": "{...}"
    },
    "responseLog": {
      "responseBody": "{\"statusCode\":500,\"timestamp\":\"...\",\"path\":\"/api/users\",\"errorCode\":\"99999999\",\"errorMessage\":\"에러 메시지\"}",
      "httpStatusCode": 500
    },
    "exceptionMessage": "에러 메시지",
    "exceptionStack": "Error: 에러 메시지\n    at Object.<anonymous> ..."
  }
}
```

### API 로그 파일 (에러 시, apiLogger에도 동시 기록)

에러 발생 시 `exceptionLogSave`가 `apiLogSave`를 먼저 호출하므로, API 로그 파일에도 에러 응답이 기록된다:
```json
{
  "@timestamp": "2026-04-07T00:30:00.000Z",
  "apiLog": {
    "requestLog": { ... },
    "responseLog": {
      "responseBody": "{\"statusCode\":500,\"timestamp\":\"...\",\"path\":\"...\",\"errorCode\":\"99999999\",\"errorMessage\":\"...\"}",
      "httpStatusCode": 500
    },
    "apiStartTime": "...",
    "apiEndTime": "...",
    "duration": { ... }
  }
}
```

### 콘솔 출력 형식

일반 로그:
```
[2026-04-07 09:30:00.123] [debug] {"requestLog":{...},"responseLog":{...},...}
```

예외 로그 (콘솔에서만 pretty-print):
```
[2026-04-07 09:30:00.123] [error] {
  "message": "에러 메시지",
  "stack": "Error: 에러 메시지\n    at ..."
}
```

---

## 6. Interceptor 동작 흐름

```
HTTP 요청 수신
      ↓
LoggingInterceptor.intercept()
  ↓ apiStartTime = new Date()
  ↓ next.handle() 실행 (컨트롤러 처리)
  ↓
  ┌──────────────────────────────────────────────────┐
  │                   pipe 처리                       │
  │                                                  │
  │  [정상 응답]          [에러 발생]                  │
  │  tap(responseBody)    catchError(err)             │
  │       ↓                    ↓                     │
  │  apiLogSave()         exceptionLogSave()          │
  │       ↓                    ↓                     │
  │  apiLogger.debug()    1. statusCode 조정          │
  │  (requestLog,         2. errorCode 결정           │
  │   responseLog,        3. errorMessage 구성         │
  │   startTime,          4. SQL 에러 메시지 추가       │
  │   endTime,            5. apiLogSave() 호출         │
  │   duration)              (API 로그에도 기록)        │
  │  응답 그대로 전달      6. exceptionLogger.error()  │
  │                          (예외 상세 기록)          │
  │                       7. throw exception          │
  │                          (NestJS 에러 핸들러로 전파) │
  └──────────────────────────────────────────────────┘
```

**핵심 흐름 특징**:
1. `tap`은 스트림을 수정하지 않고 side-effect만 실행. 응답 body는 그대로 downstream으로 전달됨.
2. `catchError`는 에러를 처리한 후 반드시 `throw exception`으로 재전파. NestJS의 ExceptionFilter가 정상 작동하도록 보장.
3. 에러 발생 시 API 로그와 예외 로그에 모두 기록 (중복 기록).
4. 에러 발생 시 `context.switchToHttp().getResponse().statusCode`를 직접 수정 (버그로 인해 항상 500으로 설정됨).

---

## 7. 재구현 시 주의사항

### 7-1. NestJS 버전 의존성

```json
"dependencies": {
    "@nestjs/common": "^9.0.0",
    "@nestjs/config": "^2.2.0",
    "rxjs": "^7.8.0",
    "winston": "^3.8.2",
    "winston-daily-rotate-file": "^4.7.1"
}
```

- **NestJS v9** 기준으로 개발됨
- NestJS v10/v11에서는 `@nestjs/common`의 `NestInterceptor`, `ExecutionContext`, `CallHandler` 인터페이스가 기본적으로 호환되지만, 피어 의존성 경고가 발생할 수 있음
- `@nestjs/config` v2는 NestJS v9 전용 버전임. NestJS v10+에서는 v3 이상 필요.

### 7-2. 파일 경로 하드코딩

`dirname`이 `/logs/api/`, `/logs/exception/`, `/logs/console/`로 절대경로 하드코딩되어 있다. Linux/Mac 환경 기준이며, Windows에서는 루트 경로 해석이 다르다.

재구현 시에는 `dirname`도 환경변수로 설정하거나 상대 경로를 허용하도록 수정이 필요할 수 있다.

### 7-3. 로그 인스턴스 생성 위치

`LoggingInterceptor` 생성자에서 `ApiLogger`와 `ExceptionLogger` 인스턴스를 즉시 만든다. 이는 NestJS DI 컨테이너 외부에서 직접 `new`로 생성하는 방식이므로, 생성 시점에 `ConfigService`가 완전히 초기화되어 있어야 한다.

### 7-4. 환경변수 누락 시 동작

`configService.get('API_LOG_FILE_NAME_PREFIX')`가 `undefined`를 반환하면, 파일명이 `undefined_%DATE%.txt`가 된다. 환경변수 미설정 시 방어 로직이 없다.

### 7-5. duration 계산 버그

```javascript
let diff = Math.abs(apiEndTime.getMilliseconds() - apiStartTime.getMilliseconds());
```

`Date.getMilliseconds()`는 전체 시간이 아닌 0~999ms 부분만 반환한다. 재구현 시 정확한 경과 시간을 원한다면:

```javascript
let diff = Math.abs(apiEndTime.getTime() - apiStartTime.getTime());
```

으로 수정해야 한다.

### 7-6. exceptionLogSave의 status 계산 버그

```javascript
let status = !exception.status ? exception.status : 500;
```

원래 의도는 `exception.status || 500`이었을 것이다. 현재 코드는 status가 있을 때 500을 반환하고, 없을 때 exception.status(undefined)를 반환한다.

### 7-7. LoggingInterceptor를 NestJS에 등록하는 방법

```typescript
// app.module.ts 또는 특정 module
import { LoggingInterceptor } from '@lactea-blue/lululala';
import { ConfigService } from '@nestjs/config';

// 전역 등록 (main.ts)
app.useGlobalInterceptors(new LoggingInterceptor(app.get(ConfigService)));

// 또는 Module 레벨 등록
@Module({
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useFactory: (configService: ConfigService) => new LoggingInterceptor(configService),
            inject: [ConfigService],
        },
    ],
})
```

### 7-8. CustomLogger 사용 방법

```typescript
import { CustomLogger } from '@lactea-blue/lululala';
import { ConfigService } from '@nestjs/config';

// NestJS Service 내부
@Injectable()
export class SomeService {
    private logger = new CustomLogger(this.configService).createLogger();
    
    constructor(private configService: ConfigService) {}
    
    doSomething() {
        this.logger.debug('처리 시작');
        this.logger.info({ key: 'value' });
        this.logger.error('에러 발생');
    }
}
```

### 7-9. 로그 파일 디렉토리 사전 생성 필요

`winston-daily-rotate-file`은 디렉토리가 없으면 에러를 던질 수 있다. 배포 환경에서 `/logs/api/`, `/logs/exception/`, `/logs/console/` 디렉토리가 미리 생성되어 있거나, `fs.mkdirSync`로 앱 시작 시 생성해두어야 한다.

### 7-10. 완전한 재구현을 위한 필수 npm 패키지

```
npm install winston winston-daily-rotate-file @nestjs/common @nestjs/config rxjs
```

---

## 요약 체크리스트

- [x] 진입점: `LoggingInterceptor`, `CustomLogger` 두 개만 외부 공개
- [x] 필요한 환경변수 3개: `API_LOG_FILE_NAME_PREFIX`, `EXCEPTION_LOG_FILE_NAME_PREFIX`, `CONSOLE_FILE_NAME_PREFIX`
- [x] `NODE_ENV`로 파일 저장 여부 결정 (dev/prod만 파일 저장)
- [x] 로그 파일 위치: `/logs/api/`, `/logs/exception/`, `/logs/console/` (하드코딩)
- [x] 파일 보관: 일별 로테이션, 최대 10MB, 최대 2개 파일
- [x] 로그 포맷: JSON (`@timestamp` 필드 포함)
- [x] 에러 발생 시 API 로그와 예외 로그에 동시 기록
- [x] 에러 후 반드시 `throw exception`으로 재전파
- [x] duration 계산과 status 계산에 버그 존재 (재구현 시 수정 권장)
