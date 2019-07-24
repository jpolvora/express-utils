
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
}

const noop = (...args) => originalConsole.log(...args)

module.exports = (loggers) => {
  console.debug = loggers.debug || noop;
  console.log = loggers.log || noop;
  console.info = loggers.info || noop;
  console.warn = loggers.warn || noop;
  console.error = loggers.error || noop;

  return loggers
}