const Recaptcha = require('express-recaptcha').RecaptchaV2;

const recaptcha = new Recaptcha(process.env.RECAPTCHA_KEY, process.env.RECAPTCHA_SECRET);

module.exports = {
  renderRecaptcha: () => {
    return recaptcha.middleware.renderWith({ hl: 'pt-br', callback: 'enableDisable', expired_callback: 'reset' })
  },
  recaptcha: recaptcha,
  verify: function (req) {
    return new Promise((resolve) => {
      recaptcha.verify(req, (error, data) => {
        return resolve({ error, data });
      });
    });
  }
}