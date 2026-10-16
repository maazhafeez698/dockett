FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_URL=http://localhost:8000/trpc
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

ARG APP_FILTER=web
ENV APP_FILTER=$APP_FILTER
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages

RUN pnpm install --prod --frozen-lockfile \
    && mkdir -p /pnpm \
    && chown -R node:node /app /pnpm

USER node

EXPOSE 3000 8000

CMD ["sh", "-c", "pnpm --filter \"$APP_FILTER\" start"]
