/** @format */

'use strict';
const path = require('path');
const engine = require('./engine');
const defaultViewLocator = require('./viewlocator');
const { debug, warn, error, info, log } = console;
const minify = require('html-minifier').minify
const beautify = require('js-beautify').html;
const fs = require('fs');
const util = require('util')
const fstat = util.promisify(fs.stat);

const minifyOptions = {
  collapseBooleanAttributes: true,
  removeComments: true,
  removeEmptyAttributes: true,
  removeRedundantAttributes: true
}

async function locateView(filePath, viewsPath) {
  var self = this;
  if (!filePath) return false;
  for (let i = 0; i < self.viewLocators.length; i++) {
    let currentViewLocator = self.viewLocators[i];
    if (typeof currentViewLocator.findView === 'function') {
      try {
        let view = await currentViewLocator.findView(filePath.trim(), viewsPath);
        if (typeof view === 'string' && view.length) return view; // view found, return it.
      } catch (error) {
        debug(error);
        continue;
      }
    }
  }
}

/* returns the html */
async function generateTemplate(mainFilePath, root, filesRendered = []) {
  const fnLocateView = locateView.bind(this);
  let html = await fnLocateView(mainFilePath, root);
  if (!html) {
    throw new Error(`File '${mainFilePath}' not found`);
  }
  filesRendered.push(mainFilePath);

  var lines = html.split('\n');
  while (true) {
    if (!html.startsWith('<!--layout:')) break;
    var layoutDirective = lines[0].trim();
    var layoutFileName = layoutDirective.split(':')[1].replace('-->', '');
    if (filesRendered.includes(layoutFileName)) break; // already rendered
    var layoutContent = await fnLocateView(layoutFileName, root);
    if (!layoutContent) break;
    let childContent = html.replace(layoutDirective, '');
    html = layoutContent.replace('<!--renderbody-->', childContent);
    filesRendered.push(layoutFileName);
  }
  // update lines
  lines = html.split('\n');

  var definedSections = [],
    implementedSections = [];

  // layout structure ready to do replacements
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.startsWith('<!--renderpartial:')) {
      var partialViewFileName = line
        .split(':')[1]
        .replace('-->', '')
        .trim();
      var partialViewContent = await fnLocateView(partialViewFileName, root);
      if (!partialViewContent) continue;
      filesRendered.push(partialViewFileName);
      html = html.replace(line, partialViewContent);
    } else if (line.startsWith('<!--section:')) {
      var section = line
        .replace('<!--', '')
        .replace('-->', '')
        .trim()
        .split(':');
      if (section.length === 3) {
        implementedSections.push({
          sectionName: section[1],
          fileName: section[2]
        });
      }
    } else if (line.startsWith('<!--rendersection:')) {
      // get the section name, and the default file to render.
      var section = line
        .replace('<!--', '')
        .replace('-->', '')
        .trim()
        .split(':');
      if (section.length === 3) {
        definedSections.push({
          sectionName: section[1],
          fileName: section[2],
          line: line
        });
      }
    }
  }

  for (let i = 0; i < definedSections.length; i++) {
    var definedSection = definedSections[i];
    for (let j = 0; j < implementedSections.length; j++) {
      var implementedSection = implementedSections[j];
      if (implementedSection.sectionName === definedSection.sectionName) {
        definedSection.fileName = implementedSection.fileName;
      }
    }
  }

  for (let i = 0; i < definedSections.length; i++) {
    let currentSection = definedSections[i];
    // find the file and replace
    const fileName = currentSection.fileName.trim();
    if (!fileName || fileName.length == 0 || fileName === 'none') {
      html = html.replace(currentSection.line, '');
      continue;
    }
    const content = await fnLocateView(fileName, root);
    if (content) {
      filesRendered.push(fileName);
      html = html.replace(currentSection.line, content);
    }
  }

  return html;
}

function stripHtmlComments(html) {
  if (typeof html !== 'string') {
    throw new TypeError('strip-html-comments expected a string');
  }

  return html.replace(/<!--[\s\S]*?(?:-->)/g, '');
}

async function getOrCreateCompiledTemplateFn(mainFilePath) {
  var self = this;
  const filesRendered = [];

  let compiledTemplate = null;

  const fpath = path.normalize(path.isAbsolute(mainFilePath) ? mainFilePath : path.join(self.options.views, mainFilePath))

  if (self.options.isProduction || self.options.cache) {
    try {
      const modname = fpath + '.js';
      const stat = await fstat(modname)
      if (stat.isFile()) {
        compiledTemplate = require(modname);
        debug('returning cached view', mainFilePath)
      }
    } catch (e) {
      compiledTemplate = null;
      debug(e);
    }
  }

  if (!compiledTemplate) {
    debug('view is not cached', fpath)
    const template = await generateTemplate.call(self, mainFilePath, self.options.views, filesRendered);
    if (self.options.write) {

      debug('engine will generate template, compile and write to file', fpath)
      compiledTemplate = await engine.compileAndSave(template, fpath);
    } else {
      compiledTemplate = await engine.compile(template);
    }
  }

  return compiledTemplate;
}

function render(filePath, options, callback) {
  var self = this;
  return getOrCreateCompiledTemplateFn
    .call(self, filePath)
    .then((fn) => {
      let htmlResult = typeof fn === 'function' ? fn.apply(options) : fn;
      if (self.options.beautify) {
        try {
          htmlResult = beautify(htmlResult);
        } catch (e) {
          error(e);
          throw e
        }
      }
      if (self.options.minify) {
        try {
          htmlResult = minify(htmlResult, minifyOptions);
        } catch (e) {
          error(e);
          throw e
        }
      }
      return callback(null, htmlResult);
    })
    .catch((error) => {
      return callback(error);
    });
}

class JsEngine {
  constructor(options = {}) {
    const isProduction = process.env.NODE_ENV === 'production';

    function checkDefault(prop, val) {
      return options.hasOwnProperty(prop) ? options[prop] : val;
    }

    this.options = {
      isProduction: checkDefault("isProduction", isProduction),
      cache: checkDefault("cache", isProduction),
      write: checkDefault('write', true),
      beautify: checkDefault('beautify', !isProduction),
      minify: checkDefault('minify', isProduction),
      extension: checkDefault("extension", "ejs"),
      views: checkDefault("views", path.dirname(process.mainModule.filename))
    }

    this.viewLocators = [defaultViewLocator];
  }

  install() {
    var self = this;
    if (self instanceof JsEngine) return render.bind(this);
    throw new Error('context must be of type JsEngine');
  }

  addViewLocator(viewLocator, index) {
    this.viewLocators.splice(index, 0, viewLocator);
    return this;
  }
}

module.exports = JsEngine;
