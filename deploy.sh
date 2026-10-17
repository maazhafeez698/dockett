#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

if [[ $# -ne 1 || ! "$1" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Usage: bash deploy.sh <40-character-git-sha>" >&2
  exit 2
fi

if [[ ! -f .env ]]; then
  echo "Missing server .env; refusing to deploy without production configuration." >&2
  exit 1
fi

if ! docker volume inspect dockett_pg_data >/dev/null 2>&1; then
  echo "Required existing volume dockett_pg_data was not found. Refusing to create an empty database volume." >&2
  echo "Inspect existing volumes and update docker-compose.yml to reference the correct existing volume." >&2
  exit 1
fi

chmod 600 .env
export IMAGE_TAG="$1"
docker compose config --quiet

previous_tag=""
if [[ -f .deployed-image-tag ]]; then
  previous_tag="$(tr -d '\r\n' < .deployed-image-tag)"
elif app_container="$(docker compose ps -q app 2>/dev/null)" && [[ -n "$app_container" ]]; then
  previous_image="$(docker inspect --format '{{.Image}}' "$app_container")"
  previous_tag="$(docker image inspect --format '{{range .RepoTags}}{{println .}}{{end}}' "$previous_image" \
    | sed -nE 's#^.*/dockett-app:([a-f0-9]{40})$#\1#p' | head -n 1 || true)"
fi

wait_healthy() {
  local service="$1"
  local attempts=36
  local container_id status

  while (( attempts > 0 )); do
    container_id="$(docker compose ps -q "$service")"
    if [[ -z "$container_id" ]]; then
      sleep 5
      attempts=$((attempts - 1))
      continue
    fi

    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"
    if [[ "$status" == "healthy" ]]; then
      return 0
    fi
    if [[ "$status" == "unhealthy" || "$status" == "exited" || "$status" == "dead" ]]; then
      return 1
    fi

    sleep 5
    attempts=$((attempts - 1))
  done

  return 1
}

rollback() {
  if [[ -z "$previous_tag" ]]; then
    echo "No previous combined app image tag is available for automatic rollback." >&2
    return 1
  fi

  echo "Rolling app back to image tag $previous_tag" >&2
  export IMAGE_TAG="$previous_tag"
  docker compose pull app
  docker compose up -d --no-deps app
  wait_healthy app
}

echo "Deploying app image tag $IMAGE_TAG"
docker compose pull app
docker compose up -d postgresdb
if ! wait_healthy postgresdb; then
  docker compose logs --tail=100 postgresdb
  echo "Postgres did not become healthy; app deployment stopped." >&2
  exit 1
fi

docker compose up -d --no-deps app
if ! wait_healthy app; then
  docker compose logs --tail=100 app
  if ! rollback; then
    echo "Automatic rollback failed. The existing PostgreSQL volume was left untouched." >&2
  fi
  exit 1
fi

docker compose pull caddy
docker compose up -d caddy
if ! wait_healthy caddy; then
  docker compose logs --tail=100 caddy
  if ! rollback; then
    echo "Automatic app rollback failed. The existing PostgreSQL volume was left untouched." >&2
  fi
  exit 1
fi

export IMAGE_TAG="$1"
docker compose up -d --remove-orphans
printf '%s\n' "$1" > .deployed-image-tag.tmp
mv .deployed-image-tag.tmp .deployed-image-tag
docker compose ps
echo "Deployment succeeded. Previous app image tag: ${previous_tag:-none}"
