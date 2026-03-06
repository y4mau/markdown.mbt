const URL_PATTERN = /^https?:\/\/\S+$|^ftp:\/\/\S+$/;

export function isUrl(text: string): boolean {
  return URL_PATTERN.test(text.trim());
}

export function handlePasteAsLink(
  e: ClipboardEvent,
  textarea: HTMLTextAreaElement,
): boolean {
  const pasted = e.clipboardData?.getData("text/plain") ?? "";
  const { selectionStart, selectionEnd } = textarea;
  if (selectionStart === selectionEnd || !isUrl(pasted)) return false;

  e.preventDefault();
  const selected = textarea.value.substring(selectionStart, selectionEnd);
  textarea.setRangeText(
    `[${selected}](${pasted.trim()})`,
    selectionStart,
    selectionEnd,
    "end",
  );
  return true;
}
