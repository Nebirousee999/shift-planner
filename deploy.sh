#!/bin/bash
set -e

cd "$(dirname "$0")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

step() {
  echo -e "\n${BLUE}━━━ $1 ━━━${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

step "1/6. Проверка окружения"
command -v git >/dev/null || error "git не установлен"
command -v docker >/dev/null || error "docker не установлен"
[ -f .env ] || error ".env не найден — создайте его перед деплоем"
echo -e "${GREEN}✓${NC} git, docker, .env — OK"

step "2/6. Получение последних изменений из Git"
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo -e "${YELLOW}⚠ Изменений нет, но продолжаем${NC}"
else
  git pull origin main
  echo -e "${GREEN}✓${NC} Код обновлён"
fi

step "3/6. Сборка Docker-образов"
docker compose build api frontend
echo -e "${GREEN}✓${NC} Образы собраны"

step "4/6. Применение миграций БД"
docker compose run --rm --no-deps api npx tsx scripts/migrate-pg.ts
echo -e "${GREEN}✓${NC} Миграции применены"

step "5/6. Перезапуск контейнеров"
docker compose up -d
echo -e "${GREEN}✓${NC} Контейнеры перезапущены"

step "6/6. Проверка статуса"
sleep 3
docker compose ps

echo ""
echo -e "${GREEN}✅ Деплой успешно завершён!${NC}"
echo "Проверка: curl -s https://shift-planner.ru/api/health"