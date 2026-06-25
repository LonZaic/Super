// ─── Function Calling: Native DeepSeek tools API ───
import { hasSMTP, sendEmail, scheduleEmail, parseSendTime } from './email.js'
import { addMemory, searchMemories, getMemories } from '../db/database.js'

// ─── Image library search (Wikimedia Commons, free, no API key) ───
export async function searchImageLibrary(query, limit = 6) {
    const res = await fetch('/api/image-library/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '图片搜索失败')
    return data.results || []
}

// ═══════════════════════════════════════════════════════════════════════
// Information Agent tools — read & reply across email/feishu/dingtalk/wecom/github/rss
// ═══════════════════════════════════════════════════════════════════════

// Fetch configured inbox sources (so AI knows what's available)
async function getInboxSources() {
    try {
        const res = await fetch('/api/inbox/sources')
        const data = await res.json()
        return (data?.data || []).filter(s => s.enabled)
    } catch { return [] }
}

// email tools definition for DeepSeek native function calling
function getEmailTools() {
    if (!hasSMTP()) return { tools: [], executors: {} }
    return {
        tools: [
            {
                type: 'function',
                function: {
                    name: 'send_email',
                    description: '发送邮件。用户说"发邮件""帮我发""发送到邮箱"时调用此工具。支持带附件发送，支持一次发给多个收件人（to 传数组即可群发）。',
                    parameters: {
                        type: 'object',
                        properties: {
                            to: {
                                description: '收件人邮箱地址。可以传单个字符串，也可以传字符串数组一次群发给多人。',
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } },
                                ],
                            },
                            cc: {
                                description: '抄送收件人（可选）。可传字符串或字符串数组。',
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } },
                                ],
                            },
                            subject: { type: 'string', description: '邮件主题' },
                            text: { type: 'string', description: '邮件正文' },
                            attachments: {
                                type: 'array',
                                description: '附件列表。每项为 { filename, path }（本地文件路径）或 { filename, url }（远程图片URL）。',
                                items: { type: 'object' },
                            },
                        },
                        required: ['to', 'subject', 'text'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'schedule_email',
                    description: '定时发送邮件。用户说"明天发""5分钟后发""下午3点发"时调用。支持多收件人。',
                    parameters: {
                        type: 'object',
                        properties: {
                            time: { type: 'string', description: '自然语言时间，如"明天上午8点""5分钟后""下周三下午3点"' },
                            to: {
                                description: '收件人邮箱地址，可传字符串或字符串数组。',
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } },
                                ],
                            },
                            subject: { type: 'string', description: '邮件主题' },
                            text: { type: 'string', description: '邮件正文' },
                        },
                        required: ['time', 'to', 'subject', 'text'],
                    },
                },
            },
        ],
        executors: {
            send_email: async (args) => {
                const opts = {}
                if (args.cc) opts.cc = args.cc
                if (Array.isArray(args.attachments) && args.attachments.length > 0) {
                    opts.attachments = args.attachments
                }
                const result = await sendEmail(args.to, args.subject, args.text, opts)
                const n = result?.recipients || (Array.isArray(args.to) ? args.to.length : 1)
                return JSON.stringify({ success: true, messageId: result?.messageId || 'sent', recipients: n, attachments: args.attachments?.length || 0 })
            },
            schedule_email: async (args) => {
                const parsed = parseSendTime(args.time)
                if (parsed.type === 'immediate' || parsed.delay <= 1000) {
                    await sendEmail(args.to, args.subject, args.text)
                    return JSON.stringify({ success: true, msg: '邮件已立即发送' })
                }
                const r = await scheduleEmail(args.to, args.subject, args.text, args.time)
                return JSON.stringify({ success: true, msg: `邮件已定时于 ${parsed.time.toLocaleString('zh-CN')} 发送` })
            },
        },
    }
}

