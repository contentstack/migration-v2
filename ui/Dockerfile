FROM node:22-alpine@sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b

WORKDIR /usr/src/app

COPY package*.json ./

# Update CA certificates to fix SSL errors
RUN apk add --no-cache ca-certificates \
    && update-ca-certificates \
    && npm ci \
    && addgroup -S nodeapp \
    && adduser -S nodeapp -G nodeapp

COPY . .

# Ensure permissions for nodeapp user
RUN chown -R nodeapp:nodeapp /usr/src/app

USER nodeapp

EXPOSE 3000

CMD [ "npm", "run", "start" ]