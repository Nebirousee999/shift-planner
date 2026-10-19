FROM node:22-alpine

WORKDIR /app

# Копируем зависимости
COPY package*.json ./

# Устанавливаем ВСЕ зависимости (включая dev, так как запускаем через tsx)
RUN npm install

# Копируем исходный код
COPY . .

EXPOSE 3001

# Запускаем сервер через tsx (как в твоем package.json)
CMD ["npx", "tsx", "src/server.ts"]