// ═══ Information Agent tools: fetch messages + reply + send to channels ═══
function getInboxTools() {
    return {
        tools: [
            {
                type: 'function',
                function: {
                    name: 'fetch_messages',
                    description: '读取用户各信息源（邮箱/飞书/GitHub/RSS等）的最新消息。用户说"今天收到什么消息""帮我看看邮箱""最近有什么通知""飞书有什么新消息"时调用。可指定单个信息源，也可不传 sourceId 读取所有已配置的信息源。返回的消息按时间倒序排列。',
                    parameters: {
                        type: 'object',
                        properties: {
                            sourceId: { type: 'string', description: '指定读取某个信息源（可选）。不传则读取所有已启用的信息源。' },
                            limit: { type: 'integer', description: '每个信息源最多读取多少条，默认15' },
                        },
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'reply_email',
                    description: '回复一封邮件。用户说"帮我回复""回他邮件"时调用。需要指定用哪个邮箱信息源（sourceId）发送，以及回复内容。可带上原邮件的 messageId 形成邮件线程。',
                    parameters: {
                        type: 'object',
                        properties: {
                            sourceId: { type: 'string', description: '邮箱信息源的 ID（从 fetch_messages 的结果中获取，或从已配置信息源列表获取）' },
                            to: {
                                description: '收件人邮箱地址，可传字符串或字符串数组（群发）。',
                                oneOf: [
                                    { type: 'string' },
                                    { type: 'array', items: { type: 'string' } },
                                ],
                            },
                            subject: { type: 'string', description: '邮件主题（回复时通常加 Re: 前缀）' },
                            text: { type: 'string', description: '回复正文' },
                            inReplyTo: { type: 'string', description: '原邮件的 Message-ID（可选，用于邮件线程关联）' },
                        },
                        required: ['sourceId', 'to', 'subject', 'text'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'send_channel',
                    description: '向飞书/钉钉/企业微信群发送消息。用户说"发到飞书群""通知钉钉""发企业微信"时调用。需要指定信息源 sourceId。',
                    parameters: {
                        type: 'object',
                        properties: {
                            sourceId: { type: 'string', description: '信息源 ID（飞书/钉钉/企业微信）' },
                            text: { type: 'string', description: '要发送的文本内容' },
                            chatId: { type: 'string', description: '飞书目标群 chat_id（可选，不传则用配置的默认群）' },
                            markdown: { type: 'string', description: '钉钉/企业微信的 markdown 内容（可选，传了则发 markdown 格式）' },
                        },
                        required: ['sourceId', 'text'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'list_inbox_sources',
                    description: '列出用户已配置的所有信息源（邮箱/飞书/钉钉/企业微信/GitHub/RSS）。当用户问"我配置了哪些信息源""能读哪些消息"或你需要知道有哪些信息源可用时调用。返回每个信息源的 ID、类型、名称和是否启用。',
                    parameters: { type: 'object', properties: {} },
                },
            },
        ],
        executors: {
            fetch_messages: async (args) => {
                const res = await fetch('/api/inbox/fetch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourceId: args.sourceId, limit: args.limit || 15 }),
                })
                const data = await res.json()
                if (!data.success) return JSON.stringify({ success: false, error: data.error?.message || '读取失败' })
                const { messages, errors } = data.data || {}
                // Compact the messages for the model (avoid huge payloads)
                const compact = (messages || []).map(m => ({
                    source: m.source,
                    sourceName: m.sourceName,
                    from: m.from,
                    subject: m.subject,
                    body: (m.body || '').slice(0, 800),
                    date: m.date,
                    unread: m.unread,
                    id: m.id,
                    sourceId: m.sourceId,
                }))
                return JSON.stringify({
                    success: true,
                    count: compact.length,
                    messages: compact,
                    errors: errors || [],
                    hint: '请基于这些消息用自然语言总结给用户。按来源/重要程度归类，未读消息优先。不要逐条罗列原始数据。',
                })
            },
            reply_email: async (args) => {
                const res = await fetch('/api/inbox/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceId: args.sourceId,
                        to: args.to,
                        subject: args.subject,
                        text: args.text,
                        inReplyTo: args.inReplyTo,
                    }),
                })
                const data = await res.json()
                if (!data.success) return JSON.stringify({ success: false, error: data.error?.message || '回复失败' })
                return JSON.stringify({ success: true, messageId: data.data?.messageId, recipients: data.data?.recipients })
            },
            send_channel: async (args) => {
                const res = await fetch('/api/inbox/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceId: args.sourceId,
                        text: args.text,
                        chatId: args.chatId,
                        markdown: args.markdown,
                    }),
                })
                const data = await res.json()
                if (!data.success) return JSON.stringify({ success: false, error: data.error?.message || '发送失败' })
                return JSON.stringify({ success: true, messageId: data.data?.messageId })
            },
            list_inbox_sources: async () => {
                const sources = await getInboxSources()
                const compact = sources.map(s => ({
                    id: s.id,
                    type: s.type,
                    name: s.name,
                    enabled: s.enabled,
                    capabilities: s.config?.capabilities || [],
                }))
                return JSON.stringify({ success: true, sources: compact })
            },
        },
    }
}

