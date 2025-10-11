'use strict';

const notify = async e => {
  try {
    const id = await chrome.notifications.create({
      type: 'basic',
      iconUrl: '/data/icons/48.png',
      title: chrome.runtime.getManifest().name,
      message: e.message || e
    });
    setTimeout(() => chrome.notifications.clear(id), 3000);
  }
  catch (ee) {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (tab) {
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: 'E'
      });
      chrome.action.setTitle({
        tabId: tab.id,
        title: e.message || e
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: 'red'
      });
    }
  }
};

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
      e.setAttribute('allow', 'clipboard-write');
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

const internals = new Map();
const isCloned = tab => internals.has(tab.id) && tab.url.startsWith(chrome.runtime.getURL('/'));

const onClicked = async (tab, cloned = false) => {
  if (isCloned(tab)) {
    chrome.tabs.sendMessage(tab.id, {
      method: 'capture'
    });
    return;
  }

  const target = {
    tabId: tab.id
  };
  const prefs = await chrome.storage.local.get({
    magnify: false
  });

  // magnifier
  try {
    if (prefs.magnify) {
      const image = await chrome.tabs.captureVisibleTab();
      chrome.scripting.executeScript({
        target,
        func: src => {
          self.magnify = true;
          self.src = src;
        },
        args: [image]
      });
    }
    else {
      chrome.scripting.executeScript({
        target,
        func: src => {
          self.magnify = false;
        }
      });
    }
  }
  catch (e) {}

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
    const r = await chrome.scripting.executeScript({
      target,
      files: ['/data/inject/inject.js']
    });
    // Safari
    if (r && r[0] && r[0].error) {
      throw (Error(r[0].error));
    }
    // Firefox
    if (r && r[0] === undefined) {
      throw Error('INTERNAL_PAGE');
    }
  }
  catch (e) {
    console.warn(e);
    // can we clone tab
    try {
      const v = await chrome.tabs.captureVisibleTab();
      const args = new URLSearchParams();
      args.set('title', 'Screenshot of "' + tab.title + '"');
      const t = await chrome.tabs.create({
        url: '/data/blank/index.html?' + args.toString(),
        index: tab.index + 1,
        openerTabId: tab.id
      });
      internals.set(t.id, v);
    }
    catch (e) {
      notify(e);
    }
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
    if (isCloned(sender.tab)) {
      chrome.tabs.sendMessage(sender.tab.id, {
        method: 'proceed',
        href: internals.get(sender.tab.id),
        request
      });
    }
    else {
      chrome.tabs.captureVisibleTab(sender.tab.windowId, {
        format: 'png'
      }, href => {
        proceed(sender.tab.id, href, request);
      });
    }
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
    if (isCloned(sender.tab)) {
      chrome.tabs.sendMessage(sender.tab.id, request);
    }
    else {
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
  }
  else if (request.method === 'remove-iframe') {
    if (isCloned(sender.tab)) {
      chrome.tabs.sendMessage(sender.tab.id, {
        method: 'remove-iframe'
      });
    }
    else {
      chrome.scripting.executeScript({
        target: {
          tabId: sender.tab.id
        },
        func: () => {
          document.querySelector('iframe.gfrunj').remove();
        }
      });
    }
  }
  else if (request.method === 'clipboard-permission') {
    chrome.permissions.request({
      permissions: ['clipboardWrite']
    }, response);
    return true;
  }
  else if (request.method === 'get-image') {
    response(internals.get(sender.tab.id));
    // internals.delete(sender.tab.id);
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
  chrome.management = chrome.management || {
    getSelf(c) {
      c({installType: 'normal'});
    }
  };
  if (navigator.webdriver !== true) {
    const {homepage_url: page, name, version} = chrome.runtime.getManifest();
    chrome.runtime.onInstalled.addListener(({reason, previousVersion}) => {
      chrome.management.getSelf(({installType}) => installType === 'normal' && chrome.storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            chrome.tabs.query({active: true, lastFocusedWindow: true}, tbs => chrome.tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            chrome.storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    chrome.runtime.setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
