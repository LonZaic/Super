<template>
  <!-- 定时任务开关按钮 -->
  <button class="sched-toggle" :class="{ on: showPanel }" @click="showPanel = !showPanel" :title="t('dsSchedule')">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7.5" r="5" stroke="currentColor" stroke-width="1.3"/>
      <path d="M7 4.5v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 1.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <span v-if="schedules.length" class="sched-badge">{{ schedules.length }}</span>
  </button>

  <!-- 定时计划表面板 -->
  <teleport to="body">
    <div v-if="showPanel" class="sched-overlay" @click.self="showPanel = false">
      <div class="sched-modal">
        <div class="sched-header">
          <span class="sched-title">{{ t('dsScheduleTitle') }}</span>
          <button class="sched-close" @click="showPanel = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="sched-body">
          <!-- 已有定时任务列表 -->
          <div v-if="schedules.length" class="sched-list">
            <div v-for="(s, i) in schedules" :key="i" class="sched-item">
              <div class="sched-item-time">{{ formatTime(s.time) }}</div>
              <div class="sched-item-main">
                <div class="sched-item-task">{{ s.task }}</div>
                <div class="sched-item-meta">
                  <span class="sched-item-agent">{{ s.agentName }}</span>
                  <span class="sched-item-repeat">{{ repeatLabel(s.repeat) }}</span>
                </div>
              </div>
              <button class="sched-item-del" @click="removeSchedule(i)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
              </button>
            </div>
          </div>
          <div v-else class="sched-empty">{{ t('dsScheduleEmpty') }}</div>

          <!-- 添加定时任务表单 -->
          <div class="sched-form">
            <div class="sched-form-row">
              <label class="sched-label">{{ t('dsScheduleTime') }}</label>
              <input type="time" v-model="newSchedule.time" class="sched-input sched-time-input" />
            </div>

            <div class="sched-form-row">
              <label class="sched-label">{{ t('dsScheduleTask') }}</label>
              <textarea v-model="newSchedule.task" class="sched-input sched-task-input" :placeholder="t('dsScheduleTaskPh')" rows="2"></textarea>
            </div>

            <div class="sched-form-row">
              <label class="sched-label">{{ t('dsScheduleAgent') }}</label>
              <select v-model="newSchedule.agentId" class="sched-input sched-select">
                <option value="">{{ t('dsScheduleAutoAgent') }}</option>
                <option v-for="a in agents" :key="a.id" :value="a.id">{{ a.name }} ({{ t('dsRole_' + a.role) }})</option>
              </select>
            </div>

            <div class="sched-form-row">
              <label class="sched-label">{{ t('dsScheduleRepeat') }}</label>
              <div class="sched-repeat-group">
                <button v-for="r in ['once', 'daily', 'weekly']" :key="r"
                  class="sched-repeat-btn" :class="{ active: newSchedule.repeat === r }"
                  @click="newSchedule.repeat = r">
                  {{ t('dsSchedule' + r.charAt(0).toUpperCase() + r.slice(1)) }}
                </button>
              </div>
            </div>

            <button class="sched-save-btn" @click="addSchedule" :disabled="!newSchedule.time || !newSchedule.task">
              {{ t('dsScheduleSave') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { dsAgents } from '../../api/index.js'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  roomId: { type: String, required: true },
  agents: { type: Array, default: () => [] },
})

const emit = defineEmits(['schedule-added', 'schedule-removed'])

const showPanel = ref(false)
const schedules = ref([])

const newSchedule = reactive({
  time: '09:00',
  task: '',
  agentId: '',
  repeat: 'once',
})

// ─── 加载定时任务 ───
async function loadSchedules() {
  try {
    const data = await dsAgents.listSchedules(props.roomId)
    schedules.value = data.schedules || []
  } catch (e) {
    console.error('Load schedules failed:', e)
  }
}

// ─── 添加定时任务 ───
async function addSchedule() {
  if (!newSchedule.time || !newSchedule.task) return
  const agentName = props.agents.find(a => a.id == newSchedule.agentId)?.name || t('dsScheduleAutoAgent')
  try {
    await dsAgents.addSchedule(props.roomId, {
      time: newSchedule.time,
      task: newSchedule.task,
      agentId: newSchedule.agentId || null,
      agentName,
      repeat: newSchedule.repeat,
    })
    await loadSchedules()
    emit('schedule-added', newSchedule)
    // 重置表单
    newSchedule.task = ''
    newSchedule.agentId = ''
  } catch (e) {
    alert(e.message)
  }
}

