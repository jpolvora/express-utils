/** @format */

process.on('SIGTERM', graceful);
process.on('SIGINT', graceful);
process.on('exit', graceful);
const events = require('events');
const Agenda = require("agenda");
const key = require('./app-symbols').agenda;
const emitter = Agenda[key] = new events.EventEmitter();
const cluster = require('cluster');
const util = require('util');
const { promise, logSys, formatDateTime } = require('./functions')
let _agenda = undefined;

async function graceful() {
  console.log('gracefull exiting');
  if (_agenda) {
    await _agenda.stop();
  }
}

async function getInstance() {
  if (_agenda) return _agenda;
  const mongo = require('mongoose').connection;
  const agenda = await init(mongo, true);
  return agenda;
}

async function init(mongo, force) {
  if (_agenda) return _agenda;

  if (force || process.env.ENABLE_AGENDA === "1") {

    const agenda = new Agenda({
      defaultConcurrency: 1,
      processEvery: process.env.AGENDA_INTERVAL || "30 seconds",
      mongo: mongo,
      db: {
        collection: process.env.COLLECTION_PREFIX + 'agendaJobs'
      }
    });

    _agenda = agenda;

    agenda.on("start", (job) => {
      console.debug("Job %s (%s) started", job.attrs.name, job.attrs._id.toString());
      logSys(`agenda:start job ${job.attrs.name} at ${formatDateTime()}`, job.attrs);
    });

    agenda.on("success", (job) => {
      console.debug("Job %s (%s) finished success", job.attrs.name, job.attrs._id.toString());
    });

    agenda.on("fail", (err, job) => {
      console.error("Job %s (%s) error: %s", job.attrs.name, job.attrs._id && job.attrs._id.toString() || "", err);
    });

    agenda.on("complete", (job) => {
      if (job.attrs.failReason) {
        logSys(`agenda:complete:ERROR job: ${job.attrs.name}, ${formatDateTime()}: ${job.attrs.failReason}`, job.attrs);
      } else {
        logSys(`agenda:complete:SUCCESS job: ${job.attrs.name}, ${formatDateTime()}`, job.attrs);
      }
      emitter.emit('jobcompleted', job)
    });


    defineTasks(agenda);

    await agenda.start();
    await agenda._ready;

    if (cluster.isMaster) {
      //console.log("limpando tasks jobs etc");
      if (process.env.AGENDA_PURGE === "1") {
        await agenda.cancel(); //remove tasks
        await agenda.purge();
      }
    }

    console.log('agenda iniciada!');
    return agenda;
  }
}

function taskWrapper(task) {
  return async (job, done) => {
    const hrstart = process.hrtime();

    const data = {}; // prevent undefined data = {}

    async function successHandler(result) {
      data.handled = true;
      data.result = result;
      data.success = true;
      data.error = false;
      return done();
    }

    async function errorHandler(err) {
      data.handled = true;
      data.error = err;
      data.result = err;
      data.success = false;
      return done(err)
    }

    try {
      await task(job, successHandler, errorHandler);
      const hrend = process.hrtime(hrstart)
      const execTime = util.format('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
      data.execTime = execTime;
      if (!job.attrs.data) job.attrs.data = {};
      job.attrs.data = Object.assign(job.attrs.data, data);
      await job.save();

    } catch (error) {
      console.error(error);
      return done(error);
    }
  }
}

async function defineTasks(agenda) {

  const definedJobs = [];

  function defineJob(callback) {
    return (jobName, jobOptions, tasksExecutor) => {
      if (definedJobs.includes(jobName)) throw new Error("Job já foi definido anteriormente");
      definedJobs.push(jobName);
      agenda.define(jobName, jobOptions, taskWrapper(tasksExecutor));
      callback(jobName);
    }
  }

  [
    './tasks/saldo',
    './tasks/ajustes',
    './tasks/backup',
    './tasks/dummy',
    './tasks/restore',
    './tasks/sendmail',
    './tasks/ativarInvestimento',
    './tasks/rodarRendimentos',
    './tasks/checkprogramacao',
    './tasks/reativarInvestimentos'
  ].forEach(file => {
    try {
      const taskExported = require(file);
      taskExported.call(agenda, defineJob(jobName => {
        console.log(`job [${jobName}] loaded from [${file}.js]`);
      }));

    } catch (error) {
      console.error(`Error loading file [${file}.js]: ${error}`);
      throw error;
    }
  });

  agenda.define("Atribuir Slots", { priority: "high", concurrency: 1 }, async (job, done) => {
    try {
      const task = require("./tasks/atribuirSlots");
      await task();
      return done();
    } catch (error) {
      return done(error);
    }
  });

  agenda.define("usernames", { priority: "high", concurrency: 1 }, async (job, done) => {
    try {
      const task = require("./tasks/usernames");
      await task();
      return done();
    } catch (error) {
      return done(error);
    }
  });

  agenda.define("reboot", { priority: "high", concurrency: 1 }, async (job, done) => {
    console.log('rebooting in a few seconds (agenda job)');
    await agenda.stop();
    setTimeout(() => {
      return process.exit(0);
    }, 3000);
    return done();
  });
}

module.exports = {
  init: init,
  getInstance: getInstance
};
