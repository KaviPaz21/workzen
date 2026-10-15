export type CanvasLanguage = 'html' | 'javascript' | 'python'

export interface CanvasContent {
  language: CanvasLanguage
  code: string
}

const aliases: Record<string, CanvasLanguage | 'svg'> = {
  html: 'html',
  htm: 'html',
  svg: 'svg',
  js: 'javascript',
  javascript: 'javascript',
  python: 'python',
  py: 'python',
}

export function canvasLanguage(fenceLanguage: string | undefined): CanvasLanguage | null {
  const found = aliases[(fenceLanguage ?? '').toLowerCase()]
  if (!found) return null
  return found === 'svg' ? 'html' : found
}

export function canvasContentFor(fenceLanguage: string, code: string): CanvasContent | null {
  const language = canvasLanguage(fenceLanguage)
  if (!language) return null
  if (fenceLanguage.toLowerCase() === 'svg') {
    return { language, code: `<!DOCTYPE html>\n<html>\n<body style="margin:0;display:grid;place-items:center;min-height:100vh">\n${code}\n</body>\n</html>` }
  }
  return { language, code }
}

export const canvasLabels: Record<CanvasLanguage, string> = { html: 'HTML', javascript: 'JavaScript', python: 'Python' }

const consoleBridge = `(function () {
  function format(value) {
    try {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.stack || String(value);
      var text = JSON.stringify(value, null, 2);
      return text === undefined ? String(value) : text;
    } catch (error) {
      return String(value);
    }
  }
  function send(level, text) {
    parent.postMessage({ canvasConsole: true, level: level, text: text }, '*');
  }
  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      send(level, Array.prototype.slice.call(arguments).map(format).join(' '));
      if (original) original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (event) {
    send('error', (event.message || 'Error') + (event.lineno ? ' (line ' + event.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (event) {
    send('error', 'Unhandled promise rejection: ' + format(event.reason));
  });
})();`

function withBridge(html: string) {
  const script = `<script>${consoleBridge}</script>`
  const head = /<head[^>]*>/i.exec(html)
  if (head) return html.slice(0, head.index + head[0].length) + script + html.slice(head.index + head[0].length)
  const root = /<html[^>]*>/i.exec(html)
  if (root) return html.slice(0, root.index + root[0].length) + script + html.slice(root.index + root[0].length)
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${script}</head><body>${html}</body></html>`
}

export function webDocument(language: CanvasLanguage, code: string) {
  if (language === 'javascript') {
    const safe = code.replace(/<\/script/gi, '<\\/script')
    return withBridge(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>\ntry {\n${safe}\n} catch (error) { console.error(error); }\n</script></body></html>`)
  }
  return withBridge(code)
}

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface ConsoleLine {
  level: ConsoleLevel
  text: string
}
