# Spud

Spud is a local-first notes app. Your notes live on each of your devices and work fully offline. When a device is online, it syncs through a small server, so every device ends up with the same notes.

## Who it's for

One person with several devices, such as a laptop terminal, a browser, and a second computer.

## Surfaces

- **The `spud` CLI.** Every command can print JSON for scripts.
- **The web app.** It runs in a browser and works offline.
- **`spud-server`.** It stores changes and relays them between devices.

## Notes

A note has an ID, a title, a body (plain text or Markdown), a created time, and an updated time. Deleting a note removes it from every device after they sync.

## CLI

| Command | What it does |
|---|---|
| `spud new --title <title> --body <body>` | Creates a note and prints it |
| `spud list` | Lists notes, most recently updated first |
| `spud show <id>` | Prints one note |
| `spud edit <id> [--title <title>] [--body <body>]` | Changes a note |
| `spud rm <id>` | Deletes a note |
| `spud search <query>` | Finds notes whose title or body contains the query, ignoring case |
| `spud sync` | Sends this device's changes and receives the changes from other devices |
| `spud status` | Shows the sync status |

- With `--json`, a command prints JSON and nothing else.
- `SPUD_DATA_DIR` sets where a device keeps its data. Two devices can run on one machine with different values.
- `SPUD_SERVER` sets the server's URL.
- A search query is plain text. No character in it has a special meaning.

## Sync promises

The code must keep these promises.

1. A saved edit is never lost, even if the network drops or the app crashes during sync.
2. A retried sync never applies the same change twice.
3. Two devices that have both synced, with no edits since, show the same notes.
4. The status never says Synced while the device is offline or has edits it hasn't sent.
5. Everything works offline: create, edit, delete, list, and search.

## Sync status

The user sees one of these states: Synced, Syncing, Offline (with the number of unsent edits), or Sync failed (with the reason).

## Conflicts

In version 1, when two devices edit the same note, the later edit wins for the whole note. We keep this rule simple on purpose for version 1.

## Server

- There is one user. Each device registers once and gets a device ID.
- The server stores every change in order and returns the changes after a device's cursor.

## Not in version 1

Accounts and sharing, rich text, attachments, mobile apps, and end-to-end encryption.

## Quality bar

- Every user-facing change is verified on the real surface, the CLI or the browser, not only by tests.
- JSON output is a contract. Changing its shape is a breaking change.
