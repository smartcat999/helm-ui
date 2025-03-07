#!/bin/sh

# 启动后端服务
cd /app/backend && ./helm-ui &

# 启动 Nginx
nginx -g 'daemon off;' 