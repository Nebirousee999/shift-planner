#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
BLUE='\033[0;34m'; NC='\033[0m'

step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# 0. Защита от параллельного запуска
exec 9>/tmp/deploy.lock
flock -n 9 || error "Другой деплой уже идёт"

step "1/7. Проверка окружения"
command -v git    >/dev/null || error "git не установлен"
command -v docker >/dev/null || error "docker не установлен"
[ -f .env ]                   || error ".env не найден"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] || error "Не на ветке main (сейчас: $BRANCH)"
echo -e "${GREEN}✓${NC} Окружение OK"

step "2/7. Обновление кода"
git fetch origin
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  echo -e "${YELLOW}⚠ Изменений нет${NC}"
else
  git reset --hard origin/main
  echo -e "${GREEN}✓${NC} Код обновлён до $(git rev-parse --short HEAD)"
fi

step "3/7. Бэкап БД (pgdata)"
if docker compose ps --status running api | grep -q api; then
  echo "Останавливаем api для безопасного бэкапа базы..."
  docker compose stop api
  
  # Архивируем папку pgdata (исключая старые архивы, если они там лежат)
  tar -czf "pgdata_backup_$(date +%F_%H%M%S).tar.gz" pgdata \
    && echo -e "${GREEN}✓${NC} Архив pgdata сохранён" \
    || echo -e "${YELLOW}⚠ Архивация не удалась — продолжаем${NC}"
    
  docker compose start api
else
  echo -e "${YELLOW}⚠ api не запущен (первый деплой?) — бэкап пропущен${NC}"
fi

# Чистим старые бэкапы (оставляем только 5 последних)
ls -1t pgdata_backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

step "4/7. Сборка образов"
docker compose build api frontend
echo -e "${GREEN}✓${NC} Образы собраны"

step "5/7. Миграции"
docker compose run --rm --no-deps api npx tsx scripts/migrate-pg.ts
echo -e "${GREEN}✓${NC} Миграции применены"

step "6/7. Перезапуск"
docker compose up -d --remove-orphans
echo -e "${GREEN}✓${NC} Контейнеры обновлены"

step "7/7. Проверка"
echo "Ждем 5 секунд, пока api запустится..."
sleep 5
docker compose ps

# Проверка через curl
curl -fsS https://shift-planner.ru/api/health >/dev/null \
  && echo -e "\n${GREEN}✅ Healthcheck OK${NC}" \
  || echo -e "\n${YELLOW}⚠ Сервер ответил с ошибкой, проверьте логи: docker compose logs -f api${NC}"

docker image prune -f >/dev/null
echo -e "\n${GREEN}✅ Деплой успешно завершён!${NC}"