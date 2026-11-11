const API = "/api/v1";
const LLM_KEY_STORAGE = "mindflow.llmKey";

function readLocalLlmKey() {
  try {
    return (localStorage.getItem(LLM_KEY_STORAGE) || "").trim();
  } catch (ignored) {
    return "";
  }
}

function saveLocalLlmKey(value) {
  try {
    localStorage.setItem(LLM_KEY_STORAGE, value);
  } catch (ignored) {
    // 存储不可用时本次请求仍可用，刷新后需重填
  }
}

const els = {
  picker: document.getElementById("doc-picker"),
  pickerName: document.getElementById("doc-picker-name"),
  fileInput: document.getElementById("doc-file-input"),
  realList: document.getElementById("doc-real-list"),
  docEmpty: document.getElementById("doc-empty"),
  searchInput: document.getElementById("doc-search"),
  activeName: document.getElementById("doc-active-name"),
  analyzeState: document.getElementById("doc-analyze-state"),
  analyzeBtn: document.getElementById("doc-analyze-btn"),
  analyzeResult: document.getElementById("doc-analyze-result"),
  analyzeHint: document.getElementById("doc-analyze-hint"),
  docSkill: document.getElementById("doc-skill"),
  llmBaseUrl: document.getElementById("llm-base-url"),
  llmApiKey: document.getElementById("llm-api-key"),
  llmModel: document.getElementById("llm-model"),
  llmSkill: document.getElementById("llm-skill"),
  llmPrompt: document.getElementById("llm-prompt"),
  llmSave: document.getElementById("llm-save"),
  llmTest: document.getElementById("llm-test"),
  llmStatus: document.getElementById("llm-status"),
  llmMessage: document.getElementById("llm-message"),
  tasksRoot: document.getElementById("doc-tasks"),
  tasksProgress: document.getElementById("doc-tasks-progress"),
  tasksGenerate: document.getElementById("doc-tasks-generate"),
  tasksList: document.getElementById("doc-tasks-list"),
  tasksReader: document.getElementById("doc-tasks-reader"),
  tasksReaderTitle: document.getElementById("doc-tasks-reader-title"),
  tasksReaderText: document.getElementById("doc-tasks-reader-text"),
  tasksClose: document.getElementById("doc-tasks-close"),
  tasksComplete: document.getElementById("doc-tasks-complete"),
  tasksReaderMeta: document.getElementById("doc-tasks-reader-meta"),
  tasksReaderHint: document.getElementById("doc-tasks-reader-hint"),
  tasksReaderFill: document.getElementById("doc-tasks-reader-fill")
};

let documents = [];
let skills = [];
let settings = null;
let activeDoc = null;
let documentsLoaded = false;
let skillsLoaded = false;
let settingsLoaded = false;
let documentsError = false;
let tasks = [];
let activeTaskId = null;
let tasksBusy = false;

const ACTIVE_DOC_KEY = "mindflow.activeDoc";
const DOC_TASK_KEY = "mindflow.docTask";
const FRAGMENT_KEY = "mindflow.docFragments";

const SKILL_FRAGMENT_LIMIT = {
  summary: 4,
  paper_review: 5,
  key_points: 7,
  terms: 10,
  critique: 4,
  custom: 6
};

if (els.picker && els.fileInput) {
  boot();
}

function boot() {
  els.picker.addEventListener("click", function () {
    els.fileInput.click();
  });
  els.fileInput.addEventListener("change", function () {
    uploadFile(els.fileInput.files && els.fileInput.files[0]);
  });

  if (els.analyzeBtn) els.analyzeBtn.addEventListener("click", analyze);
  if (els.llmSave) els.llmSave.addEventListener("click", saveSettings);
  if (els.llmTest) els.llmTest.addEventListener("click", testConnection);
  if (els.searchInput) els.searchInput.addEventListener("input", renderDocuments);
  if (els.tasksGenerate) els.tasksGenerate.addEventListener("click", generateTasks);
  if (els.tasksClose) els.tasksClose.addEventListener("click", closeReader);
  if (els.tasksComplete) els.tasksComplete.addEventListener("click", completeTask);
  if (els.tasksReaderText) els.tasksReaderText.addEventListener("scroll", updateReaderProgress);

  const modal = document.getElementById("fragment-modal");
  const modalGo = document.getElementById("fragment-modal-go");
  const modalClose = document.getElementById("fragment-modal-close");
  if (modalClose && modal) {
    modalClose.addEventListener("click", function () {
      modal.hidden = true;
    });
  }
  if (modalGo && modal) {
    modalGo.addEventListener("click", function () {
      modal.hidden = true;
      const first = tasks.find(function (task) { return task.status !== "LOCKED"; });
      if (first) openTask(first.id);
    });
  }

  watchPage();
  preloadFragments();

  const page = document.body.dataset.page;
  if (page === "docs" || page === "settings") loadFor(page);
}

