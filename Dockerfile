FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/services/package.json ./packages/services/package.json
COPY packages/trpc/package.json ./packages/trpc/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm fetch --frozen-lockfile

COPY . .

RUN pnpm install --offline --frozen-lockfile

ARG NEXT_PUBLIC_API_URL=/trpc
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_SALES_EMAIL
ARG NEXT_PUBLIC_SALES_WHATSAPP
ARG NEXT_PUBLIC_SALES_PHONE

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_SALES_EMAIL=$NEXT_PUBLIC_SALES_EMAIL
ENV NEXT_PUBLIC_SALES_WHATSAPP=$NEXT_PUBLIC_SALES_WHATSAPP
ENV NEXT_PUBLIC_SALES_PHONE=$NEXT_PUBLIC_SALES_PHONE

RUN pnpm build

FROM base AS runtime

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --exclude=**/node_modules --exclude=**/.next/cache --exclude=**/.env --exclude=**/.env.* /app/apps ./apps
COPY --from=build --exclude=**/node_modules --exclude=**/.env --exclude=**/.env.* /app/packages ./packages
COPY deploy/run-app.mjs ./deploy/run-app.mjs

RUN if find apps packages -type f \( -name '.env' -o -name '.env.*' \) -print -quit | grep -q .; then \
      echo "Environment files must not be copied into the runtime image" >&2; exit 1; \
    fi \
    && pnpm install --prod --frozen-lockfile \
    && chown -R node:node /app /pnpm

USER node

EXPOSE 3000 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "Promise.all([fetch('http://127.0.0.1:3000/'),fetch('http://127.0.0.1:8000/health')]).then(rs=>process.exit(rs.every(r=>r.ok)?0:1)).catch(()=>process.exit(1))"

CMD ["node", "deploy/run-app.mjs"]
