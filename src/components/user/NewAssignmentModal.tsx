import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { scanScreenshot } from '../../lib/ocrParser'
import type { Assignment, AssignmentAsset, Subject } from '../../types'
import type { AssignmentFormInput } from '../../lib/assignments'
import styles from './NewAssignmentModal.module.css'

type ActiveTab = 'info' | 'attachments'
type Meridiem = 'AM' | 'PM'

const DESCRIPTION_MAX_LENGTH = 100

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

function splitAssets(assets: AssignmentAsset[] | undefined) {
  return {
    images: (assets ?? []).filter((asset) => asset.assetType === 'image'),
    files: (assets ?? []).filter((asset) => asset.assetType === 'file'),
  }
}

function getLocalDateParts(value?: string) {
  if (!value) {
    return {
      date: '',
      hour: '9',
      minute: '00',
      meridiem: 'AM' as Meridiem,
    }
  }

  const date = new Date(value)
  const localYear = date.getFullYear()
  const localMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const localDay = `${date.getDate()}`.padStart(2, '0')
  const hours24 = date.getHours()
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  const meridiem: Meridiem = hours24 >= 12 ? 'PM' : 'AM'
  const hour12Raw = hours24 % 12 || 12

  return {
    date: `${localYear}-${localMonth}-${localDay}`,
    hour: `${hour12Raw}`,
    minute: minutes,
    meridiem,
  }
}

function buildIsoDate(dateValue: string, hourValue: string, minuteValue: string, meridiem: Meridiem) {
  if (!dateValue) {
    return ''
  }

  const parsedHour = Number(hourValue)
  const parsedMinute = Number(minuteValue)

  if (
    Number.isNaN(parsedHour) ||
    Number.isNaN(parsedMinute) ||
    parsedHour < 1 ||
    parsedHour > 12 ||
    parsedMinute < 0 ||
    parsedMinute > 59
  ) {
    return ''
  }

  const [year, month, day] = dateValue.split('-').map(Number)
  const hours24 = meridiem === 'PM' ? (parsedHour % 12) + 12 : parsedHour % 12
  const localDate = new Date(year, month - 1, day, hours24, parsedMinute, 0, 0)

  return localDate.toISOString()
}

function getAssetSummaryLabel(asset: AssignmentAsset) {
  const prefix = asset.assetType === 'image' ? '이미지' : '파일'
  const suffix = asset.isThumbnail ? ' · 썸네일' : ''
  return `${prefix} · ${bytesToMegabytes(asset.sizeBytes)}MB${suffix}`
}

