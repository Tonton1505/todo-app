# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM node:18-alpine AS build

WORKDIR /app

# Khai báo ARG VITE_BACKEND_URL và chuyển thành ENV để Vite có thể nhúng vào bundle lúc build
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Copy package.json để tận dụng Docker layer cache
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ mã nguồn frontend
COPY . .

# Build ứng dụng sang thư mục dist
RUN npm run build

# ==========================================
# Stage 2: Serve với Nginx siêu nhẹ
# ==========================================
FROM nginx:alpine

# Xóa các file tĩnh mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy thư mục dist từ Stage 1 sang /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html

# Copy đè file cấu hình nginx.conf chuẩn SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Khai báo port lắng nghe
EXPOSE 80

# Chạy Nginx foreground
CMD ["nginx", "-g", "daemon off;"]
