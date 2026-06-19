import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  getCollections, createCollection, deleteCollection, renameCollection,
  getSavedItems, getAllSavedItems, searchSavedItems, saveItem, deleteSavedItem
} from '../db/database.js'
import { collectionsApi } from '../api/index.js'

let _serverAvailable = true

export const useCollectionStore = defineStore('collections', () => {
  const collections = ref([])
  const items = ref([])
  const currentCollectionId = ref(null)  // null = 全局/全部
  const searchQuery = ref('')
  const loaded = ref(false)

  function load() {
    if (loaded.value) return
    collections.value = getCollections()
    items.value = getAllSavedItems()
    loaded.value = true
  }

  function refresh() {
    collections.value = getCollections()
    items.value = currentCollectionId.value
      ? getSavedItems(currentCollectionId.value)
      : getAllSavedItems()
  }

  const filteredItems = computed(() => {
    if (!searchQuery.value) return items.value
    const q = searchQuery.value.toLowerCase()
    return items.value.filter(i =>
      (i.preview || '').toLowerCase().includes(q) ||
      (i.msg_json || '').toLowerCase().includes(q)
    )
  })

  function addCollection(name) {
    const id = createCollection(name)
    if (_serverAvailable) {
      collectionsApi.create(name).catch(() => { _serverAvailable = false })
    }
    refresh()
    return id
  }

  function removeCollection(id) {
    deleteCollection(id)
    if (_serverAvailable) {
      collectionsApi.delete(id).catch(() => { _serverAvailable = false })
    }
    refresh()
  }

  function editCollectionName(id, name) {
    renameCollection(id, name)
    if (_serverAvailable) {
      collectionsApi.rename(id, name).catch(() => { _serverAvailable = false })
    }
    refresh()
  }

  function selectCollection(id) {
    currentCollectionId.value = id
    items.value = id ? getSavedItems(id) : getAllSavedItems()
  }

  function doSearch(q) {
    searchQuery.value = q
    if (q) {
      items.value = searchSavedItems(q)
    } else {
      refresh()
    }
  }

  function addItem(collectionId, msgData, preview) {
    saveItem(collectionId, JSON.stringify(msgData), preview)
    if (_serverAvailable) {
      collectionsApi.saveItem(collectionId, JSON.stringify(msgData), preview).catch(() => { _serverAvailable = false })
    }
    refresh()
  }

  function removeItem(id) {
    deleteSavedItem(id)
    if (_serverAvailable) {
      collectionsApi.deleteItem(id).catch(() => { _serverAvailable = false })
    }
    refresh()
  }

  return {
    collections, items, currentCollectionId, searchQuery, loaded,
    filteredItems,
    load, refresh,
    addCollection, removeCollection, editCollectionName,
    selectCollection, doSearch,
    addItem, removeItem
  }
})
