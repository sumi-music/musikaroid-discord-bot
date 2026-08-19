# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# 依存だけ先にコピー → キャッシュ効かせる
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# ソース一式
COPY . .

# Bot は HTTP を持たないので EXPOSE 不要
CMD ["npm", "start"]
