/**
 * Local testing server config.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 *
 * David Hodgson, david@voxel51.com
 */
'use strict';

const { join } = require('path');

const PORT = 4000;

module.exports = {
  STORAGE_BASE_DIR: join(__dirname, './storage'),
  API_TOKEN: 'my-very-special-key12345',
  API_BASE_URL: `http://localhost:${PORT}/v1`,
  PORT,
  TEST_REPORT_PATH: join(__dirname, './storage/report.txt'),
};
