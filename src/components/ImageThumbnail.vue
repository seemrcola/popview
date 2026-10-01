<script setup lang="ts">
import { ref, watch } from 'vue'
import { FileImage } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ src: string; alt?: string; fit?: 'cover' | 'contain' }>(), { alt: '', fit: 'contain' })
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>

<template>
  <span class="image-thumbnail">
    <img v-if="!failed" :src="src" :alt="alt" :style="{ objectFit: fit }" loading="lazy" decoding="async" :draggable="false" @error="failed = true" />
    <FileImage v-else :size="24" :aria-hidden="!alt" :aria-label="alt ? `${alt}，缩略图不可用` : undefined" />
  </span>
</template>

<style scoped>
.image-thumbnail { width: 100%; height: 100%; min-width: 0; min-height: 0; display: grid; place-items: center; pointer-events: none; }
img { display: block; width: 100%; height: 100%; }
</style>
