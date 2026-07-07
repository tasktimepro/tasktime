# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[ ] Check about CI for public repo, should we add one or?

[x] docs/todo/local-agent-bridge-proposal.md
    [x] Make sure this is full-parity with UI and that the agent can really do anything a user can do currently
    [x] Add public Astro agent docs at `/agents/` with `llms.txt`, generated MCP tool JSON, and Skill/OpenClaw pointers
    [x] Prepare final MCP/OpenClaw skill and plugin for publishing package metadata and so on
    [x] Publish everything under the new github org /tasktimepro in clawhub
        [x] Should the skill be @tasktimepro/tasktime-pro or just @tasktimepro/tasktime? - YES
    [ ] Actually validate the skill/MCP with our own OpenClaw

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] Create a blog post that mentions openclaw skill and how you can use tasktime pro with openclaw / agents
[ ] I think it's also important to teach how tasktime multi-timer support can actually allow you to have multiple agents works for different clients at the same time - to start timing before they start working on a task and stop the timer when then finish - to creating the invoice and so on - and e2e flow for agents

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
