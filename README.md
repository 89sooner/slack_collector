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

## 시스템 아키텍처

### 전체 구조

애플리케이션은 다음과 같은 핵심 구성요소로 이루어져 있습니다:

1. **데이터 수집 모듈**: Slack API를 통해 각 플랫폼의 채널에서 메시지를 수집
2. **플랫폼별 파싱 엔진**: 각 예약 플랫폼에 특화된 메시지 파싱 로직 적용
3. **표준화 및 정규화 모듈**: 파싱된 데이터를 표준화된 형식으로 변환
4. **데이터베이스 저장소**: PostgreSQL 데이터베이스를 사용하여 예약 정보 저장
5. **REST API 서버**: 저장된 예약 데이터를 조회할 수 있는 인터페이스 제공
6. **모니터링 및 로깅 시스템**: 시스템 상태 및 로그 기록

### 데이터 흐름

```
Slack 채널 → 메시지 수집 → 플랫폼별 파싱 → 데이터 표준화 → 중복 검사 → 데이터베이스 저장 → API 노출
```

## 메시지 파싱 기능

각 플랫폼별 파싱 모듈은 다음과 같은 특성을 가집니다:

### 야놀자 (yanolja.js)

- 텍스트 기반 메시지 파싱 (plain text)
- 라인별 구조화된 정보 추출
- 예약 상태, 펜션명, 객실명, 체크인/아웃 날짜 등 정보 파싱

### 네이버 (naver.js)

- HTML 기반 메시지 파싱
- Cheerio 라이브러리를 사용한 HTML DOM 분석
- 예약자명, 예약번호, 객실명, 이용일시, 결제금액, 요청사항 등 추출

### 에어비앤비 (airbnb.js)

- 복잡한 텍스트 파싱 로직 구현
- 숙소명, 객실 번호, 특징(오션뷰, 독채 등) 파싱
- 예약 상태별 다른 파싱 전략 적용 (확정/대기/취소)

### 여기어때 (yeogi.js)

- HTML 및 텍스트 기반 파싱 지원
- 실패 시 대체 파싱 전략으로 자동 전환
- 제휴점명, 예약번호, 결제정보, 체크인/아웃, 전달사항 등 광범위한 정보 파싱

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
LOG_LEVEL: 로그 수준 (debug, info, warning, error)
LOG_MESSAGES_TO_FILE: 메시지 내용을 파일로 로깅할지 여부 (true/false)

BACKUP_ENABLED: 데이터베이스 백업 활성화 여부 (true/false)
BACKUP_INTERVAL_DAYS: 백업 실행 간격 (일)
BACKUP_RETENTION_DAYS: 백업 보존 기간 (일)
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
│   │   ├── yeogi.js
│   │   └── basePlatform.js  # 플랫폼 파서 기본 클래스
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
- GET /status - 시스템 모니터링 정보 조회 (처리된 메시지, 성공/실패 건수, 캐시 상태 등)
- GET /channels/status - 채널별 마지막 읽은 타임스탬프 정보
- GET /reservations - 예약 목록 조회 (쿼리 파라미터: platform, status, limit, offset)
- GET /reservations/:id - 특정 예약 정보 조회

### API 응답 예시:

```json
// GET /reservations
{
  "total": 120,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": "1",
      "platform": "네이버",
      "reservation_status": "예약확정",
      "guest_name": "홍길동",
      "reservation_number": "ABC12345",
      "check_in_date": "2023-06-15",
      "check_out_date": "2023-06-17",
      ...
    },
    ...
  ]
}
```

## 캐싱 시스템

시스템은 메모리 캐싱을 사용하여 성능을 최적화합니다:

- 이미 처리된 메시지 캐싱으로 중복 처리 방지
- TTL(Time-To-Live) 기반 자동 캐시 만료
- 최대 캐시 크기 제한으로 메모리 사용량 제어
- 성능 통계 수집 (히트율, 미스율 등)

## 테스트 및 품질 관리

### 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 테스트만 실행
npm test -- -g "formatHandler"

# 테스트 감시 모드
npm run test:watch

