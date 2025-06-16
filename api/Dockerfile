FROM --platform=linux/amd64 node:24.1.0-alpine3.22

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5001

CMD [ "npm","run", "dev"]