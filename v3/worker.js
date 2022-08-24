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
    await chrome.scripting.executeScript({
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

chrome.runtime.onMessage.addListener((request, sender) => {
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
    }, async href => {
      try {
        const target = {
          tabId: sender.tab.id
        };
        await chrome.scripting.executeScript({
          target,
          files: ['/data/inject/elements.js'],
          world: 'MAIN'
        });
        await chrome.scripting.executeScript({
          target,
          files: ['/data/engine/helper.js']
        });
        await chrome.scripting.executeScript({
          target,
          files: ['/data/inject/response.js']
        });
        // start
        chrome.storage.local.get({
          'post-method': 'POST',
          'post-href': '',
          'post-body': '',
          'lang': 'eng',
          'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara']
        }, prefs => chrome.scripting.executeScript({
          target,
          func: (prefs, href, box) => {
            const em = document.querySelector('ocr-result:last-of-type');

            em.command('configure', prefs);
            em.command('prepare');

            em.href = href;
            em.box = box;

            em.run();
          },
          args: [prefs, href, {
            width: width * devicePixelRatio,
            height: height * devicePixelRatio,
            left: left * devicePixelRatio,
            top: top * devicePixelRatio
          }]
        }));
      }
      catch (e) {
        notify(e);
      }
    });
  }
  else if (request.method === 'open-link') {
    chrome.tabs.create({
      url: request.href,
      index: sender.tab.index + 1
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
