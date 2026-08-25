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
  /* modes (set by the background right before this file is injected):
     'ocr'      draw once, release captures and runs OCR (legacy flow)
     'save-ocr' draw once, release freezes the box; Enter saves the region
                as well as running OCR; Esc cancels
     'save'     like 'save-ocr' but only updates the stored region */
  self.capture = (function() {
    const rect = {};
    const MODE = self.pickMode || 'ocr';
    const GHOST = self.savedRegion || null;
    let box;
    let hint;

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
    function cleanup() {
      guide.remove();
      capture.remove();
      monitor.remove();
    }
    function confirm() {
      document.removeEventListener('keydown', confirmKey, true);
      const r = calc();
      if (r.width < 1 || r.height < 1) {
        chrome.runtime.sendMessage({
          method: 'aborted'
        });
        return cleanup();
      }
      if (MODE !== 'ocr') {
        chrome.runtime.sendMessage({
          method: 'region-selected',
          ...r,
          ...(GHOST ? {
            id: GHOST.id,
            label: GHOST.label
          } : {}),
          origin: location.origin,
          href: location.href,
          title: document.title
        });
      }
      if (MODE === 'save-ocr' || MODE === 'ocr') {
        chrome.runtime.sendMessage({
          method: 'captured',
          ...r,
          devicePixelRatio: window.devicePixelRatio,
          title: document.title,
          service: window.service // used by Reverse Image Search extension
        });
      }
      cleanup();
    }
    function confirmKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Enter') {
        confirm();
      }
      else if (e.code === 'Escape') {
        chrome.runtime.sendMessage({
          method: 'aborted'
        });
        cleanup();
      }
    }
    function freeze() {
      document.removeEventListener('mousedown', mousedown);
      hint.textContent = `${Math.round(calc().width)} × ${Math.round(calc().height)} — Enter to confirm · Esc to cancel`;
      hint.classList.add('visible');
      document.addEventListener('keydown', confirmKey, true);
    }
    function release() {
      document.removeEventListener('mousemove', update);
      if (MODE === 'ocr') {
        confirm();
      }
      else {
        freeze();
      }
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
      document.addEventListener('mouseup', release);
      document.documentElement.appendChild(box);
    }

    return {
      install: function() {
        if (GHOST && MODE !== 'ocr') {
          const g = document.createElement('div');
          g.setAttribute('class', 'itrisearch-ghost');
          g.style.left = GHOST.left + 'px';
          g.style.top = GHOST.top + 'px';
          g.style.width = GHOST.width + 'px';
          g.style.height = GHOST.height + 'px';
          document.documentElement.append(g);
        }
        if (MODE !== 'ocr') {
          hint = document.createElement('div');
          hint.setAttribute('class', 'itrisearch-hint');
          hint.textContent = 'Drag a box over the text';
          document.documentElement.append(hint);
        }
        document.addEventListener('mousedown', mousedown);
      },
      remove: function() {
        document.removeEventListener('mousedown', mousedown);
        document.removeEventListener('mousemove', update);
        document.removeEventListener('mouseup', release);
        document.removeEventListener('keydown', confirmKey, true);
        for (const e of [...document.querySelectorAll('.itrisearch-box,.itrisearch-ghost,.itrisearch-hint')]) {
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

  if (self.standby !== true) {
    guide.install();
    capture.install();
    monitor.install();
  }
}


