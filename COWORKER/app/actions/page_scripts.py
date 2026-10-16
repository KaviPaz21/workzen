CURSOR_SCRIPT = """
(() => {
  if (window.top !== window || window.__wz) return;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .cursor{position:fixed;left:0;top:0;transform:translate(-100px,-100px);opacity:0;transition:opacity .2s}
      .cursor.on{opacity:1}
      .cursor svg{display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))}
      .tag{position:absolute;left:16px;top:22px;background:#111;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.35)}
      .ring{position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border:2px solid #111;border-radius:50%;background:rgba(255,255,255,.75);animation:pulse .6s ease-out forwards}
      @keyframes pulse{from{transform:scale(.4);opacity:1}to{transform:scale(2.6);opacity:0}}
      .box{position:fixed;border:2px solid #111;outline:2px solid #fff;border-radius:4px;box-shadow:0 0 0 5px rgba(0,0,0,.16);animation:fade 1.1s ease-out forwards}
      .box span{position:absolute;left:-2px;bottom:100%;margin-bottom:4px;background:#111;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:4px 7px;border-radius:5px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
      @keyframes fade{0%,70%{opacity:1}100%{opacity:0}}
    </style>
    <div class="cursor"><svg width="24" height="28" viewBox="0 0 24 28"><path d="M3 2 L3 22 L8.5 17 L12.5 25.5 L16 24 L12 15.5 L19.5 15.5 Z" fill="#111" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><div class="tag">Co-worker</div></div>`;
  const cursor = root.querySelector('.cursor');
  const attach = () => {
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
  };
  const place = (x, y) => {
    attach();
    cursor.style.transform = `translate(${x}px,${y}px)`;
    cursor.classList.add('on');
  };
  const drop = (node, ms) => {
    root.appendChild(node);
    setTimeout(() => node.remove(), ms);
  };
  addEventListener('mousemove', (event) => place(event.clientX, event.clientY), true);
  addEventListener('mousedown', (event) => {
    const ring = document.createElement('div');
    ring.className = 'ring';
    ring.style.left = event.clientX + 'px';
    ring.style.top = event.clientY + 'px';
    drop(ring, 700);
  }, true);
  const api = {
    refs: new Map(),
    counter: 0,
    mark(element, label) {
      attach();
      const box = element.getBoundingClientRect();
      const frame = document.createElement('div');
      frame.className = 'box';
      frame.style.left = box.left - 3 + 'px';
      frame.style.top = box.top - 3 + 'px';
      frame.style.width = box.width + 6 + 'px';
      frame.style.height = box.height + 6 + 'px';
      if (label) {
        const text = document.createElement('span');
        text.textContent = label;
        frame.appendChild(text);
      }
      drop(frame, 1200);
    },
  };
  Object.defineProperty(window, '__wz', { value: api, enumerable: false });
  attach();
})();
"""

INSPECT_SCRIPT = """(filter) => {
  const wz = window.__wz;
  if (!wz) return { total: 0, items: [], note: 'The page has not finished loading.' };
  wz.refs.clear();
  const groups = {
    inputs: 'input:not([type=hidden]), textarea, select, [contenteditable=""], [contenteditable="true"], [role=textbox], [role=combobox], [role=searchbox]',
    buttons: 'button, [role=button], input[type=button], input[type=submit], input[type=reset], summary',
    links: 'a[href], [role=link]',
  };
  groups.all = [groups.inputs, groups.buttons, groups.links, '[role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem], [role=option]'].join(', ');
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const clean = (value, limit) => (typeof value === 'string' ? value.trim().replace(/\\s+/g, ' ').slice(0, limit) : '');
  const nameOf = (element) => {
    const labelled = element.getAttribute('aria-labelledby');
    const fromIds = labelled ? labelled.split(' ').map((id) => document.getElementById(id)?.innerText || '').join(' ') : '';
    const fromLabel = element.labels && element.labels[0] ? element.labels[0].innerText : '';
    return clean(element.getAttribute('aria-label') || fromIds || fromLabel || element.placeholder || element.title || element.innerText || element.value || element.alt, 80);
  };
  const found = [...document.querySelectorAll(groups[filter] || groups.all)].filter(visible);
  const items = found.slice(0, 80).map((element) => {
    wz.counter += 1;
    const ref = 'e' + wz.counter;
    wz.refs.set(ref, element);
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    const item = {
      ref,
      tag,
      type: type || undefined,
      role: element.getAttribute('role') || undefined,
      label: nameOf(element),
      id: element.id || undefined,
      name: element.getAttribute('name') || undefined,
      placeholder: element.getAttribute('placeholder') || undefined,
      value: type === 'password' ? undefined : clean(element.value, 40) || undefined,
      checked: typeof element.checked === 'boolean' && ['checkbox', 'radio'].includes(type) ? element.checked : undefined,
      disabled: element.disabled || undefined,
      required: element.required || undefined,
      href: tag === 'a' ? element.href : undefined,
      options: tag === 'select' ? [...element.options].slice(0, 12).map((option) => clean(option.text, 40)) : undefined,
      in_form: element.form ? true : undefined,
    };
    return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined && value !== ''));
  });
  return { total: found.length, items };
}"""

DESCRIBE_SCRIPT = """(element) => {
  const form = element.form || element.closest('form');
  const parts = [element.innerText, element.value, element.getAttribute('aria-label'), element.title, element.getAttribute('name'), element.id, element.alt];
  const label = parts.filter((part) => typeof part === 'string' && part.trim()).map((part) => part.trim().replace(/\\s+/g, ' ').slice(0, 80)).join(' | ');
  const tag = element.tagName.toLowerCase();
  const type = (element.getAttribute('type') || '').toLowerCase();
  const isSubmit = (tag === 'button' && (type === '' || type === 'submit') && !!form) || (tag === 'input' && (type === 'submit' || type === 'image'));
  const search = !!form && (form.getAttribute('role') === 'search' || !!form.querySelector('input[type=search]') || /search/i.test(form.getAttribute('action') || ''));
  const fieldSelector = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=image]):not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=""], [contenteditable="true"]';
  const shown = (node) => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  let scope = form || element.parentElement;
  for (let level = 0; scope && level < 5 && ![...scope.querySelectorAll(fieldSelector)].some(shown); level += 1) scope = scope.parentElement;
  const fields = scope ? [...scope.querySelectorAll(fieldSelector)].filter(shown) : [];
  const lone = fields.length === 1 ? fields[0] : null;
  const hints = lone ? [lone.placeholder, lone.getAttribute('aria-label'), lone.getAttribute('name'), lone.id].join(' ') : '';
  const chat = !!lone && (lone.tagName === 'TEXTAREA' || lone.isContentEditable || /message|ask|chat|question|prompt|type here|say something/i.test(hints));
  return { label, tag, type, isSubmit, search, chat, form: !!form, password: type === 'password' };
}"""

POINT_SCRIPT = """(point) => {
  const hit = document.elementFromPoint(point.x, point.y);
  if (!hit) return null;
  return hit.closest('button, a, [role=button], input, label, summary') || hit;
}"""
