import { computed, ref, watch, type Ref } from 'vue'

type SearchableImage = { name: string }

export function useImageSearch<T extends SearchableImage>(items: Readonly<Ref<readonly T[]>>) {
  const query = ref('')
  const filteredItems = computed(() => {
    const search = query.value.trim().toLowerCase()
    return search ? items.value.filter(item => item.name.toLowerCase().includes(search)) : [...items.value]
  })

  function reset() {
    query.value = ''
  }

  watch(items, images => {
    if (!images.length) reset()
  })

  return { query, filteredItems, reset }
}
