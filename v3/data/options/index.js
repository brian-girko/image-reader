/* global getRegions, REGIONS_KEY */

'use strict';

const $ = selector => document.querySelector(selector);

$('#close-after').addEventListener('change', e => {
  const value = e.target.value;
  chrome.storage.local.set({
    'close-after': value === 'clipboard' ? 'clipboard' : Number(value)
  });
});

$('#auto-clipboard').addEventListener('change', e => {
  // same behavior as the OCR window: saving the pref is enough, but the
  // clipboard needs the optional permission granted from a user gesture
  chrome.storage.local.set({'auto-clipboard': e.target.checked});
  if (e.target.checked) {
    chrome.permissions.request({
      permissions: ['clipboardWrite']
    }, granted => {
      if (granted !== true) {
        alert(`Please enable the "Input data to the clipboard" permission for this extension in the browser's extensions manager.`);
      }
    });
  }
});

$('#magnify').addEventListener('change', e => {
  chrome.storage.local.set({magnify: e.target.checked});
});

// applied by the background on change; an empty popup string re-enables
// action.onClicked, which is what makes the legacy click behavior work
$('#legacy').addEventListener('change', e => {
  chrome.storage.local.set({'click-action': e.target.checked ? 'capture' : 'popup'});
});

$('#clear-regions').addEventListener('click', async () => {
  const regions = await getRegions();
  const sites = new Set(regions.map(r => r.origin).filter(Boolean));
  const ok = confirm(
    `Delete all ${regions.length} saved region${regions.length === 1 ? '' : 's'}` +
    (sites.size ? ` from ${sites.size} site${sites.size === 1 ? '' : 's'}` : '') +
    '? This cannot be undone.'
  );
  if (ok) {
    await chrome.storage.local.set({[REGIONS_KEY]: []});
  }
});

chrome.storage.local.get({
  'close-after': -1,
  'auto-clipboard': false,
  'magnify': false,
  'click-action': 'popup'
}).then(prefs => {
  $('#close-after').value = prefs['close-after'];
  $('#auto-clipboard').checked = prefs['auto-clipboard'];
  $('#magnify').checked = prefs['magnify'];
  $('#legacy').checked = prefs['click-action'] === 'capture';
});
