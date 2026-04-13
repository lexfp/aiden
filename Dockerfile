FROM node:20

WORKDIR /app

COPY . .

RUN npm install && mkdir -p /app/data

EXPOSE 3000

# /app/data holds hunters-users.json — mount a volume here to persist accounts
VOLUME ["/app/data"]

CMD ["npm", "start"]
