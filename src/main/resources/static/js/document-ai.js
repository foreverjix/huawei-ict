const API = "/api/v1";

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
  llmMessage: document.getElementById("llm-message")
};

let documents = [];
let skills = [];
let settings = null;
let activeDoc = null;
let documentsLoaded = false;
let skillsLoaded = false;
let settingsLoaded = false;
let documentsError = false;

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

  watchPage();

  const page = document.body.dataset.page;
  if (page === "docs" || page === "settings") loadFor(page);
}

async function loadFor(page) {
  if (page === "docs") {
    loadDocuments();
    await loadSkills();
  }
  await loadSettings();
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
  const response = await fetch(API + path, options || {});
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
    setAnalyzeState("分析完成", "ok");
    els.analyzeHint.textContent =
      (result.skillName || "分析") + " · " + result.model + " · "
      + (result.durationMs / 1000).toFixed(1) + " 秒";
    showResult(result.result || "");
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
  setConnectionState(settings.hasApiKey);
  els.llmApiKey.placeholder = settings.hasApiKey
    ? "已保存 " + settings.apiKeyHint + "，留空不修改"
    : "请输入 API Key";
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
  if (apiKey) payload.apiKey = apiKey;

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
    setMessage("已保存", "ok");
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
  setPickerName(doc.name);
  renderDocuments();
  updateActiveDoc();
  setAnalyzeState("已选择", "ok");
  els.analyzeHint.textContent = doc.analyzable
    ? "已提取 " + doc.textChars + " 字，选择 Skill 后开始分析。"
    : "该文档没有提取到文本，无法分析。";
  showResult("");
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