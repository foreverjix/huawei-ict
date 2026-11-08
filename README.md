# MindFlow

面向办公族的专注与颈部舒缓应用：摄像头端侧识别姿态，结合深海主题的引导式互动，把久坐时的颈部活动变成可持续的小练习；同时支持上传工作文档，用外部大模型按 Skill 做摘要、要点、术语解释与审阅。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript，three.js 海底光柱，MediaPipe 端侧人脸关键点
- 后端：Java 17 + Spring Boot 3.3 + Spring Data JPA + H2
- 文档解析：Apache PDFBox
- 模型服务：任意 OpenAI 兼容 Chat Completions 接口（可选华为云 ModelArts Studio）
- 文档 OCR：华为云文字识别（可选，用于补扫描版 PDF 的文本层）

## 环境要求

- JDK 17
- Maven 3.9+（或使用仓库内的 `mvnw` 自动下载）
- Chrome / Edge，需要摄像头权限

## 运行

1. 确认 JDK：
   ```powershell
   java -version
   ```
2. 准备凭证文件（可选）：
   ```powershell
   copy .env.example .env
   ```
   打开 `.env` 填入 API Key 与 AK/SK。不填也能启动，AI 功能会自动降级。
3. 在项目根目录启动：
   ```powershell
   .\mvnw.cmd spring-boot:run
   ```
   本机已安装 Maven 时也可以：
   ```powershell
   mvn spring-boot:run
   ```
   首次启动会下载依赖，日志出现 `Started MindflowApplication` 即成功。
4. 打开：
   ```
   http://localhost:8080
   ```

必须通过 `localhost` 访问，直接双击 `index.html`（`file://`）时摄像头不可用。

### 项目路径不要含中文

如果编译通过但启动时报：

```
找不到或无法加载主类 com.mindflow.MindflowApplication
```

请把项目移动到纯英文路径（例如 `D:\mindflow`）后重新启动。

### 用 IntelliJ IDEA

用 IDEA 打开项目根目录，选择 JDK 17，直接运行 `com.mindflow.MindflowApplication`。

## 配置外部大模型

1. 打开 `http://localhost:8080`。
2. 左侧「设置」→「模型服务与 Skill」。
3. 填写：
   - **API Base URL**：例如 `https://api.deepseek.com/v1`
   - **API Key**
   - **模型名称**：例如 `deepseek-chat`
   - **默认 Skill**
4. 保存后点「测试连接」。

API Key 的读取顺序：设置页保存到本机 H2 的值优先；H2 里没有时回落到 `.env` 的 `MINDFLOW_LLM_API_KEY`。接口只返回脱敏尾号，不回传明文，也不写入仓库或日志。

推荐直接写 `.env`，不用在设置页重复填写：

```
MINDFLOW_LLM_BASE_URL=https://api.deepseek.com/v1
MINDFLOW_LLM_MODEL=deepseek-chat
MINDFLOW_LLM_API_KEY=你的 Key
```

### 换成华为云 ModelArts Studio

模型服务只要是 OpenAI 兼容接口，切换到华为云就不需要改代码：

1. 登录华为云控制台，进入 **ModelArts Studio → 在线推理 → 调用说明**。
2. 复制页面上给出的三项：
   - **API 地址** → 填到「API Base URL」
   - **API Key** → 填到「API Key」
   - **模型名称** → 填到「模型名称」
3. 保存后点「测试连接」，返回成功即可。

不同区域、不同模型的地址与名称都不一样，所以这三项不写死在仓库里。

## 文档分析

1. 点顶栏「选择文档」，上传 PDF / TXT / MD / CSV / JSON（单个文件不超过 25MB）。
2. 文件名会立即回显；上传成功后出现在「文档阅读」列表。
3. 选择 Skill 后点「开始分析」。

内置 Skill：论文精读、结构化摘要、核心要点、术语解释、批判性审阅、自定义 Prompt。

扫描版 PDF 没有文本层，默认显示「不可分析」；开启华为云 OCR 后会自动逐页识别，见下一节。

