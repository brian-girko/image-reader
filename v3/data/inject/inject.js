/* global guide, capture, monitor */
'use strict';

if (document.querySelector('.itrisearch-guide-1')) {
  try {
    chrome.runtime.sendMessage({
      method: 'aborted'
    });
    guide.remove();
    capture.remove();
    monitor.remove();
  }
  catch (e) {}
}
else {
  self.capture = (function() {
    const rect = {};
    let box;

    const calc = () => ({
      left: Math.min(rect.lt.x, rect.rb.x),
      top: Math.min(rect.lt.y, rect.rb.y),
      width: Math.abs(rect.rb.x - rect.lt.x),
      height: Math.abs(rect.rb.y - rect.lt.y)
    });

    function update(e) {
      rect.rb.x = e.clientX;
      rect.rb.y = e.clientY;

      for (const [key, value] of Object.entries(calc())) {
        box.style[key] = value + 'px';
      }
    }
    function remove() {
      chrome.runtime.sendMessage({
        method: 'captured',
        ...calc(),
        devicePixelRatio: window.devicePixelRatio,
        title: document.title,
        service: window.service // used by Reverse Image Search extension
      });
      guide.remove();
      capture.remove();
      monitor.remove();
    }
    function mousedown(e) {
      // prevent content selection on Firefox
      e.stopPropagation();
      e.preventDefault();
      box = document.createElement('div');
      box.setAttribute('class', 'itrisearch-box');

      rect.lt = {
        x: e.clientX,
        y: e.clientY
      };
      rect.rb = {
        x: e.clientX,
        y: e.clientY
      };

      document.addEventListener('mousemove', update);
      document.addEventListener('mouseup', remove);
      document.documentElement.appendChild(box);
    }

    return {
      install: function() {
        document.addEventListener('mousedown', mousedown);
      },
      remove: function() {
        document.removeEventListener('mousedown', mousedown);
        document.removeEventListener('mousemove', update);
        document.removeEventListener('mouseup', remove);
        for (const e of [...document.querySelectorAll('.itrisearch-box')]) {
          e.remove();
        }
      }
    };
  })();

  self.guide = (function() {
    let guide1;
    let guide2;
    let guide3;
    let image;
    const size = 100;
    const vt = document.documentElement.scrollTop;
    const ht = document.documentElement.scrollLeft;

    function position(left, top) {
      guide1.style.width = left + 'px';
      guide2.style.height = top + 'px';

      if (self.magnify === true) {
        const vtt = document.documentElement.scrollTop - vt;
        const htt = document.documentElement.scrollLeft - ht;
        const x = Math.max((left + htt) * devicePixelRatio - size / 2, 0);
        const y = Math.max((top + vtt) * devicePixelRatio - size / 2, 0);
        image.style['background-position'] = '-' + x + 'px -' + y + 'px';
        if (devicePixelRatio === 1) {
          image.style.zoom = 1.5;
        }
      }
    }
    function update(e) {
      position(e.clientX, e.clientY);
    }
    return {
      install() {
        guide1 = document.createElement('div');
        guide2 = document.createElement('div');
        guide3 = document.createElement('div');
        guide1.setAttribute('class', 'itrisearch-guide-1');
        guide2.setAttribute('class', 'itrisearch-guide-2');
        guide3.setAttribute('class', 'itrisearch-guide-3');
        document.documentElement.append(guide3, guide1, guide2);
        if (self.magnify) {
          image = document.createElement('div');
          image.style['background-image'] = `url(${self.src})`;
          image.setAttribute('class', 'itrisearch-image');
          image.style.setProperty('--size', size + 'px');
          document.documentElement.append(image);
        }
        document.addEventListener('mousemove', update, false);
      },
      remove() {
        document.removeEventListener('mousemove', update, false);
        const es = document.querySelectorAll('[class^="itrisearch"]');
        for (const e of es) {
          e.remove();
        }
        capture.remove();
      }
    };
  })();

  self.monitor = (function() {
    const keydown = e => {
      if (e.code === 'Escape') {
        chrome.runtime.sendMessage({
          method: 'aborted'
        });
        guide.remove();
        capture.remove();
        monitor.remove();
      }
    };
    return {
      install() {
        addEventListener('keydown', keydown);
      },
      remove() {
        removeEventListener('keydown', keydown);
      }
    };
  })();

  guide.install();
  capture.install();
  monitor.install();
}


