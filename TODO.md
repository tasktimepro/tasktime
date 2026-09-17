# Updates

## Priority

[ ] Check about indexing blog issues - ONGOING

...

[ ] Polishing updates
    [ ] Mobile design and home landing enhancements
        [ ] Update mobile screenshot
        [ ] Improve mobile navigation menu
        [ ] Make cards views horizontally scrollable

Launch v1.6.0 is complete: app and public site are live, billing is enabled,
and the agent releases are published. Evidence: `status/app-status.md` and
`status/agent-status.md`; private operations retain deployment details.

Remaining operational follow-ups:
[ ] Confirm Dropbox broad-public production status in its owning App Console and the post-approval connection canary.
[ ] Verify Search Console sitemap submission and indexing (retain the existing blog-indexing investigation above).
[ ] Observe the first legitimate paid purchase and post-cutover hosted email; no extra synthetic charge/send is required.
[ ] Finish external Google/Dropbox console removal of obsolete redirect URLs after Worker authority cleanup.

[x] Actually validate the skill/MCP with our own OpenClaw - RE-TEST
    - Test one use-case where the agent creates a task, starts the timer, go work on the actual task, stop the timer when it finished
    - We might need to make this flow part of the skill for people that want to use tasktime pro for task & time management
    [x] Fix and verify the private OpenClaw lifecycle plan
    [x] Then publish version 1 once we see that it's stable
    [ ] Perform one more manual test

[ ] Publish in more places:
    [ ] PulseMCP - VERIFY AUTO LISTING
    [ ] Smithery
        [ ] Skill
        [ ] MCP
    [ ] Glama
    [ ] MCP.so

[ ] Think about publishing an official supported chatGPT plugin

[ ] Focus mode - think how we can do this best.
    - Today we work on multiple projects or tasks at a time because a lot of the work is managed by AI. With this focus mode, when I enter it, I imagine a super clean overlay on top of everything, with the options to attached existing tasks, or create new ones directly inline (can be assigned to projects too)
    - These are the tasks you plan to do today/next so they remain here until you check them off - once checked, they disappear from this space
    - We can nicely separate them based on project - the ones on "top" have no project assigned
    - This view might be the best view to contain pomodoro? Let me know
We might bring some of this previous idea I had earlier into this too:
[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice
    - Pomodoro? Is this the same and does it apply here?
I would perhaps just take the subtle sound effect for a ping option that can go on every 20, 30, 40, 60 minutes. As a gentle reminder that you're in focus mode and that a timer is ongoing

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] ...


---

## Project updates



---

## Invoice updates



---

## Ideas

[ ] Global search

[ ] Include theme color options in settings, default could be neutral

[ ] Keep track of invoices that you downloaded - so perhaps have a "downloaded" check icon or something

[ ] Profitability/Reports per project/client - Can be handled better in own dashboards

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added

[ ] When the tab is not focused and we're in the dashboard, let's fade the view and leave the To Do Today widget the area of attention