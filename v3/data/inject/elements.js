// tests
// https://www.youtube.com/
// https://www.google.com/search?q=english+text&tbm=isch

{
  if (customElements.get('ocr-result') === undefined) {
    class OCRResult extends HTMLElement {
      constructor() {
        super();

        this.prefs = {
          'post-method': 'POST',
          'post-href': '',
          'post-body': '',
          'lang': 'eng',
          'frequently-used': ['eng', 'fra', 'deu', 'rus', 'ara'],

          'example': 'NA',
          'href': 'NA'
        };

        this.locales = {
          post: `Post/GET/PUT the result to a server.

Use Shift + Click to change the server data`,
          close: `Close this result.

Use Shift + Click to close all results.
Use Ctrl + Click or Command + Click to remove local language training data`,
          tutorial: `Where do you want the data to get posted:
  Server Example:
  &page;

  Post Example:
  POST|http://127.0.0.1:8080|&content;
  POST|http://127.0.0.1:8080|{"body":"&content;"}

  Put Example:
  PUT|http://127.0.0.1:8080|&content;

  Get Example:
  GET|http://127.0.0.1:8080?data=&content;|

  Open in Browser Tab Example:
  OPEN|http://127.0.0.1:8080?data=&content;|`
        };

        const shadow = this.attachShadow({mode: 'open'});
        shadow.innerHTML = `
          <style>
            :host {
              --fg: #444;
              --bg: #f1f1f1;
              --bg-result: #fff9ed;
              --accent: #907a4e;
              --width: 400px;
              --height: 200px;
              --gap: 10px;
            }
            :host([data-mode='expand']) {
              --height: 600px;
            }
            #body {
              font-size: 13px;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              padding: 10px;
              display: flex;
              flex-direction: column;
              height: var(--height);
              width: calc(100% - var(--gap) * 2);
              color: var(--fg);
              background-color: var(--bg);
              color-scheme: light;
              accent-color: var(--accent);
            }
            progress {
              width: 100%;
            }
            img {
              display: none;
            }
            button,
            input[type=submit],
            input[type=button] {
              padding: calc(var(--gap) / 2) var(--gap);
              color: var(--fg);
              background-image: linear-gradient(rgb(237, 237, 237), rgb(237, 237, 237) 38%, rgb(222, 222, 222));
              box-shadow: rgba(0, 0, 0, 0.08) 0 1px 0, rgba(255, 255, 255, 0.75) 0 1px 2px inset;
              text-shadow: rgb(240, 240, 240) 0 1px 0;
              border: solid 1px rgba(0, 0, 0, 0.25);
              cursor: pointer;
              font-size: inherit;
            }
            input[type=button]:disabled {
              opacity: 0.5;
            }
            #result {
              min-height: 40px;
              background-color: var(--bg-result);
              margin: 10px 0;
              overflow: auto;
              flex: 1;
              padding: var(--gap);
            }
            #result:empty::before {
              content: attr(data-msg);
            }
            #result .ocr_par:first-child {
              margin-top: 0;
            }
            #result .ocr_par:last-child {
              margin-bottom: 0;
            }
            .ocr_line {
              display: block;
            }
            .grid {
              display: grid;
              grid-template-columns: min-content 1fr;
              white-space: nowrap;
              align-items: center;
              justify-items: left;
              grid-gap: var(--gap);
            }
            .options {
              display: grid;
              grid-template-columns: 1fr 1px 1fr;
              grid-gap: var(--gap);
              background: rgba(0, 0, 0, 0.05);
              margin-bottom: var(--gap);
              margin-left: -3px;
              align-items: center;
            }
            #accuracy,
            #language {
              border: none;
              text-overflow: ellipsis;
              background-color: transparent;
              outline: none;
              padding: calc(var(--gap) / 2) 0;
            }
            .sep {
              background-color: #b7ae9a;
              height: 15px;
            }
            #tools {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              grid-gap: var(--gap);
              justify-content: end;
            }
          </style>

          <div id="body">
            <div style="display: flex; justify-content: center;">
              <img id="img">
            </div>
            <div class="options">
              <select id="language">
                <optgroup>
                  <option value="detect">Auto Detect (beta)</option>
                </optgroup>
                <optgroup id="frequently-used"></optgroup>
                <optgroup>
                  <option value="afr">Afrikaans</option>
                  <option value="amh">Amharic</option>
                  <option value="ara">Arabic</option>
                  <option value="asm">Assamese</option>
                  <option value="aze">Azerbaijani</option>
                  <option value="aze_cyrl">Azerbaijani - Cyrillic</option>
                  <option value="bel">Belarusian</option>
                  <option value="ben">Bengali</option>
                  <option value="bod">Tibetan</option>
                  <option value="bos">Bosnian</option>
                  <option value="bul">Bulgarian</option>
                  <option value="cat">Catalan; Valencian</option>
                  <option value="ceb">Cebuano</option>
                  <option value="ces">Czech</option>
                  <option value="chi_sim">Chinese - Simplified</option>
                  <option value="chi_tra">Chinese - Traditional</option>
                  <option value="chr">Cherokee</option>
                  <option value="cym">Welsh</option>
                  <option value="dan">Danish</option>
                  <option value="deu">German</option>
                  <option value="dzo">Dzongkha</option>
                  <option value="ell">Greek, Modern (1453-)</option>
                  <option value="enm">English, Middle (1100-1500)</option>
                  <option value="eng">English</option>
                  <option value="epo">Esperanto</option>
                  <option value="est">Estonian</option>
                  <option value="eus">Basque</option>
                  <option value="fas">Persian</option>
                  <option value="fra">French</option>
                  <option value="fin">Finnish</option>
                  <option value="frk">German Fraktur</option>
                  <option value="frm">French, Middle (ca. 1400-1600)</option>
                  <option value="gle">Irish</option>
                  <option value="glg">Galician</option>
                  <option value="grc">Greek, Ancient (-1453)</option>
                  <option value="guj">Gujarati</option>
                  <option value="hat">Haitian; Haitian Creole</option>
                  <option value="heb">Hebrew</option>
                  <option value="hin">Hindi</option>
                  <option value="hrv">Croatian</option>
                  <option value="hun">Hungarian</option>
                  <option value="iku">Inuktitut</option>
                  <option value="ind">Indonesian</option>
                  <option value="isl">Icelandic</option>
                  <option value="ita">Italian</option>
                  <option value="ita_old">Italian - Old</option>
                  <option value="jav">Javanese</option>
                  <option value="jpn">Japanese</option>
                  <option value="jpn_vert">Japanese - Vertical</option>
                  <option value="kan">Kannada</option>
                  <option value="kat">Georgian</option>
                  <option value="kat_old">Georgian - Old</option>
                  <option value="kaz">Kazakh</option>
                  <option value="khm">Central Khmer</option>
                  <option value="kir">Kirghiz; Kyrgyz</option>
                  <option value="kor">Korean</option>
                  <option value="kur">Kurdish</option>
                  <option value="lao">Lao</option>
                  <option value="lat">Latin</option>
                  <option value="lav">Latvian</option>
                  <option value="lit">Lithuanian</option>
                  <option value="mal">Malayalam</option>
                  <option value="mar">Marathi</option>
                  <option value="mkd">Macedonian</option>
                  <option value="mlt">Maltese</option>
                  <option value="msa">Malay</option>
                  <option value="mya">Burmese</option>
                  <option value="nep">Nepali</option>
                  <option value="nld">Dutch; Flemish</option>
                  <option value="nor">Norwegian</option>
                  <option value="ori">Oriya</option>
                  <option value="pan">Panjabi; Punjabi</option>
                  <option value="pol">Polish</option>
                  <option value="por">Portuguese</option>
                  <option value="pus">Pushto; Pashto</option>
                  <option value="ron">Romanian; Moldavian; Moldovan</option>
                  <option value="rus">Russian</option>
                  <option value="san">Sanskrit</option>
                  <option value="sin">Sinhala; Sinhalese</option>
                  <option value="slk">Slovak</option>
                  <option value="slv">Slovenian</option>
                  <option value="spa">Spanish; Castilian</option>
                  <option value="spa_old">Spanish; Castilian - Old</option>
                  <option value="sqi">Albanian</option>
                  <option value="srp">Serbian</option>
                  <option value="srp">latn  Serbian - Latin</option>
                  <option value="swa">Swahili</option>
                  <option value="swe">Swedish</option>
                  <option value="syr">Syriac</option>
                  <option value="tam">Tamil</option>
                  <option value="tel">Telugu</option>
                  <option value="tgk">Tajik</option>
                  <option value="tgl">Tagalog</option>
                  <option value="tha">Thai</option>
                  <option value="tir">Tigrinya</option>
                  <option value="tur">Turkish</option>
                  <option value="uig">Uighur; Uyghur</option>
                  <option value="ukr">Ukrainian</option>
                  <option value="urd">Urdu</option>
                  <option value="uzb">Uzbek</option>
                  <option value="uzb_cyrl">Uzbek - Cyrillic</option>
                  <option value="vie">Vietnamese</option>
                  <option value="yid">Yiddish</option>
                </optgroup>
              </select>
              <span class="sep"></span>
              <select id="accuracy">
                <option value='3.02'>Low Accuracy</option>
                <option value='4.0.0_fast'>Moderate Accuracy</option>
                <option value='4.0.0'>Better Accuracy</option>
                <option value='4.0.0_best'>Best Accuracy</option>
              </select>
            </div>
            <div class="grid">
              <span>Downloading</span>
              <progress id="lang" value="0" max="1"></progress>
              <span>Recognizing</span>
              <progress id="recognize" value="0" max="1"></progress>
            </div>

            <div id="result" data-msg="Please wait..."></div>
            <div id="tools">
              <input type="button" value="Expand" id="expand">
              <input type="button" value="Post Result" id="post" disabled title="${this.locales.post}">
              <input type="button" value="Copy Text" id="copy" disabled>
              <input type="button" value="Close" id="close" title="${this.locales.close}">
            </div>
          </div>
        `;
        this.events = {};
      }
      /* io */
      configure(prefs, report = false) {
        Object.assign(this.prefs, prefs);
        if (report) {
          this.dispatchEvent(new CustomEvent('save-preference', {
            detail: prefs
          }));
        }
      }
      /* methods */
      prepare() {
        // frequently used
        for (const lang of this.prefs['frequently-used']) {
          const e = this.shadowRoot.querySelector(`option[value="${lang}"]`).cloneNode(true);
          this.shadowRoot.getElementById('frequently-used').appendChild(e);
        }
        // language
        this.language(this.prefs.lang);
        // accuracy
        this.accuracy(this.prefs.accuracy);
      }
      build(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        this.clear();

        for (const child of [...doc.body.childNodes]) {
          this.shadowRoot.getElementById('result').append(child);
        }
      }
      message(value) {
        this.shadowRoot.getElementById('result').dataset.msg = value;
      }
      progress(value, type = 'recognize') {
        this.shadowRoot.getElementById(type).value = value;
      }
      rename(value) {
        this.shadowRoot.querySelector('option[value=detect]').textContent = value;
      }
      clear() {
        this.shadowRoot.getElementById('result').removeAttribute('contenteditable');
        this.shadowRoot.getElementById('result').textContent = '';
      }
      enable() {
        this.shadowRoot.getElementById('copy').disabled = false;
        this.shadowRoot.getElementById('post').disabled = false;
        this.shadowRoot.getElementById('result').setAttribute('contenteditable', true);
      }
      get result() {
        return this.shadowRoot.getElementById('result').innerText;
      }
      language(value) {
        this.dataset.language = value;
        this.shadowRoot.getElementById('language').value = value;
      }
      accuracy(value) {
        this.dataset.accuracy = value;
        this.shadowRoot.getElementById('accuracy').value = value;
      }
      toast(name, messages, timeout = 2000) {
        this.shadowRoot.getElementById(name).value = messages.new;
        clearTimeout(this[name + 'ID']);
        this[name + 'ID'] = setTimeout(() => {
          this.shadowRoot.getElementById(name).value = messages.old;
        }, timeout);
      }
      connectedCallback() {
        // copy
        this.shadowRoot.getElementById('copy').onclick = async () => {
          try {
            await navigator.clipboard.writeText(this.result);
          }
          catch (e) {
            const input = document.createElement('textarea');
            input.value = this.result;
            input.style.position = 'absolute';
            input.style.left = '-9999px';
            document.body.append(input);
            input.select();
            document.execCommand('copy');
            input.remove();
          }
          this.toast('copy', {
            new: 'Done',
            old: 'Copy Text'
          });
        };
        // post
        this.shadowRoot.getElementById('post').onclick = e => {
          if (this.prefs['post-href'] === '' || e.shiftKey) {
            const message = this.locales.tutorial.replace('&page;', this.dataset.page);
            const m = prompt(
              message,
              [this.prefs['post-method'], this.prefs['post-href'], this.prefs['post-body']].join('|')
            );
            const [method, href, body] = (m || '').split('|');

            const prefs = {
              'post-method': (method || 'POST').toUpperCase(),
              'post-href': href || '',
              'post-body': body || ''
            };
            this.configure(prefs, true);
          }

          const value = this.result.trim();
          const options = {
            method: this.prefs['post-method'],
            mode: 'no-cors'
          };
          if (this.prefs['post-body'] && this.prefs['post-method'] !== 'GET') {
            options.body = this.prefs['post-body']
              .replaceAll('&content;', value)
              .replaceAll('&href;', location.href);
            // If this is a JSON, try builder
            if (this.prefs['post-body'].startsWith('{') && this.prefs['post-body'].endsWith('}')) {
              try {
                const o = JSON.parse(this.prefs['post-body']);
                for (const [key, holder] of Object.entries(o)) {
                  if (typeof holder === 'string') {
                    o[key] = holder
                      .replaceAll('&content;', value)
                      .replaceAll('&href;', location.href);
                  }
                }
                options.body = JSON.stringify(o);
              }
              catch (e) {
                console.warn('Cannot use the JSON Builder', e);
              }
            }
          }

          const t = (msg, timeout = 3000) => this.toast('post', {
            new: msg,
            old: 'Post Result'
          }, timeout);

          if (this.prefs['post-href'] === '') {
            return t('Empty Server');
          }

          t('...', 1000000);

          const href = this.prefs['post-href']
            .replaceAll('&content;', encodeURIComponent(value))
            .replaceAll('&href;', encodeURIComponent(location.href));

          if (options.method === 'OPEN') {
            this.dispatchEvent(new CustomEvent('open-link', {
              detail: href
            }));

            t('Done');
          }
          else {
            this.dispatchEvent(new CustomEvent('fetch-resource', {
              detail: {
                href, options
              }
            }));
          }
        };
        // change language
        this.shadowRoot.getElementById('language').onchange = e => {
          this.language(e.target.value);
          const prefs = {
            'lang': e.target.value,
            'frequently-used': this.prefs['frequently-used']
          };
          prefs['frequently-used'].unshift(prefs.lang);
          prefs['frequently-used'] = prefs['frequently-used'].filter((s, i, l) => s && l.indexOf(s) === i).slice(0, 10);
          this.configure(prefs, true);
          this.dispatchEvent(new Event('language-changed'));
        };
        // change accuracy
        this.shadowRoot.getElementById('accuracy').onchange = e => {
          this.accuracy(e.target.value);
          const prefs = {
            'accuracy': e.target.value
          };
          this.configure(prefs, true);
          this.dispatchEvent(new Event('accuracy-changed'));
        };
        // close
        this.shadowRoot.getElementById('close').onclick = e => {
          this.remove();
          this.dispatchEvent(new MouseEvent('closed', {
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey
          }));
        };
        // expand
        this.shadowRoot.getElementById('expand').onclick = e => {
          this.dataset.mode = this.dataset.mode === 'expand' ? 'collapse' : 'expand';
          e.target.value = this.dataset.mode === 'expand' ? 'Collapse' : 'Expand';
          this.dispatchEvent(new CustomEvent('mode-changed', {
            detail: this.dataset.mode
          }));
        };
        // apply commands on cross-origin (Firefox Only)
        this.addEventListener('command', () => {
          const {name, args} = JSON.parse(this.getAttribute('command'));
          this[name](...args);
        });
        // constants
        this.dataset.languages = [...this.shadowRoot.querySelectorAll('#language option')]
          .map(e => e.value)
          .filter(s => s !== 'detect')
          .join(', ');
      }
    }
    customElements.define('ocr-result', OCRResult);
  }
}

