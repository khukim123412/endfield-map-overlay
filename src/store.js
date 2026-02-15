'use strict';

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULTS = {
  opacity: 1.0,
  mapUrl: 'https://endfieldtools.dev/interactive-map/valley-iv/',
};

let data = null;

function load() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    data = { ...DEFAULTS, ...JSON.parse(raw) };
    console.log('[store] Loaded settings:', STORE_FILE);
  } catch (_) {
    data = { ...DEFAULTS };
    console.log('[store] No settings file, using defaults');
  }
  return data;
}

function save() {
  if (!data) return;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[store] Failed to save settings:', err.message);
  }
}

function get(key) {
  if (!data) load();
  return data[key];
}

function set(key, value) {
  if (!data) load();
  data[key] = value;
  save();
}

module.exports = { load, get, set };