// ═══ Memory tools: persistent cross-conversation user memory ═══
function getMemoryTools() {
    return {
        tools: [
            {
                type: 'function',
                function: {
                    name: 'save_memory',
                    description: '将用户的事实、偏好、重要信息保存到长期记忆。这些记忆会跨所有对话持久保存，下次对话时自动召回。当用户说"记住""以后都""我的XX是"或透露了值得长期记住的信息（姓名、职业、偏好、项目背景、重要决定等）时调用。不要保存临时信息或一次性任务。',
                    parameters: {
                        type: 'object',
                        properties: {
                            content: { type: 'string', description: '要记住的内容，用简洁的陈述句。如"用户是前端工程师""用户偏好用 TypeScript""用户的项目用 Vue3 + Pinia"' },
                            category: { type: 'string', description: '记忆类别：fact(事实)、preference(偏好)、project(项目背景)、decision(决定)、contact(联系人)', enum: ['fact', 'preference', 'project', 'decision', 'contact'] },
                        },
                        required: ['content'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'recall_memory',
                    description: '搜索用户的长期记忆。当你需要回忆用户之前告诉过你的信息时调用（如用户说"我之前说过的""你还记得吗"或你需要用户背景信息来给出更好的回答时）。不传 query 则返回所有记忆。',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: '搜索关键词（可选，不传返回全部）' },
                        },
                    },
                },
            },
        ],
        executors: {
            save_memory: async (args) => {
                const id = addMemory(args.content, args.category || 'fact')
                return JSON.stringify({ success: true, id, msg: '已记住：' + args.content })
            },
            recall_memory: async (args) => {
                const memories = args.query ? searchMemories(args.query) : getMemories()
                return JSON.stringify({
                    success: true,
                    count: memories.length,
                    memories: memories.map(m => ({ content: m.content, category: m.category, date: m.created_at })),
                })
            },
        },
    }
}

// ═══ AI Image Generation tool (Pollinations.ai — free, no API key) ═══
function getImageGenTool() {
    return {
        tools: [
            {
                type: 'function',
                function: {
                    name: 'generate_image',
                    description: '用 AI 生成图片。用户说"画一张""生成图片""帮我画""AI画图"时调用。支持各种风格：写实、动漫、油画、水彩、3D、logo、插画等。生成后会直接在聊天中显示图片。描述越详细效果越好。',
                    parameters: {
                        type: 'object',
                        properties: {
                            prompt: { type: 'string', description: '图片描述，越详细越好。如"一只橘猫坐在窗台上看夕阳，写实风格，暖色调"' },
                            width: { type: 'integer', description: '图片宽度，默认1024' },
                            height: { type: 'integer', description: '图片高度，默认1024' },
                            seed: { type: 'integer', description: '随机种子（可选），相同种子+描述生成相同图片' },
                        },
                        required: ['prompt'],
                    },
                },
            },
        ],
        executors: {
            generate_image: async (args) => {
                const prompt = encodeURIComponent(args.prompt)
                const w = args.width || 1024
                const h = args.height || 1024
                const seed = args.seed || Math.floor(Math.random() * 1000000)
                // Pollinations.ai — free, no API key, supports FLUX model
                const url = `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&seed=${seed}&model=flux&nologo=true`
                return JSON.stringify({
                    success: true,
                    url,
                    prompt: args.prompt,
                    seed,
                    width: w,
                    height: h,
                    display: 'image',
                })
            },
        },
    }
}

// ─── Image library tool (图文并发) ───
function getImageLibraryTool() {
    return {
        type: 'function',
        function: {
            name: 'search_image',
            description: '【图片搜索/生成工具】根据关键词搜索并返回真实图片，图片会自动展示在聊天中。**此工具必定返回图片，永远不会"搜不到"**。当用户想要看图片、要图片、搜图片、发图片、配图时必须调用此工具（而不是只用文字说"让我搜索"）。触发词包括但不限于："给我看张图""配个图""有没有XXX的图片""搜个XXX图片""发张XXX的图""我想看XXX""找张XXX的图""展示XXX""搜一下XXX的图"。只要用户提到具体事物/风景/人物/动物/物品并暗示要图片，就立即调用此工具。禁止只用文字回复"正在搜索"而不调用工具。',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '图片搜索关键词，如"埃菲尔铁塔""猫""DNA结构"' },
                    limit: { type: 'number', description: '返回图片数量，默认3，最多6' },
                },
                required: ['query'],
            },
        },
    }
}

