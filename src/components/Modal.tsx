import { ReactNode, useEffect, type MouseEventHandler } from "react";
import "./Modal.css";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
  role?: "dialog" | "alertdialog";
  closeOnBackdropClick?: boolean;
};

function classNames(values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  ariaLabelledby,
  ariaDescribedby,
  role = "dialog",
  closeOnBackdropClick = true,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  const handleDialogClick: MouseEventHandler<HTMLDivElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      className={classNames(["modal", className])}
      role={role}
      aria-modal={
        role === "dialog" || role === "alertdialog" ? "true" : undefined
      }
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      onClick={handleBackdropClick}
    >
      <div className="modal__backdrop" />
      <div
        className={classNames(["modal__dialog", contentClassName])}
        role="document"
        onClick={handleDialogClick}
      >
        {children}
      </div>
    </div>
  );
}
