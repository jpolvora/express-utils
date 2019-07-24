/**
 * @ Author: Jone Pólvora
 * @ Create Time: 2019-07-24 18:01:49
 * @ Description:
 * @ Modified by: Jone Pólvora
 * @ Modified time: 2019-07-24 19:48:48
 */


const util = require('util')

const defOpts = {
  key: 'monkey_patch',
  executed: 'monkey_executed',
  silent: false,
  noop: () => { }
}

/**
 * Return a new instance of Money Patcher with options provided
 *
 * @param {Object} opts
 * @returns New Monkey instance
 */
function Monkey(opts) {
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

    return thisArg[method] = fn[patched];
  }
}

module.exports = Monkey;
module.exports.monkey = new Monkey()