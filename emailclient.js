/** @format */

const nodemailer = require('nodemailer');

function createTransporter() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    domain: process.env.SMTP_DOMAIN,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USERNAME || process.env.SENDGRID_USERNAME,
      pass: process.env.SMTP_PASSWORD || process.env.SENDGRID_PASSWORD
    }
  });

  return transporter;
}

async function sendmail(options) {
  try {
    let tipo, from, to, subject, html, filesToAttach = []
    if (arguments.length >= 5) {
      tipo = arguments[0];
      from = arguments[1];
      to = arguments[2];
      subject = arguments[3];
      html = arguments[4];
      filesToAttach = arguments.length >= 6 && arguments[5]
    } else {
      tipo = options.tipo;
      from = options.from;
      to = options.to;
      subject = options.subject;
      html = options.html;
      filesToAttach = options.fileToAttach;
    }

    if (!tipo || !from || !to || !subject || !html) {
      return reject(new ArgumentError("Faltando parâmetros obrigatórios: "));
    }

    console.log("sendmail:tipo", tipo, process.env.NODE_ENV);

    from = process.env.NODE_ENV !== "development" ? from : process.env.EMAIL_ADMIN;
    to = process.env.NODE_ENV !== "development" ? to : process.env.EMAIL_DEVELOPER;
    subject = process.env.NODE_ENV !== "development" ? subject : "(development) " + subject;
    const msg = {
      from: from,
      to: to,
      subject: subject,
      html: html,
      attachments: []
    };

    const attachments = filesToAttach && filesToAttach.length > 0 ? filesToAttach : [filesToAttach];
    attachments.map(f => msg.attachments.push({ path: f }))
    const transporter = createTransporter();

    let info = await transporter.sendMail(msg);
    console.log(info);
    return info;

  } catch (error) {
    console.error("Error sending email: " + error);
  }
}

module.exports = {
  sendmail
}