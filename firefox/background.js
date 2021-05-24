'use strict';

const notify = e => chrome.notifications.create({
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

const cache = {};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'captured') {
    const {devicePixelRatio} = request;
    let {width, height, left, top} = request;
    width = width * devicePixelRatio;
    height = height * devicePixelRatio;
    left = left * devicePixelRatio;
    top = top * devicePixelRatio;

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
  else if (request.method === 'close-me' || request.method === 'resize') {
    chrome.tabs.sendMessage(sender.tab.id, request);
  }
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
