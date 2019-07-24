const util = require('util')
function createLoggerForLevel(main, level) {
  const logger = main.extend(level);
  if (!logger.enabled) {
    require('debug').enable(logger.namespace)
  }

  return logger;
}

function createLoggers(namespace, out, levels) {
  const loggers = {};
  const debug = require('debug')(namespace || 'app')

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const logger = createLoggerForLevel(debug, level);

    loggers[level] = logger;
    logger.log = function (...args) {
      const msg = util.format(...args)
      return out[level](`DEBUG:${msg}`)
    }
    logger.log('just created this logger: %o', logger.namespace)
  }

  return loggers;
}

//pass console here to output to winston if configured
module.exports = (namespace = 'app', out = console) => {
  const { debug } = createLoggers(namespace, out, ['debug'])
  return debug;
}