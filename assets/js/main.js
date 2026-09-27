/* ==========================================================================
   HELPing · 全站通用交互
   顶栏 / 移动端抽屉 / 滚动显现 / 跑马灯 / 购物车抽屉
   ========================================================================== */

(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------- 顶栏 + 抽屉 */

  function initHeader() {
    var header = $('[data-header]');
    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-stuck', window.scrollY > 8);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    var burger = $('[data-burger]');
    var drawer = $('[data-drawer]');
    if (!burger || !drawer) return;

    var setOpen = function (open) {
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      drawer.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
    };

    burger.addEventListener('click', function () {
      setOpen(!drawer.classList.contains('is-open'));
    });

    $$('a', drawer).forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080) setOpen(false);
    });
  }

  /* ------------------------------------------------------------ 滚动显现 */

  function initReveal() {
    var els = $$('[data-reveal]');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
        setTimeout(function () { el.classList.add('is-in'); }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------------------- 跑马灯 */

  function initMarquee() {
    $$('[data-marquee]').forEach(function (track) {
      // 复制一份内容，让 translateX(-50%) 的循环无缝衔接
      track.innerHTML = track.innerHTML + track.innerHTML;
    });
  }

  /* ------------------------------------------------------------ 购物车抽屉 */

  function initCart() {
    var panel = $('[data-cart-panel]');
    if (!panel) return;

    var scrim = $('[data-scrim]');
    var body = $('[data-cart-body]');
    var foot = $('[data-cart-foot]');
    var hint = $('[data-cart-hint]');

    function open() {
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      if (scrim) scrim.classList.add('is-open');
      document.body.classList.add('is-locked');
    }

    function close() {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      if (scrim) scrim.classList.remove('is-open');
      document.body.classList.remove('is-locked');
    }

    function render() {
      var lines = HELP.cart.items();
      HELP.syncBadge();

      if (hint) {
        hint.textContent = lines.length
          ? lines.reduce(function (n, l) { return n + l.qty; }, 0) + ' 件商品'
          : '还没有加入商品';
      }

      if (!lines.length) {
        /* 商品全量下架后，这里不能再引导「去商店挑一件」——那边现在是空的。 */
        body.innerHTML = '<div class="empty-state">购物车是空的。<br>文创周边暂未开售，先去看看孩子们的作品吧。</div>';
        if (foot) foot.hidden = true;
        return;
      }

      body.innerHTML = lines.map(function (line) {
        var p = line.product;
        return '' +
          '<div class="cart-line" data-line="' + p.id + '">' +
            '<div class="cart-line__img"><img src="' + p.image + '" alt="" loading="lazy"></div>' +
            '<div>' +
              '<div class="cart-line__top">' +
                '<div class="cart-line__name">' + HELP.escapeHtml(p.name) + '</div>' +
                '<div class="cart-line__price">' + HELP.money(p.price * line.qty) + '</div>' +
              '</div>' +
              '<div class="cart-line__bottom">' +
                '<span class="qty qty--sm">' +
                  '<button type="button" data-cart-dec="' + p.id + '" aria-label="减少数量">&minus;</button>' +
                  '<span>' + line.qty + '</span>' +
                  '<button type="button" data-cart-inc="' + p.id + '" aria-label="增加数量">+</button>' +
                '</span>' +
                '<button type="button" class="cart-line__rm" data-cart-rm="' + p.id + '">移除</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      }).join('');

      if (foot) {
        foot.hidden = false;
        foot.innerHTML = '' +
          '<div class="cart-total"><span>合计</span><b>' + HELP.money(HELP.cart.subtotal()) + '</b></div>' +
          '<div class="tiny muted">收益的 30% 将以酬劳形式支付给作品创作者。</div>' +
          '<button type="button" class="btn btn--block" data-cart-checkout>去结算</button>' +
          '<div class="tiny muted" style="text-align:center">演示环境：未接入真实支付通道</div>';
      }
    }

    /* 第一步：填收货信息。没有收货信息，后台的「发货管理」就是空的。 */
    function openCheckoutForm() {
      var lines = HELP.cart.items();
      if (!lines.length) { HELP.toast('购物车是空的'); return; }

      var units = lines.reduce(function (n, l) { return n + l.qty; }, 0);
      body.innerHTML = '' +
        '<form class="cart-checkout" data-cart-form novalidate>' +
          '<div class="eyebrow eyebrow--plain">CHECKOUT</div>' +
          '<div class="h4" style="margin:10px 0 6px">填写收货信息</div>' +
          '<p class="tiny muted" style="margin-bottom:18px">' +
            units + ' 件商品 · 合计 ' + HELP.money(HELP.cart.subtotal()) +
          '</p>' +
          '<div class="field">' +
            '<label class="field__label" for="ck-name">收货人 <span class="field__req">*</span></label>' +
            '<input class="input" id="ck-name" name="name" type="text" maxlength="20" autocomplete="name" placeholder="请输入姓名">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="ck-phone">手机号 <span class="field__req">*</span></label>' +
            '<input class="input" id="ck-phone" name="phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="用于接收物流通知">' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="ck-addr">收货地址 <span class="field__req">*</span></label>' +
            '<textarea class="textarea" id="ck-addr" name="address" rows="3" maxlength="120" style="min-height:84px" placeholder="省 / 市 / 区 + 详细地址"></textarea>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="ck-note">备注</label>' +
            '<input class="input" id="ck-note" name="note" type="text" maxlength="60" placeholder="选填，例如包装要求">' +
          '</div>' +
          '<p class="tiny" data-cart-form-msg style="min-height:18px"></p>' +
          '<button class="btn btn--block" type="submit">提交订单</button>' +
          '<button class="btn btn--ghost btn--block" type="button" data-cart-back style="margin-top:8px">返回购物车</button>' +
          '<p class="tiny muted" style="text-align:center;margin-top:10px">演示环境：未接入真实支付通道</p>' +
        '</form>';

      if (foot) foot.hidden = true;
      if (hint) hint.textContent = '待填写收货信息';
      var first = body.querySelector('#ck-name');
      if (first) first.focus();
    }

    /* 第二步：校验 -> 建单 -> 清空购物车 */
    function placeOrder(formEl) {
      var fd = new FormData(formEl);
      var name = String(fd.get('name') || '').trim();
      var phone = String(fd.get('phone') || '').trim();
      var address = String(fd.get('address') || '').trim();
      var note = String(fd.get('note') || '').trim();
      var msgEl = formEl.querySelector('[data-cart-form-msg]');

      function fail(text, focusSel) {
        if (msgEl) { msgEl.textContent = text; msgEl.style.color = 'var(--clay)'; }
        var el = formEl.querySelector(focusSel);
        if (el) el.focus();
      }

      if (!name) return fail('请填写收货人姓名。', '#ck-name');
      if (!/^[\d\s()+\-]{7,20}$/.test(phone)) {
        return fail('请填写有效的手机号（7–20 位数字）。', '#ck-phone');
      }
      if (address.length < 6) return fail('收货地址太短了，请写详细一些。', '#ck-addr');

      var lines = HELP.cart.items();
      if (!lines.length) { HELP.toast('购物车是空的'); render(); return; }

      var order = HELP.orders.create({
        items: lines,
        total: HELP.cart.subtotal(),
        buyer: { name: name, phone: phone, address: address },
        note: note
      });

      HELP.cart.clear();

      body.innerHTML = '' +
        '<div style="padding:26px 0;text-align:center">' +
          '<div class="eyebrow eyebrow--plain" style="justify-content:center">ORDER PLACED</div>' +
          '<div class="h3" style="margin-top:14px">下单成功</div>' +
          '<p class="small muted" style="margin-top:12px">订单号 ' + HELP.escapeHtml(order.no) + '<br>' +
            '应付 ' + HELP.money(order.total) + ' · ' + HELP.escapeHtml(HELP.orders.statusLabel(order.status)) + '</p>' +
          '<p class="tiny muted" style="margin-top:16px">这是演示流程，未产生真实交易。<br>' +
            '订单已进入后台「发货管理」，正式上线后将接入微信支付。</p>' +
          '<button type="button" class="btn btn--ghost btn--sm" style="margin-top:20px" data-cart-continue>继续逛逛</button>' +
        '</div>';

      if (foot) foot.hidden = true;
      if (hint) hint.textContent = '下单完成';
      HELP.syncBadge();
      HELP.toast('订单已提交：' + order.no);
    }

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cart-open]') : null;
      if (t) { e.preventDefault(); render(); open(); return; }

      if (e.target.closest && e.target.closest('[data-cart-close]')) { close(); return; }

      var inc = e.target.closest && e.target.closest('[data-cart-inc]');
      if (inc) {
        var id = inc.getAttribute('data-cart-inc');
        var cur = HELP.cart.raw().filter(function (l) { return l.id === id; })[0];
        HELP.cart.setQty(id, (cur ? cur.qty : 0) + 1);
        render();
        return;
      }

      var dec = e.target.closest && e.target.closest('[data-cart-dec]');
      if (dec) {
        var id2 = dec.getAttribute('data-cart-dec');
        var cur2 = HELP.cart.raw().filter(function (l) { return l.id === id2; })[0];
        HELP.cart.setQty(id2, (cur2 ? cur2.qty : 0) - 1);
        render();
        return;
      }

      var rm = e.target.closest && e.target.closest('[data-cart-rm]');
      if (rm) { HELP.cart.remove(rm.getAttribute('data-cart-rm')); render(); return; }

      if (e.target.closest && e.target.closest('[data-cart-checkout]')) { openCheckoutForm(); return; }
      if (e.target.closest && e.target.closest('[data-cart-back]')) { render(); return; }
      if (e.target.closest && e.target.closest('[data-cart-continue]')) { close(); return; }
    });

    // 收货信息表单是动态插入的，所以用委托监听 submit
    document.addEventListener('submit', function (e) {
      var f = e.target.closest && e.target.closest('[data-cart-form]');
      if (!f) return;
      e.preventDefault();
      placeOrder(f);
    });

    if (scrim) scrim.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    // 其它页面加入购物车后，同步刷新
    window.addEventListener('ph:cart-changed', render);
    render();
  }

  /* ------------------------------------------------------------- 页脚年份 */

  function initYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------------------------------------------------------------- 启动 */

  function boot() {
    initHeader();
    initReveal();
    initMarquee();
    initCart();
    initYear();
    HELP.syncBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
