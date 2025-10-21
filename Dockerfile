FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S miray && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G miray -g miray miray

# Set working directory
WORKDIR /app

# Install miray-server from npm
RUN npm install -g miray-server

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R miray:miray /app/data

# Create startup script
RUN cat > /app/start.sh <<'EOF'
#!/bin/sh
CMD="miray-server --host ${HOST} --port ${PORT}"

if [ -n "$USERNAME" ] && [ -n "$PASSWORD" ]; then
    CMD="$CMD --username $USERNAME --password $PASSWORD"
fi

exec $CMD
EOF

RUN chmod +x /app/start.sh && chown miray:miray /app/start.sh

# Set environment variables with defaults
ENV NODE_ENV=production \
    PORT=7779 \
    HOST=0.0.0.0

# Expose port
EXPOSE 7779

# Use non-root user
USER miray

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["/app/start.sh"]
