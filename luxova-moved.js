/* Luxova moved notice. One file, no build, no dependency, like the others.
 *
 *   <script src="/luxova-moved.js" defer
 *     data-target="https://thelocalcabinets.com"
 *     data-headline="We have moved"
 *     data-note="Luxova Home is now The Local Cabinets. Same cabinets, same team, new home."
 *     data-cta="Continue to thelocalcabinets.com"></script>
 *
 * ⛔ NOT DISMISSIBLE, owner's ruling 2026-08-30 ("have a not close modal to
 * move to new site"): no close control, no overlay click-through, no Escape.
 * The old site's one remaining job is pointing at the new one.
 *
 * ⛔ IT OWNS NO FACT AND TRANSMITS NOTHING. Every visible word arrives on the
 * tag and is REFUSED rather than defaulted; without data-target NOTHING
 * renders, because a moved-notice pointing nowhere is worse than none.
 *
 * ⛔ THE LINK PRESERVES THE VISITOR'S PLACE: current path and query are
 * carried onto the target domain, so a deep link lands on the same page.
 *
 * ⭐ IT SILENCES THE SALE POPUP by claiming its double-include guard
 * (window.__luxovaSale) before that script runs. Load THIS TAG BEFORE
 * luxova-sale.js. A site telling visitors to leave must not also nag them
 * with a discount at the address it is retiring.
 */
(function () {
  'use strict'
  if (window.__luxovaMoved) return
  window.__luxovaMoved = true

  var script = document.currentScript || document.querySelector('script[data-target]')
  var d = (script && script.dataset) || {}
  var target = (d.target || '').replace(/\/$/, '')
  var headline = (d.headline || '').trim()
  var note = (d.note || '').trim()
  var cta = (d.cta || '').trim()

  if (!target || !/^https:\/\//.test(target) || !headline || !cta) {
    try { console.error('[luxova-moved] data-target (https), data-headline and data-cta are all required. Nothing rendered.') } catch (e) { /* nothing */ }
    return
  }

  // Claimed BEFORE the sale script's own guard runs (both defer, this tag
  // first), so the retiring site shows one message, not two.
  window.__luxovaSale = true

  function build() {
    if (!document.body) return
    var host = document.createElement('div')
    host.setAttribute('data-luxova-moved', '')
    host.style.setProperty('--lux-sans', '"Hanken Grotesk",ui-sans-serif,system-ui,-apple-system,sans-serif')
    host.style.setProperty('--lux-serif', '"Fraunces","Hoefler Text",Georgia,"Times New Roman",serif')
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host

    var css = document.createElement('style')
    css.textContent = [
      ':host{all:initial;',
      '--lux-ink:var(--luxova-ink,var(--ink,#14273f));--lux-soft:var(--luxova-soft,var(--soft,#51606f));',
      '--lux-line:var(--luxova-line,var(--line,#e7e5df));--lux-panel:var(--luxova-panel,var(--panel,#f3f0ea));',
      '--lux-navy:var(--luxova-navy,var(--navy,#0e2740));--lux-gold:var(--luxova-gold,var(--gold,#b4862f));',
      'font-family:var(--lux-sans);}',
      '*{box-sizing:border-box}',
      /* Above every other surface we serve: chat, card and sale sit at ...000. */
      '.veil{position:fixed;inset:0;z-index:2147483002;background:rgba(8,20,34,.62);',
      'display:flex;align-items:center;justify-content:center;padding:20px}',
      '.box{width:min(440px,calc(100vw - 40px));background:#fff;border:1px solid var(--lux-line);',
      'border-radius:7px;padding:32px 28px;box-shadow:0 18px 60px rgba(8,20,34,.35);',
      'color:var(--lux-ink);text-align:center;animation:rise .25s ease both}',
      '@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
      '.hd{font-family:var(--lux-serif);font-size:26px;font-weight:600;margin:0 0 10px;color:var(--lux-navy)}',
      '.nt{font-size:14px;color:var(--lux-soft);margin:0 0 20px;line-height:1.55}',
      '.go{display:block;width:100%;text-decoration:none;background:var(--lux-navy);color:#fff;',
      'border-radius:7px;padding:14px 16px;font:inherit;font-size:15px;font-weight:600}',
      '.go:hover{background:var(--lux-gold)}',
      '@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
    ].join('')
    root.appendChild(css)

    var veil = document.createElement('div')
    veil.className = 'veil'
    var box = document.createElement('div')
    box.className = 'box'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')
    box.setAttribute('aria-label', headline)

    var hd = document.createElement('p')
    hd.className = 'hd'
    hd.textContent = headline
    box.appendChild(hd)

    if (note) {
      var nt = document.createElement('p')
      nt.className = 'nt'
      nt.textContent = note
      box.appendChild(nt)
    }

    var go = document.createElement('a')
    go.className = 'go'
    // The visitor's place travels with them: /door-styles/?x on the old
    // domain lands on /door-styles/?x on the new one.
    go.href = target + location.pathname + location.search
    go.textContent = cta
    box.appendChild(go)

    veil.appendChild(box)
    root.appendChild(veil)
    document.body.appendChild(host)
    try { go.focus() } catch (e) { /* focus is a nicety */ }
  }

  if (document.body) build()
  else document.addEventListener('DOMContentLoaded', build)
})();
