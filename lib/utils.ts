import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Color palette for model-based border coloring (theme-aware)
const MODEL_BORDER_COLORS = [
  "border-orange-500 dark:border-orange-400",
  "border-green-500 dark:border-green-400",
  "border-yellow-500 dark:border-yellow-300",
  "border-purple-500 dark:border-purple-400",
  "border-pink-500 dark:border-pink-400",
  "border-blue-500 dark:border-blue-400",
  "border-indigo-500 dark:border-indigo-400",
  "border-teal-500 dark:border-teal-400",
  "border-cyan-500 dark:border-cyan-400",
  "border-emerald-500 dark:border-emerald-400",
  "border-lime-500 dark:border-lime-400",
  "border-rose-500 dark:border-rose-400",
  "border-violet-500 dark:border-violet-400",
  "border-amber-500 dark:border-amber-400",
  "border-slate-500 dark:border-slate-400",
];

/**
 * Generate a consistent border color for a given model ID
 * Uses a simple hash function to ensure the same model always gets the same color
 */
export function getModelBorderColor(modelId: string): string {
  if (!modelId) {
    return "border-black dark:border-white";
  }

  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < modelId.length; i++) {
    const char = modelId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Get a positive index within the color palette range
  const colorIndex = Math.abs(hash) % MODEL_BORDER_COLORS.length;
  return MODEL_BORDER_COLORS[colorIndex];
}

/**
 * Default border color for user nodes
 */
export const USER_NODE_BORDER = "border-black dark:border-white";

/**
 * Default border color for AI nodes when color coding is disabled
 */
export const DEFAULT_AI_NODE_BORDER = "border-orange-500 dark:border-orange-400";
