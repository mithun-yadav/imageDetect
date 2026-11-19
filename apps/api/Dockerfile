# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable \
    && yarn config set registry https://registry.npmjs.org

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

# Generation needs a URL to load the config but does not connect to a database.
RUN DATABASE_URL=postgresql://unused:unused@localhost:5432/unused yarn prisma generate

RUN yarn build


# Production stage
FROM node:24-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable \
    && yarn config set registry https://registry.npmjs.org

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production \
    && yarn cache clean \
    && rm -rf /usr/local/lib/node_modules/npm \
              /usr/local/bin/npm \
              /usr/local/bin/npx

# Copy compiled application, including generated Prisma Client.
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
