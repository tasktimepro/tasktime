# TaskTime Pro Public Site

Static Astro public pages served under `/product`, `/blog`, `/agents`, `/privacy`, `/terms`, and `/contact`.

## Commands

Run through the root Makefile:

- `make blog-install`
- `make blog-dev`
- `make blog-build`

## Content

Posts live in `src/content/blog/` and use frontmatter metadata for SEO.

The public product overview lives at `src/pages/product/index.astro`. Its labeled screenshot placeholders are intentionally retained until approved product captures replace them.

Agent docs live in `src/pages/agents/`. Machine-readable agent discovery files include:

- `/llms.txt`
- `/.well-known/tasktime-agent.json`
- `/agents/tasktime-agent-bridge.json`
- `/agents/mcp-tools.json`
- `/agents/skill.md`
- `/agents/claude/`
