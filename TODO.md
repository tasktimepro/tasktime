# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[ ] Centralize remaining shared UI/agent operations in separate controlled updates
    [ ] Timer lifecycle and stop recovery — the highest-priority shared operation
    [ ] Manual time-entry validation — overlaps, billing cutoff, duration fields, updates, and deletion
    [ ] Task completion and recurring-task state — completion dates, skipping, and stale-skip reconciliation
    [ ] Task/project/client creation and updates where relationship invariants apply

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
