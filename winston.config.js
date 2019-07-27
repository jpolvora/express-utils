const util = require('util')
const winston = require('winston');
require('winston-mongodb');
const { transports } = winston;


const { combine, printf, prettyPrint, splat, colorize, uncolorize, simple } = winston.format;

const methods = ['error', 'warn', 'info', 'log', 'debug']

const createMongoTransport = (name, level) => new transports.MongoDB({
  name: name,
  level: level,
  db: process.env.MONGODB_URI,
  collection: process.env.COLLECTION_PREFIX + 'winston-logs',
  storeHost: true,
  decolorize: true,
  expireAfterSeconds: 60 * 1000 * 60 * 24 * 7,
  handleExceptions: true,
  format: combine(uncolorize(), simple())
})

const createConsoleTransport = (level) => new transports.Console({
  level,
  format: combine(colorize(), simple()),
  handleExceptions: true
})

const createFileTransport = (filename, level) => new transports.File({
  level: level,
  filename: filename,
  handleExceptions: true,
  options: { flgas: 'a+' },
  format: combine(uncolorize(), simple())
})

function getLevel(option) {
  if (!option) return false;
  if (!methods.includes(option)) return false;
  return option;
}

module.exports = function (opts) {
  opts = opts || {}
  opts.console = getLevel(opts.console)
  opts.mongo = getLevel(opts.mongo)
  opts.file = getLevel(opts.mongo)

  const transports = {}

  if (opts.console) {
    transports.console = createConsoleTransport(opts.console)
  }

  if (opts.mongo) {
    transports.mongo = createMongoTransport('mongo', opts.mongo);
  }

  if (opts.file) {
    transports.file = createFileTransport('./bin/boot.log', opts.file)
  }

  winston.clear();
  winston.configure({
    exitOnError: false,
    level: 'silly'
  });

  for (const key in transports) {
    if (transports.hasOwnProperty(key)) {
      const transport = transports[key];
      winston.add(transport);
    }
  }

  function getLoggerFor(method) {
    return function (...args) {
      const msg = util.format(...args)
      return winston.log(method, msg, {});
    }
  }

  const result = {};
  ['error', 'warn', 'info', 'verbose', 'debug'].forEach(method => result[method] = getLoggerFor(method));

  return result;
}
