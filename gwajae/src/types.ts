export type Role = 'admin' | 'member'
export type AssetType = 'file' | 'image'

export interface Subject {
  id: string
  name: string
  color: string
  isDefault?: boolean
}

export interface AssignmentAsset {
  id: string
  assignmentId: string
  storagePath: string
  fileName: string
  assetType: AssetType
  sizeBytes: number
  isThumbnail: boolean
  createdAt?: string
}

export interface Assignment {
  id: string
  subjectId: string
  title: string
  dueDate: string
  submitted: boolean
  isFavorite: boolean
  attachmentCount: number
  detail?: string
  description?: string
  externalLink?: string | null
  subjectName?: string
  subjectColor?: string
  assets?: AssignmentAsset[]
}

export interface AllowedUser {
  id: string
  email: string
  role: Role
  active: boolean
  created_at?: string
}

export interface StorageUsageSummary {
  personalBytes: number
  totalBytes: number
  personalLimitBytes: number
  totalLimitBytes: number
}
