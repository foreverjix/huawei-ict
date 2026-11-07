# MindFlow

面向办公族的专注与颈部舒缓应用：摄像头端侧识别姿态，结合深海主题的引导式互动，把久坐时的颈部活动变成可持续的小练习；同时支持上传工作文档，用外部大模型按 Skill 做摘要、要点、术语解释与审阅。

## 技术栈

- 前端：原生 HTML / CSS / JavaScript，three.js 海底光柱，MediaPipe 端侧人脸关键点
- 后端：Java 17 + Spring Boot 3.3 + Spring Data JPA + H2
- 文档解析：Apache PDFBox
- 模型服务：任意 OpenAI 兼容 Chat Completions 接口

## 环境要求

- JDK 17
- Maven 3.9+（或使用仓库内的 `mvnw` 自动下载）
- Chrome / Edge，需要摄像头权限

## 运行

1. 确认 JDK：
   ```powershell
   java -version
   ```
2. 在项目根目录启动：
   ```powershell
   .\mvnw.cmd spring-boot:run
   ```
   本机已安装 Maven 时也可以：
   ```powershell
   mvn spring-boot:run
   ```
   首次启动会下载依赖，日志出现 `Started MindflowApplication` 即成功。
3. 打开：
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

API Key 只保存在本机 H2 数据库，接口只返回脱敏尾号，不会回传浏览器，也不会写入仓库或日志。

## 文档分析

1. 点顶栏「选择文档」，上传 PDF / TXT / MD / CSV / JSON（单个文件不超过 25MB）。
2. 文件名会立即回显；上传成功后出现在「文档阅读」列表。
3. 选择 Skill 后点「开始分析」。

内置 Skill：论文精读、结构化摘要、核心要点、术语解释、批判性审阅、自定义 Prompt。

扫描版 PDF 没有文本层，会显示「不可分析」。

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

## 隐私与健康提示

- 摄像头画面只在浏览器端做推理，不上传服务器。
- 颈部训练建议每小时一组、组间休息 3 分钟；动作放慢，仰头不超过 15°。
- 有颈椎病史或眩晕史请先咨询医生，本功能仅作活动引导，不是治疗。