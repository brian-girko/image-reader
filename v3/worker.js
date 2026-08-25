/* global originOf, getRegions*/

// shared region helpers (popup/shared.js). Chrome: pulled into the service
// worker here; Firefox: listed first in background.scripts, so guard it.
if (typeof importScripts === 'function') {
  self.importScripts('/data/popup/shared.js');
}

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

const startCapture = async (tab, pickMode = 'ocr', savedRegion = null) => {
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
        injectImmediately: true,
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
    // pass the picker mode (and any previous region to ghost-outline)
    // before the content script runs; defaults keep the legacy flow
    await chrome.scripting.executeScript({
      target,
      injectImmediately: true,
      func: (mode, ghost) => {
        self.pickMode = mode;
        self.savedRegion = ghost;
      },
      args: [pickMode, savedRegion]
    });
    const r = await chrome.scripting.executeScript({
      target,
      injectImmediately: true,
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

const onClicked = tab => startCapture(tab);

/* toolbar click behavior: popup by default, legacy direct capture when the
   user opts out. An empty popup string re-enables action.onClicked */
const applyClickAction = async () => {
  const prefs = await chrome.storage.local.get({
    'click-action': 'popup'
  });
  chrome.action.setPopup({
    popup: prefs['click-action'] === 'popup' ? '/data/popup/index.html' : ''
  });
};
applyClickAction();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['click-action']) {
    applyClickAction();
    if (changes['click-action'].newValue === 'capture') {
      notify('Toolbar click now starts capture directly. Revert anytime: right-click the toolbar icon and select Options.');
    }
  }
});

/* saved-region OCR pipeline. Captures are serialized so overlapping
   requests queue up instead of interleaving screenshots */
let chain = Promise.resolve();
const enqueue = job => {
  chain = chain.then(job, job);
};

const activeTab = async () => (await chrome.tabs.query({
  active: true,
  lastFocusedWindow: true
}))[0];

const captureRegion = async (tab, region) => {
  if (!tab) {
    return notify('No active tab');
  }
  if (!region) {
    return notify('Saved region not found');
  }
  if (region.origin && originOf(tab.url) !== region.origin) {
    notify(`Heads up: this region was drawn on ${region.origin}`);
  }
  try {
    // let any overlay disappear and wait for two paints before the shot,
    // so the extension's own UI can never end up inside the crop
    await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      injectImmediately: true,
      func: () => new Promise(resolve => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      ))
    });
    const image = await new Promise((resolve, reject) => chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    }, href => {
      const e = chrome.runtime.lastError;
      return e ? reject(Error(e.message)) : resolve(href);
    }));
    // ocr-it's scale math: never trust a stored devicePixelRatio; divide the
    // screenshot's own width by the live innerWidth, so zoom changes and
    // retina/non-retina differences come out right
    const [shot] = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id
      },
      injectImmediately: true,
      func: src => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth / window.innerWidth);
        img.onerror = () => reject(Error('cannot decode the screenshot'));
        img.src = src;
      }),
      args: [image]
    });
    proceed(tab.id, image, {
      method: 'proceed',
      left: region.left,
      top: region.top,
      width: region.width,
      height: region.height,
      devicePixelRatio: (shot && shot.result) || 1
    });
  }
  catch (e) {
    console.warn(e);
    notify(e);
  }
};

const standalone = async ({
  image = '',
  proceed = false,
  selector = false,
  agent = false,
  title = '',
  message = ''
}) => {
  const args = new URLSearchParams();
  args.set('mode', 'standalone');
  args.set('proceed', proceed);
  args.set('selector', selector);
  args.set('agent', agent);
  args.set('title', title || 'OCR for Local Images');
  if (message) {
    args.set('message', message);
  }

  const win = await chrome.windows.create({
    url: '/data/blank/index.html?' + args.toString(),
    width: 600,
    height: 600,
    type: 'popup'
  });
  internals.set(win.tabs[0].id, image);

  return win;
};

