<template>
  <div class="cac-root" :class="[cs?.actionType || 'running']">
    <!-- 3-line output — centered -->
    <div class="cac-body">
      <!-- Line 1: Thinking — chat-style, auto-collapse when done -->
      <div v-if="cs?.thinkingText" class="cac-line cac-think" :class="{ collapsed: cs?.thinkingDone }">
        <button class="cac-think-hdr" @click="cs.thinkingOpen = !cs.thinkingOpen">
          <svg class="cac-think-chev" :class="{ open: cs?.thinkingOpen !== false }" width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M3 2l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="cac-think-label">思考</span>
        </button>
        <div v-if="cs?.thinkingOpen !== false" class="cac-think-body">{{ cs?.thinkingText.slice(-500) }}</div>
      </div>

      <!-- Line 2: Action description -->
      <div class="cac-line cac-action" :class="cs?.actionType">
        <span class="cac-action-text">{{ cs?.actionText || '准备中...' }}</span>
      </div>

      <!-- Line 3: Tool tags -->
      <div v-if="cs?.toolTags && cs.toolTags.length" class="cac-line cac-tools">
        <span v-for="t in cs.toolTags" :key="t.id" class="cac-tool-tag" :class="{ live: t.live, done: t.done }">
          <!-- Command icon -->
          <svg v-if="t.live && (t.tool === 'execute_command' || t.tool === 'run_command' || t.tool === 'bash')" class="cac-tag-icon" width="10" height="10" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1.5" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="0.8"/>
            <path d="M3.5 4.5l1.2 1.5-1.2 1.5" stroke="currentColor" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5.8 7.5h2.7" stroke="currentColor" stroke-width="0.7" stroke-linecap="round"/>
          </svg>
          <!-- Live pulse dot -->
          <svg v-else-if="t.live" class="cac-tag-icon cac-tag-live" width="6" height="6" viewBox="0 0 6 6" fill="none">
            <circle cx="3" cy="3" r="2.5" fill="currentColor">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <!-- Done check -->
          <svg v-else class="cac-tag-icon" width="7" height="7" viewBox="0 0 7 7" fill="none">
            <path d="M1.5 3.5l1.3 1.3 2.7-2.7" stroke="var(--green)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ t.label }}
        </span>
      </div>

      <!-- Plan area (below line 3) — always show items, completed get strikethrough -->
      <div v-if="cs?.tasks && cs.tasks.length" class="cac-plan">
        <div v-for="t in visiblePlan" :key="t.id" class="cac-plan-item" :class="{ done: t.status === 'completed', active: t.status === 'in_progress' }">
          <svg v-if="t.status === 'completed'" width="10" height="10" viewBox="0 0 10 10" fill="none" class="cac-plan-icon">
            <circle cx="5" cy="5" r="4.5" stroke="var(--green)" stroke-width="0.8"/>
            <path d="M3 5l1.3 1.3 2.7-2.7" stroke="var(--green)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="t.status === 'in_progress'" width="10" height="10" viewBox="0 0 10 10" fill="none" class="cac-plan-icon cac-plan-icon-active">
            <circle cx="5" cy="5" r="4" stroke="var(--accent)" stroke-width="1"/>
            <path d="M5 2.5v2.5l1.5 1" stroke="var(--accent)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none" class="cac-plan-icon">
            <circle cx="5" cy="5" r="4" stroke="var(--text3)" stroke-width="0.8"/>
          </svg>
          <span class="cac-plan-text" :class="{ strike: t.status === 'completed' }">{{ t.text }}</span>
        </div>
        <button v-if="cs.tasks.length > 5 && !planExpanded" class="cac-plan-more" @click="planExpanded = true">
          +{{ cs.tasks.length - 5 }}
        </button>
      </div>

      <!-- Command outputs — single line, expand to see all -->
      <div v-if="cs?.commandOutputs && cs.commandOutputs.length" class="cac-terminal" :class="{ open: terminalOpen }">
        <button class="cac-terminal-hdr" @click="terminalOpen = !terminalOpen">
          <svg class="cac-terminal-chev" :class="{ open: terminalOpen }" width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M2.5 1.5l3 2.5-3 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="cac-terminal-sum">{{ latestCmdSummary }}</span>
          <span class="cac-terminal-count">{{ cs.commandOutputs.length }}</span>
        </button>
        <div v-if="terminalOpen" class="cac-terminal-list">
          <div v-for="(cmd, idx) in cs.commandOutputs" :key="cmd.id" class="cac-terminal-item" :class="{ last: idx === cs.commandOutputs.length - 1 }">
            <span class="cac-terminal-item-sum">{{ cmd._summary }}</span>
            <pre class="cac-terminal-body">{{ cmd._output }}</pre>
          </div>
        </div>
      </div>

    </div>

    <!-- Yammy GIF — left when working, right when done -->
    <div v-if="yammyActive" class="cac-yammy" :class="{ done: !isRunning, shaking: yammyShaking }" @click.stop="$emit('yammyClick')">
      <img ref="yammyImg" src="/yammy.gif" class="cac-yammy-gif" alt="yammy" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
  yammyActive: { type: Boolean, default: false },
  yammyPlaying: { type: Boolean, default: false },
  yammyShaking: { type: Boolean, default: false },
})

