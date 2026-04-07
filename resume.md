# 이력서_유태현

## 인사말

---

- 아우토크립트에서 다양한 모빌리티 서비스들의 서버 개발을 담당하고 있는 3년차 백엔드 개발자 유태현입니다.

- 항상 질문을 통해 why를 생각하고, 본질을 이해하여 올바른 방향성과 효율성 있게 개발하는 것이 저의 장점이라고 생각하고 있습니다.  예시로 한가지 기술 스택으로 모든 것을 해결하기 보다는 각 기능의 목적과 역할을 정의하고 그에 맞는 기술들을 도입하고 사용하는 것을 선호합니다.

- =팀을 리딩하며 코드 컨벤션 정리, 전체 아키텍처 및 ERD 설계, 다양한 서비스들의 공통화 작업, MSA 구조로의 변환 등을 진행했습니다.

## Tech Stack

---

<aside>
💡 Langauge & Framework

- Spring Boot 2.x
- Kotlin
- Jpa
- NestJs
- Typescript
- TypeORM
- mysql

</aside>

<aside>
📢 Third Part Service

- AWS SQS
- Firebase
    - Cloud Message
    - Realtime Database
- Map Service
    - T-map
    - Kakao Map
    - Naver Map
- KG Inicis
</aside>

<aside>
💽 Infra & Database

- AWS ECS
- AWS RDS
    - mariaDB
    - AuroraDB
- AWS S3
- AWS EKS
- Redis
- Bitbucket Pipeline
</aside>

<aside>
💼 Communication Tools

- Microsoft Teams
- Notion
- Bitbucket
- Jira

</aside>

## 학력

---

- 포항공과대학교 컴퓨터공학과 : 2018.02 - 재학중

## 경력

---

- 아우토크립트 주식회사 (FMS개발그룹/팀장)
    
    2023.04 - 2024.09 
    
- 펜타시큐리티시스템 (모바일개발팀/팀원)
    
    2021.11 - 2023.04
    
- 아우토크립트 주식회사 (서비스기획팀/팀원)
    
    2021.02 - 2021.11
    
- 포항공과대학교 기술지주 주식회사 (인턴)
    
    2019.06 - 2019.08
    

## Project

---

- Greego (Personal Mobility 대여 서비스)
    - Personal Mobility 대여/반납, 결제 및 포인트, 대중교통 환승 리워드 등 Greego 서비스의 전반적인 기능 개발
    - Personal Mobility 데이터 수집
        - TCP 통신을 통한 자전거 IOT 데이터 수집 및 실시간 업데이트
        - Scheduling을 통한 전동킥보드, 전기오토바이 데이터 수집
    - 모빌리티 위치 데이터 실시간 업데이트 개발
        - Redis Pub/Sub을 통해 Client 사이드에 버스 데이터 실시간 노티
        - Firebase Realtime Database를 통해 Client 사이드에 Personal Mobility 데이터 실시간 노티
    - Dijkstra Algorithm을 활용하여 Persnoal Mobility, 버스, 도보를 종합한 최적의 이동경로 검색 기능 고도화
- 타보소 (DRT)
    - 사용자들의 새로운 요청에 따라 실시간으로 노선이 변경되는 다이나믹형 DRT 배차 로직 개발
    - 배차 기능의 동시성 문제로 인한 문제 해결
        - 배차 서버를 분리하고, AWS SQS를 이용하여 한번에 한 사용자의 요청에 대해서만 처리할 수 있도록 처리
    - T-Money PG사 연동 아키텍처 설계 및 개발
    - MSA 아키텍처 설계 및 개발
        - 6~7개의 서비스들을 보다 효율적으로 개발, 유지보수, 확장하기 위해 재사용성이 높은 모듈화된 구조가 필요하였고, 고민 끝에 MSA 아키텍쳐 선택 및 설계
        - DDD를 차용하여 크게 세 종류의 도메인 타입 (Auth & Common, Resource, Feature)을 분류하고, 각 도메인 타입에 알맞게 도메인 정의
        - 전체 서비스들에 적용할 수 있도록 확장 가능성 있는 데이터 베이스 설계
        - 속도감 있고, 안정적인 개발을 위해 Event Sourcing 보다는 Ochestration 방식을 이용
        - SAGA Pattern을 이용한 Transaction 처리
        - I/O 작업이 많은 Resource Type 서버들은 NestJs, 연산 작업이 많은 Feature 서버들은 Spring Boot로 구현
        - 내부 통신 효율화를 위해 서버들을 모두 EKS 환경으로 이관 처리
- 이동의 자유 (교통약자 택시 서비스)
    - 기존 EC2, Jenkins를 이용하여 단순 배포되던 구조에서 ECS, bitbucket pipeline을 이용하여 안정적인 무중단 배포가 되도록 개선
    - 주행 경로 데이터 S3로 이관
        - 기사의 주행 경로를 초 단위로 수집하다 보니 데이터가 크고 쿼리 성능 저하의 원인이 되어, 주행 경로 데이터를 MairaDB에서 S3에 수집 되도록 수정
    - IRSA (IAM Role for Service Account)를 이용하여 EKS 내부에서 AWS S3 접근할 수 있도록 수정
- 백엔드 개발팀 리딩
    - 신입사원 입사 시 온보딩 프로세스로 대략 2~4주간 pair programming 진행
    - 한 달에 한번 팀원들과의 1 대 1 미팅을 통한 Process 개선 논의 혹은 방향성 제시
    - 주 1회 Study한 내용들을 공유하는 Tech Weekly Squad 진행
    - 업무 진행도 파악과 문제해결을 위한 Daily Scrum 진행
    

## Contact

---

- email : yth001209@gmail.com
- phone : 010-8937-6843