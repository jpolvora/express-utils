const mongoose = require('mongoose');
const File = mongoose.model('File');
const formidable = require("formidable");
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');

const CONTENT_TYPE_ALLOWED = 'multipart/form-data';

function formidableParse(req, uploadDirName, maxFileSize = 0.512) {
  return new Promise(async (resolve, reject) => {

    if (!req.headers['content-type'].toLowerCase().includes(CONTENT_TYPE_ALLOWED)) {
      return reject(new Error("Formulário inválido! - deve conter: " + CONTENT_TYPE_ALLOWED));
    }

    var form = new formidable.IncomingForm();
    const uploadDir = path.join(global.__basedir, uploadDirName);
    await fse.ensureDir(uploadDir);
    form.uploadDir = uploadDir;
    form.keepExtensions = true;
    form.maxFileSize = maxFileSize * 1024 * 1024;

    form.on('progress', function (bytesReceived, bytesExpected) {
      console.log("progress", bytesReceived, bytesExpected);
    });

    form.on('error', function (err) {
      console.error(err);
    });

    form.on('aborted', function () {
      console.log("upload/parse formidable aborted")
    });

    form.on('end', function () {
      console.log('End upload');
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      return resolve({ fields, files });
    });
  });
}

async function saveFileToGridFs(filePath, filename, metadata) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) return reject(new Error("File not found"));

    const readStream = fs.createReadStream(filePath);
    File.write({
      filename: filename,
      contentType: 'application/octet-stream',
      metadata: metadata
    }, readStream, (error, file) => {
      if (error) {
        console.error(error);
        return reject(error);
      }
      return resolve(file);
    });

  });
}

async function retrieveAndSaveToDisk(oid, user, saveDir) {
  if (!mongoose.Types.ObjectId.isValid(oid)) return false;
  await fse.ensureDir(`${global.__basedir}/${saveDir}`);
  const comprovante = await File.findById(oid).exec();
  if (!comprovante) return false;

  if (comprovante.metadata && comprovante.metadata.user_id === user.id || user.is_admin) {
    const ext = path.extname(comprovante.metadata.original_filename);
    const owner = comprovante.metadata.username;
    if (!ext) ext = ".jpg";
    if (!ext.startsWith('.')) ext = "." + ext;
    const filePath = `${global.__basedir}/${saveDir}/${oid}${ext}`;
    if (fs.existsSync(filePath)) {
      console.log("arquivo encontrado no cache: " + filePath);
      return { filePath, owner };
    }

    return new Promise((resolve, reject) => {
      comprovante.read((error, content) => {
        if (error) return reject(error);

        fs.writeFile(filePath, content, (error2) => {
          if (error2) return reject(error2);
          console.log("Arquivo escrito com sucesso em " + filePath);
          return resolve({ filePath, owner })
        });
      });
    });
  }
  return false;
}

function unlinkFile(file) {
  return new Promise((resolve) => {
    file.unlink((error) => {
      if (error) {
        console.error(error);
      }

      return resolve();
    });
  });
}

function isUniqueId(value) {
  if (typeof value === "string") {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim().toLowerCase());
  }
  return false;
}

function isTrue(value) {
  if (typeof (value) === 'string') {
    value = value.trim().toLowerCase();
  }
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default:
      return false;
  }
}

function validarCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf == '') return false;
  // Elimina CPFs invalidos conhecidos
  if (cpf.length != 11 ||
    cpf == "00000000000" ||
    cpf == "11111111111" ||
    cpf == "22222222222" ||
    cpf == "33333333333" ||
    cpf == "44444444444" ||
    cpf == "55555555555" ||
    cpf == "66666666666" ||
    cpf == "77777777777" ||
    cpf == "88888888888" ||
    cpf == "99999999999")
    return false;
  // Valida 1o digito
  add = 0;
  for (i = 0; i < 9; i++)
    add += parseInt(cpf.charAt(i)) * (10 - i);
  rev = 11 - (add % 11);
  if (rev == 10 || rev == 11)
    rev = 0;
  if (rev != parseInt(cpf.charAt(9)))
    return false;
  // Valida 2o digito
  add = 0;
  for (i = 0; i < 10; i++)
    add += parseInt(cpf.charAt(i)) * (11 - i);
  rev = 11 - (add % 11);
  if (rev == 10 || rev == 11)
    rev = 0;
  if (rev != parseInt(cpf.charAt(10)))
    return false;
  return true;
}

const delay = ms => new Promise(_ => setTimeout(_, ms));

// function argValidator(name, type, def, thr, msg) {
//   try {

//   } catch (e) {

//   }
// }

// function patchFn(thisArg, fname, callback) {
//   //require('bycontract');
//   if (arguments.length < 3) throw new Error("missing arguments: should be thisArg: Object, fname: String, callback(err, args): Function");
//   if (typeof thisArg !== "object") throw new Error('thisArg must be object, arg provided was:', typeof thisArg)
//   if (typeof fname !== "string")
//     const fn = thisArg[fname];
//   if (typeof fn !== "function") return false;
//   thisArg[fname] = function (...args) {

//     return fn.call(thisArg, ...args)
//   }
//   return true;
//}

const trimLeft = function (str, charlist) {
  if (charlist === undefined)
    charlist = "\s";

  return str.replace(new RegExp("^[" + charlist + "]+"), "");
}

const trimRight = function (str, charlist) {
  if (charlist === undefined)
    charlist = "\s";

  return str.replace(new RegExp("[" + charlist + "]+$"), "");
};

const trim = function (str, charlist) {
  return trimLeft(str, charlist).trimRight(str, charlist);
}

module.exports = {
  formidableParse,
  saveFileToGridFs,
  retrieveAndSaveToDisk,
  unlinkFile,
  isTrue,
  isUniqueId,
  validarCPF,
  delay,
  trim,
  trimLeft,
  trimRight
}