chrome.action.onClicked.addListener(onClicked);
chrome.commands.onCommand.addListener(async command => {
  if (command === 'simulate_action') {
    onClicked(await activeTab());
  }
  else if (command === 'standalone') {
    standalone({});
  }
  else if (command === 'draw-region') {
    startCapture(await activeTab(), 'save-ocr').catch(notify);
  }
  else if (command === 'capture-region') {
    const tab = await activeTab();
    const origin = originOf(tab?.url);
    const regions = (await getRegions())
      .filter(r => r.origin && r.origin === origin)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (!regions.length) {
      return notify('No saved region for this site yet. Draw one first.');
    }
    enqueue(() => captureRegion(tab, regions[0]));
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
  else if (request.method === 'region-selected') {
    const {left, top, width, height} = request;
    if (width && height) {
      saveRegion({
        id: request.id || 'r' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        label: request.label || request.title || request.origin || 'Region',
        origin: request.origin || originOf(sender.tab?.url || request.href || ''),
        left,
        top,
        width,
        height,
        createdAt: Date.now()
      }).catch(notify);
    }
  }
  else if (request.method === 'draw-region') {
    (async() => startCapture(await activeTab(), 'save-ocr').catch(notify))();
  }
  else if (request.method === 'quick-ocr') {
    (async() => startCapture(await activeTab(), 'ocr').catch(notify))();
  }
  else if (request.method === 'redraw-region') {
    (async() => {
      const region = await findRegion(request.id);
      if (!region) {
        return notify('Saved region not found');
      }
      startCapture(await activeTab(), 'save', region).catch(notify);
    })();
  }
  else if (request.method === 'capture-region') {
    (async() => {
      const region = await findRegion(request.id);
      if (!region) {
        return notify('Saved region not found');
      }
      enqueue(async() => captureRegion(await activeTab(), region));
    })();
  }
  else if (request.method === 'get-regions') {
    (async() => response(await getRegions()))();
    return true;
  }
  else if (request.method === 'delete-region') {
    deleteRegion(request.id).finally(response);
    return true;
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

/* cross-extension MCP support */
chrome.runtime.onMessageExternal.addListener((request, sender, response) => {
  if (request.cmd === 'mcp.json') {
    fetch('mcp/mcp.json').then(r => r.json()).then(response);
    return true;
  }
  else if (request.cmd === 'mcp.output') {
    fetch('mcp/mcp.output').then(r => r.text()).then(response);
    return true;
  }
  else {
    response({
      error: 'unknown-request'
    });
  }
});

/* external access */
const wins = new Set();
chrome.runtime.onConnectExternal.addListener(eport => {
  let win;
  eport.onDisconnect.addListener(() => {
    chrome.windows.remove(win.id).catch(() => {});
  });
  eport.onMessage.addListener(async request => {
    console.log(request);

    if (request.cmd === 'request-ocr') {
      request.agent = true; // to let the popup window know it needs to connect to this port
      const observe = iport => {
        chrome.runtime.onConnect.removeListener(observe);

        iport.onMessage.addListener(r => eport.postMessage(r));
        iport.onDisconnect.addListener(() => {
          const e = chrome.runtime.lastError;
          eport.postMessage({
            cmd: 'disconnected',
            value: e ? e.message : ''
          });
        });
      };
      chrome.runtime.onConnect.addListener(observe);
      win = await standalone(request);
      wins.add(win);

      setTimeout(() => chrome.runtime.onConnect.removeListener(observe), 5000);
    }
    else if (request.cmd === 'close') {
      for (const win of wins) {
        chrome.windows.remove(win.id).catch(() => {});
      }
      eport.postMessage({
        cmd: 'report',
        value: wins.size ? 'OCR window is closed' : 'no OCR window to close'
      });
    }
    else {
      eport.postMessage({
        error: 'this command is unknown'
      });
    }
  });
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
