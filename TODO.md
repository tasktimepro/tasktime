# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[x] Add explicit UI-versus-agent timer parity tests for start, pause, resume, stop, and resulting time-entry data

[ ] Centralize remaining shared UI/agent operations in separate controlled updates
    [ ] Timer lifecycle and stop recovery — the highest-priority shared operation
    [ ] Manual time-entry validation — overlaps, billing cutoff, duration fields, updates, and deletion
    [ ] Task completion and recurring-task state — completion dates, skipping, and stale-skip reconciliation
    [ ] Task/project/client creation and updates where relationship invariants apply

[x] docs/todo/local-agent-bridge-proposal.md
    [x] Make sure this is full-parity with UI and that the agent can really do anything a user can do currently
    [x] Add public Astro agent docs at `/agents/` with `llms.txt`, generated MCP tool JSON, and Skill/OpenClaw pointers
    [x] Prepare final MCP/OpenClaw skill and plugin for publishing package metadata and so on
    [x] Publish everything under the new github org /tasktimepro in clawhub
        [x] Canonical ClawHub skill: @tasktimepro/tasktime-agent (legacy @tasktimepro/tasktime and @tasktimepro/tasktime-pro redirect here)

    [ ] Actually validate the skill/MCP with our own OpenClaw - RE-TEST
        - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
        - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management

[ ] Publish in more places:
    [ ] PulseMCP - VERIFY AUTO LISTING
    [ ] Smithery
        [ ] Skill
        [ ] MCP
    [ ] Glama
    [ ] MCP.so

[ ] If we can't edit invoices after they were generated, then there's not point showing the edit in the dropdown - In my opinion if an invoices hasn't been marked as sent or paid, we should allow editing, but if you think that is not safe and might break history billing or other things, then let's just disable editing for all types altogether. Undo invoice remains available only to the latest invoice

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] ...


---

## Project updates

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added


---

## Invoice updates

[ ] Cancel invoice implementation that should place invoice in a canceled tab and handled properyly in all the reporting areas necessary!
    [ ] Also think about about whether currently billed items will become active again/undo billed state?
    [ ] If you cancel an invoice and there is no other future invoice, should the next one take the same sequential number or not?
    [ ] Really think about how an invoice cancellation is typically handled in a system like ours and make sure we do the minimal necessities but not overcomplicate things


---

## Ideas

[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice
