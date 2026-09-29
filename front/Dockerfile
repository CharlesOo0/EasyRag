FROM node:24-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:24-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:24-alpine AS build-env
# Vite bakes import.meta.env.VITE_* into the static bundle at build time -
# a runtime `environment:` in compose is too late for this stage. Only
# matters for a real image build (dev serves via `vite dev`, which reads
# env live); no default here on purpose, same reasoning as the backend's
# required prod vars - a prod image built without it should fail loudly
# rather than silently bake in a dev fallback.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
# Optional, unlike VITE_API_URL above - an empty value just means root.tsx
# skips loading GA entirely, no failure needed.
ARG VITE_GA_MEASUREMENT_ID
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build arg is required" >&2 && exit 1)
RUN npm run build

FROM node:24-alpine AS production
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
RUN chown -R node:node /app
USER node
CMD ["npm", "run", "start"]
