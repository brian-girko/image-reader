'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
});

chrome.action.onClicked.addListener(async tab => {
  try {
    await chrome.scripting.insertCSS({
      target: {
        tabId: tab.id
      },
      files: ['data/inject/inject.css']
    });
    chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      files: ['data/inject/inject.js']
    });
    chrome.action.setIcon({
      tabId: tab.id,
      path: {
        '16': 'data/icons/inspect/16.png',
        '32': 'data/icons/inspect/32.png',
        '48': 'data/icons/inspect/48.png'
      }
    });
  }
  catch (e) {
    notify(e);
  }
});

const cache = {};

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'captured' || request.method === 'aborted') {
    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': 'data/icons/16.png',
        '32': 'data/icons/32.png',
        '48': 'data/icons/48.png'
      }
    });
  }
  //
  if (request.method === 'captured') {
    const {devicePixelRatio, left, top, width, height} = request;

    if (!width || !height) {
      return notify('Please select a region. Either width or height of the captured area was zero');
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, {
      format: 'png'
    }, href => {
      cache[sender.tab.id] = {
        width: width * devicePixelRatio,
        height: height * devicePixelRatio,
        left: left * devicePixelRatio,
        top: top * devicePixelRatio,
        href
      };
      console.log(1111);
      chrome.scripting.executeScript({
        target: {
          tabId: sender.tab.id
        },
        files: ['data/inject/response.js']
      });
    });
  }
  else if (request.method === 'image') {
    response(cache[sender.tab.id]);
    delete cache[sender.tab.id];
  }
  else if (request.method === 'close-me' || request.method === 'resize') {
    chrome.tabs.sendMessage(sender.tab.id, request);
  }
  else if (request.method === 'open-link') {
    chrome.tabs.create({
      url: request.href,
      index: sender.tab.index
    });
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
