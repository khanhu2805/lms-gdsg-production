/** Release only completed, objectively graded work when this setting is enabled. */
export function shouldAutoPublishOnSubmit(enabled: boolean, manual: boolean, submitted: boolean): boolean {
  return enabled && !manual && submitted;
}
