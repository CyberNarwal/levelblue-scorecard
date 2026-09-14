# Getting this to your team

`report-qa.html` is the entire tool in one file. That is what makes distribution
easy: **there is nothing to install, and updating means replacing one file.**

Whichever route you pick, the important property is the same. The page is only
ever *downloaded*; the report is read and analysed by the browser on the
person's own machine. A draft never travels anywhere, even when the page itself
came from a URL.

---

## The three options

### 1. Shared drive or SharePoint — the usual answer

Put `report-qa.html` in a folder everyone already has: a team drive, a synced
SharePoint or OneDrive folder, wherever your templates live.

- People open it from there, or copy it to their desktop.
- You update it by replacing the file. Next time they open it, it is current.
- Works with no internet at all.
- Nothing is public.

The one wrinkle: opening an HTML file *directly from a SharePoint web page*
usually downloads it rather than running it. Use a **synced** folder (the one
that appears in File Explorer or Finder), or tell people to download it once.

**Best when** the tool itself is internal, which it is if you bake your client
list into it.

### 2. An internal web address

If you have somewhere that serves internal pages — an intranet, an internal
web server, an S3 bucket behind SSO — put the file there and send a link.

- Everyone is always on the current version; there is no stale copy.
- It is a bookmark, which is a lower bar than "find the file".
- Still analyses locally: the page downloads, the draft does not upload.

**Best when** you want one address and no version drift.

### 3. GitHub Pages — a public URL

This repo already deploys to GitHub Pages (`npm run deploy`). You could publish
the page the same way and send people a link.

**Read this before you do.** A GitHub Pages site on a public repo is public. The
page has no way to leak a *report* — analysis is local — but it can leak
**your own settings**, because `report-qa.config.json` is compiled into it. If
that file lists your clients under `forbiddenClientNames`, publishing the page
publishes your client list.

If you want to go this route, leave `forbiddenClientNames` empty in the built
page and have each person type their own into the settings panel, which is
stored only in their browser. The build is otherwise the same.

**Best when** the team is spread across organisations and a public URL is
genuinely acceptable.

---

## Updating it

You (or Claude) change a rule, then:

```bash
npm run qa:build
```

That rewrites `report-qa.html` and prints the version:

```
Built /path/to/report-qa.html
  version 2026-09-14 (1b02c22), 103 checks
  engine 123 kB, page 132 kB - self-contained, no network access
  Share this one file. Replacing it is the update.
```

Copy the file wherever your team gets it from. That is the whole release
process.

## Telling whether a copy is current

The page prints its version in the footer:

> Version 2026-09-14 (1b02c22) - 103 checks

Anyone can compare that against the shared copy. The page deliberately does not
check for updates itself, because that would mean reaching out to the network
and the offline guarantee is worth more than the convenience.

If version drift becomes a real problem, option 2 removes it entirely.

## Setting the house style once, for everyone

Two layers, which is what lets you set the team default without taking away
per-engagement control:

- **`report-qa.config.json`** is compiled into the page at build time. Dialect,
  severity scale, required sections, readability and slide limits — the things
  that should be the same for everyone. Change it, rebuild, redistribute.
- **The settings panel** in the page is per person, stored in their browser.
  Client name, other clients' names, required marking — the things that change
  per engagement.

So: put the house style in the config, let people fill in the client.

## What to tell the team

Something like:

> There's a QA checker for report drafts at `<wherever you put it>`. Open it and
> drag your draft on — Word or PowerPoint. It flags spelling and grammar,
> spacing, terminology, CVSS and framework mistakes, and the things that must
> not reach a client: credentials, another client's name left in a template,
> tracked changes, unresolved comments, speaker notes.
>
> It runs on your own machine. Nothing is uploaded and it works offline.
>
> First time you use it, open **Engagement settings** and put in the client's
> name and any other client whose template you copied from. It remembers them.
>
> It only catches mechanical faults. It cannot tell you whether a finding is
> right or a severity is justified — that is still your read.
