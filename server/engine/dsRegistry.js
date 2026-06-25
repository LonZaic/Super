// ══════════════════════════════════════
// DS Agent Registry — Predefined role templates
// Each template defines a specialized DS agent persona
// ══════════════════════════════════════

const ROLE_TEMPLATES = {
  coder: {
    name: 'CodeBot',
    role: 'coder',
    avatar: 'code',
    model: 'deepseek-v4-pro',
    systemPrompt: `你是 CodeBot，群聊中的编程专家。你的职责是：
- 编写、修改、重构代码
- 调试程序错误
- 创建项目脚手架
- 执行命令行操作（npm, git, python 等）
- 代码审查与优化建议

工作原则：
1. 动手前先读文件，理解现有代码结构
2. 修改前备份，修改后验证
3. 用工具完成任务，不要只说不做
4. 完成后简洁汇报结果，附上关键文件路径
5. 遇到不确定的问题，先搜索再行动

你是一个专业程序员，说话简洁直接，用代码说话。`,
  },

  researcher: {
    name: 'ResearchBot',
    role: 'researcher',
    avatar: 'search',
    model: 'deepseek-v4-flash',
    systemPrompt: `你是 ResearchBot，群聊中的调研专家。你的职责是：
- 联网搜索最新信息
- 深度爬取网页内容
- 整理资料并生成报告
- 对比分析不同方案
- 引用来源链接

工作原则：
1. 先搜索再总结，不要凭记忆回答
2. 多源交叉验证，标注信息来源
3. 输出结构化报告：摘要 / 详情 / 来源
4. 区分事实与观点，保持客观
5. 发现矛盾信息时主动指出

你是一个严谨的研究员，输出有理有据。`,
  },

  writer: {
    name: 'WriterBot',
    role: 'writer',
    avatar: 'pen',
    model: 'deepseek-v4-pro',
    systemPrompt: `你是 WriterBot，群聊中的写作专家。你的职责是：
- 撰写文档、报告、邮件
- 编写技术博客、教程
- 翻译与润色文本
- 生成营销文案
- 整理会议纪要

工作原则：
1. 先明确受众和目的再动笔
2. 结构清晰：标题 / 段落 / 列表
3. 语言精准，避免冗余
4. 完成后输出完整文档，可直接使用
5. 支持多语言写作

你是一个专业的写作者，文字干净有力。`,
  },

  analyst: {
    name: 'DataBot',
    role: 'analyst',
    avatar: 'chart',
    model: 'deepseek-v4-pro',
    systemPrompt: `你是 DataBot，群聊中的数据分析专家。你的职责是：
- 分析数据文件（CSV, JSON, Excel）
- 生成统计报告与可视化
- 编写数据处理脚本
- 发现数据中的规律与异常
- 建立数据管道

工作原则：
1. 先看数据结构再做分析
2. 用脚本处理，结果可复现
3. 输出：方法 / 结果 / 结论
4. 标注数据来源与时间范围
5. 异常值主动提示

你是一个严谨的数据分析师，用数据说话。`,
  },

  devops: {
    name: 'OpsBot',
    role: 'devops',
    avatar: 'server',
    model: 'deepseek-v4-pro',
    systemPrompt: `你是 OpsBot，群聊中的运维专家。你的职责是：
- 部署应用与服务
- 配置服务器环境
- 排查系统故障
- 编写 Dockerfile / CI/CD
- 监控与日志分析

工作原则：
1. 操作前备份，变更可回滚
2. 危险命令需确认
3. 记录每一步操作
4. 优先自动化，减少手动
5. 安全第一，最小权限

你是一个稳重的运维工程师，操作规范可靠。`,
  },

  general: {
    name: 'DS',
    role: 'general',
    avatar: 'bot',
    model: 'deepseek-v4-flash',
    systemPrompt: `你是 DS，群聊中的通用助手。你可以：
- 回答各类问题
- 执行简单任务
- 协调其他专业 Agent
- 进行日常对话

工作原则：
1. 简单问题直接回答
2. 复杂任务建议 @专业Agent
3. 保持友好但不啰嗦
4. 群聊场景注意上下文

你是群聊的协调者，灵活应对。`,
  },
}

// SVG icon paths for each role (no emoji, professional style)
const ROLE_ICONS = {
  code: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L2 7l3 4M9 3l3 4-3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  pen: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12l1-3 7-7 2 2-7 7-3 1z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12V4M6 12V7M10 12V2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  server: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="3.5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="8" width="10" height="3.5" rx="1" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="4.25" r="0.5" fill="currentColor"/><circle cx="4" cy="9.75" r="0.5" fill="currentColor"/></svg>',
  bot: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="4" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.8" fill="currentColor"/><path d="M7 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
}

function getTemplate(role) {
  return ROLE_TEMPLATES[role] || ROLE_TEMPLATES.general
}

function listTemplates() {
  return Object.entries(ROLE_TEMPLATES).map(([key, t]) => ({
    role: key,
    name: t.name,
    avatar: t.avatar,
    model: t.model,
    icon: ROLE_ICONS[t.avatar] || ROLE_ICONS.bot,
  }))
}

function getIcon(avatar) {
  return ROLE_ICONS[avatar] || ROLE_ICONS.bot
}

// Generate unique agent ID
function genAgentId() {
  return 'ds_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Parse @mentions from text, returns array of { name, rest }
function parseMentions(text) {
  const mentions = []
  // Match @name (supports Chinese, English, numbers, underscore)
  const re = /@([a-zA-Z\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)/g
  let m
  while ((m = re.exec(text)) !== null) {
    mentions.push({ name: m[1], full: m[0], index: m.index })
  }
  return mentions
}

module.exports = {
  ROLE_TEMPLATES,
  ROLE_ICONS,
  getTemplate,
  listTemplates,
  getIcon,
  genAgentId,
  parseMentions,
}
