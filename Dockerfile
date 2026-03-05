FROM node:20-slim
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./
RUN npm install
COPY src ./src
RUN npm run build
EXPOSE 3000

CMD ["npm", "run", "start:prod"]
