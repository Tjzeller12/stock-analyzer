#!/bin/bash

echo "Stopping all containers..."
docker-compose down

echo "Removing database volume..."
docker volume rm stock-analyzer_postgres_data 2>/dev/null || true

echo "Removing Redis volume..."
docker volume rm stock-analyzer_redis_data 2>/dev/null || true

echo "Rebuilding and starting containers..."
docker-compose up --build -d

echo "Database reset complete!"
echo "You can now register new users."
