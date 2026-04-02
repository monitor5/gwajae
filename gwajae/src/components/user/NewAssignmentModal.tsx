import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { scanScreenshot } from '../../lib/ocrParser'
import type { Assignment, AssignmentAsset, Subject } from '../../types'
import type { AssignmentFormInput } from '../../lib/assignments'
import styles from './NewAssignmentModal.module.css'

interface NewAssignmentModalProps {
  assignment?: Assignment | null
  onClose: () => void
  onSaved: () => Promise<void>
  subjects: Subject[]
  remainingBytes: number
  createAssignment: (input: AssignmentFormInput) => Promise<{
    data: Assignment | null
    error: Error | { message: string } | null
  }>
  updateAssignment: (
    assignmentId: string,
    input: AssignmentFormInput,
  ) => Promise<{
    data: Assignment | null
    error: Error | { message: string } | null
  }>
}

function bytesToMegabytes(bytes: number) {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10
}

function toDateTimeLocalValue(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function splitAssets(assets: AssignmentAsset[] | undefined) {
  return {
    images: (assets ?? []).filter((asset) => asset.assetType === 'image'),
    files: (assets ?? []).filter((asset) => asset.assetType === 'file'),
  }
}

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500)
    return () => clearTimeout(timer)
  }, [onDone])

  return <div className={styles.toast}>{message}</div>
}

