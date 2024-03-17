const puppeteer = require('./node_modules_local/node_modules/puppeteer');
const fs = require('./node_modules_local/node_modules/fs');
const fetch = require('./node_modules_local/node_modules/node-fetch');
const readline = require('readline');
const path = require('./node_modules_local/node_modules/path');
const { parseString } = require('./node_modules_local/node_modules/xml2js');

const CONFIG_FILE_PATH = path.join(__dirname, '../config/config.json');
const MOVIES_DB_FILE_PATH = path.join(__dirname, '../data/movies.db');
const MOVIES_DB_OLD_FILE_PATH = path.join(__dirname, '../data/movies.db.old');
const SHOWS_DB_FILE_PATH = path.join(__dirname, '../data/shows.db');
const SHOWS_DB_OLD_FILE_PATH = path.join(__dirname, '../data/shows.db.old');
const FAILED_RATINGKEY_FILE_PATH = path.join(__dirname, '../data/failedRatingKeys.txt');
const ERROR_TVSHOWS_FILE_PATH = path.join(__dirname, '../data/errShows.txt');

module.exports = {
    puppeteer,
    fs,
    fetch,
    readline,
    path,
    parseString,
    CONFIG_FILE_PATH,
    MOVIES_DB_FILE_PATH,
    MOVIES_DB_OLD_FILE_PATH,
    SHOWS_DB_FILE_PATH,
    SHOWS_DB_OLD_FILE_PATH,
    FAILED_RATINGKEY_FILE_PATH,
    ERROR_TVSHOWS_FILE_PATH
};