// Stub for @mizchi/moonlight (not yet published to npm)
export interface EditorHandle {
  exportSvg(): string;
  onChange(callback: () => void): void;
  destroy(): void;
}

export function createEditor(
  _container: HTMLElement,
  _options: Record<string, unknown>,
): EditorHandle | null {
  console.warn("@mizchi/moonlight is not available. Moonlight editor is disabled.");
  return null;
}
