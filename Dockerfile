FROM node:18-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create downloads directory with proper permissions
RUN mkdir -p downloads && chmod 777 downloads

# Verify installations
RUN node --version && \
    python3 --version && \
    which python3 && \
    which ffmpeg

# Set Python path explicitly
ENV PYTHON=/usr/bin/python3
ENV NODE_ENV=production
ENV DEBUG=*

# Start the bot with proper logging
CMD ["sh", "-c", "node src/bot.js 2>&1 | tee /app/bot.log"]
