'use strict';

const notify = e => chrome.notifications.create({
  type: 'basic',
  iconUrl: '/data/icons/48.png',
  title: chrome.runtime.getManifest().name,
  message: e.message || e
}, id => setTimeout(() => chrome.notifications.clear(id), 3000));

const proceed = (tabId, href, request) => chrome.scripting.executeScript({
  target: {
    tabId
  },
  func: (href, request) => {
    const f = document.querySelector('iframe.gfrunj');
    if (f) {
      f.contentWindow.postMessage({
        method: 'proceed',
        href,
        request
      }, '*');
    }
    else {
      const e = document.createElement('iframe');
      e.classList.add('gfrunj');
      e.style = `
        position: fixed;
        height: 0;
        width: min(500px, calc(100vw - 2rem));
        border: none;
        box-shadow: 0 0 0 1px #e5e5e5;
        bottom: 10px;
        right: 10px;
        color-scheme: light;
        z-index: 2147483647;
      `;
      e.onload = () => {
        e.contentWindow.postMessage({
          method: 'proceed',
          href,
          request
        }, '*');
      };
      e.src = chrome.runtime.getURL('/data/inject/sandbox.html');
      document.documentElement.append(e);
    }
  },
  args: [href, request]
});

const onClicked = async tab => {
  try {
    await chrome.scripting.insertCSS({
      target: {
        tabId: tab.id
      },
      files: ['/data/inject/inject.css']
    });
    // set icon here since we might toggle back if the capturing mode is active
    chrome.action.setIcon({
      tabId: tab.id,
      path: {
        '16': '/data/icons/inspect/16.png',
        '32': '/data/icons/inspect/32.png',
        '48': '/data/icons/inspect/48.png'
      }
    });
    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      files: ['/data/inject/inject.js']
    });
  }
  catch (e) {
    console.error(e);
    notify(e);
  }
};
chrome.action.onClicked.addListener(onClicked);
chrome.commands.onCommand.addListener(async command => {
  if (command === 'simulate_action') {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (tabs.length) {
      onClicked(tabs[0]);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.method === 'captured' || request.method === 'aborted') {
    chrome.action.setIcon({
      tabId: sender.tab.id,
      path: {
        '16': '/data/icons/16.png',
        '32': '/data/icons/32.png',
        '48': '/data/icons/48.png'
      }
    });
  }
  //
  if (request.method === 'captured') {
    const {width, height} = request;

    if (!width || !height) {
      return notify('Please select a region. Either width or height of the captured area was zero');
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, {
      format: 'png'
    }, href => {
      proceed(sender.tab.id, href, request);
    });
  }
  else if (request.method === 'open-link') {
    chrome.tabs.create({
      url: request.href,
      index: sender.tab.index + 1
    });
  }
  else if (request.method === 'remove-indexeddb') {
    caches.delete('traineddata').finally(response);
    try {
      indexedDB.databases().then(as => {
        for (const {name} of as) {
          indexedDB.deleteDatabase(name);
        }
      });
    }
    catch (e) {}

    return true;
  }
  else if (request.method === 'resize') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: height => {
        document.querySelector('iframe.gfrunj').style.height = height;
      },
      args: [request.height]
    });
  }
  else if (request.method === 'remove-iframe') {
    chrome.scripting.executeScript({
      target: {
        tabId: sender.tab.id
      },
      func: () => {
        document.querySelector('iframe.gfrunj').remove();
      }
    });
  }
  else if (request.method === 'clipboard-permission') {
    chrome.permissions.request({
      permissions: ['clipboardWrite']
    }, response);
    return true;
  }
});

// We no longer use IndexedDB
chrome.runtime.onInstalled.addListener(() => {
  try {
    indexedDB.databases().then(as => {
      for (const {name} of as) {
        indexedDB.deleteDatabase(name);
      }
    });
  }
  catch (e) {}
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, lastFocusedWindow: true}, tbs => tabs.create({
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