// ─── Interactive choice tool (Claude-style inline interaction) ───
function getAskUserChoiceTool() {
    return {
        type: 'function',
        function: {
            name: 'ask_user_choice',
            description: '当用户的请求有多种理解、多种方案、或需要用户做选择时，用此工具向用户展示选项让用户选择。例如：用户说"帮我发邮件"但没说发给谁→展示候选收件人；用户说"找那个文件"找到多个→展示让用户选；有多种实现方案→展示方案让用户选。调用后停止生成，等待用户选择。每次最多展示4个选项。',
            parameters: {
                type: 'object',
                properties: {
                    prompt: { type: 'string', description: '给用户的提示语，如"你想发给谁？""找到以下文件，你要哪个？"' },
                    choices: {
                        type: 'array',
                        description: '选项列表，最多4个',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string', description: '选项显示文字' },
                                value: { type: 'string', description: '选项的值（用户选择后返回给AI）' },
                                desc: { type: 'string', description: '选项的补充说明（可选）' },
                            },
                        },
                    },
                    multi: { type: 'boolean', description: '是否允许多选，默认false' },
                },
                required: ['prompt', 'choices'],
            },
        },
    }
}

// Design preview function — AI calls this when user wants visual design
function getDesignTool() {
    return {
        type: 'function',
        function: {
            name: 'request_design_preview',
            description: '仅当用户要求设计网页/UI界面/HTML页面/前端组件时调用，让用户选择目标设备。调用后停止生成，等待用户选择设备。注意：架构图、流程图、Mermaid图、SVG图表、数据可视化、时序图——这些不属于UI设计，应直接输出代码块，不要调用此函数。',
            parameters: {
                type: 'object',
                properties: {
                    summary: { type: 'string', description: '一句话描述你要设计什么，不超过20字' },
                },
                required: ['summary'],
            },
        },
    }
}

// Classification tool — forces AI to classify every request as design or chat
function getClassifyTool() {
    return {
        type: 'function',
        function: {
            name: 'classify_intent',
            description: '判断用户意图：是要求设计/创建网页UI界面，还是普通对话。',
            parameters: {
                type: 'object',
                properties: {
                    intent: {
                        type: 'string',
                        enum: ['design', 'chat'],
                        description: 'design=用户要求设计网页/UI界面/HTML页面/前端组件/布局; chat=普通对话/问答/代码/闲聊/架构图/流程图/Mermaid/SVG图表'
                    },
                    summary: {
                        type: 'string',
                        description: '如果intent=design，简述设计内容(20字内)；否则留空'
                    },
                },
                required: ['intent'],
            },
        },
    }
}

// Call DeepSeek API to classify user intent (lightweight, non-streaming)
async function classifyIntent(userText, apikey, contextMsgs = []) {
    // Build messages: system + recent context (max 4) + current user msg
    const messages = [
        { role: 'system', content: '判断用户意图。只有用户明确说"设计网页/做UI/画界面/H5页面/前端组件/写个网站/做个页面/APP界面"才返回design。以下场景必须返回chat：写代码/脚本/程序、代码版本转换（py转js等）、算法/数据结构、后端/CLI/API、数据处理、画架构图/流程图/时序图/Mermaid图/SVG图表。不确定就返回chat。用户的当前需求是"写代码"还是"设计UI界面"？' },
    ]
    const recent = contextMsgs.slice(-4)
    for (const m of recent) {
        messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: (m.text || '').slice(0, 100) })
    }
    messages.push({ role: 'user', content: userText })

    const body = {
        model: 'deepseek-v4-flash',
        stream: false,
        max_tokens: 500,  // reasoning models need extra budget for think+tool_call
        messages,
        tools: [getClassifyTool()],
        // [!] Use 'auto' instead of forced tool_choice — DeepSeek V4 Flash
        // "thinking mode" rejects { type: 'function', function: { name: '...' } }
        // with 400: "Thinking mode does not support this tool_choice"
        tool_choice: 'auto',
    }

    const { getApiHeaders } = await import('./apiHeaders.js')
    const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
    }

    const wrapper = await res.json()
    const data = (wrapper && typeof wrapper === 'object' && 'success' in wrapper) ? (wrapper.data?.raw || wrapper.data || wrapper) : wrapper
    const tc = data.choices?.[0]?.message?.tool_calls?.[0]
    if (!tc || tc.function?.name !== 'classify_intent') {
        // Model chose not to call the tool — fallback to checking content
        const content = (data.choices?.[0]?.message?.content || '').toLowerCase()
        const isDesign = content.includes('design') && !content.includes('chat')
        return { intent: isDesign ? 'design' : 'chat', summary: '' }
    }

    let args = {}
    try { args = JSON.parse(tc.function.arguments) } catch {}
    return {
        intent: args.intent || 'chat',
        summary: args.summary || '',
    }
}

export { getEmailTools, getInboxTools, getMemoryTools, getImageGenTool, getDesignTool, classifyIntent, getImageLibraryTool, getAskUserChoiceTool }
