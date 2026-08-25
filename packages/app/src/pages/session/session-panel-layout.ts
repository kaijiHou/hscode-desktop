// HSCode session panel layout — determines whether the desktop bottom tool
// panel container renders, and whether side panels stack.
//
// `visible` must include every tool that renders inside the container:
// review (diff/files side panel), terminal, and network inspector.
// Regression: network=true alone (terminal/review/files all false) must still
// yield visible=true — otherwise the NetworkPanel parent never renders.

export function sessionPanelLayout(input: {
  review: boolean
  terminal: boolean
  network: boolean
  files: boolean
}) {
  return {
    visible: input.review || input.terminal || input.network || input.files,
    // stacked only matters when the review side panel and the terminal share
    // the container; network is mutually exclusive with terminal by design.
    stacked: input.review && input.terminal,
  }
}