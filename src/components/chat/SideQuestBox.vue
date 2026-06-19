<template>
  <div class="side-quest-wrap">
    <!-- Toggle button — icon only -->
    <button class="side-quest-btn" @click="open = !open" :class="{ active: open }" title="侧边提问">
      <svg class="side-quest-btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 10h.01M12 10h.01M16 10h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <svg :class="['side-quest-chevron', { open }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Collapsible body -->
    <div
      v-if="open"
      class="side-quest-body"
      :class="{ 'mosaic-animating': loading || (sideQuest && !sideQuest.asked) }"
    >
      <div class="side-quest-content">
      <!-- State 1: Not asked yet → input area -->
      <template v-if="!sideQuest">
        <div class="side-quest-input-wrap">
          <textarea
            ref="textareaRef"
            v-model="questionText"
            placeholder="侧边提问只允许问一次"
            :disabled="loading"
            class="side-quest-textarea"
            rows="2"
            @keydown="onKeydown"
          />
          <button
            class="side-quest-send"
            :disabled="!questionText.trim() || loading"
            @click="doAsk"
            title="发送"
          >
            <template v-if="loading">
              <span class="side-quest-send-dot"></span>
            </template>
            <template v-else>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </template>
          </button>
        </div>
      </template>

      <!-- State 2 & 3: Streaming or completed -->
      <template v-else>
        <!-- Question -->
        <div class="side-quest-q">
          <span class="side-quest-q-label">Q</span>
          <span class="side-quest-q-text">{{ sideQuest.question }}</span>
        </div>

        <!-- Thinking / reasoning — above answer, shown during streaming & completed -->
        <div v-if="sideQuest.reasoning" class="side-quest-thinking">
          <div class="side-quest-thinking-head" @click="thinkingOpen = !thinkingOpen">
            <svg :class="['side-quest-thinking-arrow', { open: thinkingOpen }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="side-quest-thinking-label">思考过程</span>
          </div>
          <div v-if="thinkingOpen" class="side-quest-thinking-body">{{ sideQuest.reasoning }}</div>
        </div>

        <!-- Answer (streaming or final) -->
        <div class="side-quest-a" :class="{ streaming: !sideQuest.asked }">
          <span v-if="!sideQuest.answer && !sideQuest.asked" class="side-quest-streaming-hint">思考中...</span>
          {{ sideQuest.answer }}
          <span v-if="!sideQuest.asked" class="side-quest-cursor">|</span>
        </div>

        <!-- Completed-only: actions -->
        <div v-if="sideQuest.asked" class="side-quest-actions">
          <button class="side-quest-action-btn" @click="doCopy" :class="{ done: copyDone }" title="复制">
            <svg v-if="copyDone" width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="side-quest-action-btn del" @click="$emit('delete')" title="删除">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>
      </div><!-- .side-quest-content -->
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  sideQuest: { type: Object, default: null },
  msgId: { type: [String, Number], default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['ask', 'delete'])

const open = ref(false)
const questionText = ref('')
const thinkingOpen = ref(false)
const copyDone = ref(false)
const textareaRef = ref(null)
let _copyTimer = null

// Auto-open when streaming starts, auto-collapse when done
watch(() => props.sideQuest, (sq) => {
  if (sq && !sq.asked) {
    // Streaming: auto-open body, show live answer
    open.value = true
  }
  if (sq && sq.asked) {
    // Completed: collapse thinking and body by default
    thinkingOpen.value = false
    open.value = false
  }
})

// Auto-focus textarea when opening without sideQuest
watch(open, async (val) => {
  if (val && !props.sideQuest) {
    await nextTick()
    textareaRef.value?.focus()
  }
})

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    doAsk()
  }
}

function doAsk() {
  const q = questionText.value.trim()
  if (!q || props.loading) return
  emit('ask', { msgId: props.msgId, question: q })
}

async function doCopy() {
  const sq = props.sideQuest
  if (!sq) return
  const text = `Q: ${sq.question}\nA: ${sq.answer}`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copyDone.value = true
  clearTimeout(_copyTimer)
  _copyTimer = setTimeout(() => { copyDone.value = false }, 1800)
}
</script>

<style scoped>
/* ─── Wrapper ─── */
.side-quest-wrap {
  margin-top: 6px;
}

/* ─── Toggle button — icon only ─── */
.side-quest-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg2);
  color: var(--text3);
  cursor: pointer;
  transition: all 0.15s;
}
.side-quest-btn:hover {
  border-color: var(--accent-muted);
  color: var(--text2);
  background: var(--bg3);
}
.side-quest-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}
.side-quest-btn-icon {
  flex-shrink: 0;
  color: inherit;
}
.side-quest-chevron {
  flex-shrink: 0;
  color: inherit;
  opacity: 0.5;
  transition: transform 0.15s ease;
}
.side-quest-chevron.open {
  transform: rotate(90deg);
}

