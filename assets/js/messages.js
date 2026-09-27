/* ==========================================================================
   HELPing · 留言墙
   表单提交 / 便签墙渲染 / 点赞 / 排序
   ========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('msgForm');
  var wall = document.querySelector('[data-wall]');
  var emptyEl = document.querySelector('[data-wall-empty]');
  var totalEl = document.querySelector('[data-total]');
  var targetSel = document.querySelector('[data-target]');
  var counter = document.querySelector('[data-counter]');
  var msg = document.querySelector('[data-form-msg]');
  var tone = 'sage';
  var sort = 'new';

  /* -------------------------------------------------------- 收件人下拉 */

  function buildTargets() {
    if (!targetSel) return;
    var authors = [];
    HELP.artworks.published().forEach(function (a) {
      if (a.author && authors.indexOf(a.author) === -1) authors.push(a.author);
    });

    var html = '<option value="全体创作者">全体创作者</option>';
    authors.forEach(function (name) {
      html += '<option value="' + HELP.escapeHtml(name) + '">' + HELP.escapeHtml(name) + '</option>';
    });
    targetSel.innerHTML = html;
  }

  /* ------------------------------------------------------------ 渲染墙 */

  function noteHtml(m) {
    var liked = HELP.messages.isLiked(m.id);
    var likes = (m.likes || 0) + (liked ? 1 : 0);
    var t = m.tone || 'sage';
    var pending = HELP.review.of(m) === HELP.review.PENDING;

    return '' +
      '<article class="note note--' + t + (pending ? ' is-pending' : '') + '">' +
        (m.target && m.target !== '全体创作者'
          ? '<div class="tiny muted" style="margin-bottom:12px">致 ' + HELP.escapeHtml(m.target) + '</div>'
          : '') +
        (pending ? '<span class="note__review">待审核</span>' : '') +
        '<p class="note__text">' + HELP.escapeHtml(m.text) + '</p>' +
        '<div class="note__foot">' +
          '<span><span class="note__who">' + HELP.escapeHtml(m.name || '匿名') + '</span>' +
            (m.role ? ' · ' + HELP.escapeHtml(m.role) : '') +
            '<br><span style="opacity:.75">' + HELP.escapeHtml(m.createdAt || '') + '</span></span>' +
          '<button class="note__like' + (liked ? ' is-on' : '') + '" type="button" data-like="' + m.id + '" aria-pressed="' + liked + '">' +
            '<svg viewBox="0 0 20 20" fill="' + (liked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' +
              '<path d="M10 16.5S3.2 12.4 3.2 7.9A3.7 3.7 0 0 1 10 6a3.7 3.7 0 0 1 6.8 1.9c0 4.5-6.8 8.6-6.8 8.6Z" stroke-linejoin="round"/>' +
            '</svg>' + likes +
          '</button>' +
        '</div>' +
      '</article>';
  }

  function render() {
    if (!wall) return;
    /* visible() = 演示留言 + 本机提交且未被驳回的留言（被驳回的立即撤下） */
    var list = HELP.messages.visible().slice();

    if (sort === 'hot') {
      list.sort(function (a, b) { return (b.likes || 0) - (a.likes || 0); });
    } else {
      list.sort(function (a, b) {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    }

    wall.innerHTML = list.map(noteHtml).join('');
    if (emptyEl) emptyEl.hidden = list.length > 0;
    if (totalEl) totalEl.textContent = '已收到 ' + list.length + ' 条';
  }

  /* -------------------------------------------------------------- 事件 */

  var tones = document.querySelector('[data-tones]');
  if (tones) {
    tones.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-tone]');
      if (!chip) return;
      tone = chip.getAttribute('data-tone');
      Array.prototype.forEach.call(tones.children, function (c) {
        c.classList.toggle('is-active', c === chip);
      });
    });
  }

  var textEl = document.getElementById('m-text');
  if (textEl && counter) {
    textEl.addEventListener('input', function () {
      counter.textContent = textEl.value.length;
    });
  }

  var sortBar = document.querySelector('[data-sort]') && document.querySelectorAll('[data-sort]');
  if (sortBar) {
    Array.prototype.forEach.call(sortBar, function (btn) {
      btn.addEventListener('click', function () {
        sort = btn.getAttribute('data-sort');
        Array.prototype.forEach.call(sortBar, function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        render();
      });
    });
  }

  if (wall) {
    wall.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-like]');
      if (!btn) return;
      HELP.messages.toggleLike(btn.getAttribute('data-like'));
      render();
    });
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var name = String(fd.get('name') || '').trim();
      var text = String(fd.get('text') || '').trim();

      function setMsg(t, ok) {
        if (!msg) return;
        msg.textContent = t;
        msg.style.color = ok ? 'var(--sage)' : 'var(--clay)';
      }

      if (!name) { setMsg('请填写你的称呼，或直接写「匿名」。', false); form.name.focus(); return; }
      if (text.length < 4) { setMsg('留言太短了，再多写几个字吧。', false); form.text.focus(); return; }
      if (/\d{6,}/.test(text) || /(微信|qq|电话|手机|地址)/i.test(text)) {
        setMsg('留言中似乎包含联系方式，请去掉后再提交。', false);
        return;
      }

      HELP.messages.add({
        id: HELP.uid('msg'),
        name: name,
        role: String(fd.get('role') || '').trim(),
        target: String(fd.get('target') || '全体创作者'),
        text: text,
        tone: tone,
        likes: 0,
        review: HELP.review.PENDING,   // 默认待审核，后台通过后才算正式上墙
        createdAt: new Date().toISOString().slice(0, 10)
      });

      form.reset();
      if (counter) counter.textContent = '0';
      setMsg('留言已贴上墙。谢谢你写下的这句话。', true);
      HELP.toast('留言已发布');

      sort = 'new';
      var sortBtns = document.querySelectorAll('[data-sort]');
      Array.prototype.forEach.call(sortBtns, function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-sort') === 'new');
      });
      render();

      var anchor = document.querySelector('[data-wall]');
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    form.addEventListener('reset', function () {
      setTimeout(function () {
        if (counter) counter.textContent = '0';
        if (msg) msg.textContent = '';
      }, 0);
    });
  }

  buildTargets();
  render();
})();
