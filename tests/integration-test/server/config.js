'use strict';

const { join } = require('path');

const PORT = 4000;

module.exports = {
  input: '', // TODO fill in input file path here?
  STORAGE_BASE_DIR: join(__dirname, './storage'),
  API_TOKEN: 'my-very-special-key12345',
  API_BASE_URL: `http://localhost:${PORT}/v1`,
  PORT,
};
