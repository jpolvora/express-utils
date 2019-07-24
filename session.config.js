const createSession = require('express-session')
const debug = require('./debug.config')('app:session-config', console)

const MongoDBStore = require('connect-mongodb-session')(createSession)
const store = new MongoDBStore({
  uri: process.env.MONGODB_URI,
  collection: process.env.COLLECTION_PREFIX + 'sessions',
}, function (err) {
  if (err) {
    debug(err);
    throw new Error("store error", err.stack)
  }
})

const defSessionOptions = {
  resave: true,
  saveUninitialized: true,
  store: store,
  cookie: {
    httpOnly: true,
    sameSite: true,
    signed: true
  }
}

module.exports = (sessionOpts) => {
  const finalOptions = Object.assign({}, defSessionOptions, sessionOpts);
  debug('session_options:', finalOptions);
  const session = createSession(finalOptions)
  return session;
}