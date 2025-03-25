FROM node:20-alpine

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 다운로드 및 로그 디렉토리 생성
RUN mkdir -p downloads logs backups

# 환경 변수 설정
ENV NODE_ENV=production

# 앱 실행
CMD ["node", "src/index.js"]
