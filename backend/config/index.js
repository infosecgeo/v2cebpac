const env = require('./env');
const security = require('./security');
const constants = require('./constants');

module.exports = {
  ...env,
  ...security,
  ...constants,
};
