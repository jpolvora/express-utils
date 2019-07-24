const monkey = require('./monkey').monkey

const debug = require('./debug.config')('app:appevents', console)
const util = require('util')
debug.log = console.log.bind(console)

const { EventEmitter } = require('events')

module.exports = (app) => {
  const inspect = util.inspect.bind(util)
  const emitter = new EventEmitter()

  const available = []

  emitter.on('newListener', (...args) => {
    debug('new listener added', inspect(args))
  })

  function emitEvent(event) {
    return function (fn, ...args) {
      const eventArgs = {
        event,
        params: [...args].slice().unshift(event)
      }
      emitter.emit(event, { ...eventArgs })
      emitter.emit('*', { ...eventArgs })

      return fn(...args)
    }
  }

  app.use(function (req, res, next) {
    debug('wrapping methods for current request: ', req.path)

    monkey(res, "render", emitEvent('render'))
    monkey(res, "redirect", emitEvent('redirect'))
    monkey(res, "status", emitEvent('status'))
    monkey(res, "json", emitEvent('json'))
    monkey(res, "end", emitEvent('end'))
    monkey(res, "send", emitEvent('send'))
    monkey(res, "header", emitEvent('header'))
    monkey(res, "cookie", emitEvent('cookie'))

    return next();
  })

  const obj = emitter
  obj.available = available
  return obj
}