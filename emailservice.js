/** @format */

var fs = require("fs");
var path = require("path");
const templatePath = path.join(__dirname, "templates");
const engine = require("./lib/jsengine").engine;

const email_suporte = process.env.EMAIL_SUPORTE;

function loadTemplate(filePath) {
  return new Promise((resolve, reject) => {
    let fullPath = path.isAbsolute(filePath) ? filePath : path.join(templatePath, filePath);
    if ("" === path.extname(fullPath)) {
      fullPath = fullPath + ".html";
    }
    if (fs.existsSync(fullPath)) {
      fs.readFile(fullPath, (err, contents) => {
        if (err) return reject(err);
        return resolve(contents.toString());
      });
    } else {
      return resolve(false);
    }
  });
}

async function getHtmlFromTemplate(fileName, data) {
  try {
    const templateStr = await loadTemplate(fileName);
    const compiledTemplate = await engine.compile(templateStr);
    const html = compiledTemplate.apply(data);
    return html;
  } catch (error) {
    console.error(error);
    return false;
  }
}

/* função genérica */
async function send_email_simple(from, to, subject, msg) {
  from = from || email_suporte;
  const url = process.env.DOMINIO;
  const message = await getHtmlFromTemplate("simples", { msg, url });

  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "simples",
    from: from,
    to: to,
    subject: subject,
    message: message
  });
}

/* função genérica */
async function send_report(subject, msg) {
  const message = await getHtmlFromTemplate("simples", { msg });

  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "report",
    from: email_suporte,
    to: "jpolvora@gmail.com",
    subject,
    message,
  });
}

/* funções já prontas para envios específicos */
async function send_email_confirmacao(user) {
  const url = `${process.env.DOMINIO}/cadastro/confirmacao/${user.token_validacao_email}`;
  const message = await getHtmlFromTemplate("confirmacao-email.html", {
    url,
    username: user.username,
  });

  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "confirmação de e-mail",
    from: email_suporte,
    to: user.email,
    subject: "Confirmação de e-mail",
    message: message,
  });
}

async function send_email_confirmacao_sucesso(to) {
  const url = `/office/index`;
  const message = await getHtmlFromTemplate("confirmacao-email-sucesso.html", {
    url,
  });
  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "confirmação sucesso",
    from: email_suporte,
    to: to,
    subject: "email confirmado",
    message: message,
  });
}

async function send_email_recover_password(username, to, token) {
  const url = `${process.env.DOMINIO}/cadastro/reset/${token}`;
  const message = await getHtmlFromTemplate("recover-password", {
    username,
    url,
  });

  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "reset de senha",
    from: email_suporte,
    to: to,
    subject: "Reset de Senha",
    message: message,
  });
}

async function send_email_recover_password_success(user) {
  const message = await getHtmlFromTemplate("simples", {
    msg: "Sua senha foi alterada com sucesso.",
  });
  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "senha alterada",
    from: email_suporte,
    to: user.email,
    subject: "Senha alterada com sucesso",
    message: message,
  });
}

async function send_email_ativacao_sucesso(username, to) {
  const url = `${process.env.DOMINIO}/office/index`;
  const message = await getHtmlFromTemplate("ativacao_successo.html", {
    username,
    to,
    url,
  });

  const agenda = await require("./agenda.config").getInstance();
  return await agenda.schedule("now", "sendmail", {
    tipo: "ativação sucesso",
    from: email_suporte,
    to: to,
    subject: "Conta ativada",
    message: message,
  });
}

module.exports = {
  send_report,
  send_email_simple,
  send_email_confirmacao,
  send_email_confirmacao_sucesso,
  send_email_recover_password,
  send_email_recover_password_success,
  send_email_ativacao_sucesso,
};
