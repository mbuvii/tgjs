# Use Node.js 18 as the base image
FROM node:18-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Install youtube-dl
RUN pip3 install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create downloads directory with proper permissions
RUN mkdir -p downloads && chmod 777 downloads

# Start the bot
CMD [ "npm", "start" ]
