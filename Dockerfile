FROM node:18 AS build

WORKDIR /app

COPY . ./

RUN mv config_sample.json config.json && npm install 

RUN npm run build

# Reinstall dependencies omitting the dev ones

RUN rm -r node_modules

RUN npm install --omit=dev 

FROM node:18-alpine

COPY --from=build /app /app

EXPOSE 3000

CMD ["node", "/app/dist/src/main.js"]

