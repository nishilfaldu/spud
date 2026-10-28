# Spud

These steps install Spud and keep two notes on this computer. You create the notes, list them, show one, edit both, search, and delete them. The `--json` steps print the JSON a script would read.

Product rules live in [the Spud spec](docs/spec.md). These steps do not run `sync` or `status`.

The ids and the times in the samples are examples. Your terminal prints different ones. Use the id from your terminal in later commands. Titles, bodies, and order should match the samples. Each sample repeats its note's id, so the later outputs match the earlier ones.

## Install the command

1. Check the Bun version.

   ```bash
   bun --version
   ```

   The command prints `1.4.4`. If the command fails, or prints another version, install Bun 1.4.4 from the [Bun installation page](https://bun.sh/docs/installation).

2. Clone the repo and enter it.

   ```bash
   git clone https://github.com/nishilfaldu/spud.git
   cd spud
   ```

3. Install the packages.

   ```bash
   bun install
   ```

   Bun installs the packages in this repo and exits 0.

4. Run Spud.

   ```bash
   bunx spud --version
   ```

   ```text
   0.0.0
   ```

   Run every later `bunx spud` command from this directory.

## Keep the notes in one directory

This deletes `$HOME/spud-tutorial` if that directory is already there. Create it again and set `SPUD_DATA_DIR` to it.

```bash
rm -rf "$HOME/spud-tutorial"
mkdir "$HOME/spud-tutorial"
export SPUD_DATA_DIR="$HOME/spud-tutorial"
echo "$SPUD_DATA_DIR"
```

The last command prints the directory path. The path ends with `spud-tutorial`. Spud writes the notes from these steps in that directory. If `SPUD_DATA_DIR` is unset, Spud stores notes in `~/.spud`.

Keep this shell open. Run the note commands in order.

List the notes.

```bash
bunx spud list
```

An empty store prints nothing.

List them as JSON.

```bash
bunx spud list --json
```

The command prints an empty array and nothing else.

```json
[]
```

## Create two notes, then delete them

1. Create the milk note.

   ```bash
   bunx spud new --title "Milk" --body "Buy oat milk"
   ```

   The command prints the new note.

   ```text
   id 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   title Milk
   created 2026-10-28T20:31:00.000Z
   updated 2026-10-28T20:31:00.000Z

   Buy oat milk
   ```

   The created time and the updated time match. Your id and your times differ. Use your id wherever this page shows `01JB2K3N4P5Q6R7S8T9VWXYZ0A`.

2. Create the eggs note as JSON.

   ```bash
   bunx spud new --json --title "Eggs" --body "A dozen"
   ```

   The command prints this JSON and nothing else.

   ```json
   {
     "id": "01JB2K3N4P5Q6R7S8T9VWXYZ1B",
     "title": "Eggs",
     "body": "A dozen",
     "created": "2026-10-28T20:32:00.000Z",
     "updated": "2026-10-28T20:32:00.000Z"
   }
   ```

   Use your eggs id wherever this page shows `01JB2K3N4P5Q6R7S8T9VWXYZ1B`. The keys stay in this order.

3. List the notes.

   ```bash
   bunx spud list
   ```

   ```text
   01JB2K3N4P5Q6R7S8T9VWXYZ1B  Eggs
   01JB2K3N4P5Q6R7S8T9VWXYZ0A  Milk
   ```

   Each line is the id, two spaces, and the title. Eggs is first because that note was updated more recently.

4. List the notes as JSON.

   ```bash
   bunx spud list --json
   ```

   The command prints this JSON and nothing else.

   ```json
   [
     {
       "id": "01JB2K3N4P5Q6R7S8T9VWXYZ1B",
       "title": "Eggs",
       "body": "A dozen",
       "created": "2026-10-28T20:32:00.000Z",
       "updated": "2026-10-28T20:32:00.000Z"
     },
     {
       "id": "01JB2K3N4P5Q6R7S8T9VWXYZ0A",
       "title": "Milk",
       "body": "Buy oat milk",
       "created": "2026-10-28T20:31:00.000Z",
       "updated": "2026-10-28T20:31:00.000Z"
     }
   ]
   ```

5. Show the milk note.

   ```bash
   bunx spud show 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   ```

   ```text
   id 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   title Milk
   created 2026-10-28T20:31:00.000Z
   updated 2026-10-28T20:31:00.000Z

   Buy oat milk
   ```

6. Show the milk note as JSON.

   ```bash
   bunx spud show --json 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   ```

   The command prints this JSON and nothing else.

   ```json
   {
     "id": "01JB2K3N4P5Q6R7S8T9VWXYZ0A",
     "title": "Milk",
     "body": "Buy oat milk",
     "created": "2026-10-28T20:31:00.000Z",
     "updated": "2026-10-28T20:31:00.000Z"
   }
   ```

7. Change the milk body to two lines.

   ```bash
   bunx spud edit 01JB2K3N4P5Q6R7S8T9VWXYZ0A --body "Buy oat milk
   Get bread"
   ```

   ```text
   id 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   title Milk
   created 2026-10-28T20:31:00.000Z
   updated 2026-10-28T20:33:00.000Z

   Buy oat milk
   Get bread
   ```

   The created time stays. The updated time moves because the body changed.

8. Repeat that edit with the same body.

   ```bash
   bunx spud edit 01JB2K3N4P5Q6R7S8T9VWXYZ0A --body "Buy oat milk
   Get bread"
   ```

   The command prints the same note as the previous step. Your updated time matches that edit.

   ```text
   id 01JB2K3N4P5Q6R7S8T9VWXYZ0A
   title Milk
   created 2026-10-28T20:31:00.000Z
   updated 2026-10-28T20:33:00.000Z

   Buy oat milk
   Get bread
   ```

9. Rename the eggs note as JSON.

   ```bash
   bunx spud edit --json 01JB2K3N4P5Q6R7S8T9VWXYZ1B --title "Farm eggs"
   ```

   The command prints this JSON and nothing else.

   ```json
   {
     "id": "01JB2K3N4P5Q6R7S8T9VWXYZ1B",
     "title": "Farm eggs",
     "body": "A dozen",
     "created": "2026-10-28T20:32:00.000Z",
     "updated": "2026-10-28T20:34:00.000Z"
   }
   ```

   The title is new, so the updated time moves. The body stays `A dozen`.

10. List the notes again.

    ```bash
    bunx spud list
    ```

    ```text
    01JB2K3N4P5Q6R7S8T9VWXYZ1B  Farm eggs
    01JB2K3N4P5Q6R7S8T9VWXYZ0A  Milk
    ```

    Farm eggs is first because that edit is the newer one.

11. Search for `OAT`.

    ```bash
    bunx spud search OAT
    ```

    ```text
    01JB2K3N4P5Q6R7S8T9VWXYZ0A  Milk
    ```

    The query matches `oat` in the milk body. Search ignores case. The line matches a `list` line.

12. Search for `bread` as JSON.

    ```bash
    bunx spud search --json bread
    ```

    The command prints this JSON and nothing else.

    ```json
    [
      {
        "id": "01JB2K3N4P5Q6R7S8T9VWXYZ0A",
        "title": "Milk",
        "body": "Buy oat milk\nGet bread",
        "created": "2026-10-28T20:31:00.000Z",
        "updated": "2026-10-28T20:33:00.000Z"
      }
    ]
    ```

    The query matches the second line of the body. JSON encodes that line break as `\n`. One matching note is still a one-element array.

13. Delete the eggs note.

    ```bash
    bunx spud rm 01JB2K3N4P5Q6R7S8T9VWXYZ1B
    ```

    ```text
    deleted 01JB2K3N4P5Q6R7S8T9VWXYZ1B
    ```

14. Delete the milk note as JSON.

    ```bash
    bunx spud rm --json 01JB2K3N4P5Q6R7S8T9VWXYZ0A
    ```

    The command prints the deleted note and nothing else.

    ```json
    {
      "id": "01JB2K3N4P5Q6R7S8T9VWXYZ0A",
      "title": "Milk",
      "body": "Buy oat milk\nGet bread",
      "created": "2026-10-28T20:31:00.000Z",
      "updated": "2026-10-28T20:33:00.000Z"
    }
    ```

15. List the notes again.

    ```bash
    bunx spud list
    ```

    Stdout is empty.

16. List the notes as JSON again.

    ```bash
    bunx spud list --json
    ```

    The command prints an empty array and nothing else.

    ```json
    []
    ```

17. Show the milk note you deleted.

    ```bash
    bunx spud show 01JB2K3N4P5Q6R7S8T9VWXYZ0A
    ```

    Stdout is empty. Stderr prints this line. The exit code is 1.

    ```text
    spud: note not found: 01JB2K3N4P5Q6R7S8T9VWXYZ0A
    ```

The product rules are in [the Spud spec](docs/spec.md).