## 接入华为云 OCR

扫描版 PDF 没有文本层，PDFBox 抽不出文字。开启 OCR 后，文字层为空时会把每一页渲染成图片交给华为云文字识别，再把结果拼回正文。

配置写在项目根目录的 `.env` 里，启动时由 `spring.config.import` 自动读取：

```
MINDFLOW_OCR_ENABLED=true
MINDFLOW_OCR_AK=你的 Access Key
MINDFLOW_OCR_SK=你的 Secret Key
MINDFLOW_OCR_PROJECT_ID=你的项目 ID
MINDFLOW_OCR_REGION=cn-north-4
```

| 变量 | 说明 |
| --- | --- |
| `MINDFLOW_OCR_ENABLED` | 总开关，默认 `false` |
| `MINDFLOW_OCR_AK` / `MINDFLOW_OCR_SK` | 「我的凭证 → 访问密钥」 |
| `MINDFLOW_OCR_PROJECT_ID` | 「我的凭证 → 项目列表」 |
| `MINDFLOW_OCR_REGION` | 默认 `cn-north-4` |
| `MINDFLOW_OCR_ENDPOINT` | 可选，覆盖默认的 `https://ocr.{region}.myhuaweicloud.com` |
| `MINDFLOW_OCR_MAX_PAGES` | 单份 PDF 最多识别页数，默认 `10` |
| `MINDFLOW_OCR_DPI` | 渲染精度，默认 `150` |

认证方式为 AK/SK 签名（`SDK-HMAC-SHA256`），凭证只从 `.env` 读取，不落库、不进仓库（`.env` 已在 `.gitignore` 中）。OCR 未配置或调用失败时静默回退为空文本，不会阻断上传。

## 数据位置

- H2 数据库：`./data/mindflow.mv.db`
- 上传文件：`./data/uploads/`

两者都在 `.gitignore` 中，不会提交到仓库。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/v1/documents` | 上传文档（multipart，字段 `file`） |
| GET | `/api/v1/documents` | 文档列表 |
| DELETE | `/api/v1/documents/{id}` | 删除文档 |
| POST | `/api/v1/documents/{id}/analysis` | 按 Skill 分析 |
| GET | `/api/v1/documents/{id}/analysis` | 分析历史 |
| GET | `/api/v1/skills` | Skill 列表 |
| GET / PUT | `/api/v1/llm/settings` | 模型配置（Key 脱敏） |
| POST | `/api/v1/llm/test` | 测试模型连接 |
| POST | `/api/v1/training/plan` | 生成当日训练剧本 |
| POST | `/api/v1/training/review` | 组末 AI 点评 |
| GET / POST | `/api/v1/documents/{id}/tasks` | 文档分段阅读任务 |
| GET | `/api/v1/documents/{id}/tasks/{taskId}` | 单段任务内容 |
| POST | `/api/v1/documents/{id}/tasks/{taskId}/complete` | 标记一段已读完 |

## 背景音乐

游戏内 BGM 是第三方版权曲目，**未纳入仓库**（`Music/` 与 `src/main/resources/static/assets/audio/` 均已在 `.gitignore` 中）。clone 后不带音乐，页面照常运行，只是没有背景音；事件音效由 Web Audio API 实时合成，不依赖音频文件。

自行放两首曲目到 `src/main/resources/static/assets/audio/bgm_01.mp3`、`bgm_02.mp3` 即可自动循环播放；公开分发请换成无版权曲库。

## 隐私与健康提示

- 摄像头画面只在浏览器端做推理，不上传服务器。
- 文档原文件与提取文本保存在本机；开启 OCR 后，扫描版 PDF 的**页面图像**会发送到华为云文字识别服务，其他类型文档不会。
- 颈部训练建议每小时一组、组间休息 3 分钟；动作放慢，仰头不超过 15°。
- 有颈椎病史或眩晕史请先咨询医生，本功能仅作活动引导，不是治疗。