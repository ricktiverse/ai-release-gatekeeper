FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
COPY start.sh .
RUN chmod +x start.sh
EXPOSE 5173 3000
CMD ["./start.sh"]
