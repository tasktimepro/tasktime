# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

[x] docs/todo/local-agent-bridge-proposal.md
    [x] Make sure this is full-parity with UI and that the agent can really do anything a user can do currently
    [x] Add public Astro agent docs at `/agents/` with `llms.txt`, generated MCP tool JSON, and Skill/OpenClaw pointers
    [x] Prepare final MCP/OpenClaw skill and plugin for publishing package metadata and so on
    [x] Publish everything under the new github org /tasktimepro in clawhub
        [x] Canonical ClawHub skill: @tasktimepro/tasktime-agent (legacy @tasktimepro/tasktime and @tasktimepro/tasktime-pro redirect here)
    [ ] Actually validate the skill/MCP with our own OpenClaw
        - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
        - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management

[ ] Publish in more places:
    [ ] PulseMCP - VERIFY AUTO LISTING
    [ ] Smithery
        [ ] Skill
        [ ] MCP
    [ ] Glama
    [ ] MCP.so

[x] Merge Agents Kit so that we have a proper agent setup/scaffold
    [ ] Run deep validations on the core parts of the product like:
        - Cloud sync gaps / should not let data be unsynced or lost
        - Storage and stored data 
        - Invoicing generation (calculations, currency related conversions, all tasks + timings properly calculated, billed hours, undo last invoice properly undoes everything well, etc.)
        - Reporting totals conditions & calculations
        - Export / Import
    [ ] Set these as part of the rules/spec that we must always be very careful here about the most crucial parts of the app - there should be rules that we cannot ever break - for example, the worker sync should always be efficient, we must keep as low requests as possible. | Important data should always be sent to the cloud, backups, and export/import, so new features that will include user data must obey these rules | Agent bridge and commands should always be kept in parity with things the user can do from within the UI.
        - and we can try to determine if there are other similarly important things that could break the app that is critical
    [ ] Run any suggested improvements in general throughout the app. Is everything implemented as expected, did we leave any potential critical gaps behind? Are all timings accurate by the second? Determine all the critical paths of this app and make sure everything works as expected.
    [ ] Are agents able to handle bulk commands, like bulk mark as completed, delete, etc? Or for now doing things individually is ok for this kind of project?


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
