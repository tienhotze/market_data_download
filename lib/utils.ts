import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { toPng } from 'html-to-image';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function copyImageToClipboard(element: HTMLElement) {
  if (!element) return;
  try {
    const dataUrl = await toPng(element);
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ]);
    return true;
  } catch (error) {
    console.error("Could not copy image to clipboard:", error);
    return false;
  }
}
