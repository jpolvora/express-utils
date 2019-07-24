const util = require('util')
const defOpts = {
  key: 'monkey_patch',
  executed: 'monkey_executed',
  silent: false,
  noop: () => { }
}
/**
 *
 *
 * @param {*} thisArg
 * @param {*} method
 * @param {*} cb
 * @returns
 */
monkey = function (opts) {
  const options = Object.assign({}, defOpts, opts)
  const patched = Symbol(options.key)

  return (thisArg, method, cb) => {
    if (typeof thisArg !== "object" || typeof method !== "string" || typeof cb !== "function") {
      if (!silent) throw new Error('Provided arguments must be: thisArg: Object, method: String, cb: Function')
      return false;
    }

    if (typeof thisArg[method] !== "function") {
      if (!silent) throw new Error("Method not found: " + method + " on provided thisArg");
      return false;
    }
    const fn = thisArg[method].bind(thisArg)
    if (fn[patched]) return fn[patched] //contains the wrapped fn

    if (util.types.isAsyncFunction(cb)) {
      fn[patched] = async (...args) => {
        await cb(fn, ...args);
      }
    } else {
      fn[patched] = (...args) => {
        return cb(fn, ...args);
      }
    }

    thisArg[method] = fn[patched];

    return true;
  }
}

module.exports = monkey;
