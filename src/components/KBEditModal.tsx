'use client'

import { useState } from 'react'
import { KBEntity } from '@/lib/kb'

interface KBEditModalProps {
  entity: KBEntity
  onSave: (updated: KBEntity) => void
  onClose: () => void
}

function tagsToString(tags: string[] | null | undefined): string {
  return (tags ?? []).join(', ')
}

function stringToTags(str: string): string[] {
  return str
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

export function KBEditModal({ entity, onSave, onClose }: KBEditModalProps) {
  const [name, setName] = useState(entity.name)
  const [strapline, setStrapline] = useState(entity.strapline ?? '')
  const [description, setDescription] = useState(entity.description ?? '')
  const [website, setWebsite] = useState(entity.website ?? '')
  const [coverImage, setCoverImage] = useState(entity.cover_image ?? '')

  // Type-specific fields
  const [area, setArea] = useState(
    entity._type === 'space' ? (entity.area ?? '') :
    entity._type === 'community' ? (entity.primary_area ?? '') : ''
  )
  const [tags, setTags] = useState(() => {
    if (entity._type === 'space') return tagsToString(entity.tags)
    if (entity._type === 'community') return tagsToString(entity.sectors)
    if (entity._type === 'vc') return tagsToString(entity.sectors)
    if (entity._type === 'programme') return tagsToString(entity.sectors)
    return ''
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)

    const fields: Record<string, unknown> = {
      name,
      strapline: strapline || null,
      description: description || null,
      website: website || null,
      cover_image: coverImage || null,
    }

    if (entity._type === 'space') {
      fields.area = area || null
      fields.tags = stringToTags(tags)
    } else if (entity._type === 'community') {
      fields.primary_area = area || null
      fields.sectors = stringToTags(tags)
    } else if (entity._type === 'vc') {
      fields.sectors = stringToTags(tags)
    } else if (entity._type === 'programme') {
      fields.sectors = stringToTags(tags)
    }

    try {
      const adminKey = typeof window !== 'undefined' ? sessionStorage.getItem('admin-key') : ''
      const res = await fetch('/api/admin/kb', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': adminKey ?? '',
        },
        body: JSON.stringify({ entityType: entity._type, id: entity.id, fields }),
      })

      if (res.status === 401) {
        setError('Admin key invalid.')
        setSaving(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Save failed.')
        setSaving(false)
        return
      }

      // Optimistically update local entity state
      const updated = { ...entity, ...fields } as KBEntity
      onSave(updated)
    } catch {
      setError('Network error.')
      setSaving(false)
    }
  }

  const areaLabel = entity._type === 'community' ? 'Primary area' : 'Area'
  const tagsLabel =
    entity._type === 'space' ? 'Tags (comma separated)' : 'Sectors (comma separated)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="terminal-window is-visible w-full max-w-lg">
        <div className="flex items-center justify-between border-b pb-3 mb-4" style={{ borderColor: 'var(--line)' }}>
          <p className="terminal-eyebrow">edit / {entity._type}</p>
          <button onClick={onClose} className="terminal-ghost text-[11px]">close</button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="terminal-hint mb-1 block">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>

          <label className="block">
            <span className="terminal-hint mb-1 block">Strapline</span>
            <input
              value={strapline}
              onChange={(e) => setStrapline(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>

          <label className="block">
            <span className="terminal-hint mb-1 block">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>

          <label className="block">
            <span className="terminal-hint mb-1 block">Website</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>

          <label className="block">
            <span className="terminal-hint mb-1 block">Cover image URL</span>
            <input
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>

          {(entity._type === 'space' || entity._type === 'community') && (
            <label className="block">
              <span className="terminal-hint mb-1 block">{areaLabel}</span>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded border bg-transparent px-3 py-2 text-sm"
                style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
              />
            </label>
          )}

          <label className="block">
            <span className="terminal-hint mb-1 block">{tagsLabel}</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="terminal-ghost">cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="terminal-action"
            style={{ opacity: saving ? 0.5 : 1 }}
          >
            {saving ? 'saving…' : 'save'}
          </button>
        </div>
      </div>
    </div>
  )
}
