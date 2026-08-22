/* global window */
/**
 * Shared Generate-PDF helper used by #/cv, #/reports/:slug, #/evaluate,
 * #/deep, #/interview-prep. Streams events from the chosen SSE endpoint
 * into a modal log, snapshots the latest PDF in output/ before start,
 * and on `done` with code 0 triggers a browser download for the new file.
 *
 * Usage:
 *   PdfGenerate.run({ kind: 'report',  slug: 'q3-anthropic',  button: btn });
 *   PdfGenerate.run({ kind: 'deep',    name: 'anthropic-swe.md', button: btn });
 *   PdfGenerate.run({ kind: 'inline',  markdown: '...',       button: btn });
 *   PdfGenerate.run({ kind: 'cv',                              button: btn });
 *
 * All kinds end up at /api/stream/pdf/<kind>?... and then poll
 * /api/output/pdfs after `done` to detect the new file and trigger
 * <a download>. Behavior matches the v1.10.2 CV flow exactly.
 */
window.PdfGenerate = (function () {
  const t = (k, f) => (window.I18n && I18n.t ? I18n.t(k, f) : f);

  async function latestPdfName() {
    try {
      const r = await window.API.get('/api/output/pdfs');
      const files = (r && r.files) || [];
      return files.length ? files[0].name : null;
    } catch { return null; }
  }

  function triggerDownload(name) {
    const a = document.createElement('a');
    a.href = '/api/output/pdfs/' + encodeURIComponent(name);
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildEndpoint(opts) {
    if (opts.kind === 'cv') return { url: '/api/stream/pdf', method: 'GET' };
    if (opts.kind === 'report') {
      const slug = encodeURIComponent(opts.slug || '');
      return { url: `/api/stream/pdf/report?slug=${slug}`, method: 'GET' };
    }
    if (opts.kind === 'deep') {
      const name = encodeURIComponent(opts.name || '');
      return { url: `/api/stream/pdf/deep?name=${name}`, method: 'GET' };
    }
    if (opts.kind === 'inline') {
      return {
        url: '/api/stream/pdf/inline',
        method: 'POST',
        body: { markdown: opts.markdown, title: opts.title, slug: opts.slug },
      };
    }
    throw new Error('PdfGenerate: unknown kind ' + opts.kind);
  }

  /**
   * Parse an SSE stream from a ReadableStream (used for POST inline).
   * Calls onEvent(event, data) for each frame.
   */
  async function streamPostSse(url, body, onEvent) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      onEvent('error', { message: `HTTP ${res.status}` });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split('\n\n');
      buf = frames.pop();
      for (const frame of frames) {
        let ev = null, data = null;
        for (const l of frame.split('\n')) {
          if (l.startsWith('event: ')) ev = l.slice(7).trim();
          if (l.startsWith('data: ')) data = l.slice(6);
        }
        if (ev && data) {
          try { onEvent(ev, JSON.parse(data)); } catch { onEvent(ev, data); }
          if (ev === 'done' || ev === 'error') return;
        }
      }
    }
  }

  async function run(opts) {
    const btn = opts.button;
    const UI = window.UI;
    const API = window.API;
    if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
    UI.toast(t('cv.pdfRunning', 'Generating PDF…'));
    const before = await latestPdfName();
    const lines = [];
    const c = UI.el;
    const console_ = c('pre', { className: 'console', style: { maxHeight: '320px', overflow: 'auto' } }, '');
    UI.modal(t('cv.pdfTitle', 'Generate PDF'), console_);

    const onEvent = async (event, data) => {
      if (event === 'log' && data && data.line) {
        lines.push(data.line);
        console_.textContent = lines.join('\n');
        console_.scrollTop = console_.scrollHeight;
      } else if (event === 'done') {
        const code = (data && data.code) ?? 0;
        lines.push(`✓ done (exit ${code})`);
        console_.textContent = lines.join('\n');
        if (code === 0) {
          UI.toast(t('cv.pdfDone', 'PDF generated'), 'success');
          const after = await latestPdfName();
          if (after && after !== before) triggerDownload(after);
        } else {
          UI.toast(t('common.error', 'PDF generation failed'), 'error');
        }
        if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
      } else if (event === 'error') {
        const hint = /ERR_MODULE_NOT_FOUND|playwright/i.test((data && data.message) || '')
          ? '\n\n' + t('cv.pdfNeedsPlaywright',
            'Playwright is missing. Run in the parent project:\n  cd "$CAREER_OPS_ROOT" && npm install && npx playwright install chromium')
          : '';
        lines.push('✗ ' + ((data && data.message) || 'error') + hint);
        console_.textContent = lines.join('\n');
        UI.toast(((data && data.message) || 'error'), 'error');
        if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
      }
    };

    const ep = buildEndpoint(opts);
    if (ep.method === 'GET') {
      return API.stream(ep.url, onEvent);
    }
    return streamPostSse(ep.url, ep.body, onEvent);
  }

  return { run, latestPdfName };
})();
