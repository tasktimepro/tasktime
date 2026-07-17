# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[ ] Actually validate the skill/MCP with our own OpenClaw - RE-TEST
    - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
    - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management
[ ] Then publish version 1 once we see that it's stable

[ ] Publish in more places:
    [ ] PulseMCP - VERIFY AUTO LISTING
    [ ] Smithery
        [ ] Skill
        [ ] MCP
    [ ] Glama
    [ ] MCP.so

[x] Drive worker sync updates: tasktime-infra/docs/todo/direct-google-drive-sync-implementation-plan.md
    [x] Retire the temporary staging environment and Worker data proxy; routine Drive file requests now go directly from the browser to Google Drive while the edge service retains only OAuth/token control-plane duties.
    [ ] Also since now multiple request checks don't affect the worker free tier counts, we might as well increase the auto-sync behaviour to be a bit more agressive if that would improve the experience - maybe even the notes can trigger a sync now instead of the manual sync now button

[x] Invoice cancellation: tasktime-infra/docs/todo/invoice-cancellation-implementation-plan.md

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] We should have a blog post that mentions task and time management for AI agents, another for Invoicing with AI agents, Expense management for AI agents etc. I need the most likely searched terms for people that want to do what this product can achieve but using their AI agent
[ ] We must also have posts for open-source and that we mention something like "Open-source task management app", etc.


---

## Project updates

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added


---

## Invoice updates

[x] Cancel invoice implementation that places retained invoices in a Canceled tab and excludes them from financial reporting.
    [x] Release only source work still billed by the canceled invoice so it becomes invoice-eligible again.
    [x] Keep the canceled number permanently consumed; the next invoice uses the next sequential number.
    [x] Deliver the minimal terminal cancellation workflow while leaving paid corrections, refunds, and credit notes as explicit non-goals.


---

## Ideas

[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice
