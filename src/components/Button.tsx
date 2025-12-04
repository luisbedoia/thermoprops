import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./Button.css";

type ButtonVariant = "solid" | "ghost" | "subtle" | "plain";
type ButtonSize = "md" | "sm";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function classNames(values: Array<string | null | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "solid",
      size = "md",
      fullWidth = false,
      className,
      type,
      ...rest
    },
    ref,
  ) => {
    const classes = classNames([
      "app-button",
      variant !== "solid" ? `app-button--${variant}` : null,
      size === "sm" ? "app-button--sm" : null,
      fullWidth ? "app-button--full" : null,
      className,
    ]);

    return (
      <button ref={ref} type={type ?? "button"} className={classes} {...rest} />
    );
  },
);

Button.displayName = "Button";
