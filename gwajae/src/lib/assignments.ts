import type { AssetType, Assignment, AssignmentAsset } from '../types'
import { supabase } from './supabase'

const ASSIGNMENT_BUCKET = 'assignment-assets'

export interface AssignmentFormInput {
  subjectId: string
  title: string
  dueDate: string
  submitted: boolean
  description: string
  externalLink: string
  imageFiles: File[]
  attachmentFiles: File[]
  removedAssetIds?: string[]
}

interface SubjectRow {
  id: string
  name: string
  color: string
}

interface AssetRow {
  id: string
  assignment_id: string | null
  storage_path: string
  file_name: string
  asset_type: AssetType
  size_bytes: number
  is_thumbnail: boolean
  created_at: string
}

interface AssignmentRow {
  id: string
  subject_id: string
  title: string
  due_date: string
  submitted: boolean
  is_favorite: boolean
  description: string | null
  external_link: string | null
  subject?: SubjectRow | SubjectRow[] | null
  assets?: AssetRow[]
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function mapAsset(row: AssetRow): AssignmentAsset {
  return {
    id: row.id,
    assignmentId: String(row.assignment_id ?? ''),
    storagePath: row.storage_path,
    fileName: row.file_name,
    assetType: row.asset_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    isThumbnail: Boolean(row.is_thumbnail),
    createdAt: row.created_at,
  }
}

function mapAssignment(row: AssignmentRow): Assignment {
  const subject = Array.isArray(row.subject) ? row.subject[0] : row.subject
  const assets = (row.assets ?? []).map(mapAsset)

  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    dueDate: row.due_date,
    submitted: Boolean(row.submitted),
    isFavorite: Boolean(row.is_favorite),
    attachmentCount: assets.length,
    description: row.description ?? '',
    externalLink: row.external_link,
    subjectName: subject?.name ?? '미지정',
    subjectColor: subject?.color ?? '#d7dee7',
    assets,
  }
}

