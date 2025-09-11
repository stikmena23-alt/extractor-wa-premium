export const VERSION = '1.2.1';
const LS_PREFIX = 'v' + VERSION.replace(/\./g, '') + '_';
export const LS = {
  settings: LS_PREFIX + 'settings',
  batch: LS_PREFIX + 'batch',
  history: LS_PREFIX + 'history'
};
