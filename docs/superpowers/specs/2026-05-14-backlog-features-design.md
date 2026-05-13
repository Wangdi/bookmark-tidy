# Bookmark Tidy - Backlog Features Design

Date: 2026-05-14

## Overview

Five enhancement features for Bookmark Tidy Chrome extension to improve user experience, provide better visibility into operations, and allow trial runs before full organization.

---

## Feature 1: Trial Mode - Organize First N Bookmarks

### Current Description
A button to organize first n (input) bookmarks for a trial / test

### Improved Description
**Trial Mode with Configurable Bookmark Limit**

Allow users to test the organization workflow on a subset of bookmarks before processing the entire collection. This reduces risk and helps users understand the categorization quality before committing to a full run.

### User Story
As a user with 2000+ bookmarks, I want to organize just the first 50-100 bookmarks first, so I can verify the categorization quality and adjust settings before processing my entire collection.

### Acceptance Criteria
- [ ] Input field in popup to specify number of bookmarks (default: 50, min: 10, max: 500)
- [ ] "Trial Run" button alongside main "Organize All" button
- [ ] Progress indicator shows "Processing X of Y (Trial Mode)"
- [ ] Creates `📁Organized (Trial N)/` folder (where N = number processed)
- [ ] Clear visual distinction between trial and full runs
- [ ] Trial results auto-renamed and preserved (e.g., `📁Organized (Trial 50) - 2026-05-14/`)
- [ ] Multiple trials can coexist with timestamp-based naming
- [ ] Full run always creates clean `📁Organized/` folder

### Technical Approach
- Modify background pipeline to accept `limit?: number` parameter
- Update UI to show trial mode state
- Store trial mode flag in checkpoint for crash recovery
- Add validation for min/max limits

### Priority
**High** - Critical for user trust and adoption

### Dependencies
None - can be implemented independently

---

## Feature 2: Category Preview and Editing

### Current Description
List categories after generated, and allow user to adjust this list/tree, say rename, merge, and other edits

### Improved Description
**Interactive Category Tree Editor**

After categorization completes, display a preview of the generated category structure and allow users to refine it before creating bookmarks. Users can rename categories, merge similar ones, move bookmarks between categories, and adjust the hierarchy.

### User Story
As a user, I want to review and adjust the automatically generated categories before bookmarks are organized, so I can ensure the structure matches my mental model and preferences.

### Acceptance Criteria
- [ ] Display category tree preview after categorization phase
- [ ] Rename category (updates all bookmarks in that category)
- [ ] Merge two categories (select source + target, moves all bookmarks)
- [ ] Delete category (moves bookmarks to "Uncategorized" or prompts for target)
- [ ] "Apply Changes" button to proceed with organization
- [ ] "Regenerate Categories" button to re-run clustering
- [ ] Persistent state during editing session
- [ ] No drag-drop, undo/redo, or complex tree manipulation (basic editing only)

### Technical Approach
- Add intermediate state between categorization and organization phases
- Create category editor UI component (tree view with edit controls)
- Store edited category structure in IndexedDB
- Pass edited structure to organizer module

### Priority
**Medium** - Improves user control but adds complexity

### Dependencies
None - can be implemented independently

---

## Feature 3: Detailed Progress Messages

### Current Description
message shows more detailed ongoing operations, like shows a list of urls/titles and their connection progress, db read/write, batch checkpoint, categorizing, sorting, disk usage, term/word number, etc.

### Improved Description
**Real-time Operation Dashboard**

Enhanced progress display showing detailed operational metrics and per-bookmark status during all phases of the pipeline. Provides transparency into what's happening and helps identify issues (slow sites, failures, performance bottlenecks).

### User Story
As a user, I want to see detailed progress information including which URLs are being processed, database operations, and performance metrics, so I understand what's happening and can identify problematic bookmarks.

### Acceptance Criteria
- [ ] **Fetch Phase Details:**
  - Current URL being fetched with connection status
  - Batch progress (e.g., "Batch 3/20: Processing 10 URLs")
  - Per-URL status: fetching, success, failed (with error type)
  - Running count: success, deadlinks, unreachable
  - Time elapsed and estimated remaining
  
- [ ] **Storage Metrics:**
  - IndexedDB write operations count
  - Checkpoint saves completed
  - Storage size used (MB)
  
- [ ] **Categorization Metrics:**
  - TF-IDF vocabulary size (number of unique terms)
  - Clustering progress (iterations, convergence)
  - Categories generated count
  
- [ ] **Organization Metrics:**
  - Folders created count
  - Bookmarks created count
  - Batch progress (e.g., "Creating bookmarks 45-54 of 1500")
  
- [ ] **Performance Stats:**
  - Total elapsed time
  - Average time per bookmark
  - Memory usage estimate

### Technical Approach
- Extend progress message types with detailed metrics
- Add telemetry collection points in each module
- Create expandable "Show Details" panel in UI (collapsed by default)
- Use message passing to stream metrics from background to popup
- Lazy evaluation for performance (only collect detailed metrics when expanded)
- Toggle state persisted in popup session

### Priority
**Medium** - Helpful but not critical for core functionality

### Dependencies
None - can be implemented independently

---

## Feature 4: Background Completion Notification

### Current Description
notification when job done in background

### Improved Description
**Background Completion Notification**

When the organization job completes (success, error, or user-initiated stop), display a Chrome notification even if the popup is closed. Allows users to start the job and work on other tasks without keeping the popup open.

### User Story
As a user, I want to receive a notification when bookmark organization completes, so I can start the job and switch to other tasks without worrying about checking back.

### Acceptance Criteria
- [ ] Chrome notification API integration
- [ ] Notification on successful completion with summary:
  - Total bookmarks processed
  - Categories created
  - Deadlinks found
  - Duplicates merged
  - Time elapsed
