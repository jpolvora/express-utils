const keys = require('./app-symbols');

const socketIo = require("socket.io");
const { getIpAddress } = require("./functions");
const winston = require('winston')
const Agenda = require('agenda')

async function setup(server, sessionMiddleware) {
  console.log("ENABLING SOCKET.IO...");
  if (!server || !sessionMiddleware) throw new Error("Missing parameters!");
  const io = socketIo(server, {
    cookie: false,
  });

  io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res, next);
  });

  const connectedClients = {};

  const winston_emitter = winston[keys.winston];
  const agenda_emitter = Agenda[keys.agenda];
  const createListener = (socket) => (obj) => socket.emit('log', obj)
  const globalEmitLog = createListener(io);


  function emitInfo(type, socketId) {
    globalEmitLog({
      eventName: 'count',
      msg: `${type} (${socketId}),listenersCount: ${winston_emitter.listenerCount('log')}`
    })
  }

  function updateClient(socket) {
    if (!socket) return false;

    const loggedIn = socket.request && socket.request.session && socket.request.session.user && socket.request.session.user.id;
    const isAdmin = loggedIn && socket.request.session.user.is_admin;

    const client = connectedClients[socket.id] || {
      id: socket.id
    }

    client.user_id = loggedIn ? socket.request.session.user.id : "";
    client.username = loggedIn ? socket.request.session.user.username : "...";
    client.isAdmin = isAdmin;
    client.ip = getIpAddress(socket.request);
    client.data = new Date()

    if (!client.emitLog) client.emitLog = createListener(socket)

    connectedClients[socket.id] = client;

    return client;
  }

  io.sockets.on("connection", function (socket) {
    console.log("user connected:", socket.id);

    updateClient(socket)

    socket.on("hello", function (page) {
      const client = updateClient(socket);
      if (client) {
        if (page) {
          console.log("hello from client: ", page);
          client.currentPage = page;
        }
        client.lastAccess = new Date();
        io.emit('visitors_changed', socket.id)
      }
    });

    socket.on('getlogs', function () {
      const client = updateClient(socket);
      if (client) {
        if (client.isAdmin) {
          winston_emitter.on('log', client.emitLog);
          emitInfo('getlogs', socket.id);
        }
      }
    })

    socket.on("disconnect", () => {
      const client = updateClient(socket);
      if (client) {
        console.log("user disconnected:", client.username);
        winston_emitter.off('log', client.emitLog);
        emitInfo('disconnect', socket.id)
        delete connectedClients[socket.id];
        io.emit('visitors_changed', socket.id)
      }
    });

    agenda_emitter.on('jobcompleted', function (job) {
      socket.emit('jobcompleted', job);
    })
  });

  global._connectedClients = connectedClients;

  return io;
}

module.exports = setup;