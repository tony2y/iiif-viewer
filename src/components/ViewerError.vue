<script setup lang="ts">
/**
 * 错误覆盖层。
 *
 * 文案按错误码查表（`errors.<CODE>.title` / `errors.<CODE>.desc`），
 * 同时把错误码以等宽字体小字展示，便于使用方排查。
 */
import { computed } from 'vue'

import { useViewerI18nContext } from '@/composables/useViewerI18n'
import type { IiifViewerErrorLike } from '@/types/viewer'
import ViewerButton from './base/ViewerButton.vue'
import ViewerIcon from './base/ViewerIcon.vue'

const props = defineProps<{
  /** 错误对象 */
  error: IiifViewerErrorLike
}>()

const emit = defineEmits<{
  /** 用户点击「重试」 */
  retry: []
}>()

const { t } = useViewerI18nContext()

const title = computed(() => t(`errors.${props.error.code}.title`))
const description = computed(() => t(`errors.${props.error.code}.desc`))
</script>

<template>
  <div class="iiif-error" role="alert">
    <div class="iiif-error__card">
      <span class="iiif-error__icon">
        <ViewerIcon name="alert" :size="22" />
      </span>

      <h3 class="iiif-error__title">{{ title }}</h3>
      <p class="iiif-error__desc">{{ description }}</p>
      <p class="iiif-error__code">{{ props.error.code }}</p>

      <slot :error="props.error" :retry="() => emit('retry')">
        <ViewerButton
          class="iiif-error__retry"
          variant="solid"
          icon="refresh"
          :label="t('a11y.retry')"
          @click="emit('retry')"
        >
          <span class="iiif-error__retry-text">{{ t('a11y.retry') }}</span>
        </ViewerButton>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.iiif-error {
  position: absolute;
  inset: 0;
  z-index: var(--iiif-z-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--iiif-space-4);
  background-color: var(--iiif-overlay-scrim);
  animation: iiif-fade-in var(--iiif-duration) var(--iiif-ease);
}

.iiif-error__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--iiif-space-2);
  max-width: 420px;
  padding: var(--iiif-space-5);
  text-align: center;
  border-radius: var(--iiif-radius-lg);
  border: 1px solid var(--iiif-glass-border);
  background-color: var(--iiif-glass-bg);
  backdrop-filter: blur(var(--iiif-glass-blur));
  -webkit-backdrop-filter: blur(var(--iiif-glass-blur));
  box-shadow: var(--iiif-shadow-lg);
  animation: iiif-slide-up var(--iiif-duration) var(--iiif-ease);
}

.iiif-error__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--iiif-radius-full);
  background-color: var(--iiif-color-danger-soft);
  color: var(--iiif-color-danger);
}

.iiif-error__title {
  margin: 0;
  color: var(--iiif-color-fg);
  font-family: var(--iiif-font-display);
  font-size: var(--iiif-font-size-xl);
  font-weight: 600;
}

.iiif-error__desc {
  margin: 0;
  color: var(--iiif-color-fg-muted);
  font-size: var(--iiif-font-size-md);
}

.iiif-error__code {
  margin: 0;
  padding: 2px var(--iiif-space-2);
  border-radius: var(--iiif-radius-sm);
  background-color: var(--iiif-color-surface-2);
  color: var(--iiif-color-fg-muted);
  font-family: var(--iiif-font-mono);
  font-size: var(--iiif-font-size-xs);
  letter-spacing: 0.04em;
}

.iiif-error__retry {
  width: auto;
  height: auto;
  margin-top: var(--iiif-space-2);
  padding: var(--iiif-space-2) var(--iiif-space-4);
  gap: var(--iiif-space-2);
}

.iiif-error__retry-text {
  font-size: var(--iiif-font-size-md);
  font-weight: 500;
}
</style>