// ─── 删除定时任务 ───
async function removeSchedule(index) {
  const s = schedules.value[index]
  if (!s || !s.id) {
    schedules.value.splice(index, 1)
    return
  }
  try {
    await dsAgents.deleteSchedule(s.id)
    await loadSchedules()
    emit('schedule-removed', s)
  } catch (e) {
    alert(e.message)
  }
}

function formatTime(time) {
  if (!time) return ''
  return time
}

function repeatLabel(repeat) {
  const map = { once: t('dsScheduleOnce'), daily: t('dsScheduleDaily'), weekly: t('dsScheduleWeekly') }
  return map[repeat] || repeat
}

onMounted(() => {
  loadSchedules()
})

watch(() => props.roomId, () => {
  loadSchedules()
})

defineExpose({ loadSchedules })
</script>

<style scoped>
/* ─── 黑白灰简约风格 ─── */
.sched-toggle { width: 28px; height: 28px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; position: relative; flex-shrink: 0; }
.sched-toggle:hover { background: var(--bg3); color: var(--text); }
.sched-toggle.on { background: var(--bg3); color: var(--text); }
.sched-badge { position: absolute; top: -3px; right: -3px; min-width: 14px; height: 14px; border-radius: 7px; background: var(--text); color: var(--bg); font-size: 9px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }

.sched-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.sched-modal { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); width: 420px; max-width: 90vw; max-height: 80vh; display: flex; flex-direction: column; font-family: var(--font-mono); }

.sched-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.sched-title { font-size: 13px; color: var(--text); font-weight: 500; }
.sched-close { width: 24px; height: 24px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); }
.sched-close:hover { background: var(--bg3); color: var(--text); }

.sched-body { padding: 12px 16px; overflow-y: auto; flex: 1; }

.sched-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.sched-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.sched-item-time { font-size: 12px; color: var(--text); font-weight: 500; min-width: 44px; font-variant-numeric: tabular-nums; }
.sched-item-main { flex: 1; min-width: 0; }
.sched-item-task { font-size: 11px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sched-item-meta { display: flex; gap: 8px; margin-top: 2px; }
.sched-item-agent { font-size: 9px; color: var(--text2); }
.sched-item-repeat { font-size: 9px; color: var(--text3); }
.sched-item-del { width: 18px; height: 18px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); opacity: 0; transition: all .12s; flex-shrink: 0; }
.sched-item:hover .sched-item-del { opacity: 1; }
.sched-item-del:hover { background: var(--bg3); color: var(--text); }

.sched-empty { text-align: center; color: var(--text3); font-size: 11px; padding: 20px 8px; }

.sched-form { border-top: 1px solid var(--border); padding-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.sched-form-row { display: flex; flex-direction: column; gap: 4px; }
.sched-label { font-size: 10px; color: var(--text3); }
.sched-input { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 8px; color: var(--text); font-size: 11px; font-family: inherit; outline: none; transition: border-color .12s; }
.sched-input:focus { border-color: var(--text3); }
.sched-time-input { width: 100px; }
.sched-task-input { resize: vertical; min-height: 36px; }
.sched-select { cursor: pointer; }

.sched-repeat-group { display: flex; gap: 4px; }
.sched-repeat-btn { padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--text3); cursor: pointer; font-size: 10px; font-family: inherit; transition: all .12s; }
.sched-repeat-btn:hover { border-color: var(--text3); color: var(--text); }
.sched-repeat-btn.active { background: var(--text); color: var(--bg); border-color: var(--text); }

.sched-save-btn { padding: 8px 12px; border: none; border-radius: var(--radius-sm); background: var(--text); color: var(--bg); cursor: pointer; font-size: 11px; font-family: inherit; font-weight: 500; transition: opacity .12s; margin-top: 4px; }
.sched-save-btn:hover { opacity: 0.85; }
.sched-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
