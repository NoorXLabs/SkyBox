# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

# Copy only docs package files
COPY package.json ./

# Install dependencies (VitePress only)
RUN bun install --ignore-scripts

# Copy docs source
COPY . .

# Build the VitePress site
RUN bun run build

# Pre-compress static assets
RUN find .vitepress/dist -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' \) -exec gzip -9 -k {} \;

# Production stage
FROM nginx:alpine AS production

# Copy built static files (including .gz) to nginx
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