function getNewFileSummaryLabel(file: File, kind: 'image' | 'file', isFirstImage: boolean) {
  const prefix = kind === 'image' ? '이미지' : '파일'
  const suffix = kind === 'image' && isFirstImage ? ' · 첫 이미지가 썸네일로 저장됩니다.' : ''
  return `${prefix} · ${bytesToMegabytes(file.size)}MB${suffix}`
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
  const initialDateParts = getLocalDateParts(assignment?.dueDate)

  const [activeTab, setActiveTab] = useState<ActiveTab>('info')
  const [title, setTitle] = useState(assignment?.title ?? '')
  const [subjectId, setSubjectId] = useState(assignment?.subjectId ?? subjects[0]?.id ?? '')
  const [dateValue, setDateValue] = useState(initialDateParts.date)
  const [hourValue, setHourValue] = useState(initialDateParts.hour)
  const [minuteValue, setMinuteValue] = useState(initialDateParts.minute)
  const [meridiem, setMeridiem] = useState<Meridiem>(initialDateParts.meridiem)
  const [description, setDescription] = useState(
    (assignment?.description ?? '').slice(0, DESCRIPTION_MAX_LENGTH),
  )
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
  const totalAttachmentCount =
    visibleExistingImages.length + visibleExistingFiles.length + imageFiles.length + attachmentFiles.length

  const selectedBytes = useMemo(
    () =>
      [...imageFiles, ...attachmentFiles].reduce((total, file) => {
        return total + file.size
      }, 0),
    [attachmentFiles, imageFiles],
  )

  const remainingAfterSelection = Math.max(0, remainingBytes - selectedBytes)

  function addFiles(nextFiles: File[], setter: (updater: (currentFiles: File[]) => File[]) => void) {
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

  function applyScannedDueDate(dueDate?: string) {
    if (!dueDate) return

    // Expect: YYYY-MM-DDTHH:mm (no timezone). Be defensive.
    const match = dueDate.match(/(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/)
    if (!match) return

    const [, datePart, hh, mm] = match
    const hour24 = Number(hh)
    if (Number.isNaN(hour24)) return

    const minute = mm
    const mer = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = hour24 % 12 || 12

    setDateValue(datePart)
    setHourValue(String(hour12))
    setMinuteValue(minute)
    setMeridiem(mer)
  }

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
      if (parsed.dueDate) applyScannedDueDate(parsed.dueDate)
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
    const dueDate = buildIsoDate(dateValue, hourValue, minuteValue, meridiem)

    if (!title.trim() || !dueDate || !resolvedSubjectId) {
      setError(t.modal.requiredFields)
      return
    }

    if (selectedBytes > remainingBytes) {
      setError(
        `선택한 파일 용량이 남은 저장공간을 초과했습니다. 현재 남은 용량은 ${bytesToMegabytes(
          remainingBytes,
        )}MB입니다.`,
      )
      return
    }

    setIsSubmitting(true)
    setError(null)

    const payload: AssignmentFormInput = {
      subjectId: resolvedSubjectId,
      title: title.trim(),
      dueDate,
      submitted,
      description: description.trim(),
      externalLink: externalLink.trim(),
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
          <div className={styles.headingBlock}>
            <h2 id="assignment-modal-title" className={styles.title}>
              {isEditMode ? t.modal.editTitle : t.modal.createTitle}
            </h2>
            <p className={styles.subtitle}>기본 정보와 첨부 파일을 한 번에 정리할 수 있어요.</p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="모달 닫기" type="button">
            ×
          </button>
          <div className={styles.tabs} role="tablist" aria-label="과제 편집 탭">
            <button
              className={activeTab === 'info' ? `${styles.tabButton} ${styles.tabButtonActive}` : styles.tabButton}
              type="button"
              role="tab"
              aria-selected={activeTab === 'info'}
              onClick={() => setActiveTab('info')}
            >
              기본 정보
            </button>
            <button
              className={
                activeTab === 'attachments'
                  ? `${styles.tabButton} ${styles.tabButtonActive}`
                  : styles.tabButton
              }
              type="button"
              role="tab"
              aria-selected={activeTab === 'attachments'}
              onClick={() => setActiveTab('attachments')}
            >
              첨부 파일
              <span className={styles.tabBadge}>{totalAttachmentCount}</span>
            </button>
          </div>
        </header>

        <div className={styles.body}>
          <section
            className={activeTab === 'info' ? `${styles.panel} ${styles.panelActive}` : styles.panel}
            role="tabpanel"
            hidden={activeTab !== 'info'}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                과제명 <em>*</em>
              </span>
              <input
                type="text"
                placeholder={t.modal.assignmentNamePlaceholder}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <div className={styles.gridTwo}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  과목 <em>*</em>
                </span>
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
                <span className={styles.fieldLabel}>
                  마감일 <em>*</em>
                </span>
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                />
              </label>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>마감 시간</span>
              <div className={styles.timeRow}>
                <input
                  className={styles.timeInput}
                  type="number"
                  min={1}
                  max={12}
                  value={hourValue}
                  onChange={(event) => setHourValue(event.target.value)}
                />
                <span className={styles.timeSeparator}>:</span>
                <input
                  className={styles.timeInput}
                  type="number"
                  min={0}
                  max={59}
                  value={minuteValue}
                  onChange={(event) => setMinuteValue(event.target.value.padStart(2, '0'))}
                />
                <div className={styles.meridiemToggle}>
                  <button
                    type="button"
                    className={
                      meridiem === 'AM'
                        ? `${styles.meridiemButton} ${styles.meridiemButtonActive}`
                        : styles.meridiemButton
                    }
                    onClick={() => setMeridiem('AM')}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    className={
                      meridiem === 'PM'
                        ? `${styles.meridiemButton} ${styles.meridiemButtonActive}`
                        : styles.meridiemButton
                    }
                    onClick={() => setMeridiem('PM')}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>설명</span>
                <span className={styles.characterCount}>({description.length}/{DESCRIPTION_MAX_LENGTH})</span>
              </span>
              <textarea
                placeholder={t.modal.descriptionPlaceholder}
                rows={4}
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, DESCRIPTION_MAX_LENGTH))
                }
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>외부 링크</span>
              <input
                type="url"
                placeholder="https://..."
                value={externalLink}
                onChange={(event) => setExternalLink(event.target.value)}
              />
            </label>
          </section>

          <section
            className={activeTab === 'attachments' ? `${styles.panel} ${styles.panelActive}` : styles.panel}
            role="tabpanel"
            hidden={activeTab !== 'attachments'}
          >
            <div className={styles.attachHeader}>
              <span className={styles.attachTitle}>기존 첨부</span>
              <span className={styles.attachMeta}>
                이미지 {visibleExistingImages.length}개 · 파일 {visibleExistingFiles.length}개
              </span>
            </div>

            {visibleExistingImages.length === 0 && visibleExistingFiles.length === 0 ? (
              <p className={styles.emptyText}>아직 첨부된 파일이 없습니다.</p>
            ) : (
              <ul className={styles.assetList}>
                {visibleExistingImages.map((asset) => (
                  <li key={asset.id} className={styles.assetItem}>
                    <div className={`${styles.assetIcon} ${styles.assetIconImage}`}>이미지</div>
                    <div className={styles.assetInfo}>
                      <span className={styles.assetName}>{asset.fileName}</span>
                      <span className={styles.assetMeta}>{getAssetSummaryLabel(asset)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.deleteChip}
                      onClick={() => markExistingAssetRemoved(asset.id)}
                    >
                      삭제
                    </button>
                  </li>
                ))}
                {visibleExistingFiles.map((asset) => (
                  <li key={asset.id} className={styles.assetItem}>
                    <div className={`${styles.assetIcon} ${styles.assetIconFile}`}>파일</div>
                    <div className={styles.assetInfo}>
                      <span className={styles.assetName}>{asset.fileName}</span>
                      <span className={styles.assetMeta}>{getAssetSummaryLabel(asset)}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.deleteChip}
                      onClick={() => markExistingAssetRemoved(asset.id)}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.attachNewBlock}>
              <div className={styles.attachHeader}>
                <span className={styles.attachTitle}>새 첨부 추가</span>
                <span className={styles.attachMeta}>남은 용량 {bytesToMegabytes(remainingAfterSelection)}MB</span>
              </div>
              <div className={styles.attachButtonRow}>
                <label className={styles.attachButton}>
                  이미지 추가
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      addFiles(Array.from(event.target.files ?? []), setImageFiles)
                    }
                  />
                </label>
                <label className={styles.attachButton}>
                  파일 추가
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
                      <div className={`${styles.assetIcon} ${styles.assetIconImage}`}>이미지</div>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{file.name}</span>
                        <span className={styles.assetMeta}>
                          {getNewFileSummaryLabel(file, 'image', index === 0)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.deleteChip}
                        onClick={() => removeNewImage(index)}
                      >
                        {t.modal.removeNew}
                      </button>
                    </li>
                  ))}
                  {attachmentFiles.map((file, index) => (
                    <li key={`${file.name}-${file.size}-${index}`} className={styles.assetItem}>
                      <div className={`${styles.assetIcon} ${styles.assetIconFile}`}>파일</div>
                      <div className={styles.assetInfo}>
                        <span className={styles.assetName}>{file.name}</span>
                        <span className={styles.assetMeta}>{getNewFileSummaryLabel(file, 'file', false)}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.deleteChip}
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
          <label className={styles.submitToggleRow}>
            <button
              type="button"
              className={submitted ? `${styles.toggle} ${styles.toggleActive}` : styles.toggle}
              onClick={() => setSubmitted((current) => !current)}
              aria-pressed={submitted}
            >
              <span className={submitted ? `${styles.toggleKnob} ${styles.toggleKnobActive}` : styles.toggleKnob} />
            </button>
            <span className={styles.toggleLabel}>{submitted ? '제출 완료' : '미제출'}</span>
          </label>

          <div className={styles.footerButtons}>
            {error ? <p className={styles.errorText}>{error}</p> : null}
            <button className={styles.cancelButton} type="button" onClick={onClose}>
              {t.modal.cancel}
            </button>
            <button
              className={styles.saveButton}
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </footer>

        {toastMessage ? <Toast message={toastMessage} onDone={handleDismissToast} /> : null}
      </section>
    </div>
  )
}
