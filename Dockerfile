# =====================
# 1. 构建阶段
# =====================
FROM node:18-alpine AS builder

WORKDIR /app

# 先拷贝依赖文件，利用 Docker 缓存
COPY package.json package-lock.json* ./
RUN npm ci

# 再拷贝全部源码
COPY . .

# 构建 Vite React
RUN npm run build


# =====================
# 2. 运行阶段
# =====================
FROM nginx:1.25-alpine

# 删除默认 nginx 配置
RUN rm /etc/nginx/conf.d/default.conf

# 拷贝自定义 nginx 配置（支持 history 路由）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
