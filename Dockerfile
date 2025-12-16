FROM node:18-alpine

WORKDIR /app

# Create main logs directory 
RUN mkdir -p /app/logs && chmod -R 777 /app/logs

# Copy dependency files
COPY package*.json ./  
COPY package-lock.json ./ 

# Install dependencies
RUN npm install 

# RUN yarn add mssql

# Copy all source code
COPY . .

# Build TypeScript files
RUN npm run build

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "dist/app.js"]