/**
 * Local testing server config.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 *
 * David Hodgson, david@voxel51.com
 * Brian Moore, brian@voxel51.com
 */
'use strict';

const path = require('path');

const PORT = 4000;

module.exports = {
  STORAGE_BASE_DIR: 'out',
  API_BASE_URL: `http://127.0.0.1:${PORT}/v1`,
  PORT: PORT,
  TEST_REPORT_PATH: 'out/test-report.txt',
};