/* ─── Body ─── */
.side-quest-body {
  --b1: #1E90FF;
  --b2: #1873CC;
  --b3: #1256A0;
  --b4: #0D3D75;
  --b5: #08284D;
  --b6: #041830;
  --mq: 26px;  /* mosaic cell size — slightly larger for better blur fusion */
  margin-top: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius);
  border-left: 2px solid var(--accent-muted);
  position: relative;
  isolation: isolate;
  background-color: #0a1628;
  background-image:
    /* Layer 1: 6-color horizontal bands */
    repeating-linear-gradient(0deg,
      var(--b1) 0px var(--mq),
      var(--b2) var(--mq) calc(var(--mq) * 2),
      var(--b3) calc(var(--mq) * 2) calc(var(--mq) * 3),
      var(--b4) calc(var(--mq) * 3) calc(var(--mq) * 4),
      var(--b5) calc(var(--mq) * 4) calc(var(--mq) * 5),
      var(--b6) calc(var(--mq) * 5) calc(var(--mq) * 6)
    ),
    /* Layer 2: vertical overlay → mosaic grid */
    repeating-linear-gradient(90deg,
      rgba(255,255,255,0.12) 0px var(--mq),
      rgba(0,0,0,0.10) var(--mq) calc(var(--mq) * 2),
      rgba(255,255,255,0.06) calc(var(--mq) * 2) calc(var(--mq) * 3),
      rgba(0,0,0,0.14) calc(var(--mq) * 3) calc(var(--mq) * 4),
      rgba(255,255,255,0.08) calc(var(--mq) * 4) calc(var(--mq) * 5),
      rgba(0,0,0,0.08) calc(var(--mq) * 5) calc(var(--mq) * 6)
    );
  background-size: calc(var(--mq) * 6) calc(var(--mq) * 6);
  background-position: 0 0, 0 0;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.06),
    0 2px 16px rgba(0,0,0,0.35);
}

/* Apple-style frosted glass — just blur */
.side-quest-body::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
  z-index: 1;
}

/* Mosaic animation — shifts both layers for a flowing effect */
.side-quest-body.mosaic-animating {
  animation: mosaicFlow 2.5s linear infinite;
}

@keyframes mosaicFlow {
  0%   { background-position: 0 0, 0 0; }
  100% { background-position: 0 calc(var(--mq) * 6), calc(var(--mq) * 6) 0; }
}

/* Content layer — sits above glass pane */
.side-quest-content {
  position: relative;
  z-index: 3;
}

/* ─── Input area ─── */
.side-quest-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.side-quest-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(0,0,0,0.3);
  color: #fff;
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  line-height: 1.5;
  resize: vertical;
  min-height: 40px;
  outline: none;
  transition: border-color 0.15s;
}
.side-quest-textarea:focus {
  border-color: var(--accent);
}
.side-quest-textarea::placeholder {
  color: rgba(255,255,255,0.80);
}
.side-quest-send {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: flex-end;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}
.side-quest-send:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
.side-quest-send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.side-quest-send-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: sqSendPulse 0.8s ease-in-out infinite;
}
@keyframes sqSendPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* ─── Thinking / reasoning ─── */
.side-quest-thinking {
  margin-top: 8px;
}
.side-quest-thinking-head {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}
.side-quest-thinking-head:hover { color: rgba(255,255,255,0.8); }
.side-quest-thinking-arrow {
  flex-shrink: 0;
  color: rgba(255,255,255,0.5);
  transition: transform 0.15s ease;
}
.side-quest-thinking-arrow.open { transform: rotate(90deg); }
.side-quest-thinking-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.5);
  letter-spacing: 0.3px;
}
.side-quest-thinking-body {
  margin-top: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255,255,255,0.65);
  white-space: pre-wrap;
  word-break: break-word;
  padding: 6px 8px;
  border-left: 2px solid var(--accent-muted);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: rgba(0,0,0,0.3);
  max-height: 160px;
  overflow-y: auto;
}

/* ─── Question ─── */
.side-quest-q {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1.5;
}
.side-quest-q-label {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--accent);
  font-size: 11px;
}
.side-quest-q-text {
  color: #fff;
  word-break: break-word;
}

/* ─── Answer — white text for readability ─── */
.side-quest-a {
  font-size: 13px;
  line-height: 1.65;
  color: #fff;
  word-break: break-word;
  white-space: pre-wrap;
}
.side-quest-a.streaming {
  /* subtle indicator during streaming */
}
.side-quest-streaming-hint {
  color: rgba(255,255,255,0.65);
  font-style: italic;
}
.side-quest-cursor {
  display: inline;
  color: var(--accent);
  animation: sqCursorBlink 0.7s step-end infinite;
}
@keyframes sqCursorBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* ─── Actions — icon only ─── */
.side-quest-actions {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.1);
}
.side-quest-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.55);
  cursor: pointer;
  transition: all 0.15s;
}
.side-quest-action-btn:hover {
  background: rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.85);
}
.side-quest-action-btn.del:hover {
  border-color: var(--red);
  color: var(--red);
  background: rgba(248,81,73,0.12);
}
.side-quest-action-btn.done {
  border-color: var(--green) !important;
  color: var(--green) !important;
  background: rgba(34,197,94,0.15) !important;
}
</style>

<style>
/* non-scoped: guarantee placeholder & text color apply regardless of Vue scoping */
.side-quest-textarea {
  color: #fff !important;
}
.side-quest-textarea::placeholder {
  color: rgba(255,255,255,0.70) !important;
}
[data-theme="light"] .side-quest-textarea {
  color: var(--text) !important;
}
[data-theme="light"] .side-quest-textarea::placeholder {
  color: rgba(26, 39, 68, 0.45) !important;
}
</style>
