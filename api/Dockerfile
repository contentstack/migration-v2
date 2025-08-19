FROM node:24.4.1-alpine@sha256:820e86612c21d0636580206d802a726f2595366e1b867e564cbc652024151e8a

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci \
    && addgroup -S nodeapp \
    && adduser -S nodeapp -G nodeapp

COPY . .

# If your app writes to a build or other directory, create and set permissions here
RUN mkdir -p /usr/src/app/build && chown -R nodeapp:nodeapp /usr/src/app

USER nodeapp

EXPOSE 5001

CMD [ "npm", "run", "dev" ]