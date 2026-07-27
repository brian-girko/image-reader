{
  const args = new URLSearchParams(location.search);

  /* agent (detached) mode */
  if (args.get('agent') === 'true') {
    self.port = chrome.runtime.connect({
      name: 'agent'
    });
    self.port.onDisconnect.addListener(() => {
      const e = chrome.runtime.lastError;
      if (e) {
        console.warn(e);
      }
      delete self.port;
    });

    addEventListener('message', e => {
      if (e.data && self.port) {
        self.port.postMessage(e.data);
      }
    });
  }
}
