/**
 * 类型统一出口。使用者可从 `@tony2y/iiif-viewer` 直接导入以下全部类型。
 */
export type {
  IiifCanvas,
  IiifImageApiVersion,
  IiifImageInfo,
  IiifImageProfile,
  IiifLanguageMap,
  IiifManifest,
  IiifMetadataEntry,
  IiifPresentationVersion,
  IiifResourceKind,
  IiifResourceRef,
  IiifStructure,
  IiifTileSource,
  IiifViewerTileSource,
  RawAnnotation,
  RawAnnotationPage,
  RawBody,
  RawCanvas,
  RawImageInfo,
  RawManifest,
  RawMetadataEntry,
  RawSequence,
  RawService,
  RawStructure,
} from './iiif'

export { IIIF_VIEWER_ERROR_CODES } from './errors'
export type { IiifViewerErrorCode } from './errors'

export type {
  IiifColorAdjustmentKey,
  IiifColorAdjustments,
  IiifViewerActions,
  IiifViewerEmits,
  IiifViewerErrorLike,
  IiifViewerExposed,
  IiifViewerFitMode,
  IiifViewerLoadSuccessPayload,
  IiifViewerPluginOptions,
  IiifViewerProps,
  IiifViewerSource,
  IiifViewerSourceType,
  IiifViewerState,
  IiifViewerTheme,
  IiifViewerToolbarAction,
  IiifViewerToolbarOptions,
  IiifViewerToolbarPosition,
  OpenseadragonNamespace,
  ResolvedToolbarOptions,
} from './viewer'

export { DEFAULT_TOOLBAR_OPTIONS, resolveToolbarOptions } from './viewer'
