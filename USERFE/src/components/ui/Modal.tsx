import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  centered?: boolean
  footer?: ReactNode
  closeOnBackdrop?: boolean
  children: ReactNode
}

export function Modal({ open, onClose, title, description, centered = false, footer, closeOnBackdrop = true, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === dialogRef.current) onClose()
      }}
    >
      {open && (
        <div className="modal__panel">
          <header className="modal__header">
            <div>
              <h2 id={titleId} className="modal__title">
                {title}
              </h2>
              {description && <p className="modal__description">{description}</p>}
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
              <X />
            </button>
          </header>
          <div className={`modal__body${centered ? ' modal__body--center' : ''}`}>{children}</div>
          {footer && <footer className="modal__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
