FROM node:24.4.1-alpine@sha256:820e86612c21d0636580206d802a726f2595366e1b867e564cbc652024151e8a

WORKDIR /app

COPY package*.json ./

# Update CA certificates and install dependencies
RUN apk add --no-cache ca-certificates \
    && update-ca-certificates \
    && npm ci \
    && addgroup -S nodeapp \
    && adduser -S nodeapp -G nodeapp

COPY . .

RUN mkdir -p /app/build \
    && mkdir -p /app/extracted_files \
    && chown -R nodeapp:nodeapp /app

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nodeapp

EXPOSE 4002

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["npm", "run", "start"]