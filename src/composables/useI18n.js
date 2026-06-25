import { ref, computed } from 'vue'

// ═══════════════════════════════════════════
// Language metadata
// ═══════════════════════════════════════════

const LANG_META = [
  { code: 'zh-CN', native: '简体中文',     en: 'Simplified Chinese' },
  { code: 'zh-HK', native: '繁體中文（港澳地區）', en: 'Traditional Chinese (HK/MO China)' },
  { code: 'zh-TW', native: '繁體中文（台灣地區）', en: 'Traditional Chinese (TW China)' },
  { code: 'en',    native: 'English',         en: 'English' },
]

// ═══════════════════════════════════════════
// All translations — zh-CN / zh-HK / zh-TW / en
// HK = 港澳繁體 (Cantonese-influenced)
// TW = 台灣正體 (Mandarin-influenced)
// API Key 保持英文不變
// ═══════════════════════════════════════════

const L = {

  // ── Brand & Nav ──
  brand:           ['DeepSeek-Super', 'DeepSeek-Super', 'DeepSeek-Super', 'DeepSeek-Super'],
  collections:     ['收藏', '收藏', '收藏', 'Collections'],
  searchCollections: ['搜索收藏...', '搜尋收藏...', '搜尋收藏...', 'Search collections...'],
  newCollection:   ['新建收藏夹', '新增收藏夾', '新增收藏夾', 'New collection'],
  allItems:        ['全部', '全部', '全部', 'All'],
  noAgentConvs:    ['暂无 Agent 对话', '暫無 Agent 對話', '暫無 Agent 對話', 'No agent conversations'],
  home:            ['主页', '主頁', '首頁', 'Home'],
  code:            ['编程', '編程', '程式', 'Code'],
  newChat:         ['新对话', '新對話', '新對話', 'New Chat'],
  apiKey:          ['API Key', 'API Key', 'API Key', 'API Key'],
  email:           ['邮箱', '電郵', '電子郵件', 'Email'],
  social:          ['社交', '社交', '社交', 'Social'],
  recent:          ['最近对话', '最近對話', '最近對話', 'Recent'],
  noConvs:         ['暂无对话', '暫無對話', '暫無對話', 'No conversations yet'],
  signIn:          ['请先登录', '請先登入', '請先登入', 'Sign in'],
  signOut:         ['退出', '登出', '登出', 'Sign out'],

  // ── Greeting ──
  morning:         ['早上好', '早晨', '早安', 'Good morning'],
  afternoon:       ['下午好', '午安', '午安', 'Good afternoon'],
  evening:         ['晚上好', '晚安', '晚安', 'Good evening'],

  // ── Home Feature Cards ──
  agentMode:       ['智能代理', '智能代理', '智慧代理', 'Agent Mode'],
  agentModeDesc:   ['读写文件、搜索代码、执行命令 — 全自主', '讀寫檔案、搜尋程式碼、執行命令 — 全自主', '讀寫檔案、搜尋程式碼、執行命令 — 全自主', 'Read, write, search, run commands — full autonomy'],
  livePreview:     ['实时预览', '即時預覽', '即時預覽', 'Live Preview'],
  livePreviewDesc: ['HTML/CSS/JS 设计稿实时渲染', 'HTML/CSS/JS 設計稿即時渲染', 'HTML/CSS/JS 設計稿即時渲染', 'HTML/CSS/JS designs rendered in real-time'],
  codePanel:       ['代码面板', '程式碼面板', '程式碼面板', 'Code Panel'],
  codePanelDesc:   ['语法高亮代码，支持复制、下载、预览', '語法高亮程式碼，支援複製、下載、預覽', '語法高亮程式碼，支援複製、下載、預覽', 'Syntax-highlighted with copy, download, preview'],
  groupChatTitle:  ['群聊协作', '群組協作', '群組協作', 'Group Chat'],
  groupChatDesc:   ['多人共享空间，Agent 实时协作', '多人共享空間，Agent 即時協作', '多人共享空間，Agent 即時協作', 'Multi-agent collaboration in shared spaces'],
  apiCard:         ['API Key', 'API Key', 'API Key', 'API Key'],
  apiCardDesc:     ['管理 DeepSeek API 凭证', '管理 DeepSeek API 憑證', '管理 DeepSeek API 憑證', 'Manage DeepSeek API credentials'],
  emailCard:       ['邮箱', '電郵', '電子郵件', 'Email'],
  emailCardDesc:   ['SMTP 通知配置', 'SMTP 通知設定', 'SMTP 通知設定', 'SMTP notification setup'],
  // ── 主页特色入口 ──
  hpQuickStart:    ['快速开始', '快速開始', '快速開始', 'Quick Start'],
  hpQuickStartDesc:['直接对话，立即体验 AI 能力', '直接對話，立即體驗 AI 能力', '直接對話，立即體驗 AI 能力', 'Chat directly, experience AI instantly'],
  hpKnowledge:     ['知识库', '知識庫', '知識庫', 'Knowledge Base'],
  hpKnowledgeDesc: ['上传文档，让 AI 基于你的资料回答', '上傳文檔，讓 AI 基於你的資料回答', '上傳文檔，讓 AI 基於你的資料回答', 'Upload docs so AI answers from your materials'],
  hpWorkflow:      ['工作流', '工作流', '工作流', 'Workflow'],
  hpWorkflowDesc:  ['把多步任务串成自动流程', '把多步任務串成自動流程', '把多步任務串成自動流程', 'Chain multi-step tasks into automated flows'],
  hpMcpSkills:     ['MCP 技能', 'MCP 技能', 'MCP 技能', 'MCP Skills'],
  hpMcpSkillsDesc: ['扩展 Agent 能力，接入外部工具', '擴展 Agent 能力，接入外部工具', '擴展 Agent 能力，接入外部工具', 'Extend agent abilities with external tools'],
  hpCollections:   ['收藏集', '收藏集', '收藏集', 'Collections'],
  hpCollectionsDesc:['保存精彩对话，随时回顾复用', '保存精彩對話，隨時回顧復用', '保存精彩對話，隨時回顧復用', 'Save great conversations, revisit anytime'],
  hpProjects:      ['项目', '項目', '項目', 'Projects'],
  hpProjectsDesc:  ['按项目归类对话和资料', '按項目歸類對話和資料', '按項目歸類對話和資料', 'Group chats and resources by project'],
  hpSocial:        ['社交', '社交', '社交', 'Social'],
  hpSocialDesc:    ['好友、群组、私信，连接他人', '好友、群組、私信，連接他人', '好友、群組、私信，連接他人', 'Friends, groups, DMs — connect with others'],
  hpCode:          ['代码工坊', '程式碼工坊', '程式碼工坊', 'Code Workshop'],
  hpCodeDesc:      ['在线编程环境，多语言支持', '在線編程環境，多語言支持', '在線編程環境，多語言支持', 'Online IDE, multi-language support'],
  hpFeatureSection:['特色功能', '特色功能', '特色功能', 'Features'],
  hpToolsSection:  ['工具与设置', '工具與設置', '工具與設置', 'Tools & Settings'],

  // ── 项目页面 (ProjectsView) ──
  projTitle:       ['项目空间', '項目空間', '項目空間', 'Projects'],
  projSub:         ['为不同项目设置专属指令和资料，对话可归属到项目，AI 会按项目上下文回答', '為不同項目設定專屬指令和資料，對話可歸屬到項目，AI 會按項目上下文回答', '為不同項目設定專屬指令和資料，對話可歸屬到項目，AI 會按項目上下文回答', 'Set custom instructions and resources per project. Chats belong to projects, AI follows project context.'],
  projNew:         ['新建项目', '新增項目', '新增項目', 'New Project'],
  projEmptyTitle:  ['还没有项目', '尚未有項目', '尚未有項目', 'No projects yet'],
  projEmptyDesc:   ['创建一个项目，为其设置专属指令和关联知识库，让 AI 在该项目下的对话更懂你的需求', '創建一個項目，為其設定專屬指令和關聯知識庫，讓 AI 在該項目下的對話更懂你的需求', '建立一個項目，為其設定專屬指令和關聯知識庫，讓 AI 在該項目下的對話更懂你的需求', 'Create a project, set custom instructions and link knowledge bases so AI understands your needs in that project.'],
  projCreateFirst: ['创建第一个项目', '創建第一個項目', '建立第一個項目', 'Create your first project'],
  projCardNoInstr: ['暂无专属指令', '暫無專屬指令', '暫無專屬指令', 'No custom instructions'],
  projConvCount:   ['{n} 个对话', '{n} 個對話', '{n} 個對話', '{n} chats'],
  projKbCount:     ['{n} 个知识库', '{n} 個知識庫', '{n} 個知識庫', '{n} knowledge bases'],
  projEditTitle:   ['编辑项目', '編輯項目', '編輯項目', 'Edit Project'],
  projNewTitle:    ['新建项目', '新增項目', '新增項目', 'New Project'],
  projFieldName:   ['项目名称', '項目名稱', '項目名稱', 'Project Name'],
  projFieldNamePh: ['如：我的博客、毕业论文、公司官网', '如：我的博客、畢業論文、公司官網', '如：我的部落格、畢業論文、公司官網', 'e.g. My Blog, Thesis, Company Site'],
  projFieldColor:  ['项目颜色', '項目顏色', '項目顏色', 'Project Color'],
  projFieldInstr:  ['专属指令', '專屬指令', '專屬指令', 'Custom Instructions'],
  projFieldInstrHint: ['在这个项目下的对话，AI 会自动遵循这些指令。如：用中文回答、代码加注释、回答要简洁…', '在這個項目下的對話，AI 會自動遵循這些指令。如：用中文回答、程式碼加註釋、回答要簡潔…', '在這個項目下的對話，AI 會自動遵循這些指令。如：用中文回答、程式碼加註解、回答要簡潔…', 'AI will follow these instructions in this project. e.g. Answer in Chinese, add code comments, keep it concise…'],
  projFieldInstrPh: ['例：\n- 你是我的博客写作助手，用轻松的语气写技术文章\n- 代码示例用 TypeScript\n- 每篇文章控制在 1500 字以内', '例：\n- 你是我的博客寫作助手，用輕鬆的語氣寫技術文章\n- 程式碼示例用 TypeScript\n- 每篇文章控制在 1500 字以內', '例：\n- 你是我的部落格寫作助手，用輕鬆的語氣寫技術文章\n- 程式碼範例用 TypeScript\n- 每篇文章控制在 1500 字以內', 'e.g.\n- You are my blog writing assistant, write tech articles in a casual tone\n- Use TypeScript for code examples\n- Keep each article under 1500 words'],
  projFieldKb:     ['关联知识库', '關聯知識庫', '關聯知識庫', 'Linked Knowledge Bases'],
  projFieldKbHint: ['选择该项目可用的知识库，对话时 AI 会从这些知识库查找资料', '選擇該項目可用的知識庫，對話時 AI 會從這些知識庫查找資料', '選擇該項目可用的知識庫，對話時 AI 會從這些知識庫查找資料', 'Select knowledge bases for this project. AI will look up info from these during chats.'],
  projKbEmpty:     ['暂无知识库，请先在「知识库」页面创建', '暫無知識庫，請先在「知識庫」頁面創建', '暫無知識庫，請先在「知識庫」頁面建立', 'No knowledge bases yet. Create one in the Knowledge Base page first.'],
  projDelete:      ['删除项目', '刪除項目', '刪除項目', 'Delete Project'],
  projCancel:      ['取消', '取消', '取消', 'Cancel'],
  projSave:        ['保存', '保存', '儲存', 'Save'],
  projCreate:      ['创建', '創建', '建立', 'Create'],
  projDeleteConfirm: ['确定删除项目「{name}」吗？该项目下的对话不会被删除，只是解除关联。', '確定刪除項目「{name}」嗎？該項目下的對話不會被刪除，只是解除關聯。', '確定刪除項目「{name}」嗎？該項目下的對話不會被刪除，只是解除關聯。', 'Delete project "{name}"? Chats in this project won\'t be deleted, just unlinked.'],
  projEnterName:   ['请输入项目名称', '請輸入項目名稱', '請輸入項目名稱', 'Please enter a project name'],
  projDetailInstr: ['专属指令', '專屬指令', '專屬指令', 'Custom Instructions'],
  projDetailEdit:  ['编辑', '編輯', '編輯', 'Edit'],
  projDetailConvs: ['对话', '對話', '對話', 'Chats'],
  projDetailNewChat: ['+ 新对话', '+ 新對話', '+ 新對話', '+ New Chat'],
  projDetailNoInstr: ['未设置专属指令', '未設定專屬指令', '未設定專屬指令', 'No custom instructions set'],
  projDetailNoConv: ['还没有对话，点击右上角新建', '尚未有對話，點擊右上角新建', '尚未有對話，點擊右上角新建', 'No chats yet. Click + above to start one.'],
  projNewChat:     ['新对话', '新對話', '新對話', 'New Chat'],
  projMenuEdit:    ['编辑', '編輯', '編輯', 'Edit'],
  projMenuDelete:  ['删除', '刪除', '刪除', 'Delete'],

  // ── 知识库页面 (KnowledgeView) ──
  kbTitle:         ['知识库', '知識庫', '知識庫', 'Knowledge Base'],
  kbSub:           ['上传文档建立本地知识库，AI 回答时会自动从你的资料里查找相关内容', '上傳文檔建立本地知識庫，AI 回答時會自動從你的資料裡查找相關內容', '上傳文檔建立本地知識庫，AI 回答時會自動從你的資料裡查找相關內容', 'Upload docs to build a local knowledge base. AI automatically looks up relevant info from your materials when answering.'],
  kbStatusReady:   ['模型已就绪', '模型已就緒', '模型已就緒', 'Model ready'],
  kbStatusNotReady:['模型未加载', '模型未載入', '模型未載入', 'Model not loaded'],
  kbAddText:       ['添加文本', '添加文本', '添加文本', 'Add Text'],
  kbUpload:        ['上传文档', '上傳文檔', '上傳文檔', 'Upload'],
  kbProcessing:    ['处理中...', '處理中...', '處理中...', 'Processing...'],
  kbAutoLookupTitle: ['自动查找', '自動查找', '自動查找', 'Auto Lookup'],
  kbAutoLookupDesc: ['开启后，每次对话 AI 会自动从知识库查找相关内容', '開啟後，每次對話 AI 會自動從知識庫查找相關內容', '開啟後，每次對話 AI 會自動從知識庫查找相關內容', 'When on, AI automatically looks up relevant info from your knowledge base during chats.'],
  kbStatDocs:      ['文档', '文檔', '文檔', 'Documents'],
  kbStatChunks:    ['知识片段', '知識片段', '知識片段', 'Chunks'],
  kbDocChunks:     ['{n} 片段', '{n} 片段', '{n} 片段', '{n} chunks'],
  kbDocChars:      ['{n} 字符', '{n} 字符', '{n} 字元', '{n} chars'],
  kbDocCharsK:     ['{n}K 字符', '{n}K 字符', '{n}K 字元', '{n}K chars'],
  kbPreview:       ['预览', '預覽', '預覽', 'Preview'],
  kbDelete:        ['删除', '刪除', '刪除', 'Delete'],
  kbEmptyTitle:    ['知识库为空', '知識庫為空', '知識庫為空', 'Knowledge base is empty'],
  kbEmptyDesc:     ['上传 PDF、Word、TXT、Markdown 或代码文件，让 AI 基于你的资料回答问题', '上傳 PDF、Word、TXT、Markdown 或程式碼文件，讓 AI 基於你的資料回答問題', '上傳 PDF、Word、TXT、Markdown 或程式碼檔案，讓 AI 基於你的資料回答問題', 'Upload PDF, Word, TXT, Markdown or code files so AI answers from your materials.'],
  kbLoading:       ['加载中...', '載入中...', '載入中...', 'Loading...'],
  kbAddTextTitle:  ['添加文本到知识库', '添加文本到知識庫', '添加文本到知識庫', 'Add Text to Knowledge Base'],
  kbAddTextTitlePh:['文档标题（如：产品规格说明）', '文檔標題（如：產品規格說明）', '文檔標題（如：產品規格說明）', 'Document title (e.g. Product Spec)'],
  kbAddTextPh:     ['粘贴或输入文本内容...', '貼上或輸入文本內容...', '貼上或輸入文本內容...', 'Paste or type text content...'],
  kbAdd:           ['添加', '添加', '添加', 'Add'],
  kbPreviewTitle:  ['{name} — 预览', '{name} — 預覽', '{name} — 預覽', '{name} — Preview'],
  kbChunkLabel:    ['片段 {n}', '片段 {n}', '片段 {n}', 'Chunk {n}'],
  kbDeleteConfirm: ['确定删除「{name}」？', '確定刪除「{name}」？', '確定刪除「{name}」？', 'Delete "{name}"?'],
  kbDeleteSub:     ['此操作不可撤销', '此操作不可撤銷', '此操作不可撤銷', 'This cannot be undone'],
  kbUploadFail:    ['上传失败: {msg}', '上傳失敗: {msg}', '上傳失敗: {msg}', 'Upload failed: {msg}'],
  kbAddFail:       ['添加失败: {msg}', '添加失敗: {msg}', '添加失敗: {msg}', 'Add failed: {msg}'],
  kbPreviewFail:   ['预览失败: {msg}', '預覽失敗: {msg}', '預覽失敗: {msg}', 'Preview failed: {msg}'],
  kbDeleteFail:    ['删除失败: {msg}', '刪除失敗: {msg}', '刪除失敗: {msg}', 'Delete failed: {msg}'],
  kbUnnamed:       ['未命名文档', '未命名文檔', '未命名文檔', 'Untitled'],

  // ── 工作流页面 (WorkflowListView) ──
  wfTitle:         ['工作流', '工作流', '工作流', 'Workflows'],
  wfSub:           ['把多步任务串成自动流程，一次性对话变成可复用的自动化', '把多步任務串成自動流程，一次性對話變成可復用的自動化', '把多步任務串成自動流程，一次性對話變成可復用的自動化', 'Chain multi-step tasks into reusable automated flows.'],
  wfNew:           ['新建工作流', '新增工作流', '新增工作流', 'New Workflow'],
  wfNewName:       ['新工作流', '新工作流', '新工作流', 'New Workflow'],
  wfCardEdit:      ['点击编辑工作流', '點擊編輯工作流', '點擊編輯工作流', 'Click to edit workflow'],
  wfEmptyTitle:    ['还没有工作流', '尚未有工作流', '尚未有工作流', 'No workflows yet'],
  wfEmptyDesc:     ['创建你的第一个工作流，把搜索→总结→翻译→发邮件等任务编排成自动化流程', '創建你的第一個工作流，把搜索→總結→翻譯→發郵件等任務編排成自動化流程', '建立你的第一個工作流，把搜尋→總結→翻譯→發郵件等任務編排成自動化流程', 'Create your first workflow. Chain tasks like search → summarize → translate → email into automated flows.'],
  wfCreate:        ['创建工作流', '創建工作流', '建立工作流', 'Create Workflow'],
  wfLoading:       ['加载中...', '載入中...', '載入中...', 'Loading...'],
  wfNewWfName:     ['新工作流', '新工作流', '新工作流', 'New Workflow'],
  wfDeleteConfirm: ['确定删除「{name}」？', '確定刪除「{name}」？', '確定刪除「{name}」？', 'Delete "{name}"?'],
  wfDeleteSub:     ['此操作不可撤销', '此操作不可撤銷', '此操作不可撤銷', 'This cannot be undone'],
  wfDeleteFail:    ['删除失败: {msg}', '刪除失敗: {msg}', '刪除失敗: {msg}', 'Delete failed: {msg}'],

  // ── Input / Chat ──
  placeholder:     ['输入任何内容...', '輸入任何內容...', '輸入任何內容...', 'Ask anything...'],
  askPlaceholder:  ['输入任何内容，输入 / 使用命令...', '輸入任何內容，輸入 / 使用命令...', '輸入任何內容，輸入 / 使用命令...', 'Ask anything, or type / for commands...'],
  send:            ['发送', '發送', '傳送', 'Send'],
  stopGen:         ['停止生成', '停止生成', '停止生成', 'Stop generation'],
  sendMsg:         ['发送消息', '發送訊息', '傳送訊息', 'Send message'],
  addContext:      ['添加上下文', '加入內容', '加入內容', 'Add context'],
  uploadFile:      ['上传文件', '上載檔案', '上傳檔案', 'Upload file'],
  addFile:         ['添加文件', '添加檔案', '加入檔案', 'Add file'],
  manageComputer:  ['管理电脑', '管理電腦', '管理電腦', 'Control PC'],
  screenshot:      ['截图', '擷取畫面', '擷取畫面', 'Screenshot'],
  connectGithub:   ['连接 GitHub', '連接 GitHub', '連接 GitHub', 'Connect GitHub'],
  webSearch:       ['联网搜索', '聯網搜尋', '聯網搜尋', 'Web search'],
  thinkingDepth:   ['思考深度', '思考深度', '思考深度', 'Thinking depth'],
  changeModel:     ['切换模型', '切換模型', '切換模型', 'Change model'],

  // ── Thinking & Model Labels ──
  quick:           ['快速', '快速', '快速', 'Quick'],
  think:           ['思考', '思考', '思考', 'Think'],
  thinkOn:         ['思考', '思考', '思考', 'Think'],
  thinkOff:        ['快速', '快速', '快速', 'Quick'],
  thinkOnHint:     ['思考已开启 — 点击关闭', '思考已開啟 — 點擊關閉', '思考已開啟 — 點擊關閉', 'Thinking on — click to disable'],
  thinkOffHint:    ['思考已关闭 — 点击开启', '思考已關閉 — 點擊開啟', '思考已關閉 — 點擊開啟', 'Thinking off — click to enable'],
  deep:            ['深度', '深度', '深度', 'Deep'],
  v4flash:         ['V4-Flash', 'V4-Flash', 'V4-Flash', 'V4-Flash'],
  v4pro:           ['V4-Pro', 'V4-Pro', 'V4-Pro', 'V4-Pro'],

  // ── Agent Panel ──
  agent:           ['智能代理', '智能代理', '智慧代理', 'Agent'],
  agentDesc:       ['读写文件、搜索代码、执行命令', '讀寫檔案、搜尋程式碼、執行命令', '讀寫檔案、搜尋程式碼、執行命令', 'Read, write, search, run commands'],
  agentError:      ['出错了', '出錯了', '發生錯誤', 'Error'],
  agentAborted:    ['已暂停', '已暫停', '已暫停', 'Aborted'],
  agentComplete:   ['完成', '完成', '完成', 'Complete'],
  agentAnalyzing:  ['分析任务...', '分析任務...', '分析任務...', 'Analyzing task...'],
  agentUnderstanding: ['正在了解项目...', '正在了解專案...', '正在了解專案...', 'Understanding project...'],
  agentBrowsing:   ['正在浏览文件...', '正在瀏覽檔案...', '正在瀏覽檔案...', 'Browsing files...'],
  agentReading:    ['正在读取...', '正在讀取...', '正在讀取...', 'Reading...'],
  agentWriting:    ['正在创建...', '正在建立...', '正在建立...', 'Writing...'],
  agentEditing:    ['正在编辑...', '正在編輯...', '正在編輯...', 'Editing...'],
  agentSearching:  ['正在搜索...', '正在搜尋...', '正在搜尋...', 'Searching...'],
  agentSearchingCode: ['搜索代码中...', '搜尋程式碼中...', '搜尋程式碼中...', 'Searching code...'],
  agentRunning:    ['执行命令中...', '執行命令中...', '執行命令中...', 'Running command...'],
  agentWebSearch:  ['搜索网络中...', '搜尋網絡中...', '搜尋網路中...', 'Searching web...'],
  agentProcessing: ['正在处理...', '正在處理...', '正在處理...', 'Processing...'],
  agentDone:       ['任务完成', '任務完成', '任務完成', 'Task completed'],
  agentThinking:    ['正在思考中...', '正在思考中...', '正在思考中...', 'Thinking...'],
  agentInterrupted: ['任务中断', '任務中斷', '任務中斷', 'Task Interrupted'],
  agentInterruptedDesc: ['Agent 工作被中断，任务未完成', 'Agent 工作被中斷，任務未完成', 'Agent 工作被中斷，任務未完成', 'Agent was interrupted, task incomplete'],
  agentSummary:     ['任务总结', '任務總結', '任務總結', 'Summary'],
  agentRound:      ['轮', '輪', '輪', 'rounds'],
  agentRounds:     ['轮数', '輪數', '輪數', 'Rounds'],
  agentHooks:      ['钩子', '掛鉤', '鉤子', 'Hooks'],
  agentMemories:   ['记忆', '記憶', '記憶', 'Memories'],
  agentCompacting: ['压缩上下文中...', '壓縮上下文中...', '壓縮上下文中...', 'Compacting...'],
  agentCompacted:  ['压缩完成', '壓縮完成', '壓縮完成', 'Compaction done'],
  agentBudget:     ['预算', '預算', '預算', 'Budget'],
  agentBlocked:    ['已拦截', '已攔截', '已攔截', 'Blocked'],
  agentMemoryFound: ['回忆', '回憶', '回憶', 'Recall'],
  agentMemorySaved: ['已记忆', '已記憶', '已記憶', 'Memorized'],
  agentLoop:       ['循环', '迴圈', '迴圈', 'Loop'],

  // Agent tool action labels
  actListing:      ['列举中...', '列舉中...', '列舉中...', 'Listing...'],
  actReading:      ['读取中...', '讀取中...', '讀取中...', 'Reading...'],
  actWriting:      ['写入中...', '寫入中...', '寫入中...', 'Writing...'],
  actEditing:      ['编辑中...', '編輯中...', '編輯中...', 'Editing...'],
  actFinding:      ['搜索中...', '搜尋中...', '搜尋中...', 'Finding...'],
  actSearching:    ['查找中...', '尋找中...', '尋找中...', 'Searching...'],
  actRunning:      ['执行中...', '執行中...', '執行中...', 'Running...'],
  actWebSearching: ['搜索网络...', '搜尋網絡...', '搜尋網路...', 'Searching web...'],
  actBrowse:       ['浏览', '瀏覽', '瀏覽', 'Browse'],
  actRead:         ['读取', '讀取', '讀取', 'Read'],
  actWrite:        ['写入', '寫入', '寫入', 'Write'],
  actEdit:         ['编辑', '編輯', '編輯', 'Edit'],
  actSearch:       ['搜索', '搜尋', '搜尋', 'Search'],
  actFind:         ['查找', '尋找', '尋找', 'Find'],
  actRun:          ['执行', '執行', '執行', 'Run'],
  actWeb:          ['联网', '聯網', '聯網', 'Web'],

  // ── Message Actions ──
  regenerate:      ['重新生成', '重新生成', '重新生成', 'Regenerate'],
  copy:            ['复制', '複製', '複製', 'Copy'],
  editMsg:         ['编辑', '編輯', '編輯', 'Edit'],
  delete:          ['删除', '刪除', '刪除', 'Delete'],
  prevVersion:     ['上一版本', '上一版本', '上一版本', 'Previous'],
  nextVersion:     ['下一版本', '下一版本', '下一版本', 'Next'],

  // ── Thinking / Reasoning ──
  thinkingProcess: ['思考过程', '思考過程', '思考過程', 'Thinking process'],
  viewGenProcess:  ['查看生成过程', '檢視生成過程', '檢視生成過程', 'View generation process'],

  // ── Design / Preview ──
  drawing:         ['绘制中...', '繪製中...', '繪製中...', 'Drawing...'],
  drawComplete:    ['绘制完成', '繪製完成', '繪製完成', 'Drawing complete'],
  thinkComplete:   ['思考完成', '思考完成', '思考完成', 'Thinking complete'],
  thinkingDots:    ['思考中...', '思考中...', '思考中...', 'Thinking...'],
  export:          ['导出', '匯出', '匯出', 'Export'],
  phone:           ['手机', '手機', '手機', 'Phone'],
  tablet:          ['平板', '平板', '平板', 'Tablet'],
  desktop:         ['电脑', '電腦', '電腦', 'Desktop'],
  device:          ['设备', '裝置', '裝置', 'Device'],

  // ── Friends & Groups (SocialView) ──
  friends:         ['好友', '好友', '好友', 'Friends'],
  groups2:         ['群聊', '群組', '群組', 'Groups'],
  addFriend:       ['添加', '新增', '新增', 'Add'],
  accept:          ['接受', '接受', '接受', 'Accept'],
  reject:          ['拒绝', '拒絕', '拒絕', 'Reject'],
  remove:          ['删除', '刪除', '刪除', 'Remove'],
  online:          ['在线', '在線', '線上', 'Online'],
  offline:         ['离线', '離線', '離線', 'Offline'],
  searchUsers:     ['搜索用户...', '搜尋用戶...', '搜尋使用者...', 'Search users...'],
  noUsers:         ['未找到用户', '未找到用戶', '未找到使用者', 'No users found'],
  noFriends:       ['还没有好友', '尚未有好友', '尚未有好友', 'No friends yet'],
  pending:         ['待处理', '待處理', '待處理', 'Pending'],
  myFriends:       ['我的好友', '我的好友', '我的好友', 'My Friends'],
  results:         ['搜索结果', '搜尋結果', '搜尋結果', 'Results'],
  createGroup:     ['创建', '建立', '建立', 'Create'],
  joinGroup:       ['加入', '加入', '加入', 'Join'],
  myGroups:        ['我的群聊', '我的群組', '我的群組', 'My Groups'],
  allGroups:       ['所有群聊', '所有群組', '所有群組', 'All Groups'],
  groupName:       ['群名...', '群組名稱...', '群組名稱...', 'Group name...'],
  inviteCode:      ['邀请码...', '邀請碼...', '邀請碼...', 'Invite code...'],
  noGroups:        ['还没有群聊', '尚未有群組', '尚未有群組', 'No groups yet'],
  members:         ['人', '人', '人', 'members'],

  // ── DM ──
  back:            ['返回', '返回', '返回', 'Back'],
  dmPlaceholder:   ['输入消息，@ds 提问...', '輸入訊息，@ds 提問...', '輸入訊息，@ds 提問...', 'Type a message, @ds to ask AI...'],
  loading:         ['加载中...', '載入中...', '載入中...', 'Loading...'],
  me:              ['我', '我', '我', 'Me'],

  // ── Group Chat ──
  leaveGroup:      ['退出群聊', '退出群組', '退出群組', 'Leave group'],
  leaveConfirm:    ['确定退出群聊？', '確定退出群組？', '確定退出群組？', 'Leave this group?'],
  dsThinking:      ['思考中...', '思考中...', '思考中...', 'Thinking...'],

  // ── Settings Modal ──
  apiModalTitle:   ['API Key', 'API Key', 'API Key', 'API Key'],
  apiModalSub:     ['输入你的 DeepSeek API 密钥以使用 AI 和智能代理功能。', '輸入你的 DeepSeek API 密鑰以使用 AI 同智能代理功能。', '輸入你的 DeepSeek API 金鑰以使用 AI 與智慧代理功能。', 'Enter your DeepSeek API key to start using the agent and AI features.'],
  showKey:         ['显示', '顯示', '顯示', 'Show'],
  hideKey:         ['隐藏', '隱藏', '隱藏', 'Hide'],
  saveApiKey:      ['保存 API Key', '儲存 API Key', '儲存 API Key', 'Save API Key'],
  apiKeySaved:     ['API Key 已保存到本地', 'API Key 已儲存到本機', 'API Key 已儲存到本機', 'API Key saved to local disk'],
  cloudKey:        ['使用云端 Key', '使用雲端 Key', '使用雲端 Key', 'Use cloud key'],
  cloudKeyDesc:    ['已预填，即开即用，无需配置', '已預填，即開即用，無需配置', '已預填，即開即用，無需配置', 'Pre-configured, ready to use'],
  ownKey:          ['使用自己的 Key', '使用自己的 Key', '使用自己的 Key', 'Use my own key'],
  ownKeyDesc:      ['填入你的 DeepSeek API Key', '填入你的 DeepSeek API Key', '填入你的 DeepSeek API Key', 'Enter your DeepSeek API Key'],
  fillApiKey:      ['请先填写 API Key', '請先填寫 API Key', '請先填寫 API Key', 'Please fill in your API Key'],

  emailModalTitle: ['邮箱（SMTP）', '電郵（SMTP）', '電子郵件（SMTP）', 'Email (SMTP)'],
  emailModalSub:   ['配置 SMTP 以接收通知。数据仅存储在本地磁盘。', '設定 SMTP 以接收通知。資料僅儲存於本機磁碟。', '設定 SMTP 以接收通知。資料僅儲存於本機磁碟。', 'Configure SMTP to receive notifications. Data stored on your local disk only.'],
  smtpProvider:    ['服务商', '服務商', '服務商', 'Provider'],
  smtpServer:      ['服务器', '伺服器', '伺服器', 'Server'],
  smtpPort:        ['端口', '連接埠', '連接埠', 'Port'],
  smtpEmail:       ['邮箱地址', '電郵地址', '電子郵件地址', 'Email address'],
  smtpAuth:        ['授权码', '授權碼', '授權碼', 'Auth code'],
  smtpAuthHint:    ['非登录密码', '非登入密碼', '非登入密碼', 'Not login password'],
  saveSMTP:        ['保存 SMTP', '儲存 SMTP', '儲存 SMTP', 'Save SMTP'],
  smtpSaved:       ['SMTP 已保存', 'SMTP 已儲存', 'SMTP 已儲存', 'SMTP saved'],
  settingsTitle:   ['设置', '設定', '設定', 'Settings'],
  settingsSub:     ['从侧边栏选择一个分类进行配置。', '從側邊欄選擇一個分類進行設定。', '從側邊欄選擇一個分類進行設定。', 'Select a category from the sidebar to configure.'],
  custom:          ['自定义', '自訂', '自訂', 'Custom'],

  // ── Data Export/Import ──
  dataTabTitle:    ['数据管理', '數據管理', '資料管理', 'Data Management'],
  dataTabSub:      ['导出对话数据到本地文件，或从文件导入以恢复历史记录。', '匯出對話資料到本機檔案，或從檔案匯入以恢復歷史記錄。', '匯出對話資料到本機檔案，或從檔案匯入以恢復歷史記錄。', 'Export conversation data to a local file, or import from a file to restore history.'],
  exportData:      ['导出数据', '匯出數據', '匯出資料', 'Export data'],
  importData:      ['导入数据', '匯入數據', '匯入資料', 'Import data'],
  exporting:       ['导出中...', '匯出中...', '匯出中...', 'Exporting...'],
  exportSuccess:   ['导出成功', '匯出成功', '匯出成功', 'Export successful'],
  exportError:     ['导出失败', '匯出失敗', '匯出失敗', 'Export failed'],
  importSuccess:   ['成功导入 {n} 个对话', '成功匯入 {n} 個對話', '成功匯入 {n} 個對話', 'Successfully imported {n} conversations'],
  importError:     ['导入失败', '匯入失敗', '匯入失敗', 'Import failed'],
  importInvalid:   ['无效的导入文件：缺少 conversations 数组', '無效的匯入檔案：缺少 conversations 陣列', '無效的匯入檔案：缺少 conversations 陣列', 'Invalid import file: missing conversations array'],

  // ── Login Page ──
  loginTitle:      ['登录', '登入', '登入', 'Sign In'],
  registerTitle:   ['注册', '註冊', '註冊', 'Register'],
  loginSub:        ['登录你的工作空间', '登入你嘅工作空間', '登入你的工作空間', 'Sign in to your workspace'],
  registerSub:     ['创建你的本地账户', '建立你嘅本機帳戶', '建立你的本機帳戶', 'Create your local account'],
  username:        ['用户名', '用戶名', '使用者名稱', 'Username'],
  password:        ['密码', '密碼', '密碼', 'Password'],
  loginBtn:        ['登录', '登入', '登入', 'Sign in'],
  registerBtn:     ['注册', '註冊', '註冊', 'Register'],
  createAccount:   ['创建账户', '建立帳戶', '建立帳戶', 'Create account'],
  toLogin:         ['已有账号？去登录', '已有帳號？去登入', '已有帳號？去登入', 'Already have an account? Sign in'],
  toRegister:      ['没有账号？去注册', '未有帳號？去註冊', '未有帳號？去註冊', 'No account? Create one'],
  loginError:      ['请填写用户名和密码', '請填寫用戶名同密碼', '請填寫使用者名稱與密碼', 'Please enter username and password'],
  pleaseWait:      ['请稍候...', '請稍候...', '請稍候...', 'Please wait...'],

  // ── Language Selector ──
  chinese:         ['简体中文', '簡體中文', '簡體中文', 'Simplified Chinese'],
  chineseHK:       ['繁體中文（港澳地區）', '繁體中文（港澳地區）', '繁體中文（港澳地區）', 'Traditional Chinese (HK/MO China)'],
  chineseTW:       ['繁體中文（台灣地區）', '繁體中文（台灣地區）', '繁體中文（台灣地區）', 'Traditional Chinese (TW China)'],
  english:         ['English', 'English', 'English', 'English'],
  switchLang:      ['切换语言', '切換語言', '切換語言', 'Language'],
  appearance:      ['外观', '外觀', '外觀', 'Appearance'],
  darkMode:        ['深色模式', '深色模式', '深色模式', 'Dark'],
  lightMode:       ['浅色模式', '淺色模式', '淺色模式', 'Light'],
  themeAuto:       ['跟随系统', '跟隨系統', '跟隨系統', 'Auto'],
  themeDarkDesc:   ['深色界面，适合暗光环境', '深色界面，適合暗光環境', '深色界面，適合暗光環境', 'Dark interface, suited for low-light'],
  themeLightDesc:  ['暖白界面，藏青文字，阅读舒适', '暖白界面，藏青文字，閱讀舒適', '暖白界面，藏青文字，閱讀舒適', 'Warm white with navy text, easy on the eyes'],

  // ── Misc ──
  newChatTab:      ['新对话', '新對話', '新對話', 'New Chat'],
  apiNotSet:       ['请先设置 API Key', '請先設定 API Key', '請先設定 API Key', 'Please set API Key first'],
  ok:              ['确定', '確定', '確定', 'OK'],
  cancel:          ['取消', '取消', '取消', 'Cancel'],
  close:           ['关闭', '關閉', '關閉', 'Close'],
  fileText:        ['(文件)', '(檔案)', '(檔案)', '(file)'],
  sendFail:        ['发送失败: {msg}', '發送失敗: {msg}', '發送失敗: {msg}', 'Send failed: {msg}'],
  unknownError:    ['未知错误', '未知錯誤', '未知錯誤', 'Unknown error'],
  searchConvs:     ['搜索对话...', '搜尋對話...', '搜尋對話...', 'Search conversations...'],
  rename:          ['重命名', '重命名', '重命名', 'Rename'],
  deleteConv:      ['删除对话', '刪除對話', '刪除對話', 'Delete conversation'],
  confirmDeleteQ:  ['确定删除', '確定刪除', '確定刪除', 'Delete'],
  cannotUndo:      ['删除后无法恢复', '刪除後無法恢復', '刪除後無法恢復', 'This cannot be undone'],
  noMatchConvs:    ['无匹配对话', '無匹配對話', '無匹配對話', 'No matching conversations'],
  selectDevice:    ['选择设备：', '選擇裝置：', '選擇裝置：', 'Select device:'],
  copyCode:        ['复制代码', '複製程式碼', '複製程式碼', 'Copy code'],
  downloadFile:    ['下载文件', '下載檔案', '下載檔案', 'Download file'],
  previewCode:     ['预览', '預覽', '預覽', 'Preview'],
  showCode:        ['显示代码', '顯示程式碼', '顯示程式碼', 'Show code'],
  expand:          ['展开', '展開', '展開', 'Expand'],
  codeN:           ['代码', '程式碼', '程式碼', 'Code'],
  linesUnit:       ['行', '行', '行', 'lines'],
  groupPeople:     ['人', '人', '人', 'people'],
  dsAiName:        ['DS', 'DS', 'DS', 'DS'],
  tagMe:           ['我', '我', '我', 'Me'],
  apiNotSetMsg:    ['请先在首页设置 API Key', '請先喺首頁設定 API Key', '請先在首頁設定 API Key', 'Please set API Key on the home page first'],
  agentDoneMsg:    ['任务完成', '任務完成', '任務完成', 'Task completed'],
  agentErrorMsg:   ['Agent 出错', 'Agent 出錯', 'Agent 發生錯誤', 'Agent error'],
  requestFailed:   ['请求失败', '請求失敗', '請求失敗', 'Request failed'],
  somethingWrong:  ['出了点问题', '出咗啲問題', '出了點問題', 'Something went wrong'],
  systemPrompt:    ['INTJ 型 AI。私聊模式。直接、简洁、说实话。不确定就去搜。不讨好、不废话。', 'INTJ 型 AI。私聊模式。直接、簡潔、說實話。不確定就去搜。不討好、不廢話。', 'INTJ 型 AI。私聊模式。直接、簡潔、說實話。不確定就去搜。不討好、不廢話。', 'INTJ AI. Private chat. Direct, concise, truthful. Verify before speaking. No flattery.'],
  systemPromptGroup: ['INTJ 型 AI。群聊模式。直接、简洁、说实话。不确定就去搜。', 'INTJ 型 AI。群組模式。直接、簡潔、說實話。不確定就去搜。', 'INTJ 型 AI。群組模式。直接、簡潔、說實話。不確定就去搜。', 'INTJ AI. Group chat. Direct, concise, truthful. Verify before speaking.'],
  viewPanel:       ['（查看面板）', '（檢視面板）', '（檢視面板）', ' (view panel)'],

  // ── DS Agents (Multi-agent group chat) ──
  dsAgents:        ['DS 员工', 'DS 員工', 'DS 員工', 'DS Agents'],
  dsActive:        ['工作中', '工作中', '工作中', 'active'],
  dsAddAgent:      ['添加 DS 员工', '新增 DS 員工', '新增 DS 員工', 'Add DS agent'],
  dsNoAgents:      ['暂无 DS 员工', '暫無 DS 員工', '暫無 DS 員工', 'No DS agents'],
  dsAddFirst:      ['添加第一个', '新增第一個', '新增第一個', 'Add first agent'],
  dsRemove:        ['移除', '移除', '移除', 'Remove'],
  dsRemoveConfirm: ['确定移除', '確定移除', '確定移除', 'Remove'],
  dsWorking:       ['正在处理', '正在處理', '正在處理', 'Working on'],
  dsIdle:          ['空闲中', '空閒中', '空閒中', 'Idle'],
  dsErrorState:    ['出错了', '出錯了', '出錯了', 'Error'],
  dsInterrupt:     ['中断', '中斷', '中斷', 'Interrupt'],
  dsInterruptConfirm: ['确定中断', '確定中斷', '確定中斷', 'Interrupt'],
  dsPlan:          ['计划', '計劃', '計劃', 'Plan'],
  dsSchedule:      ['定时任务', '定時任務', '定時任務', 'Schedule'],
  dsScheduleOn:    ['定时已开启', '定時已開啟', '定時已開啟', 'Schedule ON'],
  dsScheduleOff:   ['定时已关闭', '定時已關閉', '定時已關閉', 'Schedule OFF'],
  dsScheduleAdd:   ['添加定时', '添加定時', '添加定時', 'Add schedule'],
  dsScheduleTime:  ['时间', '時間', '時間', 'Time'],
  dsScheduleTask:  ['任务', '任務', '任務', 'Task'],
  dsScheduleAgent: ['执行者', '執行者', '執行者', 'Agent'],
  dsScheduleRepeat:['重复', '重複', '重複', 'Repeat'],
  dsScheduleOnce:  ['单次', '單次', '單次', 'Once'],
  dsScheduleDaily: ['每天', '每天', '每天', 'Daily'],
  dsScheduleWeekly:['每周', '每週', '每週', 'Weekly'],
  dsScheduleSave:  ['保存', '保存', '保存', 'Save'],
  dsScheduleCancel:['取消', '取消', '取消', 'Cancel'],
  dsScheduleTitle: ['定时计划表', '定時計劃表', '定時計劃表', 'Schedule Plan'],
  dsScheduleEmpty: ['暂无定时任务', '暫無定時任務', '暫無定時任務', 'No scheduled tasks'],
  dsScheduleDelete:['删除', '刪除', '刪除', 'Delete'],
  dsScheduleTaskPh:['如：整理今日工作汇报', '如：整理今日工作匯報', '如：整理今日工作匯報', 'e.g. Summarize today\'s work'],
  dsScheduleAutoAgent: ['自动分配', '自動分配', '自動分配', 'Auto assign'],
  dsMentionAgents: ['@提及 DS 员工', '@提及 DS 員工', '@提及 DS 員工', '@mention DS agents'],
  dsRole_coder:    ['编程', '編程', '程式', 'Coder'],
  dsRole_researcher: ['调研', '調研', '調研', 'Researcher'],
  dsRole_writer:   ['写作', '寫作', '寫作', 'Writer'],
  dsRole_analyst:  ['分析', '分析', '分析', 'Analyst'],
  dsRole_devops:   ['运维', '運維', '運維', 'DevOps'],
  dsRole_general:  ['通用', '通用', '通用', 'General'],
  actListing:      ['列出', '列出', '列出', 'Listing'],
  actReading:      ['读取', '讀取', '讀取', 'Reading'],
  actWriting:      ['写入', '寫入', '寫入', 'Writing'],
  actEditing:      ['编辑', '編輯', '編輯', 'Editing'],
  actFinding:      ['查找', '查找', '查找', 'Finding'],
  actSearching:    ['搜索', '搜尋', '搜尋', 'Searching'],
  actRunning:      ['执行', '執行', '執行', 'Running'],
  actWebSearching: ['网搜', '網搜', '網搜', 'Web search'],

  // ── DS Ambient Mode (主动感知) ──
  dsAmbient:          ['Ambient 监控', 'Ambient 監控', 'Ambient 監控', 'Ambient Monitor'],
  dsAmbientAlert:     ['Ambient 提醒', 'Ambient 提醒', 'Ambient 提醒', 'Ambient Alert'],
  dsAmbientUnanswered: ['未回答的问题', '未回答的問題', '未回答的問題', 'Unanswered Question'],
  dsAmbientIncomplete: ['未完成的任务', '未完成的任務', '未完成的任務', 'Incomplete Task'],
  dsAmbientTodo:      ['待办跟进', '待辦跟進', '待辦跟進', 'Todo Follow-up'],
  dsAmbientMemory:    ['记忆匹配', '記憶匹配', '記憶匹配', 'Memory Match'],
  dsAmbientSeverity:  ['严重程度', '嚴重程度', '嚴重程度', 'Severity'],
  dsAmbientSeverityLow: ['低', '低', '低', 'Low'],
  dsAmbientSeverityMedium: ['中', '中', '中', 'Medium'],
  dsAmbientSeverityHigh: ['高', '高', '高', 'High'],
  dsAmbientSuggested: ['建议行动', '建議行動', '建議行動', 'Suggested Action'],
  dsAmbientSuggestedAgent: ['建议处理', '建議處理', '建議處理', 'Suggested Agent'],

  // ── DS Relay Mode (上下文接力) ──
  dsRelay:            ['上下文接力', '上下文接力', '上下文接力', 'Context Relay'],
  dsRelayStart:       ['接力启动中...', '接力啟動中...', '接力啟動中...', 'Relay starting...'],
  dsRelayDone:        ['接力完成', '接力完成', '接力完成', 'Relay complete'],
  dsRelayFailed:      ['接力失败，回退到压缩', '接力失敗，回退到壓縮', '接力失敗，回退到壓縮', 'Relay failed, falling back to compaction'],
  dsRelaySummary:     ['接力摘要', '接力摘要', '接力摘要', 'Relay Summary'],
  dsRelayContext:     ['新上下文', '新上下文', '新上下文', 'New Context'],
  dsRelayTokens:      ['Token 数', 'Token 數', 'Token 數', 'Tokens'],
  dsRelayThreshold:   ['接力阈值', '接力閾值', '接力閾值', 'Relay Threshold'],
  dsRelayAmbientMem:  ['Ambient 记忆', 'Ambient 記憶', 'Ambient 記憶', 'Ambient Memory'],
  dsRelaySharedMem:   ['共享记忆', '共享記憶', '共享記憶', 'Shared Memory'],
  dsRelayHandoff:     ['交接包', '交接包', '交接包', 'Handoff Package'],
  dsRelayAutoSave:    ['自动保存记忆', '自動儲存記憶', '自動儲存記憶', 'Auto-save Memory'],

  // ── DS Orchestrator (并行编排) ──
  dsParallel:         ['并行执行', '並行執行', '並行執行', 'Parallel Execution'],
  dsParallelStart:    ['启动并行任务', '啟動並行任務', '啟動並行任務', 'Starting parallel tasks'],
  dsParallelDone:     ['并行任务完成', '並行任務完成', '並行任務完成', 'Parallel tasks complete'],
  dsParallelAgentStart: ['Agent 启动', 'Agent 啟動', 'Agent 啟動', 'Agent started'],
  dsParallelAgentDone: ['Agent 完成', 'Agent 完成', 'Agent 完成', 'Agent done'],
  dsParallelAgentError: ['Agent 出错', 'Agent 出錯', 'Agent 出錯', 'Agent error'],
  dsParallelSynthesis: ['综合结果中', '綜合結果中', '綜合結果中', 'Synthesizing results'],
  dsParallelSuccess:  ['成功', '成功', '成功', 'success'],
  dsParallelFailed:   ['失败', '失敗', '失敗', 'failed'],
  dsParallelTotal:    ['总计', '總計', '總計', 'total'],
  dsMapReduce:        ['Map-Reduce', 'Map-Reduce', 'Map-Reduce', 'Map-Reduce'],
  dsMapReduceMap:     ['分发任务中', '分發任務中', '分發任務中', 'Mapping tasks'],
  dsMapReduceReduce:  ['汇总结果中', '匯總結果中', '匯總結果中', 'Reducing results'],
  dsSpawnSubAgent:    ['子 Agent', '子 Agent', '子 Agent', 'Sub-agent'],
  dsSpawnSubAgentStart: ['子 Agent 启动', '子 Agent 啟動', '子 Agent 啟動', 'Sub-agent started'],
  dsSpawnSubAgentDone: ['子 Agent 完成', '子 Agent 完成', '子 Agent 完成', 'Sub-agent done'],

  // ── DS Inter-Agent Communication (跨 Agent 通信) ──
  dsInterAgent:       ['Agent 通信', 'Agent 通信', 'Agent 通信', 'Inter-Agent'],
  dsInterAgentMsg:    ['Agent 消息', 'Agent 訊息', 'Agent 訊息', 'Agent Message'],
  dsInterAgentFrom:   ['来自', '來自', '來自', 'From'],
  dsInterAgentTo:     ['发送给', '發送給', '發送給', 'To'],
  dsInterAgentAutoTrigger: ['自动触发任务', '自動觸發任務', '自動觸發任務', 'Auto-triggered task'],
  dsInterAgentBusy:   ['对方忙碌中，已留言', '對方忙碌中，已留言', '對方忙碌中，已留言', 'Recipient busy, message left'],
  dsInterAgentShared: ['已存入共享记忆', '已存入共享記憶', '已存入共享記憶', 'Saved to shared memory'],

  // ── DS Context Stats (上下文统计) ──
  dsContextStats:     ['上下文统计', '上下文統計', '上下文統計', 'Context Stats'],
  dsContextTokens:    ['Token 使用', 'Token 使用', 'Token 使用', 'Token Usage'],
  dsContextPercent:   ['使用率', '使用率', '使用率', 'Usage'],
  dsContextMessages:  ['消息数', '訊息數', '訊息數', 'Messages'],
  dsContextRounds:    ['轮数', '輪數', '輪數', 'Rounds'],
  dsContextCompacted: ['已压缩', '已壓縮', '已壓縮', 'Compacted'],
  dsContextRelayed:   ['已接力', '已接力', '已接力', 'Relayed'],

  // ── Code Mode ──
  codeMode:        ['编程模式', '編程模式', '程式模式', 'Code Mode'],
  codeOpenHint:    ['打开项目以查看文件', '打開項目以查看文件', '打開專案以查看檔案', 'Open a project to view files'],
  codeNoProj:      ['未打开项目', '未打開項目', '未開啟專案', 'No project opened'],
  codeProjectConvs: ['此项目对话', '此項目對話', '此專案對話', 'Project Conversations'],
  codeNoConvs:     ['暂无 Code 对话', '暫無 Code 對話', '暫無 Code 對話', 'No code conversations'],
  codeDefaultConv: ['Code 对话', 'Code 對話', 'Code 對話', 'Code Chat'],
  codePlaceholder: ['开启编程之旅', '開啟編程之旅', '開啟程式之旅', 'Start coding...'],
  codeEmptyTitle:  ['编程模式', '編程模式', '程式模式', 'Code Mode'],
  codeEmptyDesc:   ['选择本地项目开始编码', '選擇本地項目開始編碼', '選擇本地專案開始編碼', 'Select a local project to start coding'],
  codeOpenProject: ['打开项目', '打開項目', '開啟專案', 'Open Project'],
  codeNewProject:  ['新建项目', '新建項目', '新增專案', 'New Project'],
  codeInputPath:   ['输入本地项目文件夹的完整路径', '輸入本地項目文件夾的完整路徑', '輸入本地專案資料夾的完整路徑', 'Enter the full path of the local project folder'],
  codeTakeover:    ['是否同意 SuperDS 接管您的项目？', '是否同意 SuperDS 接管您的項目？', '是否同意 SuperDS 接管您的專案？', 'Allow SuperDS to take over this project?'],
  codeTakeoverSub: ['AI 将有权读取、编辑、执行此目录下的文件', 'AI 將有權讀取、編輯、執行此目錄下的文件', 'AI 將有權讀取、編輯、執行此目錄下的檔案', 'AI will be able to read, edit, and execute files in this directory'],
  codeOneProject:  ['一次只能打开一个项目', '一次只能打開一個項目', '一次只能開啟一個專案', 'Only one project at a time'],
  codeSwitchSub:   ['新项目覆盖当前，旧对话记录保留，重新打开即可恢复', '新項目覆蓋當前，舊對話記錄保留，重新打開即可恢復', '新專案覆蓋當前，舊對話記錄保留，重新開啟即可恢復', 'New project will replace current one. Old conversations are preserved, reopen to restore.'],
  codeNewConv:     ['新对话', '新對話', '新對話', 'New Chat'],
  codeThinking:    ['思考过程', '思考過程', '思考過程', 'Thinking process'],
  codeChatHint:    ['输入编码需求，AI 将读写项目代码', '輸入編碼需求，AI 將讀寫項目代碼', '輸入編碼需求，AI 將讀寫專案程式碼', 'Describe your coding task, AI will read and write project files'],
  codeSelectFile:  ['从左侧文件树选择文件查看', '從左側文件樹選擇文件查看', '從左側檔案樹選擇檔案檢視', 'Select a file from the left file tree to view'],
  codeAcceptAll:   ['全部同意', '全部同意', '全部同意', 'Accept All'],
  codeRejectAll:   ['全部拒绝', '全部拒絕', '全部拒絕', 'Reject All'],
  codeSwitchProj:  ['切换项目', '切換項目', '切換專案', 'Switch Project'],
  codeProjectPath: ['项目路径', '項目路徑', '專案路徑', 'Project Path'],
  codeProjectNameHint: ['输入项目名称...', '輸入項目名稱...', '輸入專案名稱...', 'Enter project name...'],
  codeParentDirHint: ['如 E:\\', '如 E:\\', '如 E:\\', 'e.g. E:\\'],
  codeConfirmSwitch: ['确认切换', '確認切換', '確認切換', 'Confirm Switch'],
  codeCreate:      ['创建', '創建', '建立', 'Create'],
  codeConfirm:     ['确认', '確認', '確認', 'Confirm'],
  codeCancel:      ['取消', '取消', '取消', 'Cancel'],
  codeAgree:       ['同意', '同意', '同意', 'Agree'],
  codeReject:      ['拒绝', '拒絕', '拒絕', 'Reject'],
  codeLoading:     ['加载中...', '載入中...', '載入中...', 'Loading...'],
  codeEmptyDir:    ['空目录', '空目錄', '空目錄', 'Empty directory'],
  codeProjectName: ['项目名称', '項目名稱', '專案名稱', 'Project Name'],
  codeParentDir:   ['父目录', '父目錄', '父目錄', 'Parent Directory'],
  codePreviewHint: ['将在 {path} 创建项目文件夹', '將在 {path} 創建項目文件夾', '將在 {path} 建立專案資料夾', 'Project folder will be created at {path}'],
  codeSuperDS:     ['SuperDS', 'SuperDS', 'SuperDS', 'SuperDS'],
  codeReturn:      ['返回聊天', '返回聊天', '返回聊天', 'Back to Chat'],
  codeNewRound:    ['新一轮开始', '新一輪開始', '新一輪開始', 'New Round Started'],
  codePlanDone:    ['规划完成', '規劃完成', '規劃完成', 'Planning done'],
  codeStepDone:    ['完成步骤', '完成步驟', '完成步驟', 'Step done'],
  codeHandoff:     ['上下文使用率较高，准备接力...', '上下文使用率較高，準備接力...', '上下文使用率較高，準備接力...', 'Context usage high, preparing handoff...'],
  codeAllDone:     ['[完成] 全部任务完成', '[完成] 全部任務完成', '[完成] 全部任務完成', 'All tasks completed'],
  codeMoreSteps:   ['+{n} 步', '+{n} 步', '+{n} 步', '+{n} more'],
  codeShowDetail:  ['查看详情', '查看詳情', '檢視詳情', 'Details'],
  codeHideDetail:  ['收起详情', '收起詳情', '收起詳情', 'Hide'],
  codeGeneratingReport: ['生成报告中...', '生成報告中...', '產生報告中...', 'Generating report...'],
  codeThinkingLabel: ['思考中...', '思考中...', '思考中...', 'Thinking...'],
  codeReportDone:  ['汇报完成', '匯報完成', '匯報完成', 'Report done'],
  codeToolUsed:    ['使用工具', '使用工具', '使用工具', 'Tools'],

  // ── MCP ──
  mcpTabTitle:     ['MCP 服务器', 'MCP 伺服器', 'MCP 伺服器', 'MCP Servers'],
  mcpTabSub:       ['管理 Model Context Protocol 服务器，扩展 AI 能力。', '管理 Model Context Protocol 伺服器，擴展 AI 能力。', '管理 Model Context Protocol 伺服器，擴展 AI 能力。', 'Manage MCP servers to extend AI capabilities.'],
  mcpSidebar:      ['MCP/Skills', 'MCP/Skills', 'MCP/Skills', 'MCP/Skills'],

  // ── Skills ──
  skillsTabTitle:  ['Skills', 'Skills', 'Skills', 'Skills'],
  skillsTabSub:    ['管理 Skills — AI 可自动调用的专业指令集。', '管理 Skills — AI 可自動調用的專業指令集。', '管理 Skills — AI 可自動調用的專業指令集。', 'Manage Skills — specialized instructions that AI can invoke automatically.'],
  capabilityBtn:   ['能力', '能力', '能力', 'Capabilities'],

  // ── MCP/Skills page ──
  mcpSkillsTitle:  ['MCP 与 Skills', 'MCP 與 Skills', 'MCP 與 Skills', 'MCP & Skills'],
  mcpSkillsSub:    ['管理 AI 扩展能力：MCP 服务器和 Skills 指令集。', '管理 AI 擴展能力：MCP 伺服器和 Skills 指令集。', '管理 AI 擴展能力：MCP 伺服器和 Skills 指令集。', 'Manage AI extensions: MCP servers and Skills.'],

  // ── 小说页面 (NovelView) ──
  novTitle:        ['AI 小说工坊', 'AI 小說工坊', 'AI 小說工坊', 'AI Novel Workshop'],
  novSub:          ['让 AI 用手写体在纸上为你创作小说，逐章逐页，可翻页阅读', '讓 AI 用手寫體在紙上為你創作小說，逐章逐頁，可翻頁閱讀', '讓 AI 用手寫體在紙上為你創作小說，逐章逐頁，可翻頁閱讀', 'AI writes novels by hand on paper, chapter by chapter, page by page — readable like a real book.'],
  novNew:          ['新建小说', '新建小說', '新建小說', 'New Novel'],
  novEmptyTitle:   ['书架空空如也', '書架空空如也', '書架空空如也', 'Empty shelf'],
  novEmptyDesc:    ['创建一部小说，选择纸张风格，AI 会逐章逐页为你书写', '創建一部小說，選擇紙張風格，AI 會逐章逐頁為你書寫', '創建一部小說，選擇紙張風格，AI 會逐章逐頁為你書寫', 'Create a novel, pick a paper style, and AI will write it chapter by chapter.'],
  novCreateFirst:  ['创作第一部', '創作第一部', '創作第一部', 'Write your first novel'],
  novChapters:     ['{n} 章', '{n} 章', '{n} 章', '{n} ch.'],
  novWords:        ['{n} 字', '{n} 字', '{n} 字', '{n} words'],
  novWriting:      ['写作中', '寫作中', '寫作中', 'Writing'],
  novNewTitle:     ['新建小说', '新建小說', '新建小說', 'New Novel'],
  novFieldName:    ['书名', '書名', '書名', 'Title'],
  novFieldNamePh:  ['如：星河彼岸、江湖夜雨', '如：星河彼岸、江湖夜雨', '如：星河彼岸、江湖夜雨', 'e.g. Beyond the Galaxy'],
  novFieldGenre:   ['类型', '類型', '類型', 'Genre'],
  novFieldPaper:   ['纸张', '紙張', '紙張', 'Paper'],
  novFieldSummary: ['故事简介', '故事簡介', '故事簡介', 'Synopsis'],
  novFieldSummaryPh: ['简单描述故事背景和主线，AI 会据此创作（可留空让 AI 自由发挥）', '簡單描述故事背景和主線，AI 會據此創作（可留空讓 AI 自由發揮）', '簡單描述故事背景和主線，AI 會據此創作（可留空讓 AI 自由發揮）', 'Briefly describe the story. Leave empty for AI to improvise.'],
  novFieldChapters: ['章节数', '章節數', '章節數', 'Chapters'],
  novFieldWords:   ['每章字数', '每章字數', '每章字數', 'Words / chapter'],
  novCancel:       ['取消', '取消', '取消', 'Cancel'],
  novCreate:       ['开始创作', '開始創作', '開始創作', 'Start Writing'],
  novEnterTitle:   ['请输入书名', '請輸入書名', '請輸入書名', 'Please enter a title'],
  novBackShelf:    ['返回书架', '返回書架', '返回書架', 'Back to shelf'],
  novGenerate:     ['AI 创作', 'AI 創作', 'AI 創作', 'AI Write'],
  novStop:         ['停止', '停止', '停止', 'Stop'],
  novWritingCh:    ['正在写第 {n} 章…', '正在寫第 {n} 章…', '正在寫第 {n} 章…', 'Writing chapter {n}…'],
  novWritingPage:  ['正在写第 {n} 章第 {p} 页…', '正在寫第 {n} 章第 {p} 頁…', '正在寫第 {n} 章第 {p} 頁…', 'Writing ch.{n} page {p}…'],
  novPageDone:     ['第 {n} 章第 {p} 页完成', '第 {n} 章第 {p} 頁完成', '第 {n} 章第 {p} 頁完成', 'Ch.{n} page {p} done'],
  novChDone:       ['第 {n} 章完成', '第 {n} 章完成', '第 {n} 章完成', 'Chapter {n} done'],
  novProgress:     ['第 {n} 章第 {p} 页 · 已写 {w} 字', '第 {n} 章第 {p} 頁 · 已寫 {w} 字', '第 {n} 章第 {p} 頁 · 已寫 {w} 字', 'Ch.{n} p.{p} · {w} words'],
  novDone:         ['创作完成！', '創作完成！', '創作完成！', 'Done!'],
  novGenerating:   ['AI 正在创作…', 'AI 正在創作…', 'AI 正在創作…', 'AI is writing…'],
  novGeneratingHint: ['AI 正在书写，请稍候…', 'AI 正在書寫，請稍候…', 'AI 正在書寫，請稍候…', 'AI is writing, please wait…'],
  novNoChapters:   ['还没有章节，点击右上角「AI 创作」开始', '還沒有章節，點擊右上角「AI 創作」開始', '還沒有章節，點擊右上角「AI 創作」開始', 'No chapters yet. Click "AI Write" to start.'],
  novPageOf:       ['第 {n} / {t} 页', '第 {n} / {t} 頁', '第 {n} / {t} 頁', 'Page {n} / {t}'],
  novPrevPage:     ['上一页', '上一頁', '上一頁', 'Prev'],
  novNextPage:     ['下一页', '下一頁', '下一頁', 'Next'],
  novSelectChapter: ['从左侧选择一章开始阅读', '從左側選擇一章開始閱讀', '從左側選擇一章開始閱讀', 'Select a chapter from the left to read'],
  novRead:         ['阅读', '閱讀', '閱讀', 'Read'],
  novDelete:       ['删除', '刪除', '刪除', 'Delete'],
  novDeleteConfirm: ['确定删除《{name}》吗？所有章节和页面将被永久删除。', '確定刪除《{name}》嗎？所有章節和頁面將被永久刪除。', '確定刪除《{name}》嗎？所有章節和頁面將被永久刪除。', 'Delete "{name}"? All chapters and pages will be permanently removed.'],

  // ── 小说续作 ──
  novContinue:           ['AI 续作', 'AI 續作', 'AI 續作', 'AI Continue'],
  novContinueTitle:      ['续写设置', '續寫設置', '續寫設置', 'Continue Settings'],
  novContinueChapters:   ['续写章数', '續寫章數', '續寫章數', 'Chapters to write'],
  novContinueWords:      ['每章字数', '每章字數', '每章字數', 'Words / chapter'],
  novContinueDirection:  ['续写导向', '續寫導向', '續寫導向', 'Direction'],
  novContinueDirectionPh:['描述接下来的情节走向、新角色、转折等（可留空让 AI 自由发挥）', '描述接下來的情節走向、新角色、轉折等（可留空讓 AI 自由發揮）', '描述接下來的情節走向、新角色、轉折等（可留空讓 AI 自由發揮）', 'Describe upcoming plot, new characters, twists (optional)'],
  novContinueScope:      ['续写范围', '續寫範圍', '續寫範圍', 'Scope'],
  novContinueScopeOverall: ['总览续写', '總覽續寫', '總覽續寫', 'Overall'],
  novContinueScopeChapter: ['指定章节', '指定章節', '指定章節', 'After chapter'],
  novContinueFromCh:     ['续写位置', '續寫位置', '續寫位置', 'Continue from'],
  novContinueFromLast:   ['从最后一章之后', '從最後一章之後', '從最後一章之後', 'After last chapter'],
  novContinueAfterCh:    ['第 {n} 章之后', '第 {n} 章之後', '第 {n} 章之後', 'After chapter {n}'],

  // ── 主页小说卡片 ──
  hpNovels:        ['小说工坊', '小說工坊', '小說工坊', 'Novels'],
  hpNovelsDesc:    ['AI 手写体创作小说，可翻页阅读', 'AI 手寫體創作小說，可翻頁閱讀', 'AI 手寫體創作小說，可翻頁閱讀', 'AI writes novels by hand, page-turnable'],
}

