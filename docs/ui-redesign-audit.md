# HSCode UI Redesign Audit

## Current State

HSCode is based on OpenCode Desktop. The UI is 90%+ OpenCode visual identity.

## Top 10 OpenCode Visual Characteristics

1. **Sidebar** — OpenCode's signature left panel with project/session tree
2. **Session Header** — OpenCode's session header with model/agent selectors
3. **Prompt Input** — OpenCode's composer at bottom
4. **Tool Call Cards** — OpenCode's expanded tool call cards with borders/shadows
5. **Thinking Block** — OpenCode's gray thinking block
6. **Settings Dialog** — OpenCode's settings layout
7. **Command Palette** — OpenCode's command palette style
8. **Titlebar** — OpenCode's custom titlebar
9. **Color Palette** — OpenCode's default blue/gray theme
10. **Typography** — OpenCode's font choices and weights

## Components That Must Be Redesigned

### High Impact (visual identity change)
- Sidebar (layout + colors + active state)
- Session Header / Workspace Bar
- Composer / Prompt Input
- Agent Feed (user message, assistant, tool calls)
- Settings Dialog
- Command Palette

### Medium Impact (token changes)
- Button variants
- Card/Panel surfaces
- Borders and dividers
- Typography scale
- Color tokens (accent, text, background)

### Low Impact (mostly tokens)
- Icons (keep existing, just standardize)
- Tooltips
- Badges
- Scrollbar
- Selection highlight

## Components That Must NOT Change

- PTY/Terminal core logic
- Network Capture backend
- WinDivert native bridge
- Agent/Session data structures
- Provider protocol
- Shell selection logic
- Resize/splitter mechanics
- WebSocket connections

## Design Token Location

Current: `packages/ui/src/v2/styles/colors.css`
Proposed: `packages/app/src/styles/hscode-tokens.css`

## Phases

1. Design Tokens (foundation)
2. App Shell (sidebar, workspace bar, main canvas)
3. Agent Feed (messages, tool calls, thinking)
4. Composer
5. Tool Dock (terminal, network wrappers)
6. Settings + Command Palette
7. Dark Theme
8. Regression testing
