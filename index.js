/**
 *
 * To see all of Flatfile's code examples go to: https://github.com/FlatFilers/flatfile-docs-kitchen-sink
 */

import { ExcelExtractor } from '@flatfile/plugin-xlsx-extractor'
import { viewMappedPlugin } from '@flatfile/plugin-view-mapped'

export default function(listener) {
  listener.use(ExcelExtractor())
  
  // this plugin hides all unmapped columns, making new Flatfile Platform behave like Flatfile Portal v2
  listener.use(viewMappedPlugin())
}
 
