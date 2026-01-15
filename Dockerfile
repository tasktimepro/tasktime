FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3101
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3101"]