// ═══════════════════════════════════════════
// Build locale maps from the L matrix
// ═══════════════════════════════════════════

const CODES = ['zh-CN', 'zh-HK', 'zh-TW', 'en']
const IDX = { 'zh-CN': 0, 'zh-HK': 1, 'zh-TW': 2, 'en': 3 }

const locales = {}
for (const code of CODES) {
  const idx = IDX[code]
  locales[code] = {}
  for (const key of Object.keys(L)) {
    locales[code][key] = L[key][idx]
  }
}

// ═══════════════════════════════════════════
// Reactive state
// ═══════════════════════════════════════════

const stored = localStorage.getItem('ds_lang')
const defaultLang = CODES.includes(stored) ? stored : 'zh-CN'
const lang = ref(defaultLang)

// ═══════════════════════════════════════════
// API
// ═══════════════════════════════════════════

function t(key, ...params) {
  const dict = locales[lang.value]
  if (!dict) return key
  let str = dict[key] || key
  if (!params.length) return str
  // Support object params: t('key', { n: 5, p: 2 })
  if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
    for (const [k, v] of Object.entries(params[0])) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
    }
    return str
  }
  // Positional params: t('key', 5, 2) → {n}=5, {p}=2, {w}=3rd, {t}=4th, {name}=1st
  const slots = ['n', 'p', 'w', 't', 'name']
  for (let i = 0; i < params.length && i < slots.length; i++) {
    str = str.replace(new RegExp(`\\{${slots[i]}\\}`, 'g'), params[i])
  }
  return str
}

function setLang(code) {
  if (!CODES.includes(code)) return
  lang.value = code
  localStorage.setItem('ds_lang', code)
}

// Get display name for a language in the current language
function langDisplay(code) {
  const meta = LANG_META.find(m => m.code === code)
  if (!meta) return code
  // In Chinese locales, show native names; in English, show English names
  if (lang.value === 'en') return meta.en
  return meta.native
}

// Available languages with display names (reactive computed)
function availableLangs() {
  return LANG_META.map(m => ({
    code: m.code,
    label: langDisplay(m.code),
  }))
}

// Convenience: quick check helpers
const isZh = computed(() => lang.value.startsWith('zh'))
const isEn = computed(() => lang.value === 'en')

export function useI18n() {
  return {
    t,
    lang,
    setLang,
    availableLangs,
    langDisplay,
    LANG_META,
    CODES,
    isZh,
    isEn,
  }
}
