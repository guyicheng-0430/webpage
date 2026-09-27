/* ==========================================================================
   HELPing · 上传作品页
   本地选图 -> 压缩 -> 表单校验 -> 存入本地数据层 -> 展示「我的上传」
   ========================================================================== */

(function () {
  'use strict';

  var form = document.getElementById('uploadForm');
  if (!form) return;

  var dz = form.querySelector('[data-dropzone]');
  var input = form.querySelector('[data-file-input]');
  var preview = form.querySelector('[data-preview]');
  var fileHint = form.querySelector('[data-file-hint]');
  var msg = form.querySelector('[data-form-msg]');
  var myGrid = document.querySelector('[data-my-uploads]');

  var MAX = 6;
  var picked = []; // { id, dataUrl, name, size }
  var skipResetMsg = false; // 提交成功后由代码触发的 reset，不应清掉成功提示

  /* ------------------------------------------------------------ 提示信息 */

  function setMsg(text, ok) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.style.color = ok ? 'var(--sage)' : 'var(--clay)';
  }

  function refreshHint() {
    if (!fileHint) return;
    fileHint.textContent = picked.length
      ? '已选择 ' + picked.length + ' 张，还可添加 ' + (MAX - picked.length) + ' 张'
      : '尚未选择图片';
  }

  /* -------------------------------------------------------------- 渲染预览 */

  function renderPreview() {
    if (!preview) return;
    preview.innerHTML = picked.map(function (f, i) {
      return '' +
        '<div class="preview">' +
          '<img src="' + f.dataUrl + '" alt="预览图 ' + (i + 1) + '">' +
          '<button class="preview__x" type="button" data-remove="' + f.id + '" aria-label="移除这张图片">&times;</button>' +
        '</div>';
    }).join('');
    refreshHint();
  }

  /* -------------------------------------------------------------- 收文件 */

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;

    var room = MAX - picked.length;
    if (room <= 0) { HELP.toast('最多上传 ' + MAX + ' 张图片'); return; }

    var accepted = [];
    files.slice(0, room).forEach(function (f) {
      if (!/^image\//.test(f.type)) { HELP.toast('「' + f.name + '」不是图片文件，已跳过'); return; }
      accepted.push(f);
    });
    if (files.length > room) HELP.toast('已到达上限，仅添加前 ' + room + ' 张');

    setMsg('正在处理图片…', true);

    Promise.all(accepted.map(function (f) {
      return HELP.fileToDataUrl(f, 1280, 0.82).then(function (dataUrl) {
        return { id: HELP.uid('img'), dataUrl: dataUrl, name: f.name, size: f.size };
      }).catch(function () { return null; });
    })).then(function (list) {
      list.filter(Boolean).forEach(function (item) { picked.push(item); });
      renderPreview();
      setMsg(list.filter(Boolean).length + ' 张图片已就绪，请继续填写作品信息。', true);
    });
  }

  /* ------------------------------------------------------------ dropzone */

  if (dz && input) {
    dz.addEventListener('click', function () { input.click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    input.addEventListener('change', function () {
      addFiles(input.files);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        dz.classList.add('is-drag');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) {
        e.preventDefault();
        if (ev === 'dragleave' && dz.contains(e.relatedTarget)) return;
        dz.classList.remove('is-drag');
      });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });
  }

  if (preview) {
    preview.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (!btn) return;
      var id = btn.getAttribute('data-remove');
      picked = picked.filter(function (f) { return f.id !== id; });
      renderPreview();
    });
  }

  /* ---------------------------------------------------------------- 提交 */

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!picked.length) {
      setMsg('请至少上传一张作品图片。', false);
      if (dz) dz.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var fd = new FormData(form);
    var title = String(fd.get('title') || '').trim();
    var category = String(fd.get('category') || '').trim();
    var author = String(fd.get('author') || '').trim();

    if (!title) { setMsg('请填写作品名称。', false); form.title.focus(); return; }
    if (!category) { setMsg('请选择作品类型。', false); form.category.focus(); return; }
    if (!author) { setMsg('请填写创作者昵称。', false); form.author.focus(); return; }
    if (!fd.get('own')) { setMsg('请勾选「作品为原创」的确认项。', false); return; }

    var tags = String(fd.get('tags') || '')
      .split(/[,，、]/)
      .map(function (t) { return t.trim(); })
      .filter(Boolean)
      .slice(0, 6);

    var ageRaw = String(fd.get('age') || '').trim();
    var age = ageRaw ? Math.max(3, Math.min(18, parseInt(ageRaw, 10) || 0)) || '' : '';

    var item = {
      id: HELP.uid('art'),
      seed: false,
      image: picked[0].dataUrl,       // 主图
      images: picked.map(function (f) { return f.dataUrl; }),
      title: title,
      category: category,
      author: author,
      age: age,
      school: String(fd.get('school') || '').trim(),
      medium: String(fd.get('medium') || '').trim(),
      story: String(fd.get('story') || '').trim(),
      tags: tags,
      license: !!fd.get('license'),
      display: !!fd.get('display'),
      status: fd.get('license') ? '开放授权' : '待确认授权',
      review: HELP.review.PENDING,    // 审核状态：后台通过后才进入公开画廊
      createdAt: new Date().toISOString().slice(0, 10)
    };

    var ok = HELP.artworks.add(item);
    if (!ok) { setMsg('保存失败：本地存储空间不足。', false); return; }

    skipResetMsg = true;   // 必须在 reset() 之前置位：reset 事件是同步派发的
    form.reset();
    picked = [];
    renderPreview();
    setMsg('提交成功！作品已进入待审核列表，可在下方「我上传的作品」查看。', true);
    HELP.toast('作品已提交，感谢你让一份才华被看见');

    renderMine();
    var mine = document.getElementById('mine');
    if (mine) mine.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  form.addEventListener('reset', function () {
    if (skipResetMsg) { skipResetMsg = false; return; }
    setTimeout(function () {
      picked = [];
      renderPreview();
      setMsg('');
    }, 0);
  });

  /* ----------------------------------------------------------- 我的上传 */

  function renderMine() {
    if (!myGrid) return;
    var mine = HELP.artworks.uploads();

    if (!mine.length) {
      myGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1">还没有上传过作品。提交后会显示在这里。</div>';
      return;
    }

    myGrid.innerHTML = mine.map(function (a) {
      var meta = [a.category, a.medium, a.age ? a.age + ' 岁' : ''].filter(Boolean).join(' · ');
      var tag = (a.tags || [])[0];
      return '' +
        '<article class="card">' +
          '<div class="art__wrap">' +
            '<div class="card__media"><img src="' + a.image + '" alt="' + HELP.escapeHtml(a.title) + '" loading="lazy"></div>' +
            '<span class="art__badge">' + HELP.escapeHtml(a.status || '待审核') + '</span>' +
          '</div>' +
          '<div class="card__body">' +
            '<div class="card__kicker">' + HELP.escapeHtml(a.createdAt || '') + '</div>' +
            '<div class="h4" style="margin-top:8px">' + HELP.escapeHtml(a.title) + '</div>' +
            '<div class="art__meta">' + HELP.escapeHtml(a.author) + (meta ? ' · ' + HELP.escapeHtml(meta) : '') + '</div>' +
            (tag ? '<div class="art__tags"><span class="tag tag--sage">' + HELP.escapeHtml(tag) + '</span></div>' : '') +
            '<div style="margin-top:16px">' +
              '<button class="link-arrow small" type="button" data-del="' + a.id + '" style="color:var(--ink-3)">删除这件作品</button>' +
            '</div>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  if (myGrid) {
    myGrid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      var id = btn.getAttribute('data-del');
      if (!window.confirm('确定要删除这件作品吗？此操作不可撤销。')) return;
      HELP.artworks.remove(id);
      renderMine();
      HELP.toast('已删除');
    });
  }

  renderPreview();
  renderMine();
})();
