# GitHub Issues Guide - Next.js Rewrite Epic

This guide explains how to create and manage GitHub issues for the Next.js rewrite epic.

## 📋 Quick Start

### 1. Create the Parent Epic Issue

Copy the content from `.github/issues/EPIC-001-nextjs-rewrite.md` and create a new issue:

1. Go to https://github.com/josiah-nelson/SFPLiberate/issues/new
2. Title: `[EPIC-001] Next.js Frontend Rewrite with shadcn/ui`
3. Labels: `epic`, `planning`
4. Paste the content from the markdown file
5. Create issue → note the issue number (e.g., #123)

### 2. Create Child Story Issues

Use the GitHub issue template or copy from example markdown files:

**Using Template (Recommended):**
1. Go to https://github.com/josiah-nelson/SFPLiberate/issues/new/choose
2. Select "Story" template
3. Fill in the form
4. Set `Parent Epic` to `#123` (the epic issue number)
5. Add appropriate labels and priority

**Using Markdown Files:**
1. Copy content from `.github/issues/STORY-XXX-*.md`
2. Replace `#XXX` with actual epic issue number
3. Create new issue manually
4. Add labels: `story`, `phase-X`, `pX` (priority)

### 3. Link Dependencies

On each story issue, add to the description:

```markdown
## Dependencies
**Depends on:** #124, #125
**Blocks:** #127, #128
```

Then add these relationships as comments:
- Depends on #124
- Blocks #127

GitHub will automatically create bidirectional links.

## 🏷️ Label System

### Priority Labels
- `p0` - Blocker (must be done)
- `p1` - High priority
- `p2` - Medium priority
- `p3` - Low priority / nice-to-have

### Type Labels
- `epic` - Parent epic tracking multiple stories
- `story` - User story or feature work
- `bug` - Bug fix
- `enhancement` - New feature request
- `documentation` - Documentation work

### Phase Labels
- `phase-1-foundation`
- `phase-2-core-ble`
- `phase-3-module-library`
- `phase-4-features`
- `phase-5-standalone-deploy`
- `phase-6-appwrite-deploy`
- `phase-7-polish`

### Component Labels
- `ble` - BLE-related work
- `ui` - UI components
- `api` - API client work
- `testing` - Test infrastructure
- `deployment` - Deployment config
- `typescript` - TypeScript work

### Status Labels (Project Board)
- `status:todo` - Not started
- `status:in-progress` - Currently being worked on
- `status:blocked` - Blocked by dependency
- `status:review` - In PR review
- `status:done` - Completed

## 📊 Issue Workflow

### Story Lifecycle

```
1. Created (status:todo)
   ↓
2. Dependencies resolved
   ↓
3. Assigned to developer
   ↓
4. Started (status:in-progress)
   ↓
5. PR created (status:review)
   ↓
6. PR merged (status:done)
   ↓
7. Issue closed
```

### Using Task Lists

Each story should have task lists for:
- **Acceptance Criteria** (high-level requirements)
- **Tasks** (implementation checklist)
- **Testing Requirements** (test cases)

Example:
```markdown
## ✅ Acceptance Criteria
- [ ] Feature X implemented
- [ ] Tests passing
- [ ] Documentation updated

## 🔧 Tasks
- [ ] Create component
- [ ] Wire up API
- [ ] Add tests
```

Checking these boxes automatically updates progress on the issue.

## 🔗 Dependency Management

### Declaring Dependencies

In each story issue, clearly state:

```markdown
## 🔗 Dependencies

**Depends on:**
- #124 STORY-001: Project Scaffolding
- #125 STORY-002: API Client

**Blocks:**
- #128 STORY-006: Device Connection Flow
```

### Viewing Dependency Graph

GitHub doesn't have a built-in dependency graph, but you can use:
- **Manual tracking** in epic issue (update weekly)
- **GitHub Projects** (Beta) - supports dependency fields
- **Third-party tools** (e.g., ZenHub, Linear)

### Handling Blockers

If a story is blocked:
1. Add `status:blocked` label
2. Comment with reason and blocker issue number
3. Update epic issue with blocker status
4. Consider parallelizing other work

## 📈 Progress Tracking

### Epic Progress

Update the epic issue weekly with:

```markdown
## 📈 Progress Update - Week X

**Story Points Completed:** 21 / 125
**Stories Completed:** 5 / 25
**Current Velocity:** 10-11 pts/week

### Completed This Week
- [x] #124 STORY-001: Project Scaffolding (3 pts)
- [x] #125 STORY-002: API Client (5 pts)

### In Progress
- [ ] #126 STORY-003: BLE Service Layer (8 pts) - 60% complete

### Blocked
- [ ] #130 STORY-007: Device Discovery - waiting on #126

### Next Week
- Start STORY-004: Layout & Navigation
- Continue STORY-003
```

### Sprint Planning

Use milestones for sprints:

1. Create milestone: `Sprint 1 (Weeks 1-2)`
2. Add stories to milestone
3. Set due date
4. Track burndown via milestone view

## 🎯 Example: Creating STORY-001

**Step-by-step:**

1. **Go to** https://github.com/josiah-nelson/SFPLiberate/issues/new/choose
2. **Select** "Story" template
3. **Fill in:**
   - Story ID: `STORY-001`
   - Parent Epic: `#123` (replace with actual epic number)
   - Priority: `P0 (Blocker)`
   - Story Points: `3`
   - Description: Copy from `.github/issues/STORY-001-project-scaffolding.md`
   - Acceptance Criteria: (included in description)
   - Tasks: (included in description)
   - Dependencies: `None (first story)`
   - Phase: `Phase 1 - Foundation`
4. **Add labels:**
   - `story`
   - `p0`
   - `phase-1-foundation`
   - `setup`
   - `typescript`
5. **Assign** to developer (if known)
6. **Create issue**

## 🔄 Updating Stories

### When Work Starts
- Change label to `status:in-progress`
- Comment: "Starting work on this story"
- Check off tasks as you complete them

### When Blocked
- Add label: `status:blocked`
- Comment with blocker details and link to blocking issue
- Notify team in Slack/Discord

### When Creating PR
- Create PR with title: `[STORY-001] Project Scaffolding`
- Link to issue in PR description: `Closes #124`
- Add label to issue: `status:review`
- Request reviewers

### When Complete
- Merge PR (GitHub auto-closes issue if `Closes #124` in PR)
- Verify issue closed
- Update epic progress
- Unblock dependent stories

## 📋 Checklist: All 25 Stories

Use this checklist to track issue creation:

### Phase 1: Foundation
- [ ] #XXX STORY-001: Project Scaffolding (3 pts) - P0
- [ ] #XXX STORY-002: API Client & Types (5 pts) - P0
- [ ] #XXX STORY-003: BLE Service Layer (8 pts) - P0
- [ ] #XXX STORY-004: Layout & Navigation (3 pts) - P1
- [ ] #XXX STORY-005: Connection Status Dashboard (5 pts) - P1

### Phase 2: Core BLE
- [ ] #XXX STORY-006: Device Connection Flow (8 pts) - P0
- [ ] #XXX STORY-007: Device Discovery (8 pts) - P1
- [ ] #XXX STORY-008: SFP Read Operation (5 pts) - P0
- [ ] #XXX STORY-009: SFP Write Operation (8 pts) - P1
- [ ] #XXX STORY-010: Status Monitoring (3 pts) - P2

### Phase 3: Module Library
- [ ] #XXX STORY-011: Module Library DataTable (8 pts) - P1
- [ ] #XXX STORY-012: Module Detail View (5 pts) - P2
- [ ] #XXX STORY-013: Save Module Flow (3 pts) - P1

### Phase 4: Features
- [ ] #XXX STORY-014: Community Submission (5 pts) - P2
- [ ] #XXX STORY-015: Community Browser (8 pts) - P2
- [ ] #XXX STORY-016: Import/Export (5 pts) - P2
- [ ] #XXX STORY-017: Log Console & Toasts (3 pts) - P1

### Phase 5: Standalone Deploy
- [ ] #XXX STORY-018: Docker Configuration (5 pts) - P0
- [ ] #XXX STORY-019: E2E Testing (5 pts) - P1

### Phase 6: Appwrite Deploy
- [ ] #XXX STORY-020: Appwrite Auth Setup (8 pts) - P0
- [ ] #XXX STORY-021: Static Export Config (3 pts) - P0
- [ ] #XXX STORY-022: Deployment Workflow (5 pts) - P1
- [ ] #XXX STORY-023: Backend CORS Config (2 pts) - P1

### Phase 7: Polish
- [ ] #XXX STORY-024: Accessibility Audit (5 pts) - P2
- [ ] #XXX STORY-025: Documentation (5 pts) - P1

### Bonus Features
- [ ] #XXX Standalone BLE Proxy Service (5-8 pts) - P1

## 🛠️ Automation Tips

### GitHub Actions for Issue Management

Create `.github/workflows/issue-automation.yml`:

```yaml
name: Issue Automation

on:
  issues:
    types: [opened, labeled]

jobs:
  auto-assign-phase-label:
    runs-on: ubuntu-latest
    steps:
      - name: Add phase label based on title
        uses: actions/github-script@v7
        with:
          script: |
            const issue = context.payload.issue;
            const title = issue.title;

            // Extract story ID (e.g., STORY-001)
            const match = title.match(/STORY-(\d+)/);
            if (!match) return;

            const storyNum = parseInt(match[1]);
            let phase = '';

            if (storyNum <= 5) phase = 'phase-1-foundation';
            else if (storyNum <= 10) phase = 'phase-2-core-ble';
            else if (storyNum <= 13) phase = 'phase-3-module-library';
            else if (storyNum <= 17) phase = 'phase-4-features';
            else if (storyNum <= 19) phase = 'phase-5-standalone-deploy';
            else if (storyNum <= 23) phase = 'phase-6-appwrite-deploy';
            else if (storyNum <= 25) phase = 'phase-7-polish';

            if (phase) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: issue.number,
                labels: [phase]
              });
            }
```

### Issue Templates (Already Created)

Templates are in `.github/ISSUE_TEMPLATE/`:
- `epic.yml` - For creating epics
- `story.yml` - For creating stories
- `config.yml` - Template configuration

## 📚 Resources

- **Epic Plan:** [docs/NEXTJS_REWRITE_EPIC.md](NEXTJS_REWRITE_EPIC.md)
- **Roadmap:** [docs/NEXTJS_ROADMAP.md](NEXTJS_ROADMAP.md)
- **File Structure:** [docs/NEXTJS_FILE_STRUCTURE.md](NEXTJS_FILE_STRUCTURE.md)
- **BLE Proxy Service:** [docs/STANDALONE_BLE_PROXY_SERVICE.md](STANDALONE_BLE_PROXY_SERVICE.md)

---

**Last Updated:** 2025-11-02
**Maintainer:** @josiah-nelson
