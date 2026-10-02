---
title: Docusaurus Website
---

# Docusaurus Website

`@vis.gl/docusaurus-website` provides shared Docusaurus components and configuration for vis.gl's open source JavaScript frameworks.

The package supplies the common vis.gl and OpenJS branding, navigation, footer, local search, stylesheet, and webpack behavior used by project documentation sites. The implementation and tests are in [`modules/docusaurus-website`](https://github.com/visgl/dev-tools/tree/master/modules/docusaurus-website).

Project sites typically create a small `docusaurus.config.js` and call `getDocusaurusConfig` with the project name, repository URL, canonical site URL, and documentation table of contents.

This package replaces the former Gatsby-based `gatsby-theme-ocular` website tooling.
