---
name: clean-bug-report
description: Guided async bug-report form styled with @monos/ui github light and dark themes.
colors:
  primary: "#1f2328"
  neutral-bg: "#ffffff"
typography:
  body:
    fontFamily: "var(--ui-font-sans)"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "var(--ui-font-sans)"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  md: "var(--ui-radius)"
spacing:
  sm: "8px"
  md: "16px"
---

# Design System: clean-bug-report

## Overview

**Creative North Star: "Quiet Paper Spec"** — powered directly by `@monos/ui` (`@monos/ui/styles.css` + `@monos/ui/tailwind-preset`) with the `github` theme in both `light` and `dark` modes.

## Surface & Hierarchy

- Two-column desktop layout (`1.2fr / 0.9fr`) keeping the guided form on the left and sticky one-click handoff controls + live preview on the right.
- Collapses cleanly to a single column on mobile viewports.

## Components

- Uses `@monos/ui` `Card`, `TextField`, `TextArea`, `SelectField`, `SegmentedControl`, `Tabs`, `Button`, `Badge`, `Notice`, and `Toaster` without custom color overrides.
