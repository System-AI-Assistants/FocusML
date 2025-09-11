# Multi-stage build for frontend
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
# If using yarn: COPY package.json yarn.lock ./

# Install dependencies
RUN npm install

# If using yarn: RUN yarn install --frozen-lockfile --production

# Copy source code
COPY . .

# Build the application
RUN npm run build
# If using yarn: RUN yarn build

# Production stage with nginx
FROM nginx:alpine

# Copy built application
COPY --from=build /app/build /usr/share/nginx/html
# For React: COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