async function getCurrentUser() {
  if (!supabase) {
    return null
  }

  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

async function fetchSingleAssignment(assignmentId: string) {
  if (!supabase) {
    return { data: null as Assignment | null, error: null }
  }

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id,
      subject_id,
      title,
      due_date,
      submitted,
      is_favorite,
      description,
      external_link,
      subject:subjects(id,name,color),
      assets:assignment_assets(
        id,
        assignment_id,
        storage_path,
        file_name,
        asset_type,
        size_bytes,
        is_thumbnail,
        created_at
      )
    `)
    .eq('id', assignmentId)
    .single()

  if (error) {
    return { data: null as Assignment | null, error }
  }

  return { data: mapAssignment(data as unknown as AssignmentRow), error: null }
}

async function removeAssetsByIds(assetIds: string[]) {
  if (!supabase || assetIds.length === 0) {
    return { error: null }
  }

  const { data: assets, error: assetQueryError } = await supabase
    .from('assignment_assets')
    .select('id,storage_path')
    .in('id', assetIds)

  if (assetQueryError) {
    return { error: assetQueryError }
  }

  const storagePaths = (assets ?? []).map((asset) => String(asset.storage_path ?? '')).filter(Boolean)

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .remove(storagePaths)

    if (storageError) {
      return { error: storageError }
    }
  }

  const { error: deleteError } = await supabase.from('assignment_assets').delete().in('id', assetIds)
  return { error: deleteError }
}

async function uploadAssets(
  ownerUserId: string,
  assignmentId: string,
  imageFiles: File[],
  attachmentFiles: File[],
) {
  if (!supabase) {
    return { error: null }
  }

  const filesToUpload = [
    ...imageFiles.map((file, index) => ({
      file,
      assetType: 'image' as const,
      isThumbnail: index === 0,
    })),
    ...attachmentFiles.map((file) => ({
      file,
      assetType: 'file' as const,
      isThumbnail: false,
    })),
  ]

  if (filesToUpload.length === 0) {
    return { error: null }
  }

  const insertedRows: Array<Record<string, unknown>> = []

  for (const entry of filesToUpload) {
    const storagePath = `${ownerUserId}/${assignmentId}/${crypto.randomUUID()}-${sanitizeFileName(entry.file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .upload(storagePath, entry.file, {
        upsert: false,
        contentType: entry.file.type || undefined,
      })

    if (uploadError) {
      return { error: uploadError }
    }

    insertedRows.push({
      assignment_id: assignmentId,
      owner_user_id: ownerUserId,
      storage_path: storagePath,
      file_name: entry.file.name,
      asset_type: entry.assetType,
      size_bytes: entry.file.size,
      is_thumbnail: entry.isThumbnail,
    })
  }

  const { error } = await supabase.from('assignment_assets').insert(insertedRows)
  return { error }
}

export async function fetchAssignments() {
  if (!supabase) {
    return { data: [] as Assignment[], error: null }
  }

  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id,
      subject_id,
      title,
      due_date,
      submitted,
      is_favorite,
      description,
      external_link,
      subject:subjects(id,name,color),
      assets:assignment_assets(
        id,
        assignment_id,
        storage_path,
        file_name,
        asset_type,
        size_bytes,
        is_thumbnail,
        created_at
      )
    `)
    .order('due_date', { ascending: true })

  if (error) {
    return { data: [] as Assignment[], error }
  }

  return {
    data: (data ?? []).map((row) => mapAssignment(row as unknown as AssignmentRow)),
    error: null,
  }
}

export async function createAssignmentWithAssets(input: AssignmentFormInput) {
  if (!supabase) {
    return { data: null as Assignment | null, error: null }
  }

  const user = await getCurrentUser()
  if (!user) {
    return {
      data: null as Assignment | null,
      error: new Error('과제를 등록하려면 먼저 로그인해 주세요.'),
    }
  }

  const { data: insertedAssignment, error: insertError } = await supabase
    .from('assignments')
    .insert({
      owner_user_id: user.id,
      subject_id: input.subjectId,
      title: input.title.trim(),
      due_date: input.dueDate,
      submitted: input.submitted,
      is_favorite: false,
      description: input.description.trim() || null,
      external_link: input.externalLink.trim() || null,
    })
    .select('id')
    .single()

  if (insertError) {
    return { data: null as Assignment | null, error: insertError }
  }

  const assignmentId = String(insertedAssignment.id)
  const { error: uploadError } = await uploadAssets(
    user.id,
    assignmentId,
    input.imageFiles,
    input.attachmentFiles,
  )

  if (uploadError) {
    return { data: null as Assignment | null, error: uploadError }
  }

  return fetchSingleAssignment(assignmentId)
}

export async function updateAssignmentWithAssets(assignmentId: string, input: AssignmentFormInput) {
  if (!supabase) {
    return { data: null as Assignment | null, error: null }
  }

  const user = await getCurrentUser()
  if (!user) {
    return {
      data: null as Assignment | null,
      error: new Error('과제를 수정하려면 먼저 로그인해 주세요.'),
    }
  }

  const { error: updateError } = await supabase
    .from('assignments')
    .update({
      subject_id: input.subjectId,
      title: input.title.trim(),
      due_date: input.dueDate,
      submitted: input.submitted,
      description: input.description.trim() || null,
      external_link: input.externalLink.trim() || null,
    })
    .eq('id', assignmentId)

  if (updateError) {
    return { data: null as Assignment | null, error: updateError }
  }

  const { error: removeError } = await removeAssetsByIds(input.removedAssetIds ?? [])
  if (removeError) {
    return { data: null as Assignment | null, error: removeError }
  }

  const { error: uploadError } = await uploadAssets(
    user.id,
    assignmentId,
    input.imageFiles,
    input.attachmentFiles,
  )

  if (uploadError) {
    return { data: null as Assignment | null, error: uploadError }
  }

  return fetchSingleAssignment(assignmentId)
}

export async function toggleAssignmentFlags(
  assignmentId: string,
  updates: Partial<Pick<Assignment, 'submitted' | 'isFavorite'>>,
) {
  if (!supabase) {
    return { data: null as Assignment | null, error: null }
  }

  const payload: Record<string, unknown> = {}

  if (typeof updates.submitted === 'boolean') {
    payload.submitted = updates.submitted
  }

  if (typeof updates.isFavorite === 'boolean') {
    payload.is_favorite = updates.isFavorite
  }

  const { error } = await supabase.from('assignments').update(payload).eq('id', assignmentId)
  return { data: null as Assignment | null, error }
}

export async function deleteAssignment(assignmentId: string) {
  if (!supabase) {
    return { error: null }
  }

  const { data: assets, error: assetError } = await supabase
    .from('assignment_assets')
    .select('storage_path')
    .eq('assignment_id', assignmentId)

  if (assetError) {
    return { error: assetError }
  }

  const storagePaths = (assets ?? []).map((row) => String(row.storage_path ?? '')).filter(Boolean)

  if (storagePaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(ASSIGNMENT_BUCKET)
      .remove(storagePaths)

    if (removeError) {
      return { error: removeError }
    }
  }

  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId)
  return { error }
}
