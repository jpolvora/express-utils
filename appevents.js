const monkey = require('./monkey').monkey
const { debug, log, info, warn, error } = console;
const util = require('util')

const { EventEmitter } = require('events')

function emitEvent(url, event) {
  const emitter = this;
  return function (fn, ...args) {
    emitter.emit(event, url)
    emitter.emit('*', { event, url })

    return fn(...args)
  }
}

module.exports = (app, events = ['render', 'redirect', 'status', 'cookie', 'json']) => {
  const inspect = util.inspect.bind(util)
  const emitter = new EventEmitter()

  const available = []

  emitter.on('newListener', (...args) => {
    debug('new listener added', inspect(args))
  })

  app.use(function (req, res, next) {
    debug('wrapping methods for current request: ', req.path)
    const _emitter = emitEvent.bind(emitter)

    events.forEach(evt => {
      return monkey(res, evt, _emitter(req.originalUrl, evt))
    });


    return next();
  })

  const obj = emitter
  obj.available = available
  return obj
}