defineEmits(['yammyClick'])

const cs = computed(() => props.message?._compactState || null)
const isRunning = computed(() => cs.value?.actionType === 'running')
const visiblePlan = computed(() => (cs.value?.tasks || []).slice(0, 5))
const planExpanded = ref(false)
const terminalOpen = ref(false)

const latestCmdSummary = computed(() => {
  const outs = cs.value?.commandOutputs || []
  if (!outs.length) return ''
  return outs[outs.length - 1]._summary
})

// ─── Yammy GIF canvas pause/play ───
const yammyImg = ref(null)

function pauseYammy() {
  const img = yammyImg.value
  if (!img || !img.complete || img.naturalWidth === 0) return
  try {
    const c = document.createElement('canvas')
    c.width = img.naturalWidth || 32
    c.height = img.naturalHeight || 32
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    img.src = c.toDataURL('image/gif')
  } catch {}
}

function playYammy() {
  const img = yammyImg.value
  if (!img) return
  img.src = ''
  img.src = '/yammy.gif?t=' + Date.now()
}

watch(() => props.yammyPlaying, (playing) => {
  nextTick(() => { if (playing) playYammy(); else pauseYammy() })
})

watch(() => props.yammyActive, (active) => {
  if (!active) return
  nextTick(() => {
    if (!props.yammyPlaying) {
      const img = yammyImg.value
      if (img) {
        img.onload = () => { nextTick(() => pauseYammy()) }
        img.src = '/yammy.gif?t=' + Date.now()
      }
    }
  })
}, { immediate: true })
</script>

<style scoped>
/* Root */
.cac-root {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
  position: relative;
}

/* Yammy — below body, left when running, right when done */
.cac-yammy {
  cursor: pointer;
  transition: all 0.35s ease;
  margin-top: 2px;
}
.cac-yammy:not(.done) {
  align-self: flex-start;
  margin-left: 4px;
  opacity: 1;
}
.cac-yammy.done {
  align-self: flex-end;
  margin-right: 4px;
}
.cac-yammy-gif { width: 24px; height: 24px; object-fit: contain; }
.cac-yammy:hover { transform: scale(1.1); }
.cac-yammy.shaking { animation: cacShake 0.5s ease-in-out; }
@keyframes cacShake {
  0%,100%{transform:translateX(0)rotate(0)} 10%{transform:translateX(-5px)rotate(-4deg)}
  30%{transform:translateX(5px)rotate(4deg)} 50%{transform:translateX(-3px)rotate(-2deg)}
  70%{transform:translateX(3px)rotate(2deg)} 90%{transform:translateX(-1px)rotate(-1deg)}
}

/* Body — centered */
.cac-body {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}