export function NewAssignmentModal({
  assignment,
  onClose,
  onSaved,
  subjects,
  remainingBytes,
  createAssignment,
  updateAssignment,
}: NewAssignmentModalProps) {
  const { t } = useI18n()
  const isEditMode = Boolean(assignment)
  const [title, setTitle] = useState(assignment?.title ?? '')
  const [subjectId, setSubjectId] = useState(assignment?.subjectId ?? subjects[0]?.id ?? '')
  const [dueDate, setDueDate] = useState(toDateTimeLocalValue(assignment?.dueDate))
  const [description, setDescription] = useState(assignment?.description ?? '')
  const [externalLink, setExternalLink] = useState(assignment?.externalLink ?? '')
  const [submitted, setSubmitted] = useState(assignment?.submitted ?? false)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const [removedAssetIds, setRemovedAssetIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const resolvedSubjectId = subjectId || subjects[0]?.id || ''
  const { images: existingImages, files: existingFiles } = useMemo(
    () => splitAssets(assignment?.assets),
    [assignment?.assets],
  )

  const visibleExistingImages = existingImages.filter((asset) => !removedAssetIds.includes(asset.id))
  const visibleExistingFiles = existingFiles.filter((asset) => !removedAssetIds.includes(asset.id))

  const selectedBytes = useMemo(
    () =>
      [...imageFiles, ...attachmentFiles].reduce((total, file) => {
        return total + file.size
      }, 0),
    [attachmentFiles, imageFiles],
  )

  const remainingAfterSelection = Math.max(0, remainingBytes - selectedBytes)

  function addFiles(nextFiles: File[], setter: React.Dispatch<React.SetStateAction<File[]>>) {
    setter((currentFiles) => [...currentFiles, ...nextFiles])
  }

  function removeNewImage(index: number) {
    setImageFiles((currentFiles) => currentFiles.filter((_, currentIndex) => currentIndex !== index))
  }

  function removeNewAttachment(index: number) {
    setAttachmentFiles((currentFiles) =>
      currentFiles.filter((_, currentIndex) => currentIndex !== index),
    )
  }

  function markExistingAssetRemoved(assetId: string) {
    setRemovedAssetIds((currentIds) => [...new Set([...currentIds, assetId])])
  }

  const handleDismissToast = useCallback(() => setToastMessage(null), [])

  async function handleScreenshotScan(file: File) {
    setIsScanning(true)
    setError(null)

    try {
      const parsed = await scanScreenshot(file)

      const hasAnyData = parsed.title || parsed.dueDate || parsed.description || parsed.externalLink
      if (!hasAnyData) {
        setToastMessage(t.modal.scanNoData)
        setIsScanning(false)
        return
      }

      if (parsed.title) setTitle(parsed.title)
      if (parsed.dueDate) setDueDate(parsed.dueDate)
      if (parsed.description) setDescription(parsed.description)
      if (parsed.externalLink) setExternalLink(parsed.externalLink)

      setToastMessage(t.modal.scanSuccess)
    } catch {
      setToastMessage(t.modal.scanFailed)
    } finally {
      setIsScanning(false)
      if (scanInputRef.current) {
        scanInputRef.current.value = ''
      }
    }
  }

  function onScanFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void handleScreenshotScan(file)
  }

  async function handleSubmit() {
    if (!title.trim() || !dueDate || !resolvedSubjectId) {
      setError(t.modal.requiredFields)
      return
    }

    if (selectedBytes > remainingBytes) {
      setError(t.modal.storageFull.replace('{amount}', String(bytesToMegabytes(remainingBytes))))
      return
    }

    setIsSubmitting(true)
    setError(null)

    const payload: AssignmentFormInput = {
      subjectId: resolvedSubjectId,
      title,
      dueDate: new Date(dueDate).toISOString(),
      submitted,
      description,
      externalLink,
      imageFiles,
      attachmentFiles,
      removedAssetIds,
    }

    const result = assignment
      ? await updateAssignment(assignment.id, payload)
      : await createAssignment(payload)

    if (result.error) {
      setError(result.error.message)
      setIsSubmitting(false)
      return
    }

    await onSaved()
    setIsSubmitting(false)
    onClose()
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="assignment-modal-title" className={styles.title}>
              {isEditMode ? t.modal.editTitle : t.modal.createTitle}
            </h2>
            <p className={styles.subtitle}>{t.modal.subtitle}</p>
          </div>
          <div className={styles.headerActions}>
            {!isEditMode ? (
              <label className={`${styles.scanButton} ${isScanning ? styles.scanButtonBusy : ''}`}>
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={styles.scanIcon}>
                  <path d="M4 4h3V2H3a1 1 0 00-1 1v4h2V4zm13-2h-4v2h3v3h2V3a1 1 0 00-1-1zM4 13H2v4a1 1 0 001 1h4v-2H4v-3zm14 0h-2v3h-3v2h4a1 1 0 001-1v-4zM6 6h8v8H6V6z" />
                </svg>
                {isScanning ? t.modal.scanning : t.modal.scanScreenshot}
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onScanFileChange}
                  disabled={isScanning}
                />
              </label>
            ) : null}
            <button className={styles.closeButton} onClick={onClose} aria-label={t.modal.close}>
              ×
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t.modal.basicInfo}</h3>

            <label className={styles.field}>
              <span>{t.modal.assignmentName}</span>
              <input
                type="text"
                placeholder={t.modal.assignmentNamePlaceholder}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <div className={styles.fieldRow}>
              <label className={styles.field}>
                <span>{t.modal.subject}</span>
                <select
                  value={resolvedSubjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>{t.modal.dueDate}</span>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>{t.modal.description}</span>
              <textarea
                placeholder={t.modal.descriptionPlaceholder}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>{t.modal.externalLink}</span>
              <input
                type="url"
                placeholder="https://..."
                value={externalLink}
                onChange={(event) => setExternalLink(event.target.value)}
              />
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t.modal.attachments}</h3>

            <div className={styles.attachmentPanel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{t.modal.existingAttachments}</span>
                <span className={styles.panelMeta}>
                  {t.modal.imageCount.replace('{count}', String(visibleExistingImages.length))} / {t.modal.fileCount.replace('{count}', String(visibleExistingFiles.length))}
                </span>
              </div>

              {visibleExistingImages.length === 0 && visibleExistingFiles.length === 0 ? (
                <p className={styles.emptyText}>{t.modal.noAttachments}</p>
              ) : (
                <ul className={styles.assetList}>
                  {visibleExistingImages.map((asset) => (
                    <li key={asset.id} className={styles.assetItem}>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{asset.fileName}</span>
                        <span className={styles.assetMeta}>
                          {t.modal.image} · {bytesToMegabytes(asset.sizeBytes)}MB
                          {asset.isThumbnail ? ` · ${t.modal.thumbnail}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.removeChip}
                        onClick={() => markExistingAssetRemoved(asset.id)}
                      >
                        {t.modal.removeExisting}
                      </button>
                    </li>
                  ))}
                  {visibleExistingFiles.map((asset) => (
                    <li key={asset.id} className={styles.assetItem}>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{asset.fileName}</span>
                        <span className={styles.assetMeta}>
                          {t.modal.file} · {bytesToMegabytes(asset.sizeBytes)}MB
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.removeChip}
                        onClick={() => markExistingAssetRemoved(asset.id)}
                      >
                        {t.modal.removeExisting}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.attachmentPanel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{t.modal.newAttachments}</span>
                <span className={styles.panelMeta}>{t.modal.newAttachmentsNote}</span>
              </div>

              <div className={styles.pickerRow}>
                <label className={styles.filePickerLabel}>
                  {t.modal.addImages}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files ?? []), setImageFiles)
                    }
                  />
                </label>
                <label className={styles.filePickerLabel}>
                  {t.modal.addFiles}
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files ?? []), setAttachmentFiles)
                    }
                  />
                </label>
              </div>

              {imageFiles.length === 0 && attachmentFiles.length === 0 ? (
                <p className={styles.emptyText}>{t.modal.noNewFiles}</p>
              ) : (
                <ul className={styles.assetList}>
                  {imageFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className={styles.assetItem}>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{file.name}</span>
                        <span className={styles.assetMeta}>
                          {t.modal.image} · {bytesToMegabytes(file.size)}MB
                          {index === 0 ? ` · ${t.modal.firstImageThumbnail}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.removeChip}
                        onClick={() => removeNewImage(index)}
                      >
                        {t.modal.removeNew}
                      </button>
                    </li>
                  ))}

                  {attachmentFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`} className={styles.assetItem}>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{file.name}</span>
                        <span className={styles.assetMeta}>
                          {t.modal.file} · {bytesToMegabytes(file.size)}MB
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.removeChip}
                        onClick={() => removeNewAttachment(index)}
                      >
                        {t.modal.removeNew}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerMeta}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={submitted}
                onChange={(event) => setSubmitted(event.target.checked)}
              />
              <span>{t.modal.markSubmitted}</span>
            </label>
            <p className={styles.helperText}>
              {t.modal.remainingStorage.replace('{amount}', String(bytesToMegabytes(remainingAfterSelection)))}
            </p>
            {error ? <p className={styles.errorText}>{error}</p> : null}
          </div>

          <div className={styles.footerActions}>
            <button className={styles.cancelButton} type="button" onClick={onClose}>
              {t.modal.cancel}
            </button>
            <button
              className={styles.submitButton}
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isEditMode
                  ? t.modal.updating
                  : t.modal.saving
                : isEditMode
                  ? t.modal.save
                  : t.modal.create}
            </button>
          </div>
        </footer>

        {toastMessage ? <Toast message={toastMessage} onDone={handleDismissToast} /> : null}
      </section>
    </div>
  )
}
