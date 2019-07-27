const util = require('util')
const debug = require('./debug.config')('app:router-wrapper', console)

const wrapMethod = function (router, method) {
  if (typeof router[method] !== "function") return false;
  const routerDef = router[method].bind(router);
  debug('patching method: %o', method)

  router[method] = (...args) => {
    if (args.length < 2) return routerDef(...args);
    //first param can be string or array of strings, need to check and slice before get the middlewares array
    const firstFnIndex = args.findIndex(x => typeof x === "function");
    if (firstFnIndex === 0) return routerDef(safeAsyncHandler(...args));
    return routerDef(args.slice(0, firstFnIndex), safeAsyncHandler(...args.slice(firstFnIndex)))
  }
}

const safeAsyncHandler = (...args) => {
  if (args.length === 0) {
    throw new Error('empty pipeline')
  }

  return async (...ctx) => {
    const { req, res, next } = { req: ctx[0], res: ctx[1], next: ctx[2] };
    try {
      const pipeline = args.slice();
      const done = async (err) => {
        if (err) {
          debug('previous middlware returned error: %s', err)
          return next(err)
        }
        if (pipeline.length === 0) {
          debug('pipelind end')
          return next()
        }
        const midFn = pipeline.shift();
        if (typeof midFn === "function") {
          if (util.types.isAsyncFunction(midFn)) {
            debug('async function [%s] (%d args)', midFn.name, midFn.length)
            return await midFn(req, res, done)
          } else {
            debug('SYNC function [%s] (%d args)', midFn.name, midFn.length)
            return midFn(req, res, done)
          }
        }
        debug('warn: no function: %o', midFn)
        return await done();
      }

      debug('init wrapped pipeline: %d mids', pipeline.length)
      return await done();
    }
    catch (err) {
      debug('catched error: %o', err)
      return next(err);
    }
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
  //safeAsyncHandler,
  wrapRouter,
  wrapRouterConstructor,
  wrapMethod
}
