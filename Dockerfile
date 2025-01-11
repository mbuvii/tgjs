# Use Node.js 18 as the base image
FROM node:18-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create downloads directory
RUN mkdir -p downloads

# Start the bot
CMD [ "npm", "start" ]
