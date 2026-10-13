import { messageBrowserHref } from '../model/messages';

/** Link to a message's raw text in the message browser (T043 hook for holdings/settlements/breaks). */
export function SourceMessageLink({ messageId, label = 'Source message' }: { messageId: number; label?: string }) {
  return (
    <a href={messageBrowserHref(messageId)} style={{ color: '#005daa', fontFamily: "'IBM Plex Mono',monospace", fontSize: '11px' }}>
      {label}
    </a>
  );
}
