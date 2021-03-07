const { exec } = require('child_process');

const { parameters } = require('./config');

const { filesystem } = parameters;

const execute = command =>
  new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      error ? reject(error) : resolve(stdout);
    });
  });

const bytes = (number, unit) => {
  if (unit === 'TB') return number * 1000000000000;
  if (unit === 'GB') return number * 1000000000;
};

const percent = number => number / 100;

const space = bytes => bytes * (1 + percent(filesystem));

module.exports = { execute, bytes, percent, space };
