import React from "react";

export interface InputProps {
  /** Render an <input> or <textarea>. @default "input" */
  as?: "input" | "textarea";
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  /** Optional field label rendered above. */
  label?: React.ReactNode;
  /** Leading icon node. */
  icon?: React.ReactNode;
  /** Rows when as="textarea". @default 4 */
  rows?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Clay-inset text field with coral focus ring. Supports single-line and textarea. */
export function Input(props: InputProps): JSX.Element;
