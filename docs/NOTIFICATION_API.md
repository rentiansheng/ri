# Terminal Notification API (Magic Strings)

RI supports a "Magic Strings" protocol that allows CLI tools and scripts to trigger application-level notifications directly from the terminal.

## Protocol Specification

The protocol uses the Operating System Command (OSC) sequence pattern.

**Format:**
`\x1b]9;{JSON_PAYLOAD}\x07`

- `\x1b]9;`: The opening sequence (OSC 9).
- `{JSON_PAYLOAD}`: A string or JSON object containing notification details.
- `\x07`: The string terminator (BEL).

## Simple Usage

To send a simple text notification from a shell script:

```bash
printf "\033]9;Task Completed Successfully\007"
```

## Advanced Usage (JSON)

You can pass a JSON object to customize the notification behavior:

```bash
printf "\033]9;{\"title\": \"Build Status\", \"body\": \"Production build failed!\", \"type\": \"error\"}\007"
```

### JSON Fields
| Field | Type | Description |
|-------|------|-------------|
| `title` | string | The headline of the notification. |
| `body` | string | The main content message. |
| `type` | string | `info`, `success`, `warning`, or `error`. Affects the icon/color. |
| `sound` | boolean | Whether to play a system alert sound. |

## Implementation Details

The terminal scanner in `src/renderer/components/Terminal.tsx` uses a regex to catch these sequences before they are rendered by xterm.js. This ensures the "Magic String" itself is never visible to the user in the terminal scrollback.
