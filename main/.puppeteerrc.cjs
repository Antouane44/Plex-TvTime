const { join } = require('./node_modules_local/node_modules/path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Change l'emplacement du cache pour Puppeteer.
  cacheDirectory: join(__dirname, 'node_modules_local', 'puppeteer', '.cache'),
};
