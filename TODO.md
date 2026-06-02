# Updates

## Priority

[ ] I have some customers that have created an invoice by mistake, or made some mistakes, and they don't want to leave it there. I was thinking that the best option for now is that we pass a query in the URL like ?deleteMode=1 and that would enable the current session to allow deleting of invoices?
    [ ] Or should we just add the delete option and then it's up to them?
    [ ] Warning message about deleting
    [ ] Check about sequential numbering and if future invoices were already sent
    [ ] Undo all billed time entries for tasks under that invoice
    [ ] Basically undo invoice state as if it was never generated before

[ ] Cancel invoice implementation that should place invoice in a canceled tab and handled properyly in all the reporting areas necessary!
    [ ] Also think about about whether currently billed items will become active again/undo billed state?
    [ ] If you cancel an invoice and there is no other future invoice, should the next one take the same sequential number or not?

[ ] Billed task with quoted amount still kept showing the total in the invoice generation button and project card - EVEN AFTER THE INVOICE WAS GENERATED - I think this is one of those use-cases where we should automatically switch from billable to not-billable after it was invoiced
    [ ] I also noticed that if an invoice was generated from a flat rate task, and the invoice is still outstanding, if I mark the same task that is still in the project as unbillable, and I edit the invoice, there are no more tasks visible there... wtf? How is this possible? Aren't we keeping a snapshot of these or not until the invoice is generated? And what can we do to solve this?

---

## Blog Posts

- Always keep in mind trending words and most likely searched for words for better SEO reachability
[ ] Create a blog about invoice templates, multiple businesses and payment methods and the advantages that come by having these
    [ ] Create a blog about setting up an invoice template, with layout options, branding from business settings and so on
[ ] Create another blog post about auto-converting multiple currences from different clients into your own prefered currency in reports overviews & totals/goals
[ ] Create a few more blog ideas based on reporting as that has a lot of functionality

---

## Project updates

[ ] Task Templates - Create “global” tasks which are assigned a category/tag and these can be assigned to all projects for that category by default (or at a click of a button → import default tasks for this project category)
    [ ] This would be a button under projects page “Create task templates”, then when creating a new project, we can choose a task template to be added

---

## Ideas

[ ] Timed sessions with sound alerts - I want to work on this for 1hour
    - We must think were this should be placed, as a setting, or a global option in a project for example, and we choose which task we want to work on
    [ ] This can also be an alert reminder settings in account that when a time passes a certain amount, we ping with a sound, and when we have push notifications, also have that choice
