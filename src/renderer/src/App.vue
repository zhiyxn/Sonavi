<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConnectPanel from './components/ConnectPanel.vue'
import { loadApplicationInfo } from './services/application-info'
import type { ApplicationInfo } from '../../shared/application'

const applicationInfo = ref<ApplicationInfo | null>(null)
const loadingError = ref('')

const shortcutHint = computed(() =>
  applicationInfo.value ? `${applicationInfo.value.shortcutModifier}+,` : '…'
)

onMounted(async () => {
  try {
    applicationInfo.value = await loadApplicationInfo()
  } catch {
    loadingError.value = '无法读取受信任的应用信息，请重新启动 Sonavi。'
  }
})
</script>

<template>
  <main class="application-shell">
    <aside class="sidebar" aria-label="主导航">
      <div>
        <a class="brand" href="#main-content" aria-label="Sonavi 首页">Sonavi</a>
        <p class="brand-caption">YOUR MUSIC. YOUR SPACE.</p>
      </div>

      <nav>
        <a class="nav-item active" href="#connect" aria-current="page">连接服务器</a>
        <span class="nav-item disabled" aria-disabled="true">音乐库 <small>P03</small></span>
        <span class="nav-item disabled" aria-disabled="true">搜索 <small>P05</small></span>
        <span class="nav-item disabled" aria-disabled="true">歌单 <small>P06</small></span>
      </nav>

      <div class="sidebar-meta">
        <span v-if="applicationInfo" data-testid="platform-label">
          {{ applicationInfo.platformLabel }} · v{{ applicationInfo.version }}
        </span>
        <span>设置快捷键 {{ shortcutHint }}</span>
      </div>
    </aside>

    <section id="main-content" class="workspace">
      <div id="connect" class="content-frame">
        <ConnectPanel v-if="applicationInfo" :application-info="applicationInfo" />
        <p v-else-if="loadingError" class="startup-error" role="alert">{{ loadingError }}</p>
        <p v-else class="startup-status" role="status">正在读取应用信息…</p>
      </div>
    </section>

    <footer class="player-placeholder" aria-label="播放引擎占位">
      <div class="album-placeholder" aria-hidden="true">S</div>
      <div>
        <strong>播放引擎尚未启用</strong>
        <span>P01 仅保留单一 AudioEngine 接口</span>
      </div>
      <div class="transport-placeholder" aria-hidden="true">— · ○ · —</div>
      <span class="phase-pill">P03 接入真实播放</span>
    </footer>
  </main>
</template>
