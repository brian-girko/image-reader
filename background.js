'use strict';

var notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

chrome.browserAction.onClicked.addListener(() => {
  chrome.tabs.insertCSS({
    runAt: 'document_start',
    file: 'data/inject/inject.css'
  }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      return notify(lastError);
    }
    chrome.tabs.executeScript({
      runAt: 'document_start',
      file: 'data/inject/inject.js'
    });
  });
});

var cache = {};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'captured') {
    const {width, height, left, top} = request;
    console.log(request);
    if (!width || !height) {
      return notify('Please select a region. Either width or height of the captured area was zero');
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, {
      format: 'png'
    }, dataUrl => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = width || img.width;
        canvas.height = height || img.height;
        if (width && height) {
          ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
        }
        else {
          ctx.drawImage(img, 0, 0);
        }
        cache[sender.tab.id] = canvas.toDataURL();
        chrome.tabs.executeScript({
          runAt: 'document_start',
          file: 'data/inject/response.js'
        });
      };
      img.src = dataUrl;
    });
  }
  else if (request.method === 'image') {
    response(cache[sender.tab.id]);
    delete cache[sender.tab.id];
  }
  else if (request.method === 'close-me') {
    chrome.tabs.sendMessage(sender.tab.id, request);
  }
});
