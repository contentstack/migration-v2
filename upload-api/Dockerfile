FROM node:24.4.1-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install \
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