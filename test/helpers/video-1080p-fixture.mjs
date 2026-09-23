/* 1080P 门禁用的**再导出**：把 videoCatalog 的导出与 videoProviders 的报文构造器收在一处。
   为什么这么写：test/ 里既有用例习惯从模块直接 import，但 `buildProviderPayload` 属于
   videoProviders（上游报文），而产品目录属于 videoCatalog —— 门禁要同时用两边的口径，
   统一从这里取可以避免"两边各 import 一半"的散乱（也便于日后换实现只改一处）。 */
export {
  VIDEO_PRODUCTS,
  getVideoProduct,
  publicVideoProducts,
  publicRouteViolations,
  routeReachability,
  videoFeatureSku,
} from '../../server/videoCatalog.mjs';
export { buildProviderPayload } from '../../server/videoProviders.mjs';
