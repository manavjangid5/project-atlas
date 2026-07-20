# Project Atlas — Manual Test Script

A black-box walkthrough — no source code needed, just the running app. Follow
in order; each step says what to click/type and what you should see. If
anything deviates, that's a bug to fix on the spot.

Use the live URL, or `localhost:5173` for local testing.

---

## 1. Registration & first login

1. Go to `/register`.
2. Fill name, a fresh email, password (must be 8+ chars, 1 uppercase, 1 number
   — try a weak password first to confirm the validation error shows, then
   use a valid one).
3. Submit.
   **Expect:** redirected straight into the app, landing on an "Welcome to
   Atlas — create an organization" onboarding screen (not a blank/broken page).
4. Type an organization name → **Create organization**.
   **Expect:** lands on the main dashboard, sidebar visible, organization
   name shown in the top-left dropdown, role shown as "OWNER".

## 2. Session / auth guard behavior

5. Manually edit the URL to `/login` while logged in.
   **Expect:** immediately bounced back to `/dashboard` — the login form
   should never show while authenticated.
6. Click **Sign out** (bottom of sidebar).
   **Expect:** redirected to `/login`.
7. Manually edit the URL to `/dashboard/workflows` while logged out.
   **Expect:** immediately bounced to `/login` — dashboard content should
   never flash or be visible.
8. Log back in with the account from step 3.

## 3. OAuth login (optional, if credentials are configured)

9. Log out, then on the login page click **Continue with Google**.
   **Expect:** Google consent screen → redirected back into the app, logged
   in. Repeat with **Continue with GitHub** if configured.

## 4. Organization — Members

10. Sidebar → **Members**. **Expect:** your own account listed with role
    OWNER.
11. Invite a member: enter a second email address, pick role "DEVELOPER" →
    **Invite**. **Expect:** an invite link/token shown on screen (no email is
    actually sent — this is a documented gap, see TRADEOFFS.md).
12. Try changing your own role or removing yourself — **Expect:** the OWNER
    row should not offer a role dropdown or remove button (you can't demote
    or remove the sole owner from the UI).

## 5. Organization — Settings

13. Sidebar → **Settings**. Change the organization name → **Save**.
    **Expect:** name updates immediately in the sidebar dropdown too.

## 6. Workflows — building and running a real pipeline

14. Sidebar → **Workflows** → type a name (e.g. "Interview Test Flow") →
    **Create**. **Expect:** opens directly into the canvas.
15. Drag **HTTP Request** from the left palette onto the canvas.
16. Click the new node → a config panel opens on the right.
    - Method: `GET`
    - URL: `https://jsonplaceholder.typicode.com/todos/1`
    Click **Done** (or click elsewhere) to close the panel.
17. Drag an **AI Prompt** node onto the canvas, to the right of the HTTP node.
18. Connect them: drag from the small dot on the right edge of the HTTP node
    to the small dot on the left edge of the AI Prompt node.
19. Click the AI Prompt node → in the Prompt field type:
    `Write a one-sentence joke about todo lists.`
20. Click **Save** (top toolbar). **Expect:** no error, button returns to
    normal state.
21. Click **Run**. **Expect:** the Run History panel opens on the right
    automatically, showing a new entry with status `PENDING` → `RUNNING` →
    (within a few seconds) `SUCCESS`.
22. Click that run row to expand it. **Expect:** two log entries — the HTTP
    node showing real JSON from jsonplaceholder, and the AI node showing a
    real Gemini-generated joke (not a fallback/error message).
23. Test node deletion: hover the HTTP node, click the small red ✕ badge that
    appears top-right of the card. **Expect:** node and its connected edge
    disappear.
24. Undo that by re-adding a node, then test the other delete method: click a
    node, click **Delete** in the side panel. **Expect:** same result.

## 7. Workflows — failure & retry behavior

25. Create a second workflow. Add an HTTP Request node with a deliberately
    bad URL, e.g. `https://this-domain-does-not-exist-xyz123.com`.
26. Save, Run. **Expect:** Run History shows the node going through multiple
    `RETRYING` log entries (exponential backoff) before finally settling on
    `FAILED`, and the overall run status is `FAILED` (or `PARTIAL` if other
    nodes existed and succeeded).

## 8. Forms

27. Sidebar → **Forms** → create one, name it "Test Intake Form".
28. Add three fields:
    - Text field, label "Full Name", mark **Required**.
    - Checkbox field, label "Has a pet".
    - Text field, label "Pet name" → set **Show only if** = the checkbox
      field, equals `true`.
29. **Expect (live preview, right side):** the "Pet name" field is hidden
    until you tick the checkbox in the preview panel, then appears instantly.
30. Click **Save**.

## 9. Rules

31. Sidebar → **Rules** → create one, name it "Senior India Hire".
32. Build conditions: default group is AND. Add condition `field: location,
    operator: equals, value: India`. Add a second condition `field:
    experience, operator: greaterThan, value: 5`.
