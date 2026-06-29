import type { HTMLAttributes } from 'svelte/elements';

export type QrCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/** Props for the QrCode component. */
export type QrCodeProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'aria-label' | 'children' | 'class' | 'role'
> & {
  /** Text payload encoded into the QR code matrix. */
  value: string;
  /** Accessible label announced for the QR image. Defaults to `QR code for ${value}`. */
  label?: string;
  /** Square pixel size of the rendered QR code. @default 160 */
  size?: number;
  /** Quiet-zone width in QR modules. @default 1 */
  margin?: number;
  /** QR error correction level. @default "M" */
  errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
  class?: string;
};

export interface QrCodeSchemaProps {
  /** Text payload encoded into the QR code matrix. */
  value: string;
  /** Accessible label announced for the QR image. @default `QR code for ${value}` */
  label?: string;
  /** Square pixel size of the rendered QR code. @default 160 */
  size?: number;
  /** Quiet-zone width in QR modules. @default 1 */
  margin?: number;
  /** QR error correction level. @default "M" */
  errorCorrectionLevel?: QrCodeErrorCorrectionLevel;
  /** Custom class merged with `.cinder-qr-code`. */
  class?: string;
}
