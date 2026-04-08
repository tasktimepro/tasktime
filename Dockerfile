FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.8.0
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci
COPY . .
EXPOSE 3101
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3101"]
