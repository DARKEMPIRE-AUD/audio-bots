FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 10000

# Start the app
CMD ["node", "index.js"]
