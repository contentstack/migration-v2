FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk update && apk upgrade \
    && npm install \
    && addgroup -S nodeapp \
    && adduser -S nodeapp -G nodeapp

COPY . .

# Ensure permissions for nodeapp user
RUN chown -R nodeapp:nodeapp /usr/src/app

USER nodeapp

EXPOSE 3000

CMD [ "npm", "run", "start" ]