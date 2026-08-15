/* Luxova chat widget. One file, no build, no dependency, like monitor.js.
 *
 *   <script src="https://relay.example/widget.js" data-relay="https://relay.example" defer></script>
 *
 * ⛔ IT KNOWS NOTHING. No price, no size, no lead time, no canned answer, no
 * model. It renders what the relay hands it and posts what the visitor types.
 * A number that appeared in this file would be a fact with no owner, sitting on
 * a public CDN, going stale where nobody would ever look for it.
 *
 * ⛔ EVERY MESSAGE IS RENDERED WITH textContent. Never innerHTML, not once, not
 * for "just the timestamp". The chat box is an untrusted input and the person
 * typing into it may not be a customer.
 *
 * ⛔ prefers-reduced-motion is honoured by a single media query that switches
 * every duration to 0.01ms. This sits under a cabinet brand, not a growth funnel:
 * nothing bounces, nothing pulses for attention, nothing opens by itself.
 */
(function () {
  'use strict'
  if (window.__luxovaChat) return
  window.__luxovaChat = true

  // --- where the relay is. Named by the page, never guessed. ----------------
  var script = document.currentScript || document.querySelector('script[data-relay]')
  var cfg = window.LUXOVA_CHAT || {}
  var RELAY = (cfg.relay || (script && script.getAttribute('data-relay')) || '').replace(/\/$/, '')
  if (!RELAY) {
    // ⛔ Refuse visibly rather than render a launcher that silently does nothing.
    // A chat button that swallows a question is worse than no chat button.
    console.error('[luxova-chat] no relay configured: set data-relay on the script tag')
    return
  }

  var STORAGE = 'luxova_chat_v1'
  var CID_KEY = 'luxova_cid'          // minted by monitor.js. A BROWSER, not a person.
  var POLL_OPEN = 3000
  var POLL_SHUT = 15000

  // --- the site's own tokens, read off its built CSS. Not approximated. -----
  var T = {
    navy: '#0e2740',
    ink: '#14273f',
    soft: '#51606f',
    muted: '#97a1ad',
    gold: '#b4862f',
    goldLt: '#cfa44e',
    panel: '#f3f0ea',
    line: '#e7e5df',
    sans: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    serif: '"Fraunces", ui-serif, Georgia, "Times New Roman", serif',
  }

  // =========================================================================
  // ⛔ CAPTURE COPY v2. web-customer-service's words, VERBATIM. Do not edit one
  // of them to fit a control. That desk has said twice that it will rewrite
  // rather than have the wiring trim it, so if a string does not fit, ask.
  //
  // WHY THEY ALL STOP SHORT OF PROMISING A REPLY, in its words: they promise
  // STORAGE, which is the only thing proven true today. The relay stores it and
  // a desk can poll and read it; a human reading it on any schedule is not
  // proven. "saved" is a mechanism claim and holds whether or not anybody is
  // watching. Four rewrites that PASSED its own voice gate were refused anyway,
  // for naming a replier or promising "soon".
  //
  // ⛔ `pending` MUST NOT THANK ANYBODY. At that moment nothing is captured, and
  // "Thanks, got it" would be a confirmation rendered on submit, which is
  // exactly what the desk forbade. "Sending." claims nothing about the outcome.
  //
  // ⛔ `failed` EXISTS BECAUSE THE CONFIRMATION IS CONDITIONAL. If the receipt
  // only renders on a confirmed capture, there is a path where the POST does not
  // confirm, and something must be shown there. Showing nothing leaves a visitor
  // looking at a form that appears to have taken their message and did not,
  // which is the failure that made the contact form invisible for seven weeks.
  //
  // Overridable per-site by data-capture-* so a wording change is not 29 page
  // edits, but the DEFAULTS are the authored strings and are what ships.
  var CAPTURE = {
    label:        'Leave a message',
    status:       'Nobody is reading the chat right now. What you write here is saved.',
    invite:       'Leave your question and it will be waiting when someone opens the desk.',
    confirmation: 'Saved. It is waiting for us.',
    aria:         'Leave a message. Nobody is reading the chat right now. What you write here is saved and will be waiting when someone opens the desk.',
    pending:      'Sending.',
    failed:       'That did not save. Message us on WhatsApp instead and it will reach us.',
  }
  for (var _k in CAPTURE) {
    if (!script) break
    var _v = script.getAttribute('data-capture-' + _k)
    if (_v) CAPTURE[_k] = _v
  }

  // ⛔ IS ANYBODY READING? `ok:true` from the relay means the relay is up. It
  // says nothing about whether a human will ever see what a visitor types, and
  // conflating the two is what put "Not open yet, nobody is reading messages
  // here" on a live page for weeks. /health publishes `attended`: did an
  // AUTHENTICATED desk poll arrive recently. Visitor traffic cannot light it.
  //
  // ⛔ UNREACHABLE IS TREATED AS NOT ATTENDED. A relay we cannot ask is not a
  // relay we can promise on, and the failure direction has to be the safe one.
  function checkAttended() {
    return fetch(RELAY + '/health')
      .then(function (r) { return r.json() })
      .then(function (j) { return j && j.ok === true && j.attended === true })
      .catch(function () { return false })
  }

  // ⛔ PURE, SO IT CAN BE TESTED WITHOUT A BROWSER. The capture's four moments.
  // `saved` is reachable ONLY from a response whose body says ok:true. A 200 is
  // not a yes: this repo has an incident where a send returned an id, looked
  // fine, and had been refused.
  function captureState(phase, res) {
    if (phase === 'idle') return { view: 'form', text: CAPTURE.invite }
    if (phase === 'sending') return { view: 'pending', text: CAPTURE.pending }
    if (phase === 'done') {
      var ok = !!(res && res.body && res.body.ok === true)
      return ok
        ? { view: 'saved', text: CAPTURE.confirmation }
        : { view: 'failed', text: CAPTURE.failed }
    }
    return { view: 'form', text: CAPTURE.invite }
  }

  // Exposed for the test suite only. The widget itself never reads these back.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CAPTURE: CAPTURE, captureState: captureState }
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;margin:0;padding:0;font-family:' + T.sans + '}',

    /* the launcher. Quiet: it grows 4% on hover and does nothing else. */
    '.launcher{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;',
    'border:1px solid ' + T.navy + ';background:' + T.navy + ';color:' + T.panel + ';cursor:pointer;',
    'display:grid;place-items:center;box-shadow:0 6px 20px rgba(14,39,64,.18);',
    'transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s ease;z-index:2147483000}',
    '.launcher:hover{transform:scale(1.04);box-shadow:0 10px 28px rgba(14,39,64,.24)}',
    '.launcher:focus-visible{outline:2px solid ' + T.gold + ';outline-offset:3px}',
    '.launcher svg{width:24px;height:24px;display:block}',
    '.launcher .dot{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;',
    'background:' + T.gold + ';border:2px solid ' + T.panel + ';opacity:0;transform:scale(.6);',
    'transition:opacity .2s ease,transform .2s cubic-bezier(.2,.8,.2,1)}',
    '.launcher .dot.on{opacity:1;transform:scale(1)}',

    /* the panel. Springs up: 12px and 2% of scale, once, then stops. */
    '.panel{position:fixed;right:24px;bottom:92px;width:376px;max-width:calc(100vw - 32px);',
    'height:540px;max-height:calc(100vh - 132px);background:' + T.panel + ';border:1px solid ' + T.line + ';',
    'border-radius:14px;box-shadow:0 18px 48px rgba(14,39,64,.20);display:flex;flex-direction:column;',
    'overflow:hidden;z-index:2147483000;opacity:0;transform:translateY(12px) scale(.98);',
    'pointer-events:none;transition:opacity .26s ease,transform .34s cubic-bezier(.16,1.06,.3,1)}',
    '.panel.open{opacity:1;transform:none;pointer-events:auto}',

    '.head{background:' + T.navy + ';color:' + T.panel + ';padding:16px 18px;display:flex;align-items:center;gap:12px;flex:0 0 auto}',
    '.head .who{flex:1;min-width:0}',
    '.head .name{font-family:' + T.serif + ';font-size:17px;font-weight:600;letter-spacing:.01em}',
    '.head .sub{font-size:12px;color:rgba(243,240,234,.72);margin-top:2px}',
    '.head .rule{width:26px;height:2px;background:' + T.gold + ';margin-top:8px}',
    '.x{background:none;border:0;color:rgba(243,240,234,.72);cursor:pointer;font-size:22px;line-height:1;padding:2px 4px}',
    '.x:hover{color:' + T.panel + '}',
    '.x:focus-visible{outline:2px solid ' + T.gold + ';outline-offset:2px}',

    '.log{flex:1 1 auto;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px}',
    '.log::-webkit-scrollbar{width:8px}.log::-webkit-scrollbar-thumb{background:' + T.line + ';border-radius:4px}',

    /* messages fade and rise. 260ms, once, no repeat. */
    '@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.msg{max-width:82%;padding:10px 13px;border-radius:12px;font-size:14px;line-height:1.5;',
    'white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;animation:rise .26s cubic-bezier(.2,.8,.2,1) both}',
    '.msg.them{align-self:flex-start;background:#fff;border:1px solid ' + T.line + ';color:' + T.ink + ';border-bottom-left-radius:4px}',
    '.msg.me{align-self:flex-end;background:' + T.navy + ';color:' + T.panel + ';border-bottom-right-radius:4px}',
    '.meta{font-size:11px;color:' + T.muted + ';align-self:flex-end;margin-top:-6px;animation:rise .26s ease both}',
    '.meta.them{align-self:flex-start}',
    '.note{font-size:12.5px;color:' + T.soft + ';text-align:center;line-height:1.55;padding:4px 8px;animation:rise .26s ease both}',
    '.thumb{max-width:180px;border-radius:8px;display:block;border:1px solid ' + T.line + '}',

    /* a REAL typing indicator: shown only while the relay says a desk is thinking. */
    '.typing{align-self:flex-start;background:#fff;border:1px solid ' + T.line + ';border-radius:12px;',
    'border-bottom-left-radius:4px;padding:12px 14px;display:none;gap:4px;animation:rise .26s ease both}',
    '.typing.on{display:flex}',
    '.typing i{width:6px;height:6px;border-radius:50%;background:' + T.muted + ';animation:blink 1.3s ease-in-out infinite}',
    '.typing i:nth-child(2){animation-delay:.18s}.typing i:nth-child(3){animation-delay:.36s}',
    '@keyframes blink{0%,60%,100%{opacity:.28}30%{opacity:.9}}',

    '.foot{flex:0 0 auto;border-top:1px solid ' + T.line + ';background:#fff;padding:10px 12px}',
    '.row{display:flex;align-items:flex-end;gap:8px}',
    'textarea{flex:1;border:0;resize:none;font-size:14px;line-height:1.45;color:' + T.ink + ';',
    'max-height:110px;min-height:22px;background:transparent;font-family:' + T.sans + '}',
    'textarea:focus{outline:none}',
    '.icon{background:none;border:0;cursor:pointer;color:' + T.muted + ';padding:4px;border-radius:6px;',
    'transition:color .2s ease}',
    '.icon:hover{color:' + T.navy + '}',
    '.icon:focus-visible{outline:2px solid ' + T.gold + ';outline-offset:1px}',
    '.icon svg{width:19px;height:19px;display:block}',
    '.send{color:' + T.gold + '}.send:hover{color:' + T.goldLt + '}',
    '.send[disabled]{color:' + T.line + ';cursor:default}',
    '.err{font-size:12px;color:#a3392f;padding:6px 2px 0}',

    '.handoff{border:1px solid ' + T.line + ';background:#fff;border-radius:10px;padding:12px;animation:rise .26s ease both}',
    '.handoff p{font-size:13px;color:' + T.soft + ';line-height:1.5;margin-bottom:8px}',
    '.handoff .f{display:flex;gap:6px}',
    '.handoff input{flex:1;border:1px solid ' + T.line + ';border-radius:7px;padding:8px 10px;font-size:13px;color:' + T.ink + '}',
    '.handoff input:focus{outline:none;border-color:' + T.gold + '}',
    '.handoff button{background:' + T.navy + ';color:' + T.panel + ';border:0;border-radius:7px;padding:8px 14px;font-size:13px;cursor:pointer}',

    '@media (max-width:480px){.panel{right:12px;left:12px;width:auto;bottom:84px}.launcher{right:16px;bottom:16px}}',

    /* ⛔ One query, everything off. Not "reduced": off. */
    '@media (prefers-reduced-motion: reduce){',
    '*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;',
    'transition-duration:.01ms !important;scroll-behavior:auto !important}',
    '.launcher:hover{transform:none}}',
  ].join('')

  var ICON_CHAT = 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.6A.6.6 0 0 1 4.4 19v-3H4z'
  var ICON_CLIP = 'M17.5 9.5 10 17a3.5 3.5 0 0 1-5-5l7.8-7.8a2.4 2.4 0 0 1 3.4 3.4L8.4 15.4a1.3 1.3 0 0 1-1.8-1.8l7-7'
  var ICON_SEND = 'M3.4 20.6 21 12 3.4 3.4 3.4 10l12 2-12 2z'

  function svg(d, filled) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    s.setAttribute('viewBox', '0 0 24 24')
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', d)
    p.setAttribute('fill', filled ? 'currentColor' : 'none')
    p.setAttribute('stroke', filled ? 'none' : 'currentColor')
    p.setAttribute('stroke-width', '1.7')
    p.setAttribute('stroke-linecap', 'round')
    p.setAttribute('stroke-linejoin', 'round')
    s.appendChild(p)
    return s
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    // ⛔ textContent. The only way message text ever enters this document.
    if (text != null) n.textContent = text
    return n
  }

  // --- state ---------------------------------------------------------------
  var session = null      // {conversation, token}
  var cursor = -1
  var open = false
  var timer = null
  var seen = {}           // seq -> true, so a re-poll never doubles a message
  var handoffShown = false
  var pendingReceipt = null
  var localPreview = {}   // seq -> object URL, this page load only

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || 'null') } catch (e) { return null }
  }
  function save(s) {
    try { localStorage.setItem(STORAGE, JSON.stringify(s)) } catch (e) { /* incognito. A conversation never requires storage to exist. */ }
  }
  function cid() {
    try { return localStorage.getItem(CID_KEY) || null } catch (e) { return null }
  }

  // ⛔ EVERY CALL READS `ok`. A 200 is not a yes. This repo has an incident
  // where a send returned an id, looked fine, and had been refused.
  function api(path, opts) {
    opts = opts || {}
    var headers = opts.headers || {}
    if (session && session.token) headers.authorization = 'Bearer ' + session.token
    return fetch(RELAY + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body,
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j } })
    })
  }

  // --- DOM ------------------------------------------------------------------
  var host = document.createElement('div')
  host.setAttribute('data-luxova-chat', '')
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host
  var style = document.createElement('style')
  style.textContent = CSS
  root.appendChild(style)

  var launcher = el('button', 'launcher')
  launcher.setAttribute('aria-label', 'Chat with Luxova')
  launcher.appendChild(svg(ICON_CHAT))
  var dot = el('span', 'dot')
  launcher.appendChild(dot)

  var panel = el('div', 'panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Chat with Hannah Harper at Luxova')

  var head = el('div', 'head')
  var who = el('div', 'who')
  who.appendChild(el('div', 'name', 'Hannah Harper'))
  who.appendChild(el('div', 'sub', 'Luxova Home'))
  who.appendChild(el('div', 'rule'))
  var close = el('button', 'x', '×')
  close.setAttribute('aria-label', 'Close chat')
  head.appendChild(who)
  head.appendChild(close)

  var log = el('div', 'log')
  log.setAttribute('aria-live', 'polite')
  var typing = el('div', 'typing')
  typing.appendChild(el('i'))
  typing.appendChild(el('i'))
  typing.appendChild(el('i'))

  var foot = el('div', 'foot')
  var row = el('div', 'row')
  var clip = el('button', 'icon')
  clip.setAttribute('aria-label', 'Attach a photo')
  clip.appendChild(svg(ICON_CLIP))
  var file = document.createElement('input')
  file.type = 'file'
  file.accept = 'image/png,image/jpeg,image/webp,image/heic'
  file.style.display = 'none'
  var input = document.createElement('textarea')
  input.rows = 1
  input.placeholder = 'Ask us anything'
  input.setAttribute('aria-label', 'Your message')
  var sendBtn = el('button', 'icon send')
  sendBtn.setAttribute('aria-label', 'Send')
  sendBtn.appendChild(svg(ICON_SEND, true))
  sendBtn.disabled = true
  row.appendChild(clip)
  row.appendChild(input)
  row.appendChild(sendBtn)
  var err = el('div', 'err')
  err.style.display = 'none'
  foot.appendChild(row)
  foot.appendChild(err)
  foot.appendChild(file)

  // ⛔ The typing bubble lives INSIDE the log and is the anchor every message is
  // inserted before, so new messages land above it and it always sits last.
  // It was built and never appended once, and the whole widget looked fine:
  // the panel opened, the button worked, and every single insertBefore threw
  // NotFoundError because the anchor was not a child of anything.
  log.appendChild(typing)
  panel.appendChild(head)
  panel.appendChild(log)
  panel.appendChild(foot)
  root.appendChild(launcher)
  root.appendChild(panel)

  function mount() { (document.body || document.documentElement).appendChild(host) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()

  // --- rendering ------------------------------------------------------------
  function atBottom() { return log.scrollHeight - log.scrollTop - log.clientHeight < 60 }
  function toBottom() { log.scrollTop = log.scrollHeight }

  function showError(msg) {
    err.textContent = msg
    err.style.display = msg ? 'block' : 'none'
  }

  function greet() {
    if (log.querySelector('.note')) return
    // ⛔ Not an answer, not a promise, and not a LIST OF WHAT WE CAN ANSWER.
    // The first draft said "ask about sizes, finishes, or what we have in stock"
    // and the fact gate failed it, correctly: whether we can answer about stock
    // today belongs to a desk, and the widget would have been quietly promising
    // it from a CDN. A greeting that said "we usually reply in 2 minutes" would
    // be the same mistake with a clock on it.
    // ⛔ FIRST CHILD, not appendChild. Messages are inserted BEFORE the typing
    // anchor, so an appended greeting lands underneath the whole conversation.
    // Every assertion passed and the screenshot showed the opening line sitting
    // below Hannah's answer. A script can prove a message arrived; it took
    // looking at the picture to see it arrived in the wrong place.
    log.insertBefore(
      el('div', 'note', 'Ask us anything about your kitchen. If it needs a quote or a drawing, we will take it to the person who owns that.'),
      log.firstChild)
  }

  function addMessage(m) {
    if (seen[m.seq]) return
    seen[m.seq] = true
    if (pendingReceipt && m.type === 'operator') { pendingReceipt.remove(); pendingReceipt = null }

    if (m.type === 'email') {
      log.insertBefore(el('div', 'note', 'Thanks. We will email you at ' + m.email + '.'), typing)
      return
    }
    if (m.type === 'image') {
      // ⛔ NO IMAGE READ-BACK ENDPOINT, deliberately. An <img src> cannot carry
      // a bearer token, so serving photos back would mean an unauthenticated
      // route holding strangers' kitchens. The preview below comes from the
      // visitor's OWN file handle at the moment they picked it; after a reload
      // they get this line instead, which costs them nothing: they know what
      // they sent.
      var wrap = el('div', 'msg me')
      var local = localPreview[m.seq]
      if (local) {
        var img = document.createElement('img')
        img.className = 'thumb'
        img.alt = 'The photo you sent'
        img.src = local
        wrap.appendChild(img)
      } else {
        wrap.textContent = 'Photo sent'
      }
      log.insertBefore(wrap, typing)
      return
    }
    var node = el('div', 'msg ' + (m.type === 'operator' ? 'them' : 'me'), m.text)
    log.insertBefore(node, typing)
    if (m.type === 'visitor') {
      // ⛔ DELIVERED, not answered. The relay can promise the first and never
      // the second: the desks run on one laptop and "no desk available" is
      // normal here, not exceptional.
      pendingReceipt = el('div', 'meta', 'Delivered')
      log.insertBefore(pendingReceipt, typing)
    }
  }

  function showHandoff() {
    if (handoffShown) return
    handoffShown = true
    var box = el('div', 'handoff')
    box.appendChild(el('p', null, 'Nobody is free at this second. Leave an email and we will come back to you properly rather than leave you waiting here.'))
    var f = el('div', 'f')
    var email = document.createElement('input')
    email.type = 'email'
    email.placeholder = 'you@example.com'
    email.setAttribute('aria-label', 'Your email')
    var go = el('button', null, 'Send')
    f.appendChild(email)
    f.appendChild(go)
    box.appendChild(f)
    go.addEventListener('click', function () {
      var v = email.value.trim()
      if (!v) return
      api('/api/chat/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: session.conversation, email: v }),
      }).then(function (r) {
        if (!r.body.ok) { email.value = ''; email.placeholder = 'That address did not look right'; return }
        box.remove()
        poll()
      })
    })
    log.insertBefore(box, typing)
    toBottom()
  }

  // --- the loop -------------------------------------------------------------
  function poll() {
    if (!session) return
    api('/api/chat/messages?conversation=' + encodeURIComponent(session.conversation) + '&after=' + cursor)
      .then(function (r) {
        if (!r.body.ok) {
          // A refused poll is not an empty poll. Stop reusing a dead session.
          if (r.status === 401) { session = null; save(null) }
          return
        }
        var stick = atBottom()
        var msgs = r.body.messages || []
        for (var i = 0; i < msgs.length; i++) addMessage(msgs[i])
        cursor = r.body.cursor
        typing.classList.toggle('on', !!r.body.typing)
        if (r.body.handoff) showHandoff()
        if (!open && msgs.some(function (m) { return m.type === 'operator' })) dot.classList.add('on')
        if (stick || msgs.length) toBottom()
      })
      // ⛔ A BARE catch(){} HERE COST AN HOUR. It was written for "a flaky
      // network is not a reason to stop asking", and it also swallowed a real
      // TypeError inside the .then above, so the widget sat there polling
      // successfully and updating nothing, in silence. A network failure is
      // survivable and silent; a bug in our own handler is neither.
      .catch(function (e) {
        if (e instanceof TypeError && /fetch|network|Failed/i.test(e.message || '')) return
        console.error('[luxova-chat] poll handler failed', e)
      })
  }

  function schedule() {
    if (timer) clearInterval(timer)
    timer = setInterval(poll, open ? POLL_OPEN : POLL_SHUT)
  }

  function ensureSession() {
    if (session) return Promise.resolve(session)
    var saved = load()
    if (saved && saved.conversation && saved.token) {
      session = saved
      return Promise.resolve(session)
    }
    return api('/api/chat/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // ⛔ cid if the page has one, and a conversation regardless if it does not.
      body: JSON.stringify({ cid: cid(), page: location.pathname }),
    }).then(function (r) {
      if (!r.body.ok) { showError('We could not start a chat just now.'); return null }
      session = { conversation: r.body.conversation, token: r.body.token }
      save(session)
      return session
    })
  }

  // =========================================================================
  // ⛔ THE UNATTENDED STATE IS A CAPTURE, NOT AN ABSENCE. The owner chose that
  // ("go with C"): when nobody is reading, a visitor gets somewhere to leave
  // something, with a promise we come back. Making it render NOTHING was my own
  // wrong instinct and the lead corrected it.
  //
  // ⭐ IT REUSES THE COMPOSER RATHER THAN BUILDING A SECOND UI. The shape
  // web-customer-service specified is "a field to type into and a control to
  // submit", which is exactly what the composer already is, and it is the path
  // whose persistence is proven end to end. A parallel capture form would be a
  // second send path to keep correct.
  var unattended = false
  var captureNote = el('div', 'msg them')
  captureNote.style.display = 'none'

  function showCapture(text) {
    captureNote.textContent = text
    captureNote.style.display = ''
    if (captureNote.parentNode !== log) log.insertBefore(captureNote, typing)
  }

  // ⛔ CALLED ON EVERY OPEN, not once at boot. A desk can arrive or leave while
  // the page is sitting there, and a visitor who opens the panel an hour later
  // must be told the truth as it is then, not as it was at page load.
  function applyAttendance() {
    return checkAttended().then(function (a) {
      unattended = !a
      input.setAttribute('aria-label', unattended ? CAPTURE.aria : 'Your message')
      input.placeholder = unattended ? CAPTURE.label : 'Ask us anything'
      if (unattended) showCapture(CAPTURE.status + ' ' + CAPTURE.invite)
      else captureNote.style.display = 'none'
      return a
    })
  }

  function send() {
    var text = input.value.trim()
    if (!text) return
    showError('')
    input.value = ''
    input.style.height = 'auto'
    sendBtn.disabled = true
    // ⛔ PENDING CLAIMS NOTHING. "Sending." is not a receipt. A thank-you here
    // would be a confirmation rendered on submit, which web-customer-service
    // forbade and which is the silent-failure shape this whole thread exists
    // to prevent.
    if (unattended) showCapture(CAPTURE.pending)
    ensureSession().then(function (s) {
      if (!s) { input.value = text; return }
      return api('/api/chat/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversation: s.conversation, text: text, page: location.pathname }),
      }).then(function (r) {
        if (!r.body.ok) {
          // Named, honest, and it gives the text back rather than losing it.
          showError(r.body.error === 'rate_limited' ? 'That is a lot at once. Give it a moment.'
            : r.body.error === 'too_long' ? 'That is longer than the box takes. Trim it a little.'
            : 'That did not send. Try again.')
          input.value = text
          // ⛔ SAY IT DID NOT SAVE, and route to the one channel with a
          // confirmed human. Showing nothing here leaves a visitor looking at a
          // form that appears to have taken their message and did not.
          if (unattended) showCapture(CAPTURE.failed)
          return
        }
        // ⛔ THE ONLY PLACE THE CONFIRMATION IS REACHABLE, and it is inside the
        // branch where the BODY said ok:true. A 200 is not a yes.
        if (unattended) showCapture(CAPTURE.confirmation)
        poll()
      })
    }).catch(function () {
      // ⛔ A REJECTED FETCH IS A FAILED CAPTURE. Without this the promise is
      // left on screen with nothing behind it, which is the painted door again.
      input.value = text
      sendBtn.disabled = false
      if (unattended) showCapture(CAPTURE.failed)
    })
  }

  function sendImage(f) {
    if (!f) return
    showError('')
    ensureSession().then(function (s) {
      if (!s) return
      return f.arrayBuffer().then(function (buf) {
        // ⛔ BYTES ONLY. f.name is never sent. The relay sniffs the type and
        // stores under a digest, so a name cannot become a path anywhere.
        return api('/api/chat/image?conversation=' + encodeURIComponent(s.conversation), {
          method: 'POST',
          body: buf,
        }).then(function (r) {
          if (!r.body.ok) {
            showError(r.body.error === 'too_large' ? 'That photo is too big to send.'
              : r.body.error === 'unsupported_type' ? 'We can take a JPEG, PNG, WEBP or HEIC photo.'
              : 'That photo did not send.')
            return
          }
          try { localPreview[r.body.seq] = URL.createObjectURL(f) } catch (e) { /* preview is a nicety */ }
          poll()
        })
      })
    })
  }

  // --- wiring ---------------------------------------------------------------
  function setOpen(v) {
    open = v
    panel.classList.toggle('open', v)
    launcher.setAttribute('aria-expanded', v ? 'true' : 'false')
    if (v) {
      dot.classList.remove('on')
      // ⛔ ASKED ON EVERY OPEN. A desk can arrive or leave while the page sits
      // there; a visitor opening the panel an hour after load must be told the
      // truth as it is then. Defining applyAttendance and never calling it is
      // the defect that bit me twice today: it loads fine and does nothing.
      applyAttendance()
      greet()
      ensureSession().then(function () { poll() })
      setTimeout(function () { input.focus() }, 60)
    }
    schedule()
  }

  launcher.addEventListener('click', function () { setOpen(!open) })
  close.addEventListener('click', function () { setOpen(false) })
  sendBtn.addEventListener('click', send)
  clip.addEventListener('click', function () { file.click() })
  file.addEventListener('change', function () { sendImage(file.files[0]); file.value = '' })
  input.addEventListener('input', function () {
    sendBtn.disabled = !input.value.trim()
    input.style.height = 'auto'
    input.style.height = Math.min(input.scrollHeight, 110) + 'px'
  })
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  })
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false) })

  // A conversation already on this browser keeps being watched, so an answer
  // that lands while the panel is shut still lights the launcher.
  if (load()) { session = load(); schedule(); poll() }

  window.__luxovaChatApi = { open: function () { setOpen(true) }, close: function () { setOpen(false) } }
})()
