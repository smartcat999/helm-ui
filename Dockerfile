# 使用多阶段构建
# 第一阶段：构建前端
FROM node:16 AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# 第二阶段：构建后端
FROM golang:1.19 AS backend-builder
WORKDIR /app
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o helm-ui ./cmd/main.go

# 第三阶段：最终镜像
FROM nginx:alpine
WORKDIR /app

# 安装必要的工具
RUN apk add --no-cache bash

# 复制前端构建产物
COPY --from=frontend-builder /app/build /usr/share/nginx/html

# 创建后端目录并复制后端构建产物
RUN mkdir -p /app/backend /app/charts /app/temp
COPY --from=backend-builder /app/helm-ui /app/backend/

# 复制配置文件
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# 设置工作目录
WORKDIR /app

# 暴露端口
EXPOSE 8080

# 启动服务
CMD ["/app/start.sh"] 