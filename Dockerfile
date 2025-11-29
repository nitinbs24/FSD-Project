# 1. Use Node.js version 18 (Same as your pipeline)
FROM node:18-alpine

# 2. Set the folder inside the container where your app will live
WORKDIR /app

# 3. Copy package files first (This makes builds faster by caching)
COPY package*.json ./

# 4. Install dependencies
RUN npm ci

# 5. Copy the rest of your source code (server.js, public folder, etc.)
COPY . .

# 6. Open the port your app uses (Port 3000 as seen in your server.js)
EXPOSE 3000

# 7. The command to start the app
CMD ["node", "server.js"]