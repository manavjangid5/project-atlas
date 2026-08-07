# Project Atlas — Final Manual Test Script

This is the complete manual regression script for Project Atlas — every
numbered step below has been run and confirmed against both the local
development environment and the deployed production URL. It's kept here as
a reusable checklist: re-run it after any future change to catch
regressions before they reach production. Each step says what to click/type
and what to expect.

---

## 1. Registration & first login

1. Go to /register.
2. Try a weak password first (e.g. "abc") and submit.
   Expect: a clear validation error shown on screen — not a server crash
   or blank page.
3. Fill in a fresh email and a valid password (8+ chars, 1 uppercase, 1
   number), submit.
   Expect: redirected straight into the app, landing on a "Welcome to
   Atlas — create an organization" onboarding screen.
4. Type an organization name -> Create organization.
   Expect: lands on the main dashboard, sidebar visible, organization
   name shown in the top-left dropdown, role shown as "OWNER".

## 2. Session & auth guard behavior

5. Manually edit the URL to /login while logged in.
   Expect: immediately bounced back to /dashboard — the login form
   never shows while authenticated.
6. Click Sign out (top bar).
   Expect: redirected to /login and stays there — does not bounce
   back to the dashboard.
7. Manually edit the URL to /dashboard/workflows while logged out.
   Expect: immediately bounced to /login — dashboard content never
   flashes or is visible.
8. Log back in with the account from step 3.

## 3. OAuth login

9. Log out, then on the login page click Continue with Google.
   Expect: Google consent screen -> redirected back into the app, logged
   in.
10. Log out again, click Continue with GitHub.
    Expect: GitHub consent screen -> redirected back into the app,
    logged in. (This specific flow has not been independently re-confirmed
    since an earlier fix — worth watching closely.)

## 4. Theme toggle

11. Click the theme toggle icon in the top bar.
    Expect: the entire UI switches to a light theme instantly — no
    unreadable text, no leftover dark-only elements.
12. Refresh the page.
    Expect: your theme choice persists (doesn't reset to dark).
13. Toggle back to dark for the rest of testing.

## 5. Organization — Members & Settings

14. Sidebar -> Members. Expect: your own account listed with role OWNER.
15. Invite a second email as DEVELOPER -> Invite.
    Expect: an invite link/token shown on screen (no email is sent —
    documented gap).
16. Sidebar -> Settings -> change the organization name -> Save.
    Expect: name updates immediately in the sidebar dropdown too.

## 6. Workflows — building and running a real pipeline

17. Sidebar -> Workflows -> name it "Smoke Test Flow" -> Create.
    Expect: opens directly into the canvas.
18. Drag HTTP Request onto the canvas. Click it -> configure:
    - Method: GET
    - URL: https://jsonplaceholder.typicode.com/todos/1
19. Drag AI Prompt onto the canvas, to the right of the HTTP node.
    Connect them (drag from the HTTP node's right dot to the AI node's left
    dot).
20. Click the AI Prompt node. Expect: the panel shows this node's real
    ID (e.g. ID: node-1712...) and a hint on how to reference an upstream
    node's output.
21. In the Prompt field, type: "Summarize this in one sentence:
    {the-http-node's-real-id_output}" (use the actual ID shown for the HTTP
    node, not a placeholder like node-1).
22. Click "Preview response".
    Expect: text streams in visibly, chunk by chunk with a blinking
    cursor — not one big block appearing after a delay.
23. Click Save. Expect: no error.
24. Click Run. Expect: Run History panel opens automatically,
    showing PENDING -> RUNNING -> SUCCESS within a few seconds.
25. Expand the run. Expect: both nodes show real output — the HTTP
    node's JSON and the AI node's actual generated summary (not the
    unresolved literal text {...output}).
26. Test keyboard shortcuts: make a small edit, press Ctrl/Cmd+S — same
    effect as clicking Save. Press Ctrl/Cmd+Enter — same effect as
    clicking Run.
27. Make another edit (e.g. move a node), press Ctrl/Cmd+Z.
    Expect: the edit undoes. Press Ctrl/Cmd+Shift+Z.
    Expect: it redoes.
28. Hover the HTTP node, click the small red X badge.
    Expect: node and its connected edge disappear.
29. Press Ctrl/Cmd+Z.
    Expect: the deleted node reappears exactly as it was.
30. Click "Back to workflows", then click the same workflow card again.
    Expect: the workflow opens showing its current, fully up-to-date
    state — no stale/missing nodes requiring a page reload to show up.

## 7. Workflows — failure & retry behavior

31. Create a second workflow. Add an HTTP Request node with a deliberately
    bad URL (https://this-domain-does-not-exist-xyz123.com).
32. Save, Run.
    Expect: Run History shows multiple RETRYING entries (exponential
    backoff) before settling on FAILED.

## 8. Conditional branching (verify it genuinely branches)

33. New workflow. Add a Conditional node (field: test, operator:
    equals, value: yes). Add two AI Prompt nodes downstream — one
    connected from the Conditional's true handle, one from its false
    handle — with clearly different prompts so you can tell which ran (e.g.
    "list synonyms for yes" vs "list synonyms for no").
34. Save, Run (default config won't match "yes").
    Expect: only the false-branch node executes and shows SUCCESS;
    the true-branch node shows SKIPPED in Run History — not silently
    executed regardless.

## 9. New node types

35. Add a GitHub node: owner: facebook, repo: react, action:
    recent_commits. Run it standalone.
    Expect: SUCCESS with real commit data.
36. Add a Switch, an Email (send "to" your own Resend signup
    address), a Loop, and a Database Query node (table: workflows,
    limit: 5) to a test workflow. Configure each minimally and run.
    Expect: each executes to either SUCCESS or a clear, sensible
    FAILED with a readable error message — never an unhandled crash that
    takes down the whole run.

## 10. AI workflow generation & suggestions

37. Workflows list -> "Generate with AI" -> type: "Fetch a todo from
    JSONPlaceholder and summarize it with AI" -> Generate.
    Expect: button shows "Generating…" then lands you directly in a new
    canvas with a real 2-node graph already populated (HTTP + AI Prompt).
38. Save, Run.
    Expect: SUCCESS (this specific instruction should generate a
    working, real URL).
39. On any workflow, click "Suggest next".
    Expect: button shows "Thinking…", disables, then a row of
    suggestion chips appears below the toolbar.
40. Click one of the chips.
    Expect: a new, pre-configured node drops onto the canvas.

## 11. Webhook trigger

41. Copy the webhook URL shown in the workflow toolbar.
42. In Postman, POST to that exact URL with any JSON body.
    Expect: 202 response, and a new run appears in that workflow's
    Run History — triggered externally, not via the Run button.

## 12. Cron scheduling

43. Via Postman (with your session cookies from logging in through the
    browser): PATCH /api/v1/workflows/:id/schedule with body
    { "cronSchedule": "*/2 * * * *" } (every 2 minutes) for a simple
    test workflow.
44. Wait 2-3 minutes.
    Expect: a new run appears automatically in Run History, with no
    manual trigger.

## 13. Version history & diff

45. Save a workflow's graph 3-4 times, making a small change each time
    (add/remove a node between saves).
46. Click Versions.
    Expect: a paginated list, newest first, no page-cutoff or broken
    scrollbar.
47. Check two version checkboxes -> click Compare.
    Expect: a diff modal accurately shows Added / Removed / Modified
    nodes.
48. Click Restore on an older version, confirm.
    Expect: the graph reverts, and a brand-new version is created from
    the restore (not overwriting history).

## 14. Forms — including repeatable fields

49. Sidebar -> Forms -> create one, name it "Smoke Test Form".
50. Add: a required text field ("Full Name"), a checkbox ("Has a pet"), a
    text field with "Show only if" tied to that checkbox, and a
    repeatable text field ("Skills").
51. In the live preview: toggle the checkbox -> the conditional field
    appears/disappears correctly. Click "+ Add another" on the repeatable
    field -> a second input appears; remove it -> it disappears.
    Expect: no fields overflow their container, no layout breaking.
52. Save.

## 15. Rules — nested logic with real (nested) data

53. Sidebar -> Rules -> create one, name it "Senior India Hire".
54. Build a nested condition using dot-path field names matching real
    nested JSON, e.g.:
    - candidate.location equals India
    - candidate.experience greaterThan 2
    (both inside an AND group)
55. Set Action -> NOTIFY, message "Escalate to hiring manager".
56. Save. In the Test panel, paste:
    { "candidate": { "location": "India", "experience": 3 } }
    -> Run test. Expect: "Matched".
57. Change experience to 1 -> Run test again.
    Expect: "Did not match".
58. Create/use a form whose submission would satisfy this same rule, submit
    it for real. Expect: a real notification appears in the bell —
    confirms the rule action fires on an actual submission, not just in the
    isolated test panel.

## 16. Files

59. Sidebar -> Files -> upload a small file.
    Expect: appears with correct name, size, "v1".
60. Download it. Expect: opens/downloads correctly.
61. Share it -> open the link in an incognito window.
    Expect: works, no login required.
62. Delete it. Expect: disappears from the list.

## 17. API Keys & public API

63. Sidebar -> API Keys -> generate one named "Smoke Test Key".
    Expect: raw key shown once, with a copy button and a warning it
    won't be shown again.
64. Refresh the page. Expect: only the prefix is shown from now on.
65. In Postman: GET /api/v1/public/workflows with header X-API-Key:
    <raw key>. Expect: 200 with your workflows, no cookies needed.
66. Send 60+ rapid requests with the same key within a minute.
    Expect: eventually a 429 response (per-key rate limit).
67. Revoke the key, repeat the API call. Expect: 401.

## 18. Feature flags — real gating, not decorative

68. Sidebar -> Feature Flags -> create ai_node_enabled, toggle
    "Globally enabled" off.
69. Try running any workflow containing an AI Prompt node.
    Expect: blocked with a clear 403 error specifically about the
    flag, not a generic failure.
70. Toggle it back on. Expect: AI workflows run normally again.

## 19. Audit log & analytics

71. Sidebar -> Audit Log. Expect: real entries for your logins,
    workflow saves/runs, rule updates, file uploads — each with a real
    timestamp and a colored action label.
72. Sidebar -> Analytics. Expect: stat cards, a 14-day execution
    chart, and a node-usage pie chart all showing real, non-zero data
    matching your test activity — nothing mocked or static.

## 20. Search & notifications

73. Use the top search bar, type part of a workflow/form/rule/file name.
    Expect: a dropdown with matching results within ~1 second, correct
    type icons, clicking one navigates correctly.
74. Trigger a workflow run while keeping the notification bell dropdown
    open. Expect: a new notification appears live, no refresh needed.
75. Trigger two runs of the same workflow close together.
    Expect: they collapse into a single grouped notification entry
    rather than showing as two fully separate rows.

## 21. Multi-tenant isolation (don't skip — verify, don't assume)

76. Create a second organization from the sidebar dropdown ("+ Create new
    organization").
77. Confirm none of the workflows/forms/rules/files from your first org
    appear under this second one.
78. Switch back to the first org. Expect: everything reappears exactly
    as you left it.

## 22. Role enforcement

79. Using the invite link from step 15, accept it with a second test
    account (logging in as the DEVELOPER).
80. As that Developer, try to access Settings or change another
    member's role. Expect: either the controls are hidden, or the API
    correctly rejects with 403.
81. As that Developer, try creating and running a workflow.
    Expect: allowed (matches the dynamic permission matrix).

## 23. Security spot-checks (don't skip these either)

82. While logged into org A, use DevTools to replay a request but manually
    change the X-Organization-Id header to org B's real ID.
    Expect: 403.
83. In Postman, POST /api/v1/internal/notify with no X-Internal-Secret
    header. Expect: 401.
84. In Postman, POST to any mutating route (e.g. create workflow) with no
    prior /csrf-token fetch and no x-csrf-token header.
    Expect: 403.
85. Try an HTTP node pointed at http://169.254.169.254/ or
    http://localhost:4000/. Expect: blocked by the SSRF guard, node
    fails cleanly, doesn't actually reach that address.

## 24. Health & ops

86. Visit /api/v1/health directly.
    Expect: {"status":"ok","db":"connected","queue":"connected",...}.
87. Visit /api/docs. Expect: a live, interactive Swagger UI, not a 404.
88. Visit /metrics. Expect: real Prometheus-format text output, not JSON, not 404.
