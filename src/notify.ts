/**
 * Cross-platform terminal notification utilities.
 * Uses Kitty's OSC 99 protocol with BEL fallback.
 * @see https://sw.kovidgoyal.net/kitty/desktop-notifications/
 */

/**
 * Trigger a terminal notification.
 * Uses OSC 99 (Kitty's native notification protocol) with BEL fallback.
 */
export function notify(title: string, message: string): void {
  // OSC 99 - Kitty desktop notification protocol
  // Format: ESC ] 99 ; i=<id>:d=0:p=title ; <body> BEL
  const id = Date.now().toString();
  const osc99 = `\x1b]99;i=${id}:d=0:p=title;${title}\x07\x1b]99;i=${id}:d=1:p=body;${message}\x07`;
  
  // Write OSC 99 notification
  process.stdout.write(osc99);
  
  // Also trigger terminal bell (BEL) for audible alert
  process.stdout.write("\x07");
}
