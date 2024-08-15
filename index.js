/**
 * This code was inspired by Flatfile's Custom App Tutorial
 * https://flatfile.com/docs/apps/custom
 *
 * To see all of Flatfile's code examples go to: https://github.com/FlatFilers/flatfile-docs-kitchen-sink
 */

import { viewMappedPlugin } from '@flatfile/plugin-view-mapped'

export default function(listener) {
  // this plugin hides all unmapped columns, making new Flatfile Platform behave like Flatfile Portal v2
  listener.use(viewMappedPlugin())
}
