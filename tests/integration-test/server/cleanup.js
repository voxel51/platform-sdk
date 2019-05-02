'use strict';

const { exec } = require('child_process');

const config = require('./config.js');

(function main() {
  console.log('----- Cleaning up temporary storage files ------ ');
  exec(`rm ${config.STORAGE_BASE_DIR}/*`, (err, stdout, stderr) => {
    if (err) console.error(err);
    console.log('----- Cleanup complete -----');
  });
}());
