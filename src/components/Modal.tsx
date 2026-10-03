import { ReactNode, useEffect, useRef, type MouseEventHandler } from "react";
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
  // Callers pass a new onClose on every render; keep the latest without
  // re-running the effect below (that would unlock and relock the page).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    // Lock the page behind the dialog. iOS Safari ignores overflow: hidden on
    // the body for touch scrolling, so pin the body where it is instead, and
    // put the scroll position back on close. The root element is locked too,
    // so neither iOS's rubber-band bounce nor Android's pull-to-refresh can
    // move the page (and the dialog with it) under the user's finger.
    const scrollY = window.scrollY;
    const body = document.body.style;
    const root = document.documentElement.style;
    const previous = {
      position: body.position,
      top: body.top,
      width: body.width,
      overflow: body.overflow,
    };
    const previousRoot = {
      overflow: root.overflow,
      overscrollBehavior: root.overscrollBehavior,
    };
    body.position = "fixed";
    body.top = `-${scrollY}px`;
    body.width = "100%";
    body.overflow = "hidden";
    root.overflow = "hidden";
    root.overscrollBehavior = "none";

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      Object.assign(body, previous);
      Object.assign(root, previousRoot);
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

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
