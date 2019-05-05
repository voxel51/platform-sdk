/**
 * Analytic JSON schema validator.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 *
 * David Hodgson, david@voxel51.com
 */
'use strict';

const joi = require('joi');
const R = require('ramda');

const schema = (function main() {
  const inputSchema = joi.object({
    name: joi.string().required(),
    type: joi.string().required(),
    description: joi.string().required(),
    required: joi.boolean().required(),
  });

  const outputSchema = joi.object({
    name: joi.string().required(),
    type: joi.string().required(),
    description: joi.string().required(),
    filename: joi.string().required(),
    post_as_data: joi.boolean().required(),
    schema: joi.object().allow(null).required(),
  });

  const parameterSchema = joi.object({
    name: joi.string().required(),
    type: joi.string().required(),
    description: joi.string().required(),
    placeholder: joi.string().required(),
    required: joi.boolean().required(),
    default: joi.any(),
  });

  const infoSchema = joi.object({
    version: joi.string().required(),
    name: joi.string().required(),
    description: joi.string().required(),
    supports_cpu: joi.boolean().required(),
    supports_gpu: joi.boolean().required(),
  });

  const analyticSchema = joi.object({
    info: infoSchema.required(),
    inputs: joi.array().required(),
    parameters: joi.array().required(),
    outputs: joi.array().required(),
    zip_outputs: joi.boolean().required(),
  });

  const validater = R.curry(function validater(schema, test) {
    return new Promise(function(resolve, reject) {
      const opts = {
        abortEarly: false,
        convert: false,
      };
      joi.validate(test, schema, opts, (err, value) => {
        if (err) {
          return reject(err);
        }
        return resolve(true);
      });
    });
  });

  return Object.freeze({
    validate: Object.freeze({
      input: validater(inputSchema),
      output: validater(outputSchema),
      parameter: validater(parameterSchema),
      structure: validater(analyticSchema),
    }),
  });
}());

module.exports = schema;
