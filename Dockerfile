FROM node:20-alpine

# 로그 디렉토리 소유권 설정을 위해 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 디렉토리 생성 및 권한 설정
RUN mkdir -p /app/downloads /app/logs /app/backups /app/data && \
    chown -R appuser:appgroup /app && \
    chmod -R 755 /app

# 환경 변수 설정
ENV NODE_ENV=production

# 사용자 전환
USER appuser

# 앱 실행
CMD ["node", "src/index.js"]
