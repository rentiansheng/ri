#!/bin/bash

# Second Brain OS Shell Integration
# This script is automatically sourced by the terminal manager

# Prevent double loading
if [ -n "$__OM_SHELL_INTEGRATION_LOADED" ]; then
  return
fi
export __OM_SHELL_INTEGRATION_LOADED=1

# Wrapper function for opencode CLI
opencode() {
  # Execute the original command
  command opencode "$@"
  local exit_code=$?

  # Check if we are running inside Second Brain OS (RISESSION env var exists)
  if [[ -n "$RISESSION" ]]; then
    
    # Simple logic: notify on completion
    # In the future, we could inspect "$1" to only notify for specific subcommands (like 'task', 'run', etc.)
    # and ignore interactive ones like 'web' or 'serve' if needed.
    
    if [[ $exit_code -eq 0 ]]; then
      # Success signal (Hidden OSC sequence)
      # Format: \033]__OM_NOTIFY:type:message__\007
      printf "\033]__OM_NOTIFY:success:OpenCode command completed successfully__\007"
    else
      # Error signal
      printf "\033]__OM_NOTIFY:error:OpenCode command failed (Exit Code: %d)__\007" "$exit_code"
    fi
  fi
  
  return $exit_code
}

# Optional: Add a simple test alias for the user
om-test-notify() {
  printf "\033]__OM_NOTIFY:success:Test notification from shell integration__\007"
}