- [ ] Notification on error with error message and retry option
- [ ] Only send notification if popup window is NOT currently focused
- [ ] No intermediate progress notifications (terminal states only)
- [ ] Notification on user-initiated stop with partial results
- [ ] Clicking notification opens popup or bookmarks page
- [ ] User can enable/disable notifications (default: enabled)
- [ ] Notification permission request handling

### Technical Approach
- Use Chrome `notifications` API
- Track job state in background service worker
- Send notification when job state transitions to terminal state
- Store notification preferences in Chrome storage sync
- Handle notification click to open relevant page

### Priority
**High** - Important UX improvement for long-running jobs

### Dependencies
None - can be implemented independently

---

## Feature 5: Auto-navigate to Organized Folder

### Current Description
show chrome bookmark page when finished, and locate on the 'organized_bookmarks' folder

### Improved Description
**Auto-open and Highlight Organized Folder**

After successful organization completion, automatically open the Chrome Bookmarks Manager page and scroll to/highlight the newly created `📁Organized/` folder, making it immediately visible for user review.

### User Story
As a user, I want to be taken directly to the organized bookmarks folder when the job finishes, so I can immediately review the results without manually navigating through Chrome's bookmark manager.

### Acceptance Criteria
- [ ] Option to auto-navigate on completion (default: enabled)
- [ ] Open Chrome Bookmarks Manager (`chrome://bookmarks/`)
- [ ] Expand tree to show organized folder
- [ ] Scroll to and highlight the folder
- [ ] Works for both trial folders (`📁Organized (Trial N)/`) and full runs (`📁Organized/`)
- [ ] Works from both popup click and background notification
- [ ] User preference setting to disable this behavior
- [ ] Fallback if folder cannot be located (show success message)

### Technical Approach
- Use `chrome.tabs.create({ url: 'chrome://bookmarks/' })`
- Use `chrome.bookmarks.getTree()` to find folder ID
- Investigate Chrome Bookmarks Manager API for folder highlighting
  - May require URL fragment: `chrome://bookmarks/#<folder-id>`
  - Or: `chrome.bookmarks.update()` to select folder
- Handle trial mode folders separately (`📁Organized (Trial N)/`)
- Store user preference in Chrome storage sync

### Priority
**Medium** - Quality-of-life improvement

### Dependencies
None - can be implemented independently

---

## Implementation Priority Order

**Phase 1 - Core User Experience (High Priority):**
1. **Trial Mode** - Critical for user trust and adoption
2. **Background Notification** - Essential for long-running jobs

**Phase 2 - Quality of Life (Medium Priority):**
3. **Auto-navigate to Folder** - Immediate visibility of results
4. **Detailed Progress Messages** - Transparency and debugging help

**Phase 3 - Advanced Control (Medium Priority):**
5. **Category Preview and Editing** - User control over categorization (most complex)

**Recommended Sequence:**
- Features 1 & 2 can be developed in parallel (independent)
- Feature 3 builds on notification completion events
- Feature 4 can be developed independently
- Feature 5 should come after users have experience with the system

## Architecture Considerations

All features are independent and can be implemented in any order. However, consider:

- **Trial Mode** and **Category Editor** both modify the pipeline flow
- **Detailed Progress** messaging infrastructure can be reused by all features
- **Background Notification** and **Auto-navigate** both handle completion events
- Consider feature flags or settings UI for enabling/disabling optional behaviors

## Design Decisions (User Approved)

Based on user feedback on 2026-05-14:

1. **Trial Mode Results**: Auto-rename and keep
   - Trial results preserved with distinct folder name
   - Users can run multiple trials without losing previous results
   - Full run creates separate `📁Organized/` folder

2. **Category Editor**: Basic editing only
   - Rename categories
   - Merge categories (select source + target)
   - Delete categories (move bookmarks to uncategorized)
   - No drag-drop, undo/redo, or complex tree manipulation
   - Keeps UI simple and focused

3. **Progress Details**: Toggle verbose mode
   - Default view shows high-level progress
   - "Show Details" button expands to full metrics dashboard
   - Performance-friendly (lazy evaluation)

4. **Notifications**: Terminal states only, when not in focus
   - Send notification when job completes or errors
   - Only if popup window is not currently focused
   - No intermediate progress notifications (no 25%, 50%, etc.)
   - No phase change notifications
   - Respects user workflow and reduces notification fatigue

---

## Questions for User

~~1. **Trial Mode**: Should trial mode results be discarded automatically after review, or allow user to keep them alongside future full runs?~~
**✓ Decided: Auto-rename and keep**

~~2. **Category Editor**: Should we support undo/redo operations during editing? How complex should the editor be?~~
**✓ Decided: Basic editing only (rename, merge, delete)**

~~3. **Detailed Progress**: Should there be a "verbose mode" toggle, or always show all details? What's the performance impact?~~
**✓ Decided: Toggle verbose mode**

~~4. **Notifications**: Should we send intermediate notifications (e.g., "50% complete") or only terminal states?~~
**✓ Decided: Terminal states only (complete/error), when not in focus**

~~5. **Auto-navigate**: Should this work for trial mode folders too, with distinct visual indication?~~
**✓ Decided: Yes, auto-navigate for both trial and full runs**

---

## Next Steps

After user approval:
1. ✅ Design decisions documented
2. Create individual detailed design specs for each feature (if needed)
3. Write implementation plan with task breakdown (invoke writing-plans skill)
4. Implement in priority order
5. Add feature flags for user preferences in settings UI

## Ready for Planning

This design document is complete and approved. The next step is to invoke the **writing-plans** skill to create a detailed implementation plan for each feature.
