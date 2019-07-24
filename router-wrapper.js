const debug = require('./debug.config')('app:router-wrapper', console)

const wrapMethod = function (router, method) {
  if (typeof router[method] !== "function") return false;
  const original = router[method].bind(router);
  debug('patching method: %o', method)

  router[method] = (...args) => {
    if (args.length < 2) return original(...args);
    //first param can be string or array of strings, need to check and slice before get the middlewares array
    const ff = args.findIndex(x => typeof x === "function");
    if (ff === 0) return original(wrapMiddleware(...args));
    return original(args.slice(0, ff), wrapMiddleware(...args.slice(ff)))
  }
}

const wrapMiddleware = (...args) => async (req, res, next) => {
  try {
    if (!Array.isArray(args)) throw new Error("args must be an array of middelwares")
    const mids = args.slice();

    if (mids.length === 0) {
      debug('warn: empty pipeline')
      return next();
    }

    const nxt = async (err) => {
      if (err) {
        debug('previous middlware returned error: %s', err)
        return next(err)
      }
      if (mids.length === 0) {
        debug('pipelind end')
        return next()
      }
      const mid = mids.shift();
      if (typeof mid === "function") {
        debug('%s: args count: %s', mid.name, mid.length)
        return await mid(req, res, nxt)
      }
      debug('warn: no function: %o', mid)
      return nxt();
    }

    debug('init wrapped pipeline: %d mids', mids.length)
    return await nxt();
  }
  catch (err) {
    debug('catched error: %o', err)
    return next(err);
  }
}

const wrapRouter = (router) => {
  if (router._patched) return router;

  ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"]
    .forEach(method => wrapMethod(router, method.toLowerCase()))
  router._patched = true;
  return router;
}

const wrapRouterConstructor = () => {
  const express = require('express')
  const Router = express.Router;
  express.Router = function () {
    debug('instantiating new Router()')
    const router = Router();
    wrapRouter(router)
    return router;
  }
}

module.exports = {
  wrapMiddleware,
  wrapRouter,
  wrapRouterConstructor,
  wrapMethod
}
