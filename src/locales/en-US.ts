/**
 * English messages. Keys must stay in sync with `zh-CN.ts`.
 */
const enUS: Record<string, string> = {
  /* Component */
  'viewer.label': 'Image viewer',

  /* Toolbar */
  'toolbar.label': 'Viewer toolbar',
  'toolbar.zoomIn': 'Zoom in',
  'toolbar.zoomOut': 'Zoom out',
  'toolbar.reset': 'Reset view',
  'toolbar.rotateLeft': 'Rotate left',
  'toolbar.rotateRight': 'Rotate right',
  'toolbar.flipHorizontal': 'Flip horizontally',
  'toolbar.fullscreen': 'Fullscreen',
  'toolbar.exitFullscreen': 'Exit fullscreen',
  'toolbar.prev': 'Previous page',
  'toolbar.next': 'Next page',
  'toolbar.thumbnails': 'Thumbnails',
  'toolbar.info': 'Item information',
  'toolbar.more': 'More actions',
  'toolbar.doublePage': 'Double-page view',
  'toolbar.singlePage': 'Single-page view',
  'toolbar.colorAdjust': 'Adjust colors',

  /* Status bar */
  'status.loading': 'Loading image…',
  'status.page': 'Page {current} / {total}',
  'status.pageRange': 'Pages {from}–{to} of {total}',
  'status.zoom': 'Zoom {percent}%',
  'status.rotated': 'Rotated {degrees}°',
  'status.flipped': 'Flipped',
  'status.spread': 'Spread',

  /* Empty state */
  'empty.noCanvas': 'This resource contains no renderable canvas.',

  /* Info panel */
  'info.title': 'Item information',
  'info.description': 'Description',
  'info.metadata': 'Details',
  'info.rights': 'Rights',
  'info.provider': 'Provider',
  'info.rawManifest': 'View raw manifest',
  'info.close': 'Close',
  'info.tabs.toc': 'Contents',
  'info.tabs.info': 'Item information',
  'info.toc.empty': 'This item provides no table of contents.',

  /* Color adjustment panel */
  'color.title': 'Adjust colors',
  'color.brightness': 'Brightness',
  'color.contrast': 'Contrast',
  'color.saturation': 'Saturation',
  'color.neutral': 'Default',
  'color.reset': 'Reset to default',
  'color.close': 'Close',

  /* Accessibility */
  'a11y.shortcutsHint':
    'Viewer focused. Shortcuts: + / - to zoom, 0 to reset, R to rotate, F for fullscreen, arrow keys to change page, I for information.',
  'a11y.thumbnails': 'Canvas thumbnails',
  'a11y.retry': 'Retry',

  /* Errors */
  'errors.INVALID_SOURCE.title': 'Invalid resource address',
  'errors.INVALID_SOURCE.desc': 'The provided source is not a valid IIIF resource address.',
  'errors.INVALID_SOURCE_TYPE.title': 'Resource type mismatch',
  'errors.INVALID_SOURCE_TYPE.desc': 'The declared sourceType does not match the actual resource.',
  'errors.NETWORK_ERROR.title': 'Network request failed',
  'errors.NETWORK_ERROR.desc':
    'The resource could not be reached. Check your connection or the server CORS policy.',
  'errors.HTTP_ERROR.title': 'Server returned an error',
  'errors.HTTP_ERROR.desc':
    'The resource is missing or access was denied. Verify that the address is correct.',
  'errors.TIMEOUT.title': 'Request timed out',
  'errors.TIMEOUT.desc': 'Loading took too long. Try again later or increase the timeout option.',
  'errors.UNSUPPORTED_VERSION.title': 'Unsupported IIIF version',
  'errors.UNSUPPORTED_VERSION.desc':
    'Only IIIF Image API 2.x / 3.x and Presentation API 2.1 / 3.0 are supported.',
  'errors.INVALID_IIIF_INFO.title': 'Invalid info.json',
  'errors.INVALID_IIIF_INFO.desc':
    'The info.json payload is missing required fields such as width / height.',
  'errors.INVALID_MANIFEST.title': 'Invalid manifest',
  'errors.INVALID_MANIFEST.desc': 'The manifest does not conform to the IIIF Presentation API.',
  'errors.NO_CANVAS.title': 'No renderable canvas',
  'errors.NO_CANVAS.desc': 'The manifest contains no canvas that can be rendered.',
  'errors.OSD_INIT_FAILED.title': 'Viewer failed to initialize',
  'errors.OSD_INIT_FAILED.desc': 'OpenSeadragon could not start. Refresh the page and try again.',
}

export default enUS
