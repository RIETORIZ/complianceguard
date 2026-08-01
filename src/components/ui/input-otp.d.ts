import * as React from "react";
export interface InputOTPProps extends React.HTMLAttributes<HTMLDivElement> {
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  autoFocus?: boolean;
  autoComplete?: string;
}
export const InputOTP: React.ForwardRefExoticComponent<InputOTPProps & React.RefAttributes<HTMLInputElement>>;
export const InputOTPGroup: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
export const InputOTPSlot: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & { index: number } & React.RefAttributes<HTMLDivElement>>;
export const InputOTPSeparator: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>>;
