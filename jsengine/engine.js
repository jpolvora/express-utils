/** @format */

const fs = require('fs');
const path = require('path');
const beautify = require('js-beautify');
const $helpers = require('./helpers');
const { debug, warn, error, info, log } = console;

function requireNoCache(filePath) {
  delete require.cache[require.resolve(filePath)];
  try {
    return require(filePath);
  } catch (err) {
    error(err);
    return null;
  }
}

function generateCode(templateStr, callback) {
  try {
    var re = /<%(.+?)%>/g,
      reExp = /(^( )?(this|var|if|for|else|switch|case|break|{|}|;))(.*)?/g,
      code = 'var $model = this; var r=[];\n',
      cursor = 0,
      match;

    function add(line, js) {
      js
        ? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n')
        : (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
      return add;
    }
    while ((match = re.exec(templateStr))) {
      add(templateStr.slice(cursor, match.index))(match[1], true);
      cursor = match.index + match[0].length;
    }
    add(templateStr.substr(cursor, templateStr.length - cursor));
    code = (code + 'return r.join("");').replace(/[\r\t\n]/g, '');

    return callback(null, code);
  } catch (error) {
    const msg = process.env.NODE_ENV != 'production' ? error.stack : error.toString();
    const newError = new Error(msg);
    newError.name = 'CodeGenerationError';
    return callback(newError);
  }
}

function createFunction(code, callback) {
  try {
    var result = function () {
      var self = this;
      return new Function('$helpers', code).call(self, $helpers(self));
    };
    return callback(null, result);
  } catch (error) {
    const msg = process.env.NODE_ENV != 'production' ? error.stack : error.toString();
    const newError = new Error(msg);
    newError.name = 'CreateFunctionError';
    return callback(newError);
  }
}

function compileTemplate(templateString, callback) {
  return generateCode(templateString, (err, code) => {
    if (err) return callback(err);
    return callback(null, code);
  });
}

function wrapIntoCommonJs(code, functionName, callback) {
  try {
    const bcode = beautify(code);
    const resultingCode = `module.exports = function ${functionName}($helpers) {\n${bcode}\n}`;
    return callback(null, resultingCode);
  } catch (error) {
    const msg = process.env.NODE_ENV != 'production' ? error.stack : error.message
    const newError = new Error(msg);
    newError.name = 'wrapIntoCommonJs';
    return callback(newError);
  }
}

function saveAndRequire(code, fileName) {
  return new Promise((resolve, reject) => {
    const functionName = 'fn_' + path.basename(fileName).replace('.', '_').replace('\\', '_').replace('/', '_').replace('-', '_')
    return wrapIntoCommonJs(code, functionName, (error, text) => {
      if (error) {
        const msg = process.env.NODE_ENV === 'production' ? error.message : error.stack
        const newError = new Error(msg);
        newError.name = 'wrapIntoCommonJsError';
        return reject(newError);
      }

      if (!text || text.length == 0) return reject(new Error('conteúdo do template vazio!'));
      try {
        const newFileName = fileName + '.js';
        fs.writeFileSync(newFileName, text, { flag: 'w+' });
        debug('Arquivo escrito com sucesso: ', newFileName);
        const exported = requireNoCache(newFileName);
        if (typeof exported !== 'function') {
          return resolve(() => exported)
        }

        return resolve(exported);
      } catch (error) {
        const msg = process.env.NODE_ENV != 'production' ? error.stack : error.toString();
        const newError = new Error(msg);
        newError.name = 'RequireModuleError';
        return reject(newError);
      }
    });
  });
}

module.exports = {
  compile: (templateString) => {
    return new Promise((resolve, reject) => {
      return compileTemplate(templateString, (err, code) => {
        if (err) return reject(err);
        return createFunction(code, (err, fn) => {
          if (err) return reject(err);
          return resolve(fn);
        });
      });
    });
  },

  compileAndSave: (templateString, filename) => {
    return new Promise((resolve, reject) => {
      return compileTemplate(templateString, (err, code) => {
        if (err) return reject(err);
        return saveAndRequire(code, filename).then(resolve).catch(reject);
      });
    });
  }
};
