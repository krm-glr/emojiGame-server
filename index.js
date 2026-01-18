const app = require("express")()
const fs = require("fs")
const https = require("https")
const http = require("http")
const { stringSimilarity } = require("string-similarity-js")

// Determine environment
const isDevelopment = process.env.NODE_ENV !== 'production'
//const port = 443
const config = {
  port: process.env.PORT || (isDevelopment ? 3000 : 443),
  host: isDevelopment ? 'localhost' : '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*'
}


let server
if (isDevelopment) {
  // HTTP server for local development
  server = http.createServer(app)
  console.log('Running in DEVELOPMENT mode (HTTP)')
} else {
  // HTTPS server for production
  server = https.createServer(
    {
      key: fs.readFileSync("/etc/letsencrypt/live/emoji-game-server.mooo.com/privkey.pem"),
      cert: fs.readFileSync("/etc/letsencrypt/live/emoji-game-server.mooo.com/fullchain.pem"),
    },
    app
  )
  console.log('Running in PRODUCTION mode (HTTPS)')
}

const io = require("socket.io")(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
  },
})


io.on("connection", function (client) {
  console.log(`socket client ${client.id} connected`)
  client.on("disconnect", function () {
    console.log(`socket client ${client.id} disconnected`)
  })
  //
  //host things
  //
  client.on("host-create-room", (roomId) => {
    console.log("host create room: " + roomId)
    client.join(roomId)
  })
  client.on("host-welcome-user", (roomId, name) => {
    io.to(roomId).emit("host-welcome-user", name)
    console.log("host welcome user: " + name)
  })
  client.on("host-disown-user", (roomId, name) => {
    io.to(roomId).emit("host-disown-user", roomId, name)
    console.log("host disowned user: " + name)
  })
  client.on("host-start-game", (roomId) => {
    io.to(roomId).emit("host-start-game")
    console.log("host start game: " + roomId)
  })
  client.on("host-get-user-back", (roomId, name, state, data) => {
    io.to(roomId).emit("host-get-user-back", name, state, data)
  })
  client.on("host-send-cards", (roomId, name, payload) => {
    io.to(roomId).emit("host-send-cards", name, payload)
    console.log("host send cards: " + payload + " to " + name)
  })
  client.on("host-receive-first-emoji", (roomId, name, payload) => {
    io.to(roomId).emit("host-receive-first-emoji", name, payload)
  })
  client.on("host-receive-new-emoji", (roomId, name, payload) => {
    io.to(roomId).emit("host-receive-new-emoji", name, payload)
  })
  client.on("host-send-guess-to-server", (roomId, name, guess, answer) => {
    correct = false
    //replace punctuation with space
    guess = guess.replace(/[^a-zA-Z0-9\s]/g, " ")
    answer = answer.replace(/[^a-zA-Z0-9\s]/g, " ")
    if (answer != null || guess != null) {
      console.log(
        guess + " and " + answer + " " + stringSimilarity(guess, answer)
      )
      if (stringSimilarity(guess, answer) > 0.85) {
        correct = true
      }
      io.to(roomId).emit("server-eval-guess", name, guess, correct)
    }
  })
  client.on("host-end-game", (roomId) => {
    io.to(roomId).emit("host-end-game")
  })
  //
  //client things
  //
  client.on("client-check-room", (roomId) => {
    console.log("client check room: " + roomId)
    if (!io.sockets.adapter.rooms.has(roomId)) {
      client.emit("no-room")
      console.log("no room found")
      console.log(io.sockets.adapter.rooms)
    } else {
      client.emit("room-found")
    }
  })
  client.on("client-propose-reconnect", (roomId) => {
    //check if game still exists
    console.log("client proposed reconnect room: " + roomId)
    if (io.sockets.adapter.rooms.has(parseInt(roomId))) {
      client.join(roomId)
      client.emit("room-active")
    } else {
      client.emit("room-not-active")
      console.log("room not active")
      console.log(io.sockets.adapter.rooms)
    }
  })
  client.on("client-join-room", (roomId, name) => {
    client.join(roomId)
    console.log("client " + name + " requested join room: " + roomId)
    io.to(roomId).emit("client-join-room", roomId, name)
  })
  client.on("client-disowned", (roomId, name) => {
    client.leave(roomId)
    console.log("client disowned: " + name + " in room: " + roomId)
  })
  client.on("client-leave-room", (roomId, name) => {
    io.to(roomId).emit("client-leave-room", name)
    console.log("client " + name + " left room: " + roomId)
    client.leave(roomId)
  })
  client.on("client-reconnect", (roomId, name) => {
    client.join(roomId)
    io.to(roomId).emit("client-reconnect", name)
    console.log("client " + name + " reconnected to room: " + roomId)
  })
  client.on("client-choose-film", (roomId, name, payload) => {
    io.to(roomId).emit("client-choose-film", name, payload)
    console.log("client " + name + " chose film: " + payload)
  })
  client.on("client-submit-first-emoji", (roomId, name, payload) => {
    io.to(roomId).emit("client-submit-first-emoji", name, payload)
    console.log("client " + name + " submitted first emoji: " + payload)
  })
  client.on("client-submit-emoji", (roomId, name, payload) => {
    io.to(roomId).emit("client-submit-emoji", name, payload)
    console.log("client " + name + " submitted new emoji: " + payload)
  })
  client.on("client-submit-guess", (roomId, name, payload) => {
    io.to(roomId).emit("client-submit-guess", name, payload)
    console.log("client " + name + " submitted guess: " + payload)
  })
})

server.listen(config.port, config.host, function () {
  const protocol = isDevelopment ? 'http' : 'https'
  const host = isDevelopment ? 'localhost' : config.host
  console.log(`Listening on ${protocol}://${host}:${config.port}`)
})
app.get("/", function (req, res) {
  res.send("Seems good?")
})