/* ═══ Line 1: Thinking ═══ */
.cac-think {
  border-left: 2px solid var(--accent-muted);
  padding-left: 6px;
  transition: border-color 0.2s;
}
.cac-think.collapsed {
  border-left-color: var(--border);
}
.cac-think-hdr {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--text3);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  padding: 1px 0;
}
.cac-think-chev {
  transition: transform 0.15s;
  flex-shrink: 0;
  color: var(--text3);
}
.cac-think-chev.open { transform: rotate(90deg); }
.cac-think-label {
  font-family: var(--font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .04em;
  font-weight: 500;
}
.cac-think-body {
  font-size: 11px;
  line-height: 1.55;
  color: var(--text3);
  font-weight: 300;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 2px 0 4px;
}

/* Line 2: Action */
.cac-action {
  display: flex;
  align-items: center;
  min-height: 18px;
}
.cac-action-text {
  font-size: 12px;
  font-weight: 400;
  color: var(--text2);
  line-height: 1.4;
}

/* ═══ Line 3: Tools ═══ */
.cac-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.cac-tool-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: 400;
  color: var(--text3);
  background: var(--bg3);
  animation: fadeTagIn 0.2s ease both;
  transition: color 0.15s, background 0.15s;
}
.cac-tool-tag.live { color: var(--accent); background: var(--accent-muted); }
.cac-tool-tag.done { color: var(--text3); background: transparent; }
.cac-tag-icon { flex-shrink: 0; }
.cac-tag-live { color: var(--accent); }
@keyframes fadeTagIn {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Plan (below line 3) */
.cac-plan {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 0 0;
}
.cac-plan-item {
  font-size: 11px;
  color: var(--text2);
  font-weight: 300;
  padding: 1px 0;
  display: flex;
  align-items: center;
  gap: 5px;
}
.cac-plan-item.done { opacity: 0.5; }
.cac-plan-item.active { color: var(--accent); font-weight: 400; }
.cac-plan-icon { flex-shrink: 0; margin-top: 1px; }
.cac-plan-icon-active {
  animation: planIconSpin 2s linear infinite;
}
@keyframes planIconSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.cac-plan-text.strike { text-decoration: line-through; }
.cac-plan-more {
  border: none; background: none; color: var(--text3); font-size: 10px;
  font-family: inherit; cursor: pointer; padding: 1px 0; text-align: left;
}
.cac-plan-more:hover { color: var(--accent); }

/* Terminal — minimal, no boxes */
.cac-terminal {
  margin-top: 2px;
  padding-left: 4px;
  border-left: 1.5px solid var(--border);
}
.cac-terminal-hdr {
  display: flex; align-items: center; gap: 5px;
  border: none; background: none;
  color: var(--text3); font-size: 10px; font-family: var(--font-mono); cursor: pointer;
  padding: 2px 0; width: 100%; text-align: left;
  transition: color 0.12s;
}
.cac-terminal-hdr:hover { color: var(--text2); }
.cac-terminal-chev { flex-shrink: 0; transition: transform 0.15s; color: var(--text3); }
.cac-terminal-chev.open { transform: rotate(90deg); }
.cac-terminal-sum {
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cac-terminal-count {
  font-size: 9px; color: var(--text3); opacity: 0.5;
}
.cac-terminal-count::before { content: '+'; }
.cac-terminal-list {
  margin-top: 1px;
  padding-left: 12px;
  border-left: 1px solid var(--border);
}
.cac-terminal-item {
  padding: 3px 0;
}
.cac-terminal-item:not(.last) {
  border-bottom: 1px dotted var(--border);
  margin-bottom: 2px;
  padding-bottom: 5px;
}
.cac-terminal-item-sum {
  font-size: 10px; font-family: var(--font-mono); font-weight: 500;
  color: var(--text2);
  display: block;
  margin-bottom: 2px;
  cursor: default;
}
.cac-terminal-body {
  padding: 2px 0;
  font-size: 10px; font-family: var(--font-mono);
  color: var(--text3); font-weight: 300;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 140px;
  overflow-y: auto;
  cursor: default;
}

</style>
