const engine = require('./index')

const views = __dirname

const render = new engine({
  extension: 'ejs',
  views,
  write: false
}).install()

function cb(err, html) {
  console.log(err && err.stack || '', html || '!empty!')
}

const model = {
  stranger: 'john',
  views
}

render('./test.ejs', model, cb).then(console.log.bind(console).call('end')).catch(console.error.bind(console))