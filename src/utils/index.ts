export * from "./time";

// Vision-capable Grok models that support image inputs
export const VISION_MODELS = ["grok-2-vision-1212", "grok-vision-beta", "grok-beta"];

/**
 * Check if a model supports vision/image inputs
 */
export function isVisionModel(model: string): boolean {
  return VISION_MODELS.includes(model);
}