async function loadFor(page) {
  if (page === "docs") {
    await loadDocuments();
    await loadSkills();
    restoreActiveDoc();
    if (activeDoc && tasks.length === 0) {
      await loadTasks(activeDoc.id);
    }
    const state = readFragments();
    // 以最近一次分析结果为准：玩完游戏回来必须还能看到收集进度
    if (state && Array.isArray(state.fragments) && state.fragments.length) {
      renderFragments(state);
      updateFragmentStatus(state);
    } else if (activeDoc) {
      restoreFragments(activeDoc.id);
    }
  }
  await loadSettings();
}

function preloadFragments() {
  const state = readFragments();
  if (!state || !Array.isArray(state.fragments) || !state.fragments.length) return;
  renderFragments(state);
  updateFragmentStatus(state);
}

function watchPage() {
  let lastPage = document.body.dataset.page;
  new MutationObserver(function () {
    const page = document.body.dataset.page;
    if (page === lastPage) return;
    lastPage = page;
    if (page === "docs" || page === "settings") loadFor(page);
  }).observe(document.body, { attributes: true, attributeFilter: ["data-page"] });
}

async function api(path, options) {
  const opts = Object.assign({}, options || {});
  const headers = Object.assign({}, opts.headers || {});
  const apiKey = readLocalLlmKey();
  if (apiKey) headers["X-Llm-Api-Key"] = apiKey;
  opts.headers = headers;
  const response = await fetch(API + path, opts);
  if (!response.ok) {
    let message = "HTTP " + response.status;
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch (ignored) {
      // 非 JSON 错误体，保留状态码
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function uploadFile(file) {
  if (!file) return;

  // 先回显文件名，上传失败也不会让用户以为没选中
  setPickerName(file.name);
  setAnalyzeState("上传中", "busy");
  els.analyzeHint.textContent = "正在上传并提取文本…";

  const form = new FormData();
  form.append("file", file);

  try {
    const doc = await api("/documents", { method: "POST", body: form });
    documents.unshift(doc);
    activeDoc = doc;
    persistActiveDoc(doc);
    documentsLoaded = true;
    documentsError = false;
    renderDocuments();
    updateActiveDoc();
    setAnalyzeState("已上传", "ok");
    els.analyzeHint.textContent = doc.analyzable
      ? "已提取 " + doc.textChars + " 字，选择 Skill 后即可分析。"
      : "已上传，但没有提取到文本（扫描版 PDF 暂不支持分析）。";
    showResult("");
    openDocsPage();
  } catch (error) {
    setAnalyzeState("未上传", "warn");
    els.analyzeHint.textContent = "文件名已回显；上传失败：" + friendlyError(error);
  } finally {
    els.fileInput.value = "";
  }
}

async function analyze() {
  if (!activeDoc) {
    setAnalyzeState("请先上传", "warn");
    els.analyzeHint.textContent = "点击右上角「选择文档」上传 PDF / TXT / MD 后再分析。";
    return;
  }
  if (!activeDoc.analyzable) {
    setAnalyzeState("无文本", "warn");
    els.analyzeHint.textContent = "该文档没有可分析的文本，请换一份可复制文本的文件。";
    return;
  }

  const skillCode = els.docSkill.value || "summary";
  setAnalyzeState("分析中", "busy");
  els.analyzeBtn.disabled = true;
  els.analyzeHint.textContent = "模型正在阅读文档，可能需要几秒到一分钟…";
  showResult("");

  try {
    const result = await api("/documents/" + encodeURIComponent(activeDoc.id) + "/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillCode: skillCode })
    });
    const state = buildFragmentState(activeDoc, skillCode, result);
    saveFragments(state);
    renderFragments(state);
    updateFragmentStatus(state);

    // 分析即拆段：一次分析同时产出阅读任务，不再要求手动点「生成任务」
    let taskCount = 0;
    try {
      const taskData = await api("/documents/" + activeDoc.id + "/tasks", { method: "POST" });
      tasks = taskData.tasks || [];
      taskCount = tasks.length;
      renderTasks(taskData);
    } catch (ignored) {
      // 分段失败不影响碎片结果
    }
    if (taskCount > 0) scheduleFragmentModal(taskCount);
  } catch (error) {
    setAnalyzeState("分析失败", "warn");
    els.analyzeHint.textContent = friendlyError(error);
  } finally {
    els.analyzeBtn.disabled = false;
  }
}

async function loadDocuments(force) {
  if (documentsLoaded && !force) return;
  try {
    documents = await api("/documents");
    documentsLoaded = true;
    documentsError = false;
    renderDocuments();
    restoreActiveDoc();
  } catch (error) {
    // 后端未启动时静默，文件名回显仍然可用
    documentsError = true;
    renderDocuments();
  }
}

async function loadSkills() {
  if (skillsLoaded) return;
  try {
    skills = await api("/skills");
    skillsLoaded = true;
    fillSkills(els.docSkill);
    fillSkills(els.llmSkill);
    if (settings && settings.skillCode) els.docSkill.value = settings.skillCode;
  } catch (error) {
    // 后端未启动时保留空下拉
  }
}

async function loadSettings(force) {
  if (settingsLoaded && !force) return;
  try {
    settings = await api("/llm/settings");
    settingsLoaded = true;
    applySettings();
  } catch (error) {
    if (els.llmStatus) {
      els.llmStatus.textContent = "后端未连接";
      els.llmStatus.dataset.tone = "warn";
    }
    if (els.llmMessage) els.llmMessage.textContent = "请先用 Spring Boot 启动 8080 端口";
  }
}

function applySettings() {
  if (!settings) return;
  els.llmBaseUrl.value = settings.baseUrl || "";
  els.llmModel.value = settings.model || "";
  els.llmPrompt.value = settings.customPrompt || "";
  if (settings.skillCode) {
    els.llmSkill.value = settings.skillCode;
    els.docSkill.value = settings.skillCode;
  }
  const localKey = readLocalLlmKey();
  setConnectionState(Boolean(settings.hasApiKey || localKey));
  els.llmApiKey.placeholder = localKey
    ? "已保存在本机，留空不修改"
    : "请输入 API Key（只保存在本机）";
  els.llmApiKey.value = "";
}

function setConnectionState(hasKey) {
  if (!els.llmStatus) return;
  els.llmStatus.textContent = hasKey ? "已配置" : "未配置 Key";
  els.llmStatus.dataset.tone = hasKey ? "ok" : "warn";
}

async function saveSettings() {
  const payload = {
    baseUrl: els.llmBaseUrl.value.trim(),
    model: els.llmModel.value.trim(),
    skillCode: els.llmSkill.value || "summary",
    customPrompt: els.llmPrompt.value
  };
  const apiKey = els.llmApiKey.value.trim();
  if (apiKey) saveLocalLlmKey(apiKey);

  els.llmSave.disabled = true;
  setMessage("保存中…", "busy");
  try {
    settings = await api("/llm/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    settingsLoaded = true;
    applySettings();
    setMessage(apiKey ? "已保存，Key 只存在这台浏览器" : "已保存", "ok");
  } catch (error) {
    setMessage(friendlyError(error), "warn");
  } finally {
    els.llmSave.disabled = false;
  }
}

async function testConnection() {
  els.llmTest.disabled = true;
  setMessage("测试中…", "busy");
  try {
    const result = await api("/llm/test", { method: "POST" });
    setConnectionState(true);
    setMessage(result.message + " · " + Math.round(result.durationMs) + " ms", "ok");
  } catch (error) {
    setMessage(friendlyError(error), "warn");
  } finally {
    els.llmTest.disabled = false;
  }
}

function renderDocuments() {
  if (!els.realList) return;

  const keyword = els.searchInput ? els.searchInput.value.trim().toLowerCase() : "";
  const visible = documents.filter(function (doc) {
    return !keyword || doc.name.toLowerCase().indexOf(keyword) !== -1;
  });

  els.realList.textContent = "";
  els.realList.hidden = visible.length === 0;

  visible.forEach(function (doc) {
    const item = document.createElement("li");
    item.className = "doc-item doc-item--real";
    if (activeDoc && activeDoc.id === doc.id) item.classList.add("is-selected");

    const icon = document.createElement("span");
    icon.className = "doc-item__icon doc-item__icon--mint";
    icon.textContent = "U";

    const body = document.createElement("span");
    body.className = "doc-item__body";
    const name = document.createElement("b");
    name.textContent = doc.name;
    const meta = document.createElement("small");
    meta.textContent = formatBytes(doc.sizeBytes) + " · "
      + (doc.analyzable ? doc.textChars + " 字" : "无可分析文本");
    body.appendChild(name);
    body.appendChild(meta);

    const tag = document.createElement("span");
    tag.className = "doc-item__tag" + (doc.analyzable ? "" : " doc-item__tag--mute");
    tag.textContent = doc.analyzable ? "可分析" : "仅存储";

    item.appendChild(icon);
    item.appendChild(body);
    item.appendChild(tag);
    item.addEventListener("click", function () {
      selectDocument(doc);
    });
    els.realList.appendChild(item);
  });

  if (els.docEmpty) {
    if (visible.length > 0) {
      els.docEmpty.hidden = true;
    } else {
      els.docEmpty.hidden = false;
      if (documents.length === 0) {
        els.docEmpty.textContent = documentsError
          ? "后端未连接，启动 8080 后这里会显示你的文档"
          : "还没有上传文档，点击右上角「选择文档」开始";
      } else {
        els.docEmpty.textContent = "没有匹配的文档";
      }
    }
  }
}

function selectDocument(doc) {
  activeDoc = doc;
  persistActiveDoc(doc);
  setPickerName(doc.name);
  renderDocuments();
  updateActiveDoc();
  setAnalyzeState("已选择", "ok");
  els.analyzeHint.textContent = doc.analyzable
    ? "已提取 " + doc.textChars + " 字，选择 Skill 后开始分析。"
    : "该文档没有提取到文本，无法分析。";
  loadTasks(doc.id);
  showResult("");
  restoreFragments(doc.id);
}

function setPickerName(name) {
  if (!els.pickerName) return;
  els.pickerName.textContent = name;
  els.pickerName.classList.remove("is-empty");
}

function updateActiveDoc() {
  if (!els.activeName) return;
  if (activeDoc) {
    els.activeName.textContent = activeDoc.name + " · " + formatBytes(activeDoc.sizeBytes);
    if (els.analyzeBtn) els.analyzeBtn.disabled = !activeDoc.analyzable;
  } else {
    els.activeName.textContent = "尚未选择文档";
    if (els.analyzeBtn) els.analyzeBtn.disabled = false;
  }
}


function fillSkills(select) {
  if (!select) return;
  select.textContent = "";
  skills.forEach(function (skill) {
    const option = document.createElement("option");
    option.value = skill.code;
    option.textContent = skill.name;
    option.title = skill.description || "";
    select.appendChild(option);
  });
  if (!select.value && skills.length) select.value = skills[0].code;
}

function setAnalyzeState(text, tone) {
  if (!els.analyzeState) return;
  els.analyzeState.textContent = text;
  els.analyzeState.dataset.tone = tone || "idle";
}

function setMessage(text, tone) {
  if (!els.llmMessage) return;
  els.llmMessage.textContent = text;
  els.llmMessage.dataset.tone = tone || "idle";
}

function showResult(text) {
  if (!els.analyzeResult) return;
  if (!text) {
    els.analyzeResult.hidden = true;
    els.analyzeResult.textContent = "";
    return;
  }
  els.analyzeResult.hidden = false;
  els.analyzeResult.textContent = text;
}

function openDocsPage() {
  const nav = document.querySelector('.nav__item[data-view="docs"]');
  if (nav) nav.click();
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / 1024 / 1024).toFixed(1) + " MB";
}

function friendlyError(error) {
  if (!error) return "未知错误";
  if (error.status === 401 || error.status === 403) return "API Key 无效，请到设置页检查";
  if (error.status === 413) return "文件超过 25MB 上限";
  if (error.status === 400 || error.status === 409) return error.message;
  if (!error.status) return "后端未连接，请用 Spring Boot 启动 8080 后重试";
  return error.message;
}
function readFragments() {
  try {
    const raw = localStorage.getItem(FRAGMENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (ignored) {
    return null;
  }
}

function saveFragments(state) {
  try {
    localStorage.setItem(FRAGMENT_KEY, JSON.stringify(state));
  } catch (ignored) {
    // 存储不可用时当前页仍可展示，刷新后需重新分析
  }
}

function normalizeFragmentText(text) {
  return String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFragments(text, skillCode) {
  const limit = SKILL_FRAGMENT_LIMIT[skillCode] || 6;
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let current = null;

  function flush() {
    if (current && normalizeFragmentText(current.text)) {
      blocks.push({
        title: normalizeFragmentText(current.title).slice(0, 16),
        text: normalizeFragmentText(current.text)
      });
    }
    current = null;
  }

  lines.forEach(function (raw) {
    const line = raw.trim();
    if (!line) {
      flush();
      return;
    }

    const heading = line.match(/^\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/) || line.match(/^#{1,4}\s+(.+)$/);
    const bullet = line.match(/^([-*]|\d+[.、)])\s+(.+)$/);

    if (heading) {
      flush();
      current = { title: heading[1], text: heading[2] || "" };
      return;
    }
    if (bullet) {
      flush();
      current = { title: "", text: bullet[2] };
      return;
    }
    if (current) {
      current.text += (current.text ? " " : "") + line;
    } else {
      current = { title: "", text: line };
    }
  });
  flush();

  if (blocks.length < 2) {
    const sentences = String(text || "").split(/(?<=[。！？.!?])\s*/).filter(Boolean);
    if (sentences.length >= 2) {
      blocks.length = 0;
      sentences.forEach(function (sentence) {
        blocks.push({ title: "", text: normalizeFragmentText(sentence) });
      });
    }
  }
  if (!blocks.length) {
    blocks.push({ title: "分析结果", text: normalizeFragmentText(text) || "模型没有返回可展示的内容" });
  }
  while (blocks.length > limit) {
    const last = blocks.pop();
    blocks[blocks.length - 1].text += " " + last.text;
  }

  return blocks.map(function (block, index) {
    return {
      index: index,
      title: block.title || ("第 " + (index + 1) + " 块"),
      text: block.text
    };
  });
}

function buildFragmentState(doc, skillCode, result) {
  return {
    documentId: doc ? doc.id : "",
    documentName: doc ? doc.name : "",
    skillCode: skillCode,
    skillName: result.skillName || "分析",
    model: result.model || "",
    createdAt: Date.now(),
    fragments: splitFragments(result.result, skillCode),
    collected: []
  };
}

function renderFragments(state) {
  const root = els.analyzeResult;
  if (!root) return;
  if (!state || !Array.isArray(state.fragments) || !state.fragments.length) {
    root.hidden = true;
    root.textContent = "";
    return;
  }

  root.hidden = false;
  root.textContent = "";
  const collected = new Set(state.collected || []);

  state.fragments.forEach(function (fragment) {
    const done = collected.has(fragment.index);
    const item = document.createElement("article");
    item.className = "doc-fragment" + (done ? " is-collected" : " is-locked");

    const head = document.createElement("div");
    head.className = "doc-fragment__head";

    const seq = document.createElement("span");
    seq.className = "doc-fragment__seq";
    seq.textContent = String(fragment.index + 1).padStart(2, "0");

    const title = document.createElement("b");
    title.className = "doc-fragment__title";
    title.textContent = fragment.title || ("第 " + (fragment.index + 1) + " 块");

    const tag = document.createElement("span");
    tag.className = "doc-fragment__state";
    tag.textContent = done ? "已收集" : "待收集";

    const body = document.createElement("p");
    body.className = "doc-fragment__text";
    body.textContent = done ? fragment.text : "下潜后吃金色任务鱼收集这一块";

    head.appendChild(seq);
    head.appendChild(title);
    head.appendChild(tag);
    item.appendChild(head);
    item.appendChild(body);
    root.appendChild(item);
  });
}

function updateFragmentStatus(state) {
  if (!state) return;
  const collected = (state.collected || []).length;
  const total = state.fragments.length;
  setAnalyzeState("分析完成 · " + collected + "/" + total, "ok");
  els.analyzeHint.textContent = (state.skillName || "分析")
    + " · 拆成 " + total + " 块 · 已收集 " + collected + " 块"
    + (collected < total ? "，去首页下潜补齐" : "，可整理成完整结果")
    + (state.model === "local" ? "（未配置 Key，本次为本地分段）" : "");
}

function restoreFragments(documentId) {
  const state = readFragments();
  if (!state || String(state.documentId) !== String(documentId)) {
    renderFragments(null);
    return;
  }
  renderFragments(state);
  updateFragmentStatus(state);
}

let fragmentModalTimer = 0;

function scheduleFragmentModal(count) {
  const modal = document.getElementById("fragment-modal");
  const countEl = document.getElementById("fragment-modal-count");
  if (!modal) return;
  if (countEl) countEl.textContent = String(count);
  if (fragmentModalTimer) window.clearTimeout(fragmentModalTimer);
  fragmentModalTimer = window.setTimeout(function () {
    if (document.body.dataset.page !== "docs") return;
    modal.hidden = false;
  }, 600);
}

window.addEventListener("mindflow:fragment-collected", function (event) {
  const detail = event.detail || {};
  const state = readFragments();
  if (!state || state.documentId !== detail.documentId) return;
  renderFragments(state);
  updateFragmentStatus(state);
});

function persistActiveDoc(doc) {
  if (!doc || !doc.id) return;
  try {
    localStorage.setItem(ACTIVE_DOC_KEY, JSON.stringify({ id: doc.id, name: doc.name || "" }));
  } catch (ignored) {
    // 存储不可用时仅影响下次打开页面后的恢复
  }
}

function restoreActiveDoc() {
  if (activeDoc) return;
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(ACTIVE_DOC_KEY) || "null");
  } catch (ignored) {
    return;
  }
  if (!stored || !stored.id) return;
  const doc = documents.find(function (item) { return item.id === stored.id; });
  if (doc) selectDocument(doc);
}

function taskGoal(chars) {
  return Math.max(4, Math.min(10, Math.round((Number(chars) || 0) / 120)));
}

function readStoredDocTask() {
  try {
    const raw = localStorage.getItem(DOC_TASK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (ignored) {
    return null;
  }
}

function publishDocTask(documentId, list) {
  const items = Array.isArray(list) ? list.slice() : [];
  const id = documentId || (activeDoc && activeDoc.id) || "";
  const documentName = activeDoc ? activeDoc.name || "" : "";
  let payload;

  if (items.length === 0) {
    payload = {
      status: "none",
      documentId: id,
      documentName: documentName,
      total: 0,
      completed: 0,
      eaten: 0
    };
  } else {
    const pending = items
      .filter(function (task) { return task.status !== "DONE"; })
      .sort(function (a, b) { return a.seq - b.seq; })[0];
    const completed = items.filter(function (task) { return task.status === "DONE"; }).length;

    if (!pending) {
      payload = {
        status: "done",
        documentId: id,
        documentName: documentName,
        total: items.length,
        completed: completed,
        eaten: 0
      };
    } else {
      const previous = readStoredDocTask();
      const eaten = previous && previous.status === "active"
        && previous.documentId === id
        && previous.seq === pending.seq
        ? Math.max(0, Number(previous.eaten) || 0)
        : 0;

      payload = {
        status: "active",
        documentId: id,
        documentName: documentName,
        seq: pending.seq,
        title: pending.title || ("第 " + pending.seq + " 段"),
        summary: pending.summary || "",
        chars: pending.chars || 0,
        goal: taskGoal(pending.chars),
        keywords: Array.isArray(pending.keywords) ? pending.keywords : [],
        eaten: eaten,
        total: items.length,
        completed: completed
      };
    }
  }

  try {
    localStorage.setItem(DOC_TASK_KEY, JSON.stringify(payload));
  } catch (ignored) {
    // 存储不可用时仍通过事件同步当前页
  }
  window.dispatchEvent(new CustomEvent("mindflow:doc-task", { detail: payload }));
}

async function loadTasks(documentId) {
  if (!els.tasksRoot || !documentId) return;
  els.tasksRoot.hidden = false;
  els.tasksGenerate.hidden = true;
  els.tasksProgress.textContent = "加载中…";
  els.tasksList.textContent = "";
  closeReader();
  try {
    const data = await api("/documents/" + documentId + "/tasks");
    tasks = data.tasks || [];
    renderTasks(data);
    await syncCollectedTasks(documentId);
  } catch (error) {
    tasks = [];
    els.tasksProgress.textContent = "任务不可用";
  }
}

async function syncCollectedTasks(documentId) {
  const target = tasks.find(function (task) {
    if (task.status !== "COLLECTING") return false;
    const keywords = Array.isArray(task.keywords) ? task.keywords : [];
    const collected = shardCollected(documentId, task.seq);
    return keywords.length > 0 && collected.length >= keywords.length;
  });
  if (!target) return;

  try {
    const data = await api(
      "/documents/" + documentId + "/tasks/" + target.id + "/collect",
      { method: "POST" }
    );
    tasks = data.tasks || [];
    renderTasks(data);
    els.tasksProgress.textContent = "第 " + target.seq + " 段已收集完成 · 已解锁下一段";
  } catch (ignored) {
    // 下次回到文档页再同步
  }
}


const SHARD_KEY = "mindflow.taskShards";

function readShardState() {
  try {
    return JSON.parse(localStorage.getItem(SHARD_KEY) || "null");
  } catch (ignored) {
    return null;
  }
}

function shardCollected(documentId, seq) {
  const state = readShardState();
  if (!state || String(state.documentId || "") !== String(documentId || "")) return [];
  if (Number(state.seq) !== Number(seq)) return [];
  return Array.isArray(state.collected) ? state.collected : [];
}

function renderTasks(data) {
  if (!els.tasksList) return;
  els.tasksList.textContent = "";
  const documentId = (data && data.documentId) || (activeDoc && activeDoc.id) || "";
  const list = (data && data.tasks) || tasks;
  const total = list.length;
  const completed = list.filter(function (task) { return task.status === "DONE"; }).length;

  if (total === 0) {
    els.tasksGenerate.hidden = false;
    els.tasksProgress.textContent = "尚未生成";
    publishDocTask((data && data.documentId) || (activeDoc && activeDoc.id), list);
    return;
  }
  els.tasksGenerate.hidden = true;
  els.tasksProgress.textContent = "已完成 " + completed + " / " + total
    + (data && data.source === "ai" ? " · AI 拆段" : "");

  list.forEach(function (task) {
    const item = document.createElement("li");
    item.className = "doc-task doc-task--" + String(task.status).toLowerCase();

    const seq = document.createElement("span");
    seq.className = "doc-task__seq";
    seq.textContent = String(task.seq).padStart(2, "0");

    const body = document.createElement("div");
    body.className = "doc-task__body";
    const title = document.createElement("b");
    title.textContent = task.title || ("第 " + task.seq + " 段");
    const summary = document.createElement("small");
    summary.textContent = (task.summary || "") + " · " + task.chars + " 字";
    body.appendChild(title);
    body.appendChild(summary);

    const keywords = Array.isArray(task.keywords) ? task.keywords : [];
    if (keywords.length) {
      const drops = document.createElement("span");
      drops.className = "doc-task__drops";
      const collected = shardCollected(documentId, task.seq);
      keywords.forEach(function (word, index) {
        const dot = document.createElement("i");
        dot.className = "doc-task__drop" + (collected.indexOf(index) >= 0 ? " is-on" : "");
        dot.title = word;
        drops.appendChild(dot);
      });
      body.appendChild(drops);
    }

    const state = document.createElement("span");
    state.className = "doc-task__state";
    state.textContent = task.status === "DONE" ? "已完成"
      : task.status === "COLLECTING" ? "待收集"
        : task.status === "READY" ? "可读" : "未解锁";

    item.appendChild(seq);
    item.appendChild(body);
    item.appendChild(state);

    if (task.status !== "LOCKED") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "doc-task__btn";
      btn.textContent = task.status === "DONE" ? "重读"
        : task.status === "COLLECTING" ? "再读" : "开始读";
      btn.addEventListener("click", function () {
        openTask(task.id);
      });
      item.appendChild(btn);
    }

    els.tasksList.appendChild(item);
  });
  publishDocTask((data && data.documentId) || (activeDoc && activeDoc.id), list);
}

async function generateTasks() {
  if (!activeDoc || tasksBusy) return;
  tasksBusy = true;
  els.tasksGenerate.disabled = true;
  els.tasksProgress.textContent = "正在拆段…";
  try {
    const data = await api("/documents/" + activeDoc.id + "/tasks", { method: "POST" });
    tasks = data.tasks || [];
    renderTasks(data);
  } catch (error) {
    els.tasksProgress.textContent = friendlyError(error);
  } finally {
    tasksBusy = false;
    els.tasksGenerate.disabled = false;
  }
}

async function openTask(taskId) {
  if (!activeDoc) return;
  activeTaskId = taskId;
  try {
    const data = await api("/documents/" + activeDoc.id + "/tasks/" + taskId);
    showReader(data);
  } catch (error) {
    els.tasksProgress.textContent = friendlyError(error);
  }
}

let readingHintTimer = 0;

function resetReaderProgress() {
  if (els.tasksReaderFill) els.tasksReaderFill.style.width = "0%";
  if (els.tasksReaderHint) {
    els.tasksReaderHint.classList.remove("is-visible");
    els.tasksReaderHint.textContent = "";
  }
}

function updateReaderProgress() {
  const text = els.tasksReaderText;
  if (!text || !els.tasksReaderFill) return;
  const total = text.scrollHeight - text.clientHeight;
  const percent = total <= 0 ? 100 : Math.min(100, Math.round((text.scrollTop / total) * 100));
  els.tasksReaderFill.style.width = percent + "%";
}

function startReadingHint() {
  if (readingHintTimer) window.clearTimeout(readingHintTimer);
  readingHintTimer = window.setTimeout(function () {
    if (!els.tasksReaderHint || !els.tasksReader || els.tasksReader.hidden) return;
    els.tasksReaderHint.textContent = "抬头看一下远处";
    els.tasksReaderHint.classList.add("is-visible");
  }, 90000);
}

function showReader(data) {
  if (!els.tasksReader) return;
  const content = data.content || "";
  const chars = content.length;
  const minutes = Math.max(1, Math.round(chars / 300));

  els.tasksReader.hidden = false;
  els.tasksReaderTitle.textContent = (data.seq ? "第 " + data.seq + " 段 · " : "") + (data.title || "");
  els.tasksReaderText.textContent = content;
  els.tasksReaderText.scrollTop = 0;

  const keywords = Array.isArray(data.keywords) ? data.keywords : [];
  if (els.tasksReaderMeta) {
    els.tasksReaderMeta.textContent = "约 " + minutes + " 分钟 · " + chars + " 字"
      + (keywords.length ? " · 关键词：" + keywords.join(" / ") : "");
  }
  resetReaderProgress();
  updateReaderProgress();
  if (data.status !== "DONE") startReadingHint();

  els.tasksComplete.textContent = data.status === "DONE" ? "已完成" : "我读完了";
  els.tasksComplete.disabled = data.status === "DONE";
}

function closeReader() {
  activeTaskId = null;
  if (readingHintTimer) window.clearTimeout(readingHintTimer);
  readingHintTimer = 0;
  if (!els.tasksReader) return;
  els.tasksReader.hidden = true;
  els.tasksReaderText.textContent = "";
}

async function completeTask() {
  if (!activeDoc || !activeTaskId || tasksBusy) return;
  tasksBusy = true;
  els.tasksComplete.disabled = true;
  try {
    const data = await api("/documents/" + activeDoc.id + "/tasks/" + activeTaskId + "/complete", {
      method: "POST"
    });
    tasks = data.tasks || [];
    renderTasks(data);
    closeReader();
    els.tasksProgress.textContent = "这一段读完了 · 即将下潜放松";
    window.setTimeout(function () {
      goHomeForDive();
    }, 2600);
  } catch (error) {
    els.tasksProgress.textContent = friendlyError(error);
  } finally {
    tasksBusy = false;
    if (els.tasksComplete) els.tasksComplete.disabled = false;
  }
}

function goHomeForDive() {
  window.setTimeout(function () {
    const nav = document.querySelector('.nav__item[data-view="home"]');
    if (nav) {
      nav.click();
    } else {
      document.body.dataset.page = "home";
    }
  }, 900);
}