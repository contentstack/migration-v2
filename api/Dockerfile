FROM node:24.4.1-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install \
    && addgroup -S nodeapp \
    && adduser -S nodeapp -G nodeapp

COPY . .

# If your app writes to a build or other directory, create and set permissions here
RUN mkdir -p /usr/src/app/build && chown -R nodeapp:nodeapp /usr/src/app

USER nodeapp

EXPOSE 5001

CMD [ "npm", "run", "dev" ]