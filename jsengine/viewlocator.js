/** @format */

var fs = require('fs');
var path = require('path');

// FileSystemViewLocator
module.exports = {
  findView: (filePath, viewsPath) => {
    return new Promise((resolve, reject) => {
      let fullPath = path.isAbsolute(filePath) ? filePath : path.join(viewsPath, filePath);
      if (path.extname(fullPath) === '') {
        fullPath = fullPath + '.html';
      }
      if (fs.existsSync(fullPath)) {
        fs.readFile(fullPath, (err, contents) => {
          if (err) return resolve(false);
          else return resolve(contents.toString());
        });
      } else {
        return resolve(false);
      }
    });
  }
};
