import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// localStorage keys for persisting data across authentication
export const PENDING_LANDMARK_KEY = 'exploraria-pending-landmark'
