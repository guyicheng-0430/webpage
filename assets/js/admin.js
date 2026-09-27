/* ==========================================================================
   HELPing · 管理后台
   --------------------------------------------------------------------------
   两部分：
     1) HELP.admin —— 口令门禁（纯前端）。SHA-256 校验 + 会话有效期 + 失败限流。
     2) 后台界面   —— 概览 / 发货管理 / 内容审核。

   ⚠️ 安全边界（务必知悉）：
     这是纯静态站点，没有服务器。口令哈希、会话、限流逻辑全部跑在浏览器里，
     懂技术的人打开源码或控制台即可绕过。它挡的是「随手点进来的人」，
     不是攻击者。正式上线必须改成服务端鉴权（口令校验 + 会话下发都在后端），
     否则订单里的收货人姓名、电话、地址等于公开数据。
   ========================================================================== */

(function () {
  'use strict';

  /* ======================================================== SHA-256 实现 */

  var K = (function () {
    var primes = [], n = 2;
    while (primes.length < 64) {
      var isP = true;
      for (var d = 2; d * d <= n; d++) { if (n % d === 0) { isP = false; break; } }
      if (isP) primes.push(n);
      n++;
    }
    return primes.map(function (p) { return (Math.cbrt(p) * 4294967296) | 0; });
  })();

  var H0 = (function () {
    var primes = [], n = 2;
    while (primes.length < 8) {
      var isP = true;
      for (var d = 2; d * d <= n; d++) { if (n % d === 0) { isP = false; break; } }
      if (isP) primes.push(n);
      n++;
    }
    return primes.map(function (p) { return (Math.sqrt(p) * 4294967296) | 0; });
  })();

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function hex32(v) {
    return ((v >>> 24) & 255).toString(16).padStart(2, '0') +
           ((v >>> 16) & 255).toString(16).padStart(2, '0') +
           ((v >>> 8) & 255).toString(16).padStart(2, '0') +
           (v & 255).toString(16).padStart(2, '0');
  }

  /* 字符串 -> UTF-8 字节串（每个 charCode 落在 0..255） */
  function utf8(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) {
        out += String.fromCharCode(c);
      } else if (c < 0x800) {
        out += String.fromCharCode(0xC0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length &&
                 str.charCodeAt(i + 1) >= 0xDC00 && str.charCodeAt(i + 1) <= 0xDFFF) {
        var cp = 0x10000 + ((c - 0xD800) << 10) + (str.charCodeAt(i + 1) - 0xDC00);
        out += String.fromCharCode(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
                                   0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        i++;
      } else {
        out += String.fromCharCode(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  function sha256(str) {
    var msg = utf8(str);
    var bitLen = msg.length * 8;

    msg += '\x80';
    while (msg.length % 64 !== 56) msg += '\x00';
    var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    msg += String.fromCharCode((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
                               (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

    var H = H0.slice();
    var w = new Array(64);

    for (var off = 0; off < msg.length; off += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = (msg.charCodeAt(off + i * 4) << 24) |
               (msg.charCodeAt(off + i * 4 + 1) << 16) |
               (msg.charCodeAt(off + i * 4 + 2) << 8) |
               msg.charCodeAt(off + i * 4 + 3);
      }
      for (i = 16; i < 64; i++) {
        var x = w[i - 15], y = w[i - 2];
        var s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
        var s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }

      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    var out = '';
    for (i = 0; i < 8; i++) out += hex32(H[i]);
    return out;
  }

  /* ============================================================ 门禁模块 */

  var SALT = 'helping::';
  /* sha256('helping::' + 'HELPing@2026') —— 默认口令，可在后台里修改 */
  var DEFAULT_HASH = '1e6053965f60942251e722a637183c0905e92980161c015a052719eb96ed9593';
  var ADMIN_KEY = 'help.admin.v1';
  var SESSION_KEY = 'help.admin.session';
  var SESSION_HOURS = 2;
  var MAX_FAILS = 5;
  var BASE_LOCK_MS = 60000;

  function cfg() {
    var c = null;
    try { c = JSON.parse(localStorage.getItem(ADMIN_KEY)); } catch (e) { c = null; }
    if (!c || typeof c !== 'object') c = {};
    return {
      hash: (typeof c.hash === 'string' && c.hash) ? c.hash : DEFAULT_HASH,
      fails: (typeof c.fails === 'number' && c.fails >= 0) ? c.fails : 0,
      lockUntil: (typeof c.lockUntil === 'number') ? c.lockUntil : 0
    };
  }

  function saveCfg(c) {
    try { localStorage.setItem(ADMIN_KEY, JSON.stringify(c)); } catch (e) {}
  }

  function hashOf(pw) { return sha256(SALT + String(pw == null ? '' : pw)); }

  function currentSession() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (s && typeof s.exp === 'number' && s.exp > Date.now()) return s;
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    return null;
  }

  function lockState() {
    var c = cfg();
    var now = Date.now();
    return {
      locked: c.lockUntil > now,
      waitSec: c.lockUntil > now ? Math.ceil((c.lockUntil - now) / 1000) : 0,
      fails: c.fails
    };
  }

  function login(pw) {
    var c = cfg();
    var now = Date.now();

    if (c.lockUntil > now) {
      return { ok: false, reason: 'locked', waitSec: Math.ceil((c.lockUntil - now) / 1000) };
    }
    if (!pw) return { ok: false, reason: 'empty' };

    if (hashOf(pw) !== c.hash) {
      c.fails += 1;
      var hit = c.fails >= MAX_FAILS;
      if (hit) {
        var round = Math.floor(c.fails / MAX_FAILS);
        c.lockUntil = now + BASE_LOCK_MS * Math.pow(2, round - 1);
      }
      saveCfg(c);
      var rem = MAX_FAILS - (c.fails % MAX_FAILS);
      if (rem === MAX_FAILS) rem = 0;
      return {
        ok: false,
        reason: hit ? 'locked' : 'wrong',
        left: rem,
        waitSec: hit ? Math.ceil((c.lockUntil - now) / 1000) : 0
      };
    }

    c.fails = 0;
    c.lockUntil = 0;
    saveCfg(c);

    var sess = { exp: now + SESSION_HOURS * 3600 * 1000, at: now };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch (e) {}
    return { ok: true, session: sess };
  }

  function logout() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function changePassword(oldPw, newPw) {
    if (!isLoggedIn()) return { ok: false, reason: 'no-session' };
    if (hashOf(oldPw) !== cfg().hash) return { ok: false, reason: 'wrong-old' };
    if (!newPw || String(newPw).length < 6) return { ok: false, reason: 'too-short' };
    var c = cfg();
    c.hash = hashOf(newPw);
    c.fails = 0;
    c.lockUntil = 0;
    saveCfg(c);
    return { ok: true };
  }

  function isLoggedIn() { return !!currentSession(); }

  function isDefaultPassword() { return cfg().hash === DEFAULT_HASH; }

  window.HELP = window.HELP || {};
  HELP.admin = {
    hashOf: hashOf,
    sha256: sha256,
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    session: currentSession,
    lockState: lockState,
    changePassword: changePassword,
    isDefaultPassword: isDefaultPassword,
    DEFAULT_HASH: DEFAULT_HASH,
    SESSION_HOURS: SESSION_HOURS,
    MAX_FAILS: MAX_FAILS
  };

  /* ============================================================ 后台界面 */

  var gate = document.querySelector('[data-admin-gate]');
  var app = document.querySelector('[data-admin-app]');
  if (!gate || !app) return;

  var esc = HELP.escapeHtml;
  var money = HELP.money;

  var orderFilter = { status: 'pending', q: '' };
  var reviewFilter = { kind: 'artwork', state: 'pending' };
  var openShipFor = null;

  /* ------------------------------------------------------------- 门禁屏 */

  var gateForm = document.querySelector('[data-gate-form]');
  var gatePw = document.querySelector('[data-gate-pw]');
  var gateMsg = document.querySelector('[data-gate-msg]');
  var gateLock = document.querySelector('[data-gate-lock]');
  var tickTimer = null;

  function setGateMsg(text, ok) {
    if (!gateMsg) return;
    gateMsg.textContent = text || '';
    gateMsg.style.color = ok ? 'var(--sage)' : 'var(--clay)';
  }

  function refreshLockNotice() {
    var st = lockState();
    if (!gateLock || !gatePw) return;

    if (st.locked) {
      gateLock.hidden = false;
      gatePw.disabled = true;
      var n = st.waitSec;
      gateLock.textContent = '尝试次数过多，已临时锁定，请等待 ' + n + ' 秒。';
      clearTimeout(tickTimer);
      tickTimer = setTimeout(refreshLockNotice, 1000);
    } else {
      gateLock.hidden = true;
      gatePw.disabled = false;
      clearTimeout(tickTimer);
    }
  }

  /* 未登录时隐藏「退出登录」，否则门禁屏上挂着一个无意义的按钮 */
  function setChrome(loggedIn) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-logout]'), function (el) {
      el.hidden = !loggedIn;
    });
  }

  function showGate() {
    gate.hidden = false;
    app.hidden = true;
    setChrome(false);
    if (gatePw) { gatePw.value = ''; }
    setGateMsg('');
    refreshLockNotice();
    if (gatePw && !gatePw.disabled) gatePw.focus();
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    setChrome(true);
    renderAll();
  }

  if (gateForm) {
    gateForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = login(gatePw ? gatePw.value : '');

      if (res.ok) {
        setGateMsg('口令正确，正在进入…', true);
        showApp();
        return;
      }

      if (res.reason === 'locked') {
        setGateMsg('口令错误次数过多，已锁定。', false);
        refreshLockNotice();
        return;
      }
      if (res.reason === 'empty') { setGateMsg('请输入管理口令。', false); return; }

      setGateMsg('口令不正确。' + (res.left > 0 ? '还可尝试 ' + res.left + ' 次。' : ''), false);
      if (gatePw) { gatePw.value = ''; gatePw.focus(); }
      HELP.toast('口令不正确');
    });
  }

  /* ---------------------------------------------------------- 顶栏/标签 */

  var TAB_NAMES = ['overview', 'orders', 'review'];

  /* 切换标签。支持 URL hash 直达，例如 admin.html#orders */
  function activateTab(name) {
    if (TAB_NAMES.indexOf(name) === -1) name = 'overview';
    Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-panel]'), function (p) {
      p.hidden = p.getAttribute('data-panel') !== name;
    });
    return name;
  }

  function tabFromHash() {
    return String(location.hash || '').replace(/^#/, '') || 'overview';
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;

    if (t.closest('[data-logout]')) {
      logout();
      HELP.toast('已退出管理后台');
      showGate();
      return;
    }

    var tab = t.closest('[data-tab]');
    if (tab) {
      var name = activateTab(tab.getAttribute('data-tab'));
      if (history.replaceState) history.replaceState(null, '', '#' + name);
      else location.hash = name;
      return;
    }
  });

  window.addEventListener('hashchange', function () {
    if (isLoggedIn()) activateTab(tabFromHash());
  });

  /* -------------------------------------------------------------- 概览 */

  function renderOverview() {
    var box = document.querySelector('[data-panel="overview"]');
    if (!box) return;

    var os = HELP.orders.stats();
    var ac = HELP.artworks.reviewCounts();
    var mc = HELP.messages.reviewCounts();

    var cards = [
      ['待发货订单', os.by.pending, '需尽快处理', 'pending'],
      ['待审核作品', ac.pending, ac.total ? '共 ' + ac.total + ' 件投稿' : '暂无投稿', 'review'],
      ['待审留言', mc.pending, mc.total ? '共 ' + mc.total + ' 条' : '暂无留言', 'review'],
      ['累计销售额', money(os.revenue), '创作者分成 ' + money(os.share), 'none']
    ];

    var recent = HELP.orders.list({ status: 'all' }).slice(0, 5);

    box.innerHTML = '' +
      '<div class="adm-cards">' +
        cards.map(function (c) {
          return '<div class="adm-card"' + (c[3] !== 'none' ? ' data-jump="' + c[3] + '"' : '') + '>' +
            '<div class="adm-card__label">' + esc(c[0]) + '</div>' +
            '<div class="adm-card__value">' + esc(String(c[1])) + '</div>' +
            '<div class="adm-card__hint">' + esc(c[2]) + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +

      '<div class="adm-block">' +
        '<div class="adm-block__head">' +
          '<div class="h4">最近订单</div>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-goto-tab="orders">查看全部</button>' +
        '</div>' +
        (recent.length
          ? '<div class="adm-mini">' + recent.map(function (o) {
              return '<div class="adm-mini__row">' +
                '<span class="adm-mini__no">' + esc(o.no) + '</span>' +
                '<span class="adm-mini__who">' + esc(o.buyer.name) + '</span>' +
                '<span class="adm-mini__amt">' + money(o.total) + '</span>' +
                '<span class="adm-pill adm-pill--' + o.status + '">' +
                  esc(HELP.orders.statusLabel(o.status)) + '</span>' +
              '</div>';
            }).join('') + '</div>'
          : '<div class="empty-state">暂无订单。</div>') +
      '</div>' +

      '<div class="adm-block">' +
        '<div class="adm-block__head"><div class="h4">账号</div></div>' +
        '<p class="small muted">会话有效期 ' + SESSION_HOURS_TEXT() + '，到期后需重新输入口令。</p>' +
        (isDefaultPassword()
          ? '<p class="small" style="color:var(--clay);margin-top:10px">⚠️ 当前仍在使用默认口令，建议立即修改。</p>'
          : '<p class="small muted" style="margin-top:10px">已使用自定义口令。</p>') +
        '<div class="adm-inline" style="margin-top:16px">' +
          '<input class="input" type="password" data-pw-old placeholder="当前口令" autocomplete="current-password">' +
          '<input class="input" type="password" data-pw-new placeholder="新口令（至少 6 位）" autocomplete="new-password">' +
          '<button class="btn btn--sm" type="button" data-pw-save>修改口令</button>' +
        '</div>' +
        '<p class="tiny" data-pw-msg style="margin-top:10px;min-height:16px"></p>' +
        '<p class="tiny muted" style="margin-top:14px;line-height:1.7">' +
          '说明：本站是纯静态页面，口令校验在浏览器里完成，只能挡住随手进入的人，' +
          '不能当作真正的安全防护。正式上线请改为服务端鉴权，否则订单中的收货信息等同于公开。' +
        '</p>' +
      '</div>';
  }

  function SESSION_HOURS_TEXT() { return HELP.admin.SESSION_HOURS + ' 小时'; }

  /* ---------------------------------------------------------- 发货管理 */

  function shipFormHtml(o) {
    var opts = HELP.orders.couriers().map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    return '' +
      '<form class="adm-ship" data-ship-form="' + o.id + '">' +
        '<div class="adm-ship__row">' +
          '<select class="select" name="courier" aria-label="承运商">' + opts + '</select>' +
          '<input class="input" name="tracking" placeholder="运单号" maxlength="32" autocomplete="off">' +
        '</div>' +
        '<div class="adm-actions">' +
          '<button class="btn btn--sm" type="submit">确认发货</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-ship-cancel>取消</button>' +
        '</div>' +
      '</form>';
  }

  function orderCardHtml(o) {
    var items = (o.items || []).map(function (it) {
      return '<div class="adm-item">' +
        '<div class="adm-item__img"><img src="' + it.image + '" alt="" loading="lazy"></div>' +
        '<div class="adm-item__body">' +
          '<div class="adm-item__name">' + esc(it.name) + '</div>' +
          '<div class="tiny muted">原作 · ' + esc(it.artwork || '—') + ' · ' + it.qty + ' 件</div>' +
        '</div>' +
        '<div class="adm-item__price">' + money(it.price * it.qty) + '</div>' +
      '</div>';
    }).join('');

    var actions = [];
    if (o.status === 'pending') {
      actions.push('<button class="btn btn--sm" type="button" data-order-ship="' + o.id + '">填写发货信息</button>');
    }
    if (o.status === 'shipped') {
      actions.push('<button class="btn btn--sm" type="button" data-order-done="' + o.id + '">标记已完成</button>');
    }
    if (o.status === 'done') {
      actions.push('<button class="btn btn--ghost btn--sm" type="button" data-order-reopen="' + o.id + '">恢复为待发货</button>');
    }
    if (o.status !== 'cancelled' && o.status !== 'done') {
      actions.push('<button class="btn btn--ghost btn--sm" type="button" data-order-cancel="' + o.id + '">取消订单</button>');
    }

    return '' +
      '<article class="adm-order" data-order="' + o.id + '">' +
        '<div class="adm-order__head">' +
          '<div>' +
            '<div class="adm-order__no">' + esc(o.no) + '</div>' +
            '<div class="tiny muted">' + esc(o.createdAt) + ' 下单' +
              (o.shippedAt ? ' · ' + esc(o.shippedAt) + ' 发出' : '') + '</div>' +
          '</div>' +
          '<span class="adm-pill adm-pill--' + o.status + '">' +
            esc(HELP.orders.statusLabel(o.status)) + '</span>' +
        '</div>' +

        '<div class="adm-order__cols">' +
          '<div>' +
            '<div class="adm-sub">收货信息</div>' +
            '<div class="small">' + esc(o.buyer.name) + '</div>' +
            '<div class="small muted">' + esc(o.buyer.phone) + '</div>' +
            '<div class="small muted" style="line-height:1.7">' + esc(o.buyer.address) + '</div>' +
            (o.note ? '<div class="tiny" style="margin-top:8px;color:var(--sand)">备注：' + esc(o.note) + '</div>' : '') +
          '</div>' +
          '<div>' +
            '<div class="adm-sub">商品</div>' +
            items +
          '</div>' +
          '<div>' +
            '<div class="adm-sub">物流</div>' +
            (o.tracking
              ? '<div class="small">' + esc(o.courier) + '</div>' +
                '<div class="small muted" style="font-family:var(--font-mono)">' + esc(o.tracking) + '</div>'
              : '<div class="small muted">尚未发货</div>') +
            '<div class="adm-sub" style="margin-top:18px">金额</div>' +
            '<div class="adm-order__total">' + money(o.total) + '</div>' +
            '<div class="tiny muted">含创作者分成 ' + money(Math.round(o.total * 0.3)) + '</div>' +
          '</div>' +
        '</div>' +

        (openShipFor === o.id ? shipFormHtml(o) : '') +

        (actions.length
          ? '<div class="adm-actions">' + actions.join('') + '</div>'
          : '') +
      '</article>';
  }

  function renderOrders() {
    var box = document.querySelector('[data-orders]');
    if (!box) return;

    var stats = HELP.orders.stats();
    var states = [
      ['pending', '待发货', stats.by.pending],
      ['shipped', '已发货', stats.by.shipped],
      ['done', '已完成', stats.by.done],
      ['cancelled', '已取消', stats.by.cancelled],
      ['all', '全部', stats.count]
    ];

    var chips = document.querySelector('[data-order-status]');
    if (chips) {
      chips.innerHTML = states.map(function (s) {
        return '<button class="chip' + (orderFilter.status === s[0] ? ' is-active' : '') +
          '" type="button" data-order-status="' + s[0] + '">' +
          esc(s[1]) + ' <b>' + s[2] + '</b></button>';
      }).join('');
    }

    var list = HELP.orders.list({ status: orderFilter.status, q: orderFilter.q });
    var countEl = document.querySelector('[data-orders-count]');
    if (countEl) countEl.textContent = list.length + ' 条';

    box.innerHTML = list.length
      ? list.map(orderCardHtml).join('')
      : '<div class="empty-state">这个筛选条件下没有订单。</div>';
  }

  /* ---------------------------------------------------------- 内容审核 */

  function artworkRow(a) {
    var st = HELP.review.of(a);
    return '' +
      '<article class="adm-review" data-review-row="' + a.id + '">' +
        '<div class="adm-review__thumb"><img src="' + a.image + '" alt="" loading="lazy"></div>' +
        '<div class="adm-review__body">' +
          '<div class="adm-review__title">' + esc(a.title || '（未命名）') +
            '<span class="adm-pill adm-pill--' + st + '">' + esc(HELP.review.label(st)) + '</span></div>' +
          '<div class="tiny muted">' + esc(a.author || '匿名') +
            (a.age ? ' · ' + a.age + ' 岁' : '') +
            (a.school ? ' · ' + esc(a.school) : '') +
            ' · ' + esc(a.category || '') +
            (a.medium ? ' · ' + esc(a.medium) : '') +
            ' · ' + esc(a.createdAt || '') + '</div>' +
          (a.story ? '<p class="small muted" style="margin-top:8px;line-height:1.7">' + esc(a.story) + '</p>' : '') +
          (a.tags && a.tags.length
            ? '<div class="art__tags" style="margin-top:10px">' + a.tags.map(function (t) {
                return '<span class="tag">' + esc(t) + '</span>';
              }).join('') + '</div>'
            : '') +
        '</div>' +
        '<div class="adm-review__ops">' +
          '<button class="btn btn--sm" type="button" data-approve="' + a.id + '"' +
            (st === 'approved' ? ' disabled' : '') + '>通过</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-reject="' + a.id + '"' +
            (st === 'rejected' ? ' disabled' : '') + '>驳回</button>' +
          (st !== 'pending'
            ? '<button class="btn btn--ghost btn--sm" type="button" data-reopen-review="' + a.id + '">退回待审</button>'
            : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-del-art="' + a.id + '">删除</button>' +
        '</div>' +
      '</article>';
  }

  function messageRow(m) {
    var st = HELP.review.of(m);
    return '' +
      '<article class="adm-review" data-review-row="' + m.id + '">' +
        '<div class="adm-review__body" style="grid-column:span 2">' +
          '<div class="adm-review__title">' + esc(m.name || '匿名') +
            '<span class="adm-pill adm-pill--' + st + '">' + esc(HELP.review.label(st)) + '</span></div>' +
          '<div class="tiny muted">' + esc(m.role || '—') + ' · 致 ' + esc(m.target || '全体创作者') +
            ' · ' + esc(m.createdAt || '') + '</div>' +
          '<p class="small" style="margin-top:8px;line-height:1.8">' + esc(m.text) + '</p>' +
        '</div>' +
        '<div class="adm-review__ops">' +
          '<button class="btn btn--sm" type="button" data-approve="' + m.id + '"' +
            (st === 'approved' ? ' disabled' : '') + '>通过</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-reject="' + m.id + '"' +
            (st === 'rejected' ? ' disabled' : '') + '>驳回</button>' +
          (st !== 'pending'
            ? '<button class="btn btn--ghost btn--sm" type="button" data-reopen-review="' + m.id + '">退回待审</button>'
            : '') +
        '</div>' +
      '</article>';
  }

  function renderReview() {
    var box = document.querySelector('[data-review-list]');
    if (!box) return;

    var kind = reviewFilter.kind;
    var state = reviewFilter.state;

    /* 标题上的计数 */
    var counts = kind === 'artwork' ? HELP.artworks.reviewCounts() : HELP.messages.reviewCounts();
    var kindBar = document.querySelector('[data-review-kind]');
    if (kindBar) {
      kindBar.innerHTML = '' +
        '<button class="chip' + (kind === 'artwork' ? ' is-active' : '') +
          '" type="button" data-review-kind="artwork">作品 <b>' +
          (kind === 'artwork' ? counts.pending : HELP.artworks.reviewCounts().pending) + '</b></button>' +
        '<button class="chip' + (kind === 'message' ? ' is-active' : '') +
          '" type="button" data-review-kind="message">留言 <b>' +
          (kind === 'message' ? counts.pending : HELP.messages.reviewCounts().pending) + '</b></button>';
    }

    var stateBar = document.querySelector('[data-review-state]');
    if (stateBar) {
      var states = [['pending', '待审核'], ['approved', '已通过'], ['rejected', '已驳回'], ['all', '全部']];
      stateBar.innerHTML = states.map(function (s) {
        var n = s[0] === 'all' ? counts.total : counts[s[0]];
        return '<button class="chip' + (state === s[0] ? ' is-active' : '') +
          '" type="button" data-review-state="' + s[0] + '">' + esc(s[1]) + ' <b>' + n + '</b></button>';
      }).join('');
    }

    var rows;
    if (kind === 'artwork') {
      rows = (state === 'all' ? HELP.artworks.uploads() : HELP.artworks.byReview(state))
        .map(artworkRow);
    } else {
      /* 演示留言不参与审核，只审本机提交的 */
      rows = (state === 'all' ? HELP.messages.stored() : HELP.messages.byReview(state))
        .map(messageRow);
    }

    var countEl = document.querySelector('[data-review-count]');
    if (countEl) countEl.textContent = rows.length + ' 条';

    box.innerHTML = rows.length ? rows.join('')
      : '<div class="empty-state">' +
        (state === 'pending' ? '太好了，这里没有待处理的条目。' : '这个筛选条件下没有条目。') +
        '</div>';
  }

  /* ------------------------------------------------------------ 渲染总控 */

  function renderAll() {
    renderOverview();
    renderOrders();
    renderReview();
  }

  /* -------------------------------------------------------------- 事件 */

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest) return;

    /* 概览卡片跳转 */
    var jump = t.closest('[data-jump]');
    if (jump) {
      var box = jump.getAttribute('data-jump');
      var tabName = box === 'pending' ? 'orders' : 'review';
      var tabBtn = document.querySelector('[data-tab="' + tabName + '"]');
      if (tabBtn) tabBtn.click();
      return;
    }
    var goto = t.closest('[data-goto-tab]');
    if (goto) {
      var b = document.querySelector('[data-tab="' + goto.getAttribute('data-goto-tab') + '"]');
      if (b) b.click();
      return;
    }

    /* 订单筛选 */
    var stChip = t.closest('[data-order-status]');
    if (stChip) {
      orderFilter.status = stChip.getAttribute('data-order-status');
      renderOrders();
      return;
    }

    /* 发货 */
    var shipBtn = t.closest('[data-order-ship]');
    if (shipBtn) {
      var sid = shipBtn.getAttribute('data-order-ship');
      openShipFor = (openShipFor === sid) ? null : sid;
      renderOrders();
      var inp = document.querySelector('[data-ship-form="' + sid + '"] input[name="tracking"]');
      if (inp) inp.focus();
      return;
    }
    if (t.closest('[data-ship-cancel]')) {
      openShipFor = null;
      renderOrders();
      return;
    }

    var doneBtn = t.closest('[data-order-done]');
    if (doneBtn) {
      HELP.orders.setStatus(doneBtn.getAttribute('data-order-done'), 'done');
      HELP.toast('订单已标记为完成');
      renderAll();
      return;
    }
    var reopenBtn = t.closest('[data-order-reopen]');
    if (reopenBtn) {
      HELP.orders.setStatus(reopenBtn.getAttribute('data-order-reopen'), 'pending');
      HELP.toast('订单已恢复为待发货');
      renderAll();
      return;
    }
    var cancelBtn = t.closest('[data-order-cancel]');
    if (cancelBtn) {
      HELP.orders.setStatus(cancelBtn.getAttribute('data-order-cancel'), 'cancelled');
      HELP.toast('订单已取消');
      renderAll();
      return;
    }

    /* 审核 */
    var kindChip = t.closest('[data-review-kind]');
    if (kindChip) {
      reviewFilter.kind = kindChip.getAttribute('data-review-kind');
      renderReview();
      return;
    }
    var stateChip = t.closest('[data-review-state]');
    if (stateChip) {
      reviewFilter.state = stateChip.getAttribute('data-review-state');
      renderReview();
      return;
    }

    var approveBtn = t.closest('[data-approve]');
    if (approveBtn) {
      applyReview(approveBtn.getAttribute('data-approve'), 'approved');
      return;
    }
    var rejectBtn = t.closest('[data-reject]');
    if (rejectBtn) {
      applyReview(rejectBtn.getAttribute('data-reject'), 'rejected');
      return;
    }
    var reopenRv = t.closest('[data-reopen-review]');
    if (reopenRv) {
      applyReview(reopenRv.getAttribute('data-reopen-review'), 'pending');
      return;
    }
    var delArt = t.closest('[data-del-art]');
    if (delArt) {
      HELP.artworks.remove(delArt.getAttribute('data-del-art'));
      HELP.toast('作品已删除');
      renderAll();
      return;
    }

    /* 修改口令 */
    if (t.closest('[data-pw-save]')) {
      var oldEl = document.querySelector('[data-pw-old]');
      var newEl = document.querySelector('[data-pw-new]');
      var msgEl = document.querySelector('[data-pw-msg]');
      var res = changePassword(oldEl ? oldEl.value : '', newEl ? newEl.value : '');

      var text = {
        'no-session': '会话已过期，请重新登录。',
        'wrong-old': '当前口令不正确。',
        'too-short': '新口令至少 6 位。'
      }[res.reason] || (res.ok ? '口令已更新。' : '修改失败。');

      if (msgEl) {
        msgEl.textContent = text;
        msgEl.style.color = res.ok ? 'var(--sage)' : 'var(--clay)';
      }
      if (res.ok) {
        if (oldEl) oldEl.value = '';
        if (newEl) newEl.value = '';
        HELP.toast('口令已更新');
        renderOverview();
      }
      return;
    }
  });

  /* 订单搜索（防抖） */
  var searchEl = document.querySelector('[data-orders-search]');
  if (searchEl) {
    var searchTimer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var v = searchEl.value.trim();
      searchTimer = setTimeout(function () {
        orderFilter.q = v;
        renderOrders();
      }, 160);
    });
  }

  /* 发货表单提交（动态插入，用委托） */
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-ship-form]');
    if (!f) return;
    e.preventDefault();

    var id = f.getAttribute('data-ship-form');
    var fd = new FormData(f);
    var courier = String(fd.get('courier') || '').trim();
    var tracking = String(fd.get('tracking') || '').trim();

    if (tracking.length < 6) {
      HELP.toast('请填写有效的运单号（至少 6 位）');
      var inp = f.querySelector('input[name="tracking"]');
      if (inp) inp.focus();
      return;
    }

    HELP.orders.ship(id, courier, tracking);
    openShipFor = null;
    HELP.toast('已发货：' + courier + ' ' + tracking);
    renderAll();
  });

  function applyReview(id, state) {
    var isArt = reviewFilter.kind === 'artwork';
    var ok = isArt ? HELP.artworks.setReview(id, state) : HELP.messages.setReview(id, state);
    if (!ok) { HELP.toast('操作失败：未找到该条目'); return; }

    var text = { approved: '已通过', rejected: '已驳回', pending: '已退回待审核' }[state];
    HELP.toast(text);
    renderAll();
  }

  /* -------------------------------------------------------------- 启动 */

  if (isLoggedIn()) {
    showApp();
    activateTab(tabFromHash());
  } else {
    showGate();
  }
})();
