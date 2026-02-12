# Interface CI/CD – Visual UI Review & Approval System

## Overview

This system allows non-technical stakeholders to visually review UI changes between two Git commits of the SAQ-Form interface and approve or reject them before merging into the main branch.

It works by:

1. Checking out two commits
2. Building both versions
3. Taking screenshots of the UI
4. Generating a visual pixel comparison
5. Providing a browser-based review interface
6. Allowing approval or rejection
7. Automatically merging approved changes into `main`

No external services or third-party packages are required. Due to time constraints and tags not being present the initial idea was not completed. The long term ideas are notes in the summary in the root at `Summary.md`

---

## System Architecture

Git Repository  
↓  
prepare_artifacts.sh  
↓  
Screenshots (Before / After)  
↓  
review_server.py  
↓  
Browser Review UI (reviewer.html)  
↓  
Approve / Reject  
↓  
merge_and_push.sh (if approved)  
↓  
Git merge + push to main

---

## Folder Structure

interface-ci/  
│  
├── prepare_artifacts.sh # Builds and generates screenshots  
├── reviewer.html # Visual comparison UI  
├── review_server.py # Review server + decision handler  
├── merge_and_push.sh # Merges approved commit into main  
│  
├── artifacts/ # Generated screenshots + metadata  
└── reviews/ # Audit log of approvals/rejections

---

## Requirements

You must have installed:

- Git
- Node + npm (if project requires build)
- Google Chrome or Chromium
- Python 3
- Git Bash (on Windows)

---

## How to Use

### Step 1 — Open Git Bash

In Windows:

- Right-click inside the repo
- Click "Git Bash Here"

Or use VS Code terminal set to Git Bash.

Do NOT use PowerShell or Command Prompt.

---

### Step 2 — Generate Visual Artifacts

Navigate to the interface-ci folder:

cd interface-ci

Run the script with two commit IDs:

./prepare_artifacts.sh .. <commit1> <commit2>

Example:

./prepare_artifacts.sh .. a1b2c3d f4e5g6h

What this does:

- Checks out both commits
- Builds both versions
- Starts temporary local servers
- Takes screenshots
- Saves images to interface-ci/artifacts/

---

### Step 3 — Start the Review Server

From the repository root:

python3 interface-ci/review_server.py

You should see:

Serving files from <repo-root> on port 8080

---

### Step 4 — Open Review Interface

Open in your browser:

http://localhost:8080/interface-ci/reviewer.html

You will see:

- Before image
- After image
- Overlay slider
- Pixel diff heatmap
- Percent changed metric
- Approve / Reject buttons

---

## Review Process

### Visual Tools Available

- Side-by-side comparison
- Slider overlay view
- Pixel difference heatmap
- Percentage of pixels changed

This allows non-technical stakeholders to understand what changed visually without reading code.

---

## Approval Workflow

### When Approve is Clicked

1. Decision is saved in:
   interface-ci/reviews/

2. merge_and_push.sh is executed

3. The system:
   - Creates a branch from the approved commit
   - Merges it into main
   - Pushes main to origin
   - Logs merge result

4. A merge record file is created:
   merge\_<commit>\_success.json

---

### When Reject is Clicked

1. Decision is saved in:
   interface-ci/reviews/

2. No merge is performed.

3. Reviewer notes are stored for audit purposes.

---

## Using Commit IDs Instead of Tags

To get commit IDs:

git log --oneline

Then run:

./prepare_artifacts.sh .. <old_commit> <new_commit>

Example:

./prepare_artifacts.sh .. f4e5g6h a1b2c3d
