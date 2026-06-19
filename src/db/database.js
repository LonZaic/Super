import initSqlJs from 'sql.js'

const DB_KEY = '__sqlite_db__'
let db = window[DB_KEY] || null
const DB_NAME = 'ds_sqlite_db'
const DB_STORE = 'db_data'

if (import.meta.hot) { import.meta.hot.accept(() => {}) }

// ─── IndexedDB wrapper ───
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const idb = await idbOpen()
  return new Promise((resolve) => {
    const tx = idb.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function idbSet(key, value) {
  const idb = await idbOpen()
  return new Promise((resolve) => {
    const tx = idb.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => { console.warn('[DB] IndexedDB write failed'); resolve() }
  })
}

export async function initDB() {
    const SQL = await initSqlJs({ locateFile: file => '/sql-wasm.wasm' })

    let saved = await idbGet('db').catch(() => null)

    if (!saved || !saved.length) {
        const backup = localStorage.getItem('sqlite_db_backup')
        if (backup) {
            try {
                const binary = atob(backup)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                saved = Array.from(bytes)
                console.log('[DB] Restored from localStorage backup')
            } catch {}
        }
    }
    if (!saved || !saved.length) {
        const ls = localStorage.getItem('sqlite_db')
        if (ls) {
            try { saved = JSON.parse(ls); localStorage.removeItem('sqlite_db') } catch {}
        }
    }

    if (saved && saved.length > 0) {
        try {
            db = new SQL.Database(new Uint8Array(saved))
            db.exec('SELECT 1 FROM conversations LIMIT 1')
            console.log('[DB] Loaded from IndexedDB,', saved.length, 'bytes')
        } catch {
            console.warn('[DB] Corrupted, starting fresh')
            db = new SQL.Database()
        }
    } else {
        console.log('[DB] Fresh database')
        db = new SQL.Database()
    }

    window[DB_KEY] = db

    // ─── Schema migrations ───
    try { db.run('ALTER TABLE messages ADD COLUMN download_files TEXT DEFAULT \'[]\'') } catch {}
    try { db.run('ALTER TABLE agent_messages ADD COLUMN download_files TEXT DEFAULT \'[]\'') } catch {}
    try { db.run('ALTER TABLE messages ADD COLUMN side_quest TEXT DEFAULT \'\'') } catch {}
    try { db.run("ALTER TABLE collection_items ADD COLUMN msg_json TEXT DEFAULT '[]'") } catch {}

    db.run(`
        CREATE TABLE IF NOT EXISTS
        conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT '新对话',
            model TEXT DEFAULT 'deepseek-chat',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('user','ai')),
            text        TEXT NOT NULL,
            parent_id   INTEGER,
            files       TEXT DEFAULT '[]',
            designs     TEXT DEFAULT '[]',
            reasoning      TEXT DEFAULT '',
            download_files TEXT DEFAULT '[]',
            side_quest   TEXT DEFAULT '',
            created_at     TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        agent_conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Agent 对话',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        agent_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL,
            text        TEXT DEFAULT '',
            events      TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        code_conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Code 对话',
            project_path TEXT DEFAULT '',
            project_name TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        code_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL,
            text        TEXT DEFAULT '',
            html        TEXT DEFAULT '',
            thinking    TEXT DEFAULT '',
            tasks_json  TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES code_conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        collections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        collection_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id TEXT NOT NULL,
            msg_id      INTEGER NOT NULL,
            conv_id     TEXT NOT NULL,
            snippet     TEXT DEFAULT '',
            preview     TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS
        folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '新文件夹',
            parent_id TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
    `)

    // ─── Column migrations ───
    const cols = db.exec("PRAGMA table_info('messages')")
    const colNames = cols.length ? cols[0].values.map(r => r[1]) : []
    const addCol = (name, def) => {
        if (!colNames.includes(name)) {
            try { db.run(`ALTER TABLE messages ADD COLUMN ${name} ${def}`) } catch(e) { console.warn('[DB] add column failed:', name, e.message) }
        }
    }
    addCol('parent_id', 'INTEGER')
    addCol('designs', "TEXT DEFAULT '[]'")
    addCol('reasoning', "TEXT DEFAULT ''")
    addCol('side_quest', "TEXT DEFAULT ''")

    const ccCols = db.exec("PRAGMA table_info('conversations')")
    const ccColNames = ccCols.length ? ccCols[0].values.map(r => r[1]) : []
    const addCcCol = (name, def) => {
        if (!ccColNames.includes(name)) {
            try { db.run(`ALTER TABLE conversations ADD COLUMN ${name} ${def}`) } catch(e) { console.warn('[DB] add cc column failed:', name, e.message) }
        }
    }
    addCcCol('folder_id', 'TEXT')
    addCcCol('sort_order', 'INTEGER DEFAULT 0')

    const cmCols = db.exec("PRAGMA table_info('code_messages')")
    const cmColNames = cmCols.length ? cmCols[0].values.map(r => r[1]) : []
    const addCmCol = (name, def) => {
        if (!cmColNames.includes(name)) {
            try { db.run(`ALTER TABLE code_messages ADD COLUMN ${name} ${def}`) } catch(e) { console.warn('[DB] add cm column failed:', name, e.message) }
        }
    }
    addCmCol('events_json', "TEXT DEFAULT '[]'")
    addCmCol('done', "INTEGER DEFAULT 0")
    addCmCol('error', "INTEGER DEFAULT 0")
    addCmCol('timer', "TEXT DEFAULT ''")

    saveDB()
}

// ─── Save (debounced, dual persistence) ───
let _saveTimer = null
let _saveResolve = null

function saveDB() {
    if (!db) return
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(async () => {
        _saveTimer = null
        try {
            await _doSave()
            if (_saveResolve) { _saveResolve(); _saveResolve = null }
        } catch(e) {
            if (_saveResolve) { _saveResolve(); _saveResolve = null }
        }
    }, 300)
}

async function _doSave() {
    if (!db) return
    try {
        const data = Array.from(db.export())
        await idbSet('db', data).catch(() => {})
        try {
            const bytes = new Uint8Array(data)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            localStorage.setItem('sqlite_db_backup', btoa(binary))
        } catch (lsErr) {
            // localStorage full — that's fine, IndexedDB has the data
        }
    } catch(e) {
        console.warn('[DB] Save failed:', e.message)
    }
}

// ─── API ───

export function getConversations(){
    const stmt = db.prepare(`SELECT * FROM conversations ORDER BY created_at DESC`)
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function createConversation(id, model = 'deepseek-chat', folderId = null){
    db.run('INSERT INTO conversations (id, model, folder_id) VALUES (?, ?, ?)', [id, model, folderId])
    saveDB()
}

export function deleteConversation(id){
    db.run(`DELETE FROM messages WHERE conv_id = ?`, [id])
    db.run(`DELETE FROM conversations WHERE id = ?`, [id])
    saveDB()
}

export function updateConversationTitle(id, title) {
    db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, id])
    saveDB()
}

export function getMessages(convId) {
    const stmt = db.prepare('SELECT * FROM messages WHERE conv_id = ? ORDER BY id ASC')
    stmt.bind([convId])
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function addMessage(convId, role, text, parentId = null, files = '[]', designs = '[]', reasoning = '', downloadFiles = '[]', sideQuest = '') {
    db.run('INSERT INTO messages (conv_id, role, text, parent_id, files, designs, reasoning, download_files, side_quest) VALUES (?,?,?,?,?,?,?,?,?)',
        [convId, role, text, parentId, files, designs, reasoning, downloadFiles, sideQuest])
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
}

export function updateMessage(id, text) {
    db.run('UPDATE messages SET text = ? WHERE id = ?', [text, id])
    saveDB()
}

export function deleteMessage(id) {
    db.run('DELETE FROM messages WHERE id = ?', [id])
    saveDB()
}

export function deleteMessagesSince(convId, messageId) {
    db.run(`DELETE FROM messages WHERE conv_id = ? AND id > ?`, [convId, messageId])
    saveDB()
}

export function updateMessageSideQuest(msgId, json) {
    db.run('UPDATE messages SET side_quest = ? WHERE id = ?', [json, msgId])
    saveDB()
}

// ─── Folders ───

export function getFolders() {
    const stmt = db.prepare('SELECT * FROM folders ORDER BY sort_order, created_at')
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function createFolder(id, name, parentId = null) {
    db.run('INSERT INTO folders (id, name, parent_id) VALUES (?, ?, ?)', [id, name, parentId])
    saveDB()
}

export function renameFolder(id, name) {
    db.run('UPDATE folders SET name = ? WHERE id = ?', [name, id])
    saveDB()
}

export function deleteFolder(id) {
    db.run('UPDATE conversations SET folder_id = NULL WHERE folder_id = ?', [id])
    db.run('UPDATE folders SET parent_id = NULL WHERE parent_id = ?', [id])
    db.run('DELETE FROM folders WHERE id = ?', [id])
    saveDB()
}

export function moveConversation(convId, folderId) {
    db.run('UPDATE conversations SET folder_id = ? WHERE id = ?', [folderId || null, convId])
    saveDB()
}

export function moveFolder(folderId, newParentId) {
    db.run('UPDATE folders SET parent_id = ? WHERE id = ?', [newParentId || null, folderId])
    saveDB()
}

export function getConvsInFolder(folderId) {
    const stmt = db.prepare('SELECT * FROM conversations WHERE folder_id = ? ORDER BY sort_order DESC, created_at DESC')
    stmt.bind([folderId])
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

// ─── Code conversations ───
export function getCodeConversations() {
    const stmt = db.prepare('SELECT * FROM code_conversations ORDER BY created_at DESC')
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function createCodeConversation(id, title = 'Code 对话', projectPath = '', projectName = '') {
    db.run('INSERT INTO code_conversations (id, title, project_path, project_name) VALUES (?,?,?,?)', [id, title, projectPath, projectName])
    saveDB()
}

export function getCodeMessages(convId) {
    const stmt = db.prepare('SELECT * FROM code_messages WHERE conv_id = ? ORDER BY id ASC')
    stmt.bind([convId])
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function addCodeMessage(convId, role, text, html, thinking, tasksJson, eventsJson, done, error, timer) {
    db.run('INSERT INTO code_messages (conv_id, role, text, html, thinking, tasks_json, events_json, done, error, timer) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [convId, role, text, html, thinking, tasksJson, eventsJson, done, error, timer])
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
}

export function updateCodeMessage(dbId, text, html, thinking, tasksJson, eventsJson, done, error, timer) {
    db.run('UPDATE code_messages SET text=?, html=?, thinking=?, tasks_json=?, events_json=?, done=?, error=?, timer=? WHERE id=?',
        [text, html, thinking, tasksJson, eventsJson, done, error, timer, dbId])
    saveDB()
}

export function updateCodeConversationTitle(id, title) {
    db.run('UPDATE code_conversations SET title = ? WHERE id = ?', [title, id])
    saveDB()
}

export function updateCodeConversationProject(id, projectPath, projectName) {
    db.run('UPDATE code_conversations SET project_path = ?, project_name = ? WHERE id = ?', [projectPath, projectName, id])
    saveDB()
}

export function deleteCodeConversation(id) {
    db.run('DELETE FROM code_messages WHERE conv_id = ?', [id])
    db.run('DELETE FROM code_conversations WHERE id = ?', [id])
    saveDB()
}

// ─── Collections ───
export function getCollections() {
    const stmt = db.prepare('SELECT * FROM collections ORDER BY created_at DESC')
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function createCollection(id, name) {
    // Support both createCollection(name) and createCollection(id, name)
    if (name === undefined) { name = id; id = 'col_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }
    db.run('INSERT INTO collections (id, name) VALUES (?,?)', [id, name])
    saveDB()
    return id
}

export function deleteCollection(id) {
    db.run('DELETE FROM collection_items WHERE collection_id = ?', [id])
    db.run('DELETE FROM collections WHERE id = ?', [id])
    saveDB()
}

export function addToCollection(collectionId, msgId, convId, snippet, preview) {
    db.run('INSERT INTO collection_items (collection_id, msg_id, conv_id, snippet, preview) VALUES (?,?,?,?,?)',
        [collectionId, msgId, convId, snippet, preview])
    saveDB()
}

export function removeFromCollection(itemId) {
    db.run('DELETE FROM collection_items WHERE id = ?', [itemId])
    saveDB()
}

export function getCollectionItems(collectionId) {
    const stmt = db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY created_at DESC')
    stmt.bind([collectionId])
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function renameCollection(id, name) {
    db.run('UPDATE collections SET name = ? WHERE id = ?', [name, id])
    saveDB()
}

export function findCollectionByName(name) {
    const stmt = db.prepare('SELECT * FROM collections WHERE name = ? LIMIT 1')
    stmt.bind([name])
    let result = null
    if (stmt.step()) result = stmt.getAsObject()
    stmt.free()
    return result
}

export function isItemDuplicate(collectionId, msgJson) {
    const stmt = db.prepare('SELECT id FROM collection_items WHERE collection_id = ? AND msg_json = ? LIMIT 1')
    stmt.bind([collectionId || null, msgJson])
    const exists = stmt.step()
    stmt.free()
    return exists
}

export function saveItem(collectionId, msgJson, preview) {
    db.run('INSERT INTO collection_items (collection_id, msg_json, preview) VALUES (?,?,?)', [collectionId || null, msgJson, preview || ''])
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
}

export function updateSavedItemContent(id, msgJson, preview) {
    db.run('UPDATE collection_items SET msg_json = ?, preview = ? WHERE id = ?', [msgJson, preview || '', id])
    saveDB()
}

export function deleteSavedItem(id) {
    db.run('DELETE FROM collection_items WHERE id = ?', [id])
    saveDB()
}

export function moveSavedItem(itemId, newCollectionId) {
    db.run('UPDATE collection_items SET collection_id = ? WHERE id = ?', [newCollectionId, itemId])
    saveDB()
}

export function getSavedItems(collectionId) {
    const stmt = db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY created_at DESC')
    stmt.bind([collectionId])
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function getAllSavedItems() {
    const stmt = db.prepare('SELECT * FROM collection_items ORDER BY created_at DESC')
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function searchSavedItems(query) {
    const stmt = db.prepare("SELECT * FROM collection_items WHERE preview LIKE ? OR msg_json LIKE ? ORDER BY created_at DESC")
    const q = '%' + query + '%'
    stmt.bind([q, q])
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

// ─── Agent conversations ───
export function getAgentConversations() {
    const stmt = db.prepare('SELECT * FROM agent_conversations ORDER BY created_at DESC')
    const rows = []
    while(stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function createAgentConversation(id, title) {
    db.run('INSERT INTO agent_conversations (id, title) VALUES (?,?)', [id, title])
    saveDB()
}

export function deleteAgentConversation(id) {
    db.run('DELETE FROM agent_messages WHERE conv_id = ?', [id])
    db.run('DELETE FROM agent_conversations WHERE id = ?', [id])
    saveDB()
}

export function getAgentMessages(convId) {
    const stmt = db.prepare('SELECT * FROM agent_messages WHERE conv_id = ? ORDER BY id ASC')
    stmt.bind([convId])
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
}

export function addAgentMessage(convId, role, text, eventsJson) {
    db.run('INSERT INTO agent_messages (conv_id, role, text, events) VALUES (?,?,?,?)', [convId, role, text, eventsJson || '[]'])
    saveDB()
    return db.exec('SELECT last_insert_rowid()')[0].values[0][0]
}

export function updateAgentMessage(id, text, eventsJson) {
    db.run('UPDATE agent_messages SET text = ?, events = ? WHERE id = ?', [text, eventsJson || '[]', id])
    saveDB()
}

export function updateAgentConversationTitle(id, title) {
    db.run('UPDATE agent_conversations SET title = ? WHERE id = ?', [title, id])
    saveDB()
}

// ─── Export / Import ───
export function exportDB() {
    const data = db.export()
    const blob = new Blob([data], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deepseek-super-backup.db'
    a.click()
    URL.revokeObjectURL(url)
}

export async function importDB(file) {
    const buf = await file.arrayBuffer()
    const SQL = await initSqlJs({ locateFile: file => '/sql-wasm.wasm' })
    const newDB = new SQL.Database(new Uint8Array(buf))
    // Verify
    newDB.exec('SELECT 1 FROM conversations LIMIT 1')
    db = newDB
    window[DB_KEY] = db
    saveDB()
    return true
}
