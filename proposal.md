## 🚀 Project : IterateMe
**서버 개발자 취업 성공을 위한 AI 기반 데일리 성장 플랫폼**

### 1. 핵심 기능 요구사항 (Functional Requirements)

#### **A. Daily Intelligence Pipeline (데이터 수집 및 분석)**
* **Trend & Job Scraping**: 매일 자정(Cron Job), 국내 주요 채용 플랫폼 및 기술 블로그(예: Toss, Karrot, Woowahan 등)를 스크래핑하여 트렌드를 분석합니다.
* **Targeted Listing**:
    * **대기업**: 신입/경력 무관 공고 필터링.
    * **중소기업**: '경력' 공고 위주(신입에게 요구되는 높은 수준의 역량 파악 목적).
* **Tech Issue Curation**: 오늘의 주요 기술 이슈(오픈소스 업데이트, 보안 취약점, 아키텍처 트렌드) 요약.

#### **B. Adaptive Interview Engine (맞춤형 면접 생성)**
* **Domain Focus**: 서버 개발, 인프라(AWS/Docker/K8s 등), 최신 트렌드 3가지 영역에 집중.
* **User-Centric Feedback Loop**: 
    * 사용자의 이전 답변 기록을 Vector DB(예: Pinecone, Weaviate)에 저장.
    * **발전성 유도**: 이미 정답을 맞춘 개념은 제외하거나 심화 질문으로 전환. 틀린 질문은 유사한 문맥으로 재구성하여 'Retry' 유도.
* **Difficulty Scaling**: 사용자의 성취도에 따라 질문의 난이도를 점진적으로 상향.
* **User Optimized**: 사용자의 이력서를 입력 받아 해당 사용자의 경험을 고려한 맞춤형 질문 또한 생성.

#### **C. Interactive Evaluation UI (상호작용 및 채점)**
* **Answer Interface**: 사용자가 텍스트로 답변할 수 있는 UI.
* **AI Grading**: LLM(GPT-4 혹은 Claude 3.5 등)을 활용하여 사용자의 답변을 '정확성', '논리성', '키워드 포함 여부'로 채점.
* **Best Practice Provision**: 채점 완료 후, 현업 관점에서의 모범 답안 및 추가 학습 키워드 제공.
* **Continuous Improvement**: 위 면접 결과 및 채용 공고를 바탕으로 사용자의 취약점을 분석하고, 이를 바탕으로 다음 날의 면접 질문을 생성합니다. 이를 위해 매일 결과를 저장합니다.

---

### 2. 기술 스택 (Proposed Tech Stack)
AI에게 개발을 요청할 때 참고할 수 있는 스택입니다.

* **Backend**: Typescript (NestJs) - AI 모델 라이브러리 연동에 최적.
* **Frontend**: React 또는 Next.js - 일기장 형태의 대시보드 및 인터랙티브 UI.
* **AI/LLM**: LangChain 또는 LlamaIndex (RAG 패턴 구현용).
* **Database**: MariaDB (사용자 데이터) + Vector DB (면접 이력 및 지식 베이스).
* **Automation**: GitHub Actions 또는 AWS EventBridge (자정 스케줄링).

---

### 3. 시스템 아키텍처 흐름 (Workflow)

1.  **Collection**: `Scraper Module`이 채용 정보와 기술 블로그 데이터를 수집하여 LLM에게 전달.
2.  **Analysis**: LLM이 수집된 데이터를 바탕으로 '오늘의 인사이트'와 '기업 리스트' 요약.
3.  **Personalization**: `History Analyzer`가 DB에서 사용자의 과거 답변 로그를 분석하여 취약점 추출.
4.  **Generation**: 분석된 데이터를 바탕으로 약 1시간 분량(10~15문항)의 맞춤형 면접 세션 생성.
5.  **Interaction**: 사용자가 웹 페이지 접속 후 답변 입력 → 실시간 채점 → 데이터 저장.

---

### 4. AI를 위한 프롬프트 가이드 (예시)

AI에게 실제 코딩을 시킬 때 아래와 같은 페르소나를 부여해 보세요.

> "너는 시니어 서버 개발자이자 기술 면접관이야. **IterateMe**라는 프로젝트의 백엔드 로직을 설계해줘. 특히 사용자의 과거 답변 기록을 분석해서, 맞춘 문제는 건너뛰고 틀린 문제는 변형해서 다시 질문하는 **'Adaptive Questioning'** 로직에 집중해서 알고리즘을 짜줘."