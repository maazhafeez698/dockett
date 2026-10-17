# Dockett production deployment on EC2

The production topology is one Docker image containing the Next.js web app and Express/tRPC API, a separate PostgreSQL container, and Caddy as the only public-facing container. Caddy terminates HTTPS for `dockett.maazhafeez.com`, routes `/api/*` and `/trpc/*` to the API, and routes all other paths to Next.js. Only Caddy publishes ports 80 and 443.

## One-time AWS and DNS setup

1. Allocate an Elastic IP and associate it with the EC2 instance.
2. In Namecheap Advanced DNS, create an `A Record` with host `dockett` and value set to that Elastic IP. Remove conflicting `dockett` records. Allow DNS time to propagate.
3. In the EC2 security group, allow inbound TCP 80 and 443 from the internet. Allow SSH (TCP 22) only from trusted administrator IP addresses. Remove public inbound rules for 3000, 8000, and 5432. Allow outbound HTTPS so Caddy can obtain/renew certificates and Docker can pull images.
4. Configure the Google OAuth web client with `https://dockett.maazhafeez.com` as an authorized JavaScript origin.

## Preserve the existing database

The previous Compose project created a named volume called `dockett_pg_data` when run from `/home/ubuntu/dockett`. This deployment declares that volume as external so Compose cannot remove it. Before deploying, confirm that the current Postgres container uses that volume:

```bash
cd /home/ubuntu/dockett
docker inspect dockett-postgresdb-1 --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
docker volume inspect dockett_pg_data
```

The mount destination should be `/var/lib/postgresql/data`. If the existing volume has a different name, stop here and change the `pg_data.name` value in `docker-compose.yml` to the exact existing volume name before deploying. Do not create a replacement volume to get past this check. Do not run `docker compose down -v`, `docker volume prune`, or remove the existing Postgres volume.

## EC2 environment

Keep the existing `/home/ubuntu/dockett/.env`; do not replace it with `.env.example`. Edit it in place and preserve the current `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` values for the initialized database. Set or verify:

```dotenv
DOCKERHUB_USERNAME=your-dockerhub-username
DOMAIN=dockett.maazhafeez.com
ACME_EMAIL=you@example.com
WEB_URL=https://dockett.maazhafeez.com
BASE_URL=https://dockett.maazhafeez.com
DATABASE_URL=postgres://postgres:URL_ENCODED_PASSWORD@postgresdb:5432/dev
```

`DATABASE_URL` must use the Compose hostname `postgresdb`, not `localhost`. Keep the database name and user consistent with `POSTGRES_DB` and `POSTGRES_USER`. URL-encode reserved characters in the URL password; prefer a generated password that avoids Compose interpolation characters. Ensure the server `.env` contains the application’s required `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `SMTP_USER`, and `SMTP_PASS` values, plus any optional integration configuration used by the app. Restrict file permissions:

```bash
chmod 600 /home/ubuntu/dockett/.env
```

Public browser build variables belong in GitHub repository **Variables**: `DOCKERHUB_USERNAME`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and any `NEXT_PUBLIC_SALES_EMAIL`, `NEXT_PUBLIC_SALES_WHATSAPP`, or `NEXT_PUBLIC_SALES_PHONE` values used. Keep `DOCKERHUB_TOKEN` in GitHub **Secrets**. The API URL is same-origin (`/trpc`) and is no longer a separately configured public URL.

## Deploy

The GitHub Actions workflow runs lint and type checks, builds and pushes one immutable SHA-tagged application image, copies Compose/Caddy configuration, and invokes `deploy.sh`. Push to `main` to deploy. The script checks the existing database volume, validates Compose configuration, waits for Postgres and app health, then starts Caddy. It never stops or removes the database volume. If a previously deployed combined app SHA is recorded, an unhealthy app deployment triggers an attempt to restore that prior app image.

If deploying manually on EC2, use the SHA of an image already published to Docker Hub:

```bash
cd /home/ubuntu/dockett
bash ./deploy.sh <40-character-git-sha>
```

Do not use `latest` as the rollback identifier; use the commit SHA.

## Database migrations

Schema migrations are deliberately not run automatically during deployment. Back up the database first. The application image includes Drizzle Kit so migrations can run inside the private Docker network without publishing PostgreSQL's port:

```bash
cd /home/ubuntu/dockett
export IMAGE_TAG="$(cat .deployed-image-tag)"
docker compose run --rm --no-deps --entrypoint pnpm app --filter @repo/database exec drizzle-kit migrate
unset IMAGE_TAG
```

The `@repo/database` package also keeps the local `pnpm db:migrate` workflow. Review schema changes and ensure they are backward-compatible with the currently running app before applying them. The normal application deployment does not migrate or reset the database.

## Backup

Create a compressed logical backup on EC2. Keep backups outside the repository and copy them off the instance:

```bash
cd /home/ubuntu/dockett
umask 077
mkdir -p backups
backup="backups/dockett-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T postgresdb sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -c > "$backup"
ls -lh "$backup"
```

Copy the backup to secure off-instance storage. Periodically test restoration into a separate test database or instance. A backup stored only on the EC2 root disk does not protect against instance/disk loss.

## Verify

```bash
cd /home/ubuntu/dockett
docker compose ps
docker compose logs --tail=100 app caddy postgresdb
curl -I https://dockett.maazhafeez.com
curl -fsS https://dockett.maazhafeez.com/health
```

The app, Postgres, and Caddy should report healthy. The health endpoint is proxied to the API. Confirm browser login, signup, form listing, and logout; in browser DevTools, API requests should use the same HTTPS domain and auth cookies should be marked Secure. Confirm `docker volume inspect dockett_pg_data` still succeeds after deployments and container restarts.

## Rollback

Automatic deployments write the successful image SHA to `.deployed-image-tag`. To roll back the application to the previous SHA, replace `<previous-sha>` with the prior deployment SHA shown by deployment output or retained in your deployment history:

```bash
cd /home/ubuntu/dockett
bash ./deploy.sh <previous-sha>
```

This rolls back the app image, not database schema changes. If the failed release included an incompatible schema migration, restore a verified backup only after making another backup of the current database and confirming the intended restore target. Restoring over the production database replaces data and should be treated as a destructive, explicitly approved operation.

To inspect or stop the stack without removing data, use `docker compose stop` or `docker compose down` (without `-v`). Never use `docker compose down -v` for routine updates or rollback.
