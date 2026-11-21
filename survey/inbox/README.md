# Survey inbox

Survey files waiting for a person to approve them. Each build runs every CSV
here through the importer as a dry run (`scripts/lib/review.mjs`) and shows
what it would change in the steward console's **Review inbox**
(`/steward/#inbox`). Nothing here reaches the map until it is approved.

The inbox is built but **not active**: nothing puts files here yet, and
approving is switched off. `survey/inbox-examples/` holds two made-up
submissions so the console has something to show. See docs/STEWARD.md for how
it would work once switched on.
