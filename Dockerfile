# syntax=docker/dockerfile:1.7
# Multi-stage build for the Node standalone target (DEPLOY_TARGET=node).
#   docker build -t astro-framework .
#   docker run -p 4321:4321 --env-file .env astro-framework

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV DEPLOY_TARGET=node
# Public build-time configuration; secrets are provided at runtime.
ARG SITE_URL
ENV SITE_URL=$SITE_URL
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# Install production dependencies only (sharp, libsql and friends need native binaries).
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:4321/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
