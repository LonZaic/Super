<template>
  <div v-if="tasks && tasks.length" class="cpb-root">
    <!-- All done: collapsed summary -->
    <div v-if="allDone" class="cpb-all-done">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="cpb-done-icon">
        <circle cx="7" cy="7" r="6" stroke="var(--green)" stroke-width="1.2"/>
        <path d="M4.5 7l1.8 1.8 3.2-3.5" stroke="var(--green)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="cpb-done-text">{{ t('codeAllDone') }}</span>
    </div>

    <template v-else>
      <!-- Visible tasks -->
      <div
        v-for="t in visibleTasks"
        :key="t.id"
        class="cpb-item"
        :class="{ done: t.status === 'completed', active: t.status === 'in_progress' }"
      >
        <svg v-if="t.status === 'completed'" width="12" height="12" viewBox="0 0 12 12" fill="none" class="cpb-icon">
          <circle cx="6" cy="6" r="5" stroke="var(--green)" stroke-width="1"/>
          <path d="M3.5 6l1.5 1.5 3.5-3" stroke="var(--green)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else-if="t.status === 'in_progress'" width="12" height="12" viewBox="0 0 12 12" fill="none" class="cpb-icon cpb-icon-active">
          <circle cx="6" cy="6" r="4.5" stroke="var(--accent)" stroke-width="1.2"/>
          <path d="M6 3v3l2 1.5" stroke="var(--accent)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none" class="cpb-icon">
          <circle cx="6" cy="6" r="4.5" stroke="var(--text3)" stroke-width="1"/>
        </svg>
        <span class="cpb-text" :class="{ strike: t.status === 'completed' }">{{ t.text }}</span>
      </div>

      <!-- Expand for extra items -->
      <button v-if="tasks.length > maxVisible && !expanded" class="cpb-expand-btn" @click="expanded = true">
        + {{ tasks.length - maxVisible }} more
      </button>
      <template v-if="expanded">
        <div
          v-for="t in hiddenTasks"
          :key="t.id"
          class="cpb-item"
          :class="{ done: t.status === 'completed', active: t.status === 'in_progress' }"
        >
          <svg v-if="t.status === 'completed'" width="12" height="12" viewBox="0 0 12 12" fill="none" class="cpb-icon">
            <circle cx="6" cy="6" r="5" stroke="var(--green)" stroke-width="1"/>
            <path d="M3.5 6l1.5 1.5 3.5-3" stroke="var(--green)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none" class="cpb-icon">
            <circle cx="6" cy="6" r="4.5" stroke="var(--text3)" stroke-width="1"/>
          </svg>
          <span class="cpb-text" :class="{ strike: t.status === 'completed' }">{{ t.text }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  maxVisible: { type: Number, default: 5 },
})

const expanded = ref(false)

const allDone = computed(() => props.tasks.length > 0 && props.tasks.every(t => t.status === 'completed'))
const visibleTasks = computed(() => props.tasks.slice(0, props.maxVisible))
const hiddenTasks = computed(() => props.tasks.slice(props.maxVisible))
</script>

<style scoped>
.cpb-root {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0 2px;
}

.cpb-all-done {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.cpb-done-text {
  font-size: 12px;
  font-weight: 400;
  color: var(--green);
}

.cpb-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 1px 0;
  font-size: 12px;
  color: var(--text2);
  font-weight: 300;
  transition: opacity 0.2s;
}
.cpb-item.done {
  opacity: 0.45;
}
.cpb-item.active {
  color: var(--accent);
  font-weight: 400;
}
.cpb-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.cpb-icon-active {
  animation: cpbSpin 2s linear infinite;
}
@keyframes cpbSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.cpb-text {
  line-height: 1.4;
}
.cpb-text.strike {
  text-decoration: line-through;
}

.cpb-expand-btn {
  border: none;
  background: transparent;
  color: var(--text3);
  font-size: 11px;
  font-family: inherit;
  font-weight: 300;
  cursor: pointer;
  padding: 2px 0;
  text-align: left;
  transition: color 0.12s;
}
.cpb-expand-btn:hover {
  color: var(--accent);
}
</style>
