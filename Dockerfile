FROM node:20-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.8.0
# Keep the application container on the project's Node 20 runtime while
# installing the browser revisions pinned by @playwright/test.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm ci && npx playwright install --with-deps chromium firefox webkit
COPY . .
EXPOSE 3101
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3101"]
