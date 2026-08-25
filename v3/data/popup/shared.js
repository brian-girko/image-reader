'use strict';

/* Shared between the popup pages (classic script) and the service
   worker (importScripts). Stores OCR regions as CSS pixels relative
   to the viewport, keyed per site origin — same idea as ocr-it's
   pinned region, one storage schema shared by background and UI. */

const REGIONS_KEY = 'regions';

const getRegions = async () => {
  const store = await chrome.storage.local.get({
    [REGIONS_KEY]: []
  });
  return store[REGIONS_KEY];
};

// eslint-disable-next-line no-unused-vars
const saveRegion = async region => {
  const regions = await getRegions();
  const index = regions.findIndex(r => r.id === region.id);
  if (index === -1) {
    regions.push(region);
  }
  else {
    regions[index] = region;
  }
  await chrome.storage.local.set({
    [REGIONS_KEY]: regions
  });
  return region;
};

// eslint-disable-next-line no-unused-vars
const deleteRegion = async id => {
  const regions = (await getRegions()).filter(r => r.id !== id);
  await chrome.storage.local.set({
    [REGIONS_KEY]: regions
  });
};

// eslint-disable-next-line no-unused-vars
const findRegion = async id => (await getRegions()).find(r => r.id === id);

// eslint-disable-next-line no-unused-vars
const originOf = href => {
  try {
    return new URL(href).origin;
  }
  catch (e) {
    return '';
  }
};
