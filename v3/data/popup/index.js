/* global getRegions, deleteRegion, saveRegion, originOf */

'use strict';

const $ = selector => document.querySelector(selector);

let currentOrigin = '';

const render = async () => {
  // this site's regions only, newest first
  const regions = (await getRegions())
    .filter(region => currentOrigin && region.origin === currentOrigin)
    .sort((a, b) => b.createdAt - a.createdAt);

  const list = $('#list');
  list.textContent = '';
  $('#empty').hidden = regions.length !== 0;

  for (const region of regions) {
    const li = document.createElement('li');
    li.dataset.id = region.id;

    const main = document.createElement('div');
    main.classList.add('item-main');

    const label = document.createElement('div');
    label.classList.add('label');
    label.textContent = region.label;
    label.title = 'Double-click to rename';
    label.addEventListener('dblclick', () => rename(region));

    const meta = document.createElement('div');
    meta.classList.add('meta');
    const size = `${Math.round(region.width)}×${Math.round(region.height)}`;
    meta.textContent = `${size} · saved ${when(region.createdAt)}`;

    main.append(label, meta);

    const run = icon('run', 'Run OCR on this region');
    run.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        method: 'capture-region',
        id: region.id
      });
      window.close();
    });

    const redraw = icon('redraw', 'Redraw this region');
    redraw.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        method: 'redraw-region',
        id: region.id
      });
      window.close();
    });

    const del = icon('del', 'Delete this region');
    del.classList.add('del');
    del.addEventListener('click', async () => {
      await deleteRegion(region.id);
      render();
    });

    li.append(main, run, redraw, del);
    list.append(li);
  }
};

const ICONS = {
  run: '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M4 2l9 6-9 6z"/></svg>',
  redraw: '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M11.5 1.5l3 3L6 13l-3.8.8L3 10zM11 2l-.7.7-8 8-.5 2 2-.5 8-8L13 3z"/></svg>',
  del: '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M6 2h4v1h4v1H2V3h4zm-3 3h10l-.7 9a1 1 0 0 1-1 .9H4.7a1 1 0 0 1-1-.9z"/></svg>'
};

const icon = (name, title) => {
  const b = document.createElement('button');
  b.classList.add('icon');
  b.innerHTML = ICONS[name];
  b.title = title;
  return b;
};

const when = ts => {
  const days = (Date.now() - ts) / 1000 / 60 / 60 / 24;
  if (days < 1) {
    return 'today';
  }
  if (days < 30) {
    return Math.round(days) + 'd ago';
  }
  return new Date(ts).toLocaleDateString();
};

const rename = async region => {
  const label = prompt('Region name', region.label);
  if (label && label.trim()) {
    await saveRegion({...region, label: label.trim()});
    render();
  }
};

// actions
$('#draw').addEventListener('click', () => {
  chrome.runtime.sendMessage({method: 'draw-region'});
  window.close();
});
$('#quick').addEventListener('click', () => {
  chrome.runtime.sendMessage({method: 'quick-ocr'});
  window.close();
});
$('#open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

const init = async () => {
  // activeTab is granted by opening the popup, so the URL is readable
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  currentOrigin = tab ? originOf(tab.url) : '';

  if (!currentOrigin || currentOrigin.startsWith('chrome')) {
    currentOrigin = '';
  }
  console.log(currentOrigin);
  if (currentOrigin === '') {
    $('#draw').disabled = true;
  }

  render();
};

init();
