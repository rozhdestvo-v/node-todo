const $ = (selector) => document.querySelector(selector);
let token = '';
let tasks = [];
let filter = 'all';
let runId = 'manual';
let selectedId = null;
let busy = false;
let messageTimer;
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
function message(text, error = false) {
  clearTimeout(messageTimer);
  const node = $('#message'); node.textContent = text; node.classList.toggle('error', error); node.hidden = false;
  messageTimer = setTimeout(() => { node.hidden = true; }, error ? 10000 : 4500);
}
function logout() {
  token = ''; tasks = []; selectedId = null;
  $('#workspace').hidden = true; $('#login-panel').hidden = false;
  $('#token').value = ''; $('#token').type = 'password';
  $('#reveal').textContent = 'Показать'; $('#reveal').setAttribute('aria-pressed', 'false');
  $('#tasks').replaceChildren(); $('#full-name').textContent = ''; $('#author-login').textContent = '';
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  $('#token').focus();
}
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api' + path, { ...options, signal: controller.signal, cache: 'no-store', headers: {
      Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }});
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({ error: 'Сервер вернул неожиданный ответ' }));
    if (!response.ok) {
      if (response.status === 401) logout();
      throw new Error(data.error || `Ошибка HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Сервер не ответил вовремя. Проверьте актуальное состояние кнопкой «Обновить».');
    if (error instanceof TypeError) throw new Error('Не удалось связаться с сервером. Проверьте подключение.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function action(work) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  document.querySelectorAll('#tasks input').forEach(b => { b.disabled = true; });
  $('#workspace').setAttribute('aria-busy', 'true');
  try { await work(); } catch (error) { message(error.message, true); }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => { b.disabled = false; });
    document.querySelectorAll('#tasks input').forEach(b => { b.disabled = false; });
    $('#workspace').setAttribute('aria-busy', 'false');
  }
}
function titleValue(input) {
  const title = input.value.trim();
  if ([...title].length < 1 || [...title].length > 200) throw new Error('Название должно содержать от 1 до 200 символов.');
  return title;
}
function render() {
  const done = tasks.filter(t => t.done).length;
  $('#count-all').textContent = tasks.length; $('#count-active').textContent = tasks.length - done; $('#count-done').textContent = done;
  $('#progress-text').textContent = `${done} из ${tasks.length} завершено`;
  $('#progress').max = Math.max(tasks.length, 1); $('#progress').value = done;
  const visible = tasks.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  $('#list-summary').textContent = `Показано: ${visible.length}`;
  $('#space-label').textContent = runId;
  $('#empty').hidden = visible.length !== 0;
  $('#tasks').replaceChildren();
  for (const task of visible) {
    const item = document.createElement('li'); item.className = 'task' + (task.done ? ' done' : '');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done; checkbox.disabled = busy;
    checkbox.setAttribute('aria-label', `Отметка выполнения: ${task.title}`);
    checkbox.addEventListener('change', () => {
      checkbox.checked = task.done;
      action(async () => {
        const updated = await api(`/tasks/${task.id}/`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) });
        tasks = tasks.map(t => t.id === updated.id ? updated : t); render();
      });
    });
    const copy = document.createElement('div'); copy.className = 'task-copy';
    const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title;
    const meta = document.createElement('div'); meta.className = 'task-meta';
    const date = new Date(task.createdAt);
    meta.textContent = `${task.done ? 'Завершено' : 'В процессе'} · ${Number.isNaN(date.getTime()) ? task.createdAt : dateFormat.format(date)}`;
    copy.append(title, meta);
    const buttons = document.createElement('div'); buttons.className = 'task-actions';
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Изменить'; edit.disabled = busy;
    edit.setAttribute('aria-label', `Изменить: ${task.title}`);
    edit.addEventListener('click', () => { selectedId = task.id; $('#edit-title').value = task.title; $('#edit-dialog').showModal(); $('#edit-title').focus(); });
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Удалить'; remove.disabled = busy;
    remove.setAttribute('aria-label', `Удалить: ${task.title}`);
    remove.addEventListener('click', () => { selectedId = task.id; $('#delete-title').textContent = task.title; $('#delete-dialog').showModal(); $('#cancel-delete').focus(); });
    buttons.append(edit, remove); item.append(checkbox, copy, buttons); $('#tasks').append(item);
  }
}
async function load(nextRun = runId) {
  const result = await api(`/tasks/?runId=${encodeURIComponent(nextRun)}`);
  tasks = result; runId = nextRun; render();
}
$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => {
    token = $('#token').value.trim();
    try {
      const author = await api('/author/');
      $('#full-name').textContent = author.fullName; $('#author-login').textContent = '@' + author.login;
      $('#avatar').textContent = author.fullName.split(/\s+/).slice(0, 2).map(s => s[0]).join('');
      await load();
      $('#token').value = ''; $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#new-title').focus();
    } catch (error) { logout(); throw error; }
  });
});
$('#logout').addEventListener('click', logout);
$('#reveal').addEventListener('click', () => { const show = $('#token').type === 'password'; $('#token').type = show ? 'text' : 'password'; $('#reveal').textContent = show ? 'Скрыть' : 'Показать'; $('#reveal').setAttribute('aria-pressed', String(show)); });
$('#run-form').addEventListener('submit', event => {
  event.preventDefault(); action(async () => {
    const value = $('#run-id').value;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('Некорректный runId');
    await load(value); message('Пространство открыто');
  });
});
$('#refresh').addEventListener('click', () => action(async () => { await load(); message('Данные обновлены из БД'); }));
$('#add-form').addEventListener('submit', event => {
  event.preventDefault(); action(async () => {
    const title = titleValue($('#new-title'));
    const created = await api('/tasks/', { method: 'POST', body: JSON.stringify({ title, runId }) });
    tasks.unshift(created); $('#new-title').value = ''; render(); message('Дело добавлено'); $('#new-title').focus();
  });
});
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { const active = b === button; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); }); render();
});
$('#edit-form').addEventListener('submit', event => {
  event.preventDefault(); action(async () => {
    const title = titleValue($('#edit-title'));
    const updated = await api(`/tasks/${selectedId}/`, { method: 'PATCH', body: JSON.stringify({ title }) });
    tasks = tasks.map(t => t.id === updated.id ? updated : t); $('#edit-dialog').close(); render(); message('Изменения сохранены');
  });
});
$('#delete-form').addEventListener('submit', event => {
  event.preventDefault(); action(async () => {
    await api(`/tasks/${selectedId}/`, { method: 'DELETE' }); tasks = tasks.filter(t => t.id !== selectedId);
    $('#delete-dialog').close(); render(); message('Дело удалено');
  });
});
$('#cancel-edit').addEventListener('click', () => $('#edit-dialog').close());
$('#cancel-delete').addEventListener('click', () => $('#delete-dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
