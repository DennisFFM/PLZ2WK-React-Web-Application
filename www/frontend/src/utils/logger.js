export const logger = {
    log: (...args) => {
      console.log(...args);
      sendToServer('log', args);
    },
    warn: (...args) => {
      console.warn(...args);
      sendToServer('warn', args);
    },
    error: (...args) => {
      console.error(...args);
      sendToServer('error', args);
    }
  };
  
  function sendToServer(level, args) {
    fetch('/api/frontend-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, args, time: new Date().toISOString() })
    }).catch(() => {});
  }
  