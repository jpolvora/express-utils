const mongoose = require('mongoose');
const csrfProtection = require('csurf');
const zlib = require('zlib');
const stream = require('stream');
const util = require('util');
const { trim, trimLeft, trimRight } = require('./utils');
const fse = require('fs-extra');
const path = require('path');
const moment = require('moment');

const pipeline = util.promisify(stream.pipeline);

function createError(name, status, msg) {
    const error = new Error(msg);
    error.status = status;
    error.name = name;
    return error;
}

function getReqPath(req) {
    const basePath = trim(req.baseUrl, '/');
    const path = trim(req.path, '/');
    const result = '/' + trim(`${basePath}/${path}`, '/');
    return result;
}

function getRedirectUrl(loginURL, reqPath) {
    reqPath = loginURL === reqPath ? '/office/index' : reqPath;
    const returnUrl = `${loginURL}?returnUrl=${encodeURIComponent(reqPath)}`;
    return returnUrl;
}

const utils = {
    getRedirectUrl,
    getReqPath,
    resetSessionData: function () { },

    checkManutencaoRedirectMessage: function (redirectTo) {
        return (req, res, next) => {
            // const msg = "No momento esta função está indisponível, devido a uma manutenção no sistema. Aguarde !";
            // if (process.env.MANUTENCAO_PARCIAL === "1") {
            //     if (req.xhr) {
            //         return res.json(msg)
            //     } else {
            //         req.session.flash = msg;
            //         return res.redirect(redirectTo || '/office/index');
            //     }
            // }
            return next();
        }
    },

    checkmanutencao: function () {
        return (req, res, next) => {
            if (process.env.MANUTENCAO === "1") {
                return res.render('site/manutencao', {
                    previsao: process.env.HORARIO_FIM_MANUT || ''
                });
            }
            return next();
        }
    },

    csurf: () => {
        const fn = csrfProtection();
        return fn;
    },

    csurfHeader: (options, key = "_csrf") => {
        return (req, res, next) => {
            const middleware = csrfProtection(options);
            return middleware(req, res, (err) => {
                if (err) return next(err);
                const token = req.csrfToken();
                res.set(key, token);
                return next();
            });
        }
    },

    requireAjax: function () {
        return (req, res, next) => {
            if (req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
                return next();
            }

            return res.end('only ajax requests allowed to this endpoint');
        }
    },

    checkLoginRedirect: function (loginUrl = '/login') {
        return function (req, res, next) {
            return req.user
                ? next()
                : res.redirect(getRedirectUrl(loginUrl, getReqPath(req)));
        };
    },

    forceLogout: function () {
        return function (req, res, next) {
            if (req.user) return req.session.destroy(function () {
                return res.redirect('/');
            });

            return next();
        };
    },

    checkLogin: function () {
        return function (req, res, next) {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Não está autenticado'
                }).end();
            }

            return next();
        };
    },

    check: function (operation) {
        //insert to db

        return async function (req, res, next) {
            console.log("checking operation: '" + operation + "'");
            if (!req.user) {
                return res.status(401).end();
            }
            const Operation = mongoose.model('Operation');

            let dbOperation = await Operation.findOne({
                name: operation
            }).exec();

            if (!dbOperation) {
                dbOperation = new Operation({
                    name: operation,
                    roles: ["admin"]
                });
                await dbOperation.save();
            }

            if (!dbOperation.roles || dbOperation.roles.length == 0) {
                return next();
            }

            // if (req.user.isAdmin) {
            //     return next();
            // }

            if (!req.user.roles) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuário não possui grupos.'
                }).end();
            }

            let found = false;

            for (let i = 0; i < req.user.roles.length; i++) {
                let role = req.user.roles[i];
                if (dbOperation.roles.includes(role)) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuário não possui a permissão necessária'
                }).end();
            }

            //permissão ok -> next
            return next();
        }
    },

    requireRoles: function (roles = [], loginURL = '/login') {
        return function (req, res, next) {
            if (!req.user) {
                if (req.xhr) {
                    return res.status(401).json({
                        success: false,
                        message: 'Não está autenticado'
                    }).end();
                }

                return res.redirect(getRedirectUrl(loginURL, getReqPath(req)));
            }

            for (let i = 0; i < roles.length; i++) {
                var role = roles[i];
                const grantedRoles = [].concat(req.user.roles || []).concat(req.session.roles || [])
                if (grantedRoles.includes(role)) return next()

                let resource = getReqPath(req);
                const message = `Você precisa da permissão: '${role}' para acessar o recurso: '${resource}'`
                if (req.xhr) {
                    return res.status(403).json({
                        success: false,
                        message
                    }).end();
                }
                if (req && req.session) {
                    req.session.flash = message
                }

                return next(createError("requireRoles", 403, message))
            }
        }
    },

    logSys: async function (description, obj) {
        try {
            const Atividade = mongoose.model('Atividade');
            const a = new Atividade({
                descricao: description,
                username: "no-user",
                hidden: true,
                dados: obj
            });

            await a.save();
        } catch (error) {
            console.error(error);
        }
    },

    log: async function (req, description, obj) {
        try {
            const Atividade = mongoose.model('Atividade');
            const a = new Atividade({
                user: req && req.user && req.user.id || null,
                username: req && req.user && req.user.username || "no-user",
                ip: utils.getIpAddress(req),
                descricao: description,
                hidden: false,
                dados: obj
            });
            await a.save();
        } catch (error) {
            console.error(error);
        }
    },

    getIpAddress: function (req) {
        let ipAddr = req && req.connection && req.connection.remoteAddress || "no-ip";
        try {
            if (req && req.headers["x-forwarded-for"]) {
                const header = req.headers["x-forwarded-for"];
                const list = header.split(",");
                ipAddr = list[list.length - 1];
            }
        } catch (error) {
            console.error(error);
        }

        return ipAddr;
    },

    zip: async function (input, extension = '.gz') {
        const target = input + extension;
        await pipeline(fse.createReadStream(input), zlib.createGzip(), fse.createWriteStream(target));
        console.log('zip Pipeline succeeded.');
        return target;
    },

    unzip: async function (inputFileName, newExtension) {
        const target = path.join(path.dirname(inputFileName), path.basename(inputFileName, path.extname(inputFileName))) + newExtension;
        await pipeline(fse.createReadStream(inputFileName), zlib.createGunzip(), fse.createWriteStream(target));
        console.log('unzip Pipeline succeeded.');
        return target;
    },

    promise: (...args) => {
        const thisArg = args.length >= 2 ? args[0] : null;
        const fn = args.length === 1 ? args[0] : args[1];
        return new Promise((resolve, reject) => {
            //reset call stack
            function handleError(err) {
                return reject(err);
            }

            function handleSuccess(result) {
                return resolve(result);
            }
            setTimeout(() => {
                return fn.call(thisArg, handleSuccess, handleError);
            });
        }, 1000);
    },

    wrapAsyncCall: (fn, timeout = 100) => {
        return new Promise((resolve) => {
            setTimeout(async () => {
                let result = null;
                try {
                    result = await fn();
                } catch (error) {
                    console.error(error);
                }
                return resolve(result);
            }, timeout);
        });
    },

    wrapCall: (fn, timeout = 100) => {
        setTimeout(() => {
            try {
                fn();
            } catch (error) {
                console.error(error);
            }
        }, timeout);
    },

    formatDate: function (date = moment()) {
        return moment(date).format('DD/MM/YYYY');
    },

    formatDateTime: function (date = moment()) {
        return moment(date).format('DD/MM/YYYY hh:mm:ss');
    },

    safeAcessor: function (pathStr, source) {
        const paths = pathsStr.split('.').slice(0);
        const entered = [];
        for (let i = 0; i < paths.length; i++) {
            const element = paths[i];
            entered.push(element);
        }
    }
}

module.exports = utils;