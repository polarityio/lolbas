'use strict';

const schedule = require('node-schedule');
const requestCb = require('postman-request');
const config = require('./config/config');
const fs = require('fs');
const { promisify } = require('util');

const EVERY_MIDNIGHT = '0 0 * * *';
let requestDefault;
let Logger;
let lolbasLookupMap;
let reloadRunning = false;
let reloadScheduled = false;

function startup(logger) {
  Logger = logger;

  let defaults = {};

  if (typeof config.request.cert === 'string' && config.request.cert.length > 0) {
    defaults.cert = fs.readFileSync(config.request.cert);
  }

  if (typeof config.request.key === 'string' && config.request.key.length > 0) {
    defaults.key = fs.readFileSync(config.request.key);
  }

  if (typeof config.request.passphrase === 'string' && config.request.passphrase.length > 0) {
    defaults.passphrase = config.request.passphrase;
  }

  if (typeof config.request.ca === 'string' && config.request.ca.length > 0) {
    defaults.ca = fs.readFileSync(config.request.ca);
  }

  if (typeof config.request.proxy === 'string' && config.request.proxy.length > 0) {
    defaults.proxy = config.request.proxy;
  }

  if (typeof config.request.rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = config.request.rejectUnauthorized;
  }

  let requestCbDefault = requestCb.defaults(defaults);
  requestDefault = promisify(requestCbDefault);
}

function errorToPojo(err) {
  if (err instanceof Error) {
    return {
      // Pull all enumerable properties, supporting properties on custom Errors
      ...err,
      // Explicitly pull Error's non-enumerable properties
      name: err.name,
      message: err.message,
      stack: err.stack,
      detail: err.detail ? err.detail : 'LOLBAS integration had an error'
    };
  }
  return err;
}

function RequestException(message, meta) {
  this.message = message;
  this.meta = meta;
}

async function loadList() {
  reloadRunning = true;
  try {
    Logger.info('Loading Lolbas List');
    const requestOptions = {
      uri: 'https://lolbas-project.github.io/api/lolbas.json',
      json: true
    };

    const response = await requestDefault(requestOptions);
    if (response.statusCode === 200 && Array.isArray(response.body)) {
      lolbasLookupMap = new Map();
      response.body.forEach((names) => {
        lolbasLookupMap.set(names.Name.toLowerCase(), names);
      });
      Logger.info(`Finished loading ${lolbasLookupMap.size} lolabs`);
      //Logger.trace(lolbasLookupMap.names);
    } else {
      Logger.error({ response }, 'Unexpected HTTP Status Code');
      throw new RequestException(
        `Unexpected status code ${response.statusCode} received`,
        response
      );
    }
  } finally {
    reloadRunning = false;
  }
}

function _getSummaryTags(searchResult) {
  const tags = [];
  let description = searchResult.Description;

  tags.push(description);
  Logger.trace('Tag data', tags);

  return tags;
}

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
async function doLookup(entities, options, cb) {
  let lookupResults = [];

  if (reloadScheduled === false) {
    try {
      await loadList();
      schedule.scheduleJob(EVERY_MIDNIGHT, loadList);
      reloadScheduled = true;
    } catch (err) {
      return cb(errorToPojo(err));
    }
  }

  entities.forEach((entity) => {
    if (reloadRunning) {
      lookupResults.push({
        entity,
        data: {
          summary: ['Temporarily unavailable. Retry search'],
          details: {
            reloadRunning: true
          }
        }
      });
      return;
    }

    let searchResult = lolbasLookupMap.get(entity.value.toLowerCase());
    Logger.trace({ searchResult }, 'Search Result');
    if (searchResult) {
      lookupResults.push({
        entity,
        data: {
          summary: _getSummaryTags(searchResult),
          details: searchResult
        }
      });
    } else {
      lookupResults.push({
        entity,
        data: null
      });
    }
  });

  cb(null, lookupResults);
}

module.exports = {
  doLookup,
  startup
};
