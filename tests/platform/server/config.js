/**
 * Local testing server config.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 */
'use strict';

const path = require('path');

const PORT = 4000;

module.exports = {
  STORAGE_BASE_DIR: 'out',
  PORT: PORT,
  TEST_REPORT_PATH: 'out/test-report.txt',
};
