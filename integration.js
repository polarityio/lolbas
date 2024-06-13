'use strict';

const schedule = require('node-schedule');
const requestCb = require('postman-request');
const config = require('./config/config');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { promises: fsAsync } = require('fs');

const EVERY_MIDNIGHT = '0 0 * * *';
let requestDefault;
let Logger;
let lolbasLookupByName;
let reloadRunning = false;
let reloadScheduled = false;
let previousAutoUpdateSetting;

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

async function loadListFromInternet() {
  reloadRunning = true;
  try {
    const requestOptions = {
      uri: 'https://lolbas-project.github.io/api/lolbas.json',
      json: true
    };

    const response = await requestDefault(requestOptions);

    if (response.statusCode === 200 && Array.isArray(response.body)) {
      lolbasLookupByName = new Map();
      response.body.forEach((exe) => {
        enrichExe(exe);
        lolbasLookupByName.set(exe.Name.toLowerCase(), exe);
      });
      Logger.info(
        `Successfully loaded ${lolbasLookupByName.size} LOLBAS entries from https://lolbas-project.github.io/api/lolbas.json`
      );
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

async function loadListFromFile() {
  reloadRunning = true;
  try {
    Logger.info(`Loading LOLBAS list from file`);
    const dataFile = await fsAsync.readFile('./data/lolbas.json', 'utf-8');
    const dataJson = JSON.parse(dataFile);

    lolbasLookupByName = new Map();
    dataJson.forEach((exe) => {
      enrichExe(exe);
      lolbasLookupByName.set(exe.Name.toLowerCase(), exe);
    });
    Logger.info(
      `Successfully loaded ${lolbasLookupByName.size} LOLBAS entries from local 'data/lolbas.json' file`
    );
  } finally {
    reloadRunning = false;
  }
}

function enrichExe(exe) {
  if (exe && Array.isArray(exe.Detection)) {
    const detectionMap = new Map();

    exe.Detection.forEach((detection) => {
      for (let key in detection) {
        let value = detection[key];

        if (value === null) {
          return;
        }

        let newObj;
        if (
          key === 'Analysis' ||
          key === 'Sigma' ||
          key === 'Splunk' ||
          key === 'Elastic' ||
          key === 'BlockRule'
        ) {
          newObj = {
            label: path.basename(value),
            href: value,
            isUrl: true
          };
        } else {
          newObj = {
            label: value,
            isUrl: false
          };
        }
        if (detectionMap.has(key)) {
          detectionMap.get(key).push(newObj);
        } else {
          detectionMap.set(key, [newObj]);
        }
      }
    });

    exe.Detection = [...detectionMap].map(([key, value]) => ({ key, value }));
  }
}

function _getSummaryTags(searchResult) {
  return [searchResult.Description];
}

function autoUpdateChanged(options) {
  return previousAutoUpdateSetting !== options.autoUpdate;
}

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
async function doLookup(entities, options, cb) {
  Logger.trace({ entities }, 'doLookup');
  let lookupResults = [];

  if (autoUpdateChanged(options)) {
    Logger.info(`Auto Update setting changed to ${options.autoUpdate}`);
    reloadScheduled = false;
  }

  if (options.autoUpdate && reloadScheduled === false) {
    try {
      await loadListFromInternet();
      schedule.scheduleJob(EVERY_MIDNIGHT, loadListFromInternet);
      reloadScheduled = true;
    } catch (err) {
      return cb(errorToPojo(err));
    }
  } else if (options.autoUpdate === false && reloadScheduled === false) {
    try {
      await loadListFromFile();
      reloadScheduled = true;
    } catch (err) {
      return cb(errorToPojo(err));
    }
  }

  previousAutoUpdateSetting = options.autoUpdate;

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

    let searchResult = lolbasLookupByName.get(entity.value.toLowerCase());
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