# 테스트 커버리지 보고서 생성
npm run test:coverage
```

### 테스트 범위:

- 유틸리티 함수 (formatHandler.test.js)
- 캐싱 시스템 (cache.test.js)
- 플랫폼별 파서 (준비 중)
- API 엔드포인트 (준비 중)

## Docker 배포 상세 설명

### Docker 구성

시스템은 다음과 같은 Docker 구성을 제공합니다:

1. **Dockerfile**: Node.js 20 Alpine 이미지 기반의 애플리케이션 컨테이너
2. **docker-compose.yml**: 애플리케이션 실행에 필요한 환경 구성
3. **권한 설정**: 비루트 사용자로 실행하여 보안 강화

### 볼륨 마운트

다음 디렉토리는 호스트와 공유됩니다:

- `./logs:/app/logs`: 로그 파일
- `./downloads:/app/downloads`: 임시 다운로드 파일
- `./backups:/app/backups`: 데이터베이스 백업
- `./data:/app/src/data`: 영구 데이터 저장소

### 환경별 배포

```bash
# 개발 환경
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 프로덕션 환경
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 디버깅 및 로깅

로그 파일은 logs 디렉토리에 저장됩니다. 로그 레벨은 환경 변수 LOG_LEVEL로 설정할 수 있습니다.

### 로그 레벨:

- debug: 상세 디버깅 정보 (개발 환경)
- info: 정상 작동 정보 (기본값)
- warning: 경고는 있지만 작동에 문제 없음
- error: 오류 발생, 작동 중단 가능성

### 로그 필터링:

```bash
# 에러 로그만 보기
grep "ERROR" logs/app.log

# 특정 플랫폼 로그만 보기
grep "AIRBNB" logs/app.log

# 오늘 생성된 로그만 보기
find logs -type f -name "*.log" -mtime -1 | xargs cat
```

## 데이터베이스 백업

백업이 활성화된 경우 backups 디렉토리에 정기적으로 데이터베이스 백업이 생성됩니다. 백업 주기와 보관 기간은 환경 변수로 설정할 수 있습니다.

### 수동 백업 생성:

```bash
node src/utils/createBackup.js
```

### 백업 복원:

```bash
psql -U postgres -d pension_db -f backups/pension_db_backup_2023_05_20.sql
```

## 문제 해결

### 권한 관련 문제

Docker 컨테이너 내에서 로그 파일에 쓰기 권한 문제가 발생할 경우:

```bash
chmod -R 755 /path/to/slack_collector/logs
```

Docker 볼륨 권한 문제 해결:

```bash
# 컨테이너 내부의 사용자 ID 확인
docker exec -it slack_collector id

# 호스트에서 권한 조정
chown -R 1000:1000 ./logs ./downloads ./backups ./data
```

### 연결 문제

데이터베이스 연결 실패 시 확인할 사항:

1. 데이터베이스가 실행 중인지 확인
2. 환경 변수에 올바른 데이터베이스 연결 정보가 설정되었는지 확인
3. 방화벽 설정 확인

Slack 연결 문제:

```bash
# Slack 토큰 유효성 검사
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/auth.test

# 채널 접근 권한 확인
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/conversations.info?channel=$CHANNEL_ID_YANOLJA
```

### 메시지 파싱 문제

특정 플랫폼의 메시지 파싱이 실패하는 경우:

1. LOG_LEVEL=debug 설정 후 로그 확인
2. LOG_MESSAGES_TO_FILE=true 설정하여 원본 메시지 저장
3. 다운로드된 HTML 파일 확인 (downloads 디렉토리)
4. 플랫폼 웹사이트 구조 변경 여부 확인

### 메모리 사용량 문제

메모리 사용량이 높은 경우:

```bash
# 캐시 최대 크기 제한 설정
# src/utils/cache/index.js에서 maxSize 옵션 조정

# Node.js 메모리 제한 설정
NODE_OPTIONS="--max-old-space-size=512" npm start
```

## 향후 개발 계획

1. **플랫폼 지원 확장**: 다양한 예약 플랫폼 추가 지원
2. **웹 기반 대시보드**: 예약 관리를 위한 웹 인터페이스 개발
3. **실시간 알림 시스템**: 새로운 예약, 취소 등에 대한 실시간 알림 기능
4. **통계 및 보고서**: 예약 데이터 기반 통계 및 보고서 기능
5. **사용자 인증 및 권한 관리**: API 접근을 위한 인증 시스템 구현

## 라이센스

ISC
