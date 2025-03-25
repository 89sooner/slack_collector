# 펜션 예약 관리 시스템 - Slack 메시지 수집기

## 프로젝트 소개

이 프로젝트는 여러 예약 플랫폼(네이버, 야놀자, 에어비앤비, 여기어때)에서 Slack으로 전송되는 예약 메시지를 자동으로 수집하고 파싱하여 표준화된 형식으로 데이터베이스에 저장하는 애플리케이션입니다. 이를 통해 펜션 운영자는 여러 채널의 예약을 한 곳에서 관리할 수 있습니다.

## 주요 기능

- Slack 채널에서 실시간으로 예약 메시지 수집
- 다양한 플랫폼의 메시지 파싱 및 데이터 표준화
- 중복 예약 처리 및 예약 상태 관리
- REST API를 통한 예약 데이터 조회
- 시스템 상태 모니터링 및 로깅
- 데이터베이스 자동 백업

## 시스템 요구사항

- Node.js 20.x 이상
- PostgreSQL 14.x 이상
- Slack 봇 토큰 및 채널 ID
- Docker(선택사항)

## 시작하기

### 설치 방법

1. 저장소 복제

```bash
git clone https://github.com/89sooner/slack_collector.git
cd slack_collector
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

```bash
cp .env.sample .env
# .env 파일을 편집하여 필요한 설정을 입력합니다
```

4. 데이터베이스 설정

```sql
CREATE DATABASE pension_db;
```

### 실행 방법

#### 일반 실행

```bash
npm start
```

#### 개발 모드 실행

```bash
npm run dev
```

#### Docker로 실행

```bash
docker-compose up -d
```

## PM2로 프로세스 관리

### PM2 설치

```bash
npm install -g pm2
```

### PM2 명령어:

```bash
애플리케이션 시작: pm2 start ecosystem.config.js
상태 확인: pm2 status
로그 확인: pm2 logs
애플리케이션 중지: pm2 stop slack_collector
애플리케이션 재시작: pm2 restart slack_collector
```

### 시스템 재부팅 후 자동 시작 설정:

```bash
pm2 startup
pm2 save
```

## 환경 변수

주요 환경 변수 설명:

```bash
SLACK_BOT_TOKEN: Slack API 토큰
CHANNEL_ID_YANOLJA: 야놀자 예약 메시지가 오는 Slack 채널 ID
CHANNEL_ID_NAVER_BOOKING: 네이버 예약 메시지가 오는 Slack 채널 ID
CHANNEL_ID_AIRBNB: 에어비앤비 예약 메시지가 오는 Slack 채널 ID
CHANNEL_ID_YEOGI: 여기어때 예약 메시지가 오는 Slack 채널 ID

DB_USER: 데이터베이스 사용자 이름
DB_HOST: 데이터베이스 호스트
DB_DATABASE: 데이터베이스 이름
DB_PASSWORD: 데이터베이스 비밀번호
DB_PORT: 데이터베이스 포트

API_ENABLE: API 서버 활성화 여부 (true/false)
API_PORT: API 서버 포트 (기본값: 8090)
```

## 프로젝트 구조

```bash
/slack_collector
├── config/             # 설정 파일
├── src/
│   ├── api/            # API 서버 관련 코드
│   ├── platforms/      # 플랫폼별 파싱 모듈
│   │   ├── airbnb.js
│   │   ├── naver.js
│   │   ├── yanolja.js
│   │   └── yeogi.js
│   ├── utils/          # 유틸리티 함수
│   │   ├── cache/      # 캐싱 관련 모듈
│   │   ├── config/     # 설정 관련 모듈
│   │   ├── date/       # 날짜 처리 모듈
│   │   ├── db/         # 데이터베이스 관련 모듈
│   │   ├── file/       # 파일 처리 모듈
│   │   ├── format/     # 데이터 포맷팅 모듈
│   │   ├── logging/    # 로깅 모듈
│   │   ├── monitor/    # 모니터링 모듈
│   │   ├── slack/      # Slack API 모듈
│   │   └── validation/ # 데이터 검증 모듈
│   ├── tests/          # 테스트 코드
│   └── index.js        # 애플리케이션 진입점
├── downloads/          # 임시 다운로드 파일 저장소
├── logs/               # 로그 파일 저장소
├── backups/            # 데이터베이스 백업 저장소
├── Dockerfile          # Docker 이미지 정의
├── docker-compose.yml  # Docker 컴포즈 설정
├── package.json        # NPM 의존성 및 스크립트
└── README.md           # 프로젝트 문서
```

## API 엔드포인트

API가 활성화된 경우 사용할 수 있는 엔드포인트:

- GET /health - 서버 상태 확인
- GET /status - 시스템 모니터링 정보 조회
- GET /reservations - 예약 목록 조회 (쿼리 파라미터: platform, status, limit, offset)
- GET /reservations/:id - 특정 예약 정보 조회

## 디버깅 및 로깅

로그 파일은 logs 디렉토리에 저장됩니다. 로그 레벨은 환경 변수 LOG_LEVEL로 설정할 수 있습니다.

## 데이터베이스 백업

백업이 활성화된 경우 backups 디렉토리에 정기적으로 데이터베이스 백업이 생성됩니다. 백업 주기와 보관 기간은 환경 변수로 설정할 수 있습니다.

## 문제 해결

권한 관련 문제
Docker 컨테이너 내에서 로그 파일에 쓰기 권한 문제가 발생할 경우:

```bash
chmod -R 755 /path/to/slack_collector/logs
```

연결 문제
데이터베이스 연결 실패 시 확인할 사항:

1. 데이터베이스가 실행 중인지 확인
2. 환경 변수에 올바른 데이터베이스 연결 정보가 설정되었는지 확인
3. 방화벽 설정 확인

## 라이센스

ISC