33. Set Action → "Send notification" → message "Escalate to hiring manager".
34. Click **Save**.
35. Scroll to the **Test** panel → paste:
    ```
    { "location": "India", "experience": 7 }
    ```
    → **Run test**. **Expect:** "✓ Matched — action would fire".
36. Change the JSON to `{ "location": "India", "experience": 2 }` → **Run
    test** again. **Expect:** "✗ Did not match".
37. Optional deeper test: click **+ Nested group** inside the existing group,
    set it to OR, add two more conditions inside — confirm the test panel
    still evaluates correctly against the new nested logic.

## 10. Files

38. Sidebar → **Files** → drag a small image or PDF onto the drop zone (or
    click to browse).
    **Expect:** appears in the list below with correct file name, size, and
    "v1".
39. Click **Download** on that file. **Expect:** opens/downloads the actual
    file in a new tab.
40. Click **Share**. **Expect:** a modal shows a share URL with a Copy
    button.
41. Open that share URL in a **new incognito/private window** (simulating a
    non-logged-in recipient). **Expect:** shows the file name and a working
    Download button, with no login prompt.
42. Back in the Files tab, click **Delete** on the file → confirm.
    **Expect:** disappears from the list (soft-deleted, not gone from
    storage).

## 11. API Keys

43. Sidebar → **API Keys** → name a key "Interview Test Key" → **Generate
    Key**.
    **Expect:** the raw key is shown once in a highlighted box with a Copy
    button, and a note that it won't be shown again.
44. Refresh the page. **Expect:** the key is now listed only by its prefix
    (e.g. `atlas_ab12cd34`) — the full raw value is never shown again.
45. Click **Revoke** on the key → confirm. **Expect:** status changes to
    "Revoked".

## 12. Feature Flags

46. Sidebar → **Feature Flags** → create one with key `test_flag`,
    description "Interview test flag".
47. Drag its rollout slider to 50%. **Expect:** the value updates live next
    to the slider.
48. Toggle "Globally enabled" on. **Expect:** the rollout slider disappears
    (global on/off supersedes percentage rollout).

## 13. Audit Log

49. Sidebar → **Audit Log**. **Expect:** a timeline showing entries for
    everything you just did — your login, the workflow saves/runs, the rule
    update, the file upload — each tagged with a colored action label and
    timestamp.

## 14. Analytics

50. Sidebar → **Analytics**. **Expect:**
    - Stat cards showing non-zero "Total Runs" and a success-rate percentage
      that reflects the successful + failed runs from steps 6-7.
    - A bar chart of daily executions with today showing at least 2 runs.
    - A pie chart of node usage showing `http_request` and `ai_prompt`
      (and possibly others) proportionally.
    - "Most Active Users" showing your account with a non-zero action count.

## 15. Global search

51. Click the search bar at the top → type part of your workflow's name
    (e.g. "Interview"). **Expect:** a dropdown appears within ~1 second
    showing matching workflows (and forms/rules/files if their names also
    match), each with a type icon and label. Clicking a result navigates to
    the relevant tab.

## 16. Notifications

52. Click the bell icon (top right). **Expect:** a dropdown with recent
    notifications — "Workflow started" / "Workflow finished with issues"
    entries from your earlier test runs, each with a relative timestamp.
53. Trigger a fresh workflow run (repeat step 21 on any workflow) while
    **keeping the notification dropdown open**. **Expect:** a new
    notification appears in the list live, with no page refresh, within a
    couple seconds of the run starting and again when it finishes.
54. Click **Mark all read**. **Expect:** the unread badge on the bell icon
    clears.

## 17. Multi-tenant isolation (important one to actually verify, not just trust)

55. Create a **second** organization from the org dropdown (if there's no
    direct "create new org" option visible in the dropdown, register a
    second test account entirely and create an org there instead).
56. Confirm the workflows/forms/rules/files created in step 6-10 are **not**
    visible under this second organization — each org's data should be
    completely isolated.
57. Switch back to the first organization via the dropdown. **Expect:**
    everything from steps 6-14 reappears exactly as left.

## 18. Role enforcement (if a second test member account is available)

58. Using the invite link from step 11, accept the invitation with a second
    account, logging in as the invited "DEVELOPER" role member.
59. As that Developer, try to access **Settings** or attempt a role change on
    **Members**. **Expect:** either the controls are hidden, or the API
    correctly rejects the action with a 403 if attempted directly.

---

## If something breaks during this walkthrough

Note exactly: which numbered step, what you clicked/typed, what you expected
vs. what actually happened, and any red error text in the browser console
(F12 → Console tab) or a failed request in the Network tab. That's everything
needed to diagnose and fix it immediately, same as every other issue we've
resolved throughout this build.
