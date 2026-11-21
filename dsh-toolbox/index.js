/**
 * Host half of the toolbox bundle.
 *
 * The bundle exists for its Client module: the sidebar entry, the card grid and
 * the two formatters are all browser presentation, so the Host row has nothing
 * to register. It stays because a bundle's patch inserts a Loader entry, and
 * that entry needs a Host plugin to load.
 */
export function apply() {}
