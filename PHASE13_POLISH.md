# StudyHub - Phase 13 accessibility, states and polish

This phase makes the app kinder to use: a gentler AI limit message, clearer
keyboard and screen-reader support, and small polish. No new tables, services, or
environment variables.

## What changed

- Gentler AI limit (the change we agreed earlier). When a free student reaches the
  daily AI tutor limit, the message no longer just stops them. It now says they can
  keep revising for free by turning what they have learned into flashcards, and the
  chat offers two buttons: Upgrade to Pro and Make flashcards (which jumps to the
  Revision Hub). This matches the softened tone already used for AI marking.
- Accessibility:
  - A visible focus ring for keyboard users on buttons, tabs, links, chips and quiz
    options, so it is clear what is selected when tabbing.
  - Respect for the system "reduce motion" setting: animations and smooth scrolling
    are turned off for people who prefer that.
  - Icon-only buttons get a screen-reader label automatically from their tooltip, and
    modal close buttons are labelled "Close". This runs on load and whenever a page
    renders, so dynamic lists are covered too.
  - The toast area announces politely to screen readers.
  - The mobile menu button already reports its open or closed state.
- Polish: a small reusable loading spinner style and a screen-reader-only helper
  class for future use.

## Manual setup

- None. This is front-end only.

## What to test

- Tab through the app with the keyboard and confirm you can see what is focused.
- Turn on "reduce motion" in your OS and confirm animations calm down.
- As a free user who has hit the AI limit, confirm the tutor message suggests
  flashcards and shows both buttons, and that Make flashcards opens the Revision Hub.
- With a screen reader, confirm icon buttons are announced sensibly and toasts are
  read out.

## Honest limitations

- This is a solid pass, not a full WCAG audit. The biggest wins (focus visibility,
  reduced motion, labelled controls, polite announcements) are covered, but a formal
  audit with assistive tech would likely find smaller items to refine.
- The accessibility label pass uses each control's tooltip text; a few very generic
  tooltips could be made more descriptive over time.
