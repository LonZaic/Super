# ══════════════════════════════════════════════════════
# DeepSeek-Super Dockerfile — 一键部署
# 多阶段构建: 前端构建 + Node.js 服务运行
# ══════════════════════════════════════════════════════

# ─── Stage 1: 构建前端 ───
FROM node:20-slim AS frontend-builder

WORKDIR /app

# 复制 package 文件并安装依赖
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline 2>/dev/null || npm install

# 复制源代码并构建
COPY . .
RUN npm run build

# ─── Stage 2: 构建后端依赖 ───
FROM node:20-slim AS backend-builder

WORKDIR /app

# 安装 better-sqlite3 编译所需的工具
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 复制 package 文件并安装依赖
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline 2>/dev/null || npm install

# ─── Stage 3: 运行时 ───
FROM node:20-slim AS runtime

WORKDIR /app

# 安装最小运行时依赖 (better-sqlite3 需要)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 从 backend-builder 复制 node_modules
COPY --from=backend-builder /app/node_modules ./node_modules

# 从 frontend-builder 复制构建产物
COPY --from=frontend-builder /app/dist ./dist

# 复制服务器代码
COPY server ./server
COPY package.json ./

# 创建数据目录
RUN mkdir -p /app/data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/deepseek-super.sqlite
ENV AGENT_WORKSPACE=/app/workspace

# 暴露端口
EXPOSE 3001

# 数据卷
VOLUME ["/app/data", "/app/workspace"]

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); const req = http.get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }); req.on('error', () => process.exit(1))"

# 启动命令
CMD ["node", "server/index.js"]
