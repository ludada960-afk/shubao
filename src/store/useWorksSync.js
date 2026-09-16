import { useEffect } from 'react';

import { useApp } from './AppContext';
import { loadWorks } from '../services/api';

/* ═══ 作品列表同步（首页 / 媒体板块页共用）═══════════════════════════════════════
   为什么抽出来：首页原本自己拉一次作品列表，而媒体板块页（技能工作台）**没有拉**。
   后果是真实存在的：用户在某个 skill 的子页面里生成了图，刷新页面后进「历史」——
   一片空白。作品明明已经存下来了（saveWork 落库），只是没人去取。
   用户 9-17 明确要求「历史记录这一块你自己也得做好」，所以这里必须是同一个实现，
   两处共用，不许谁忘了拉。 */
export function useWorksSync() {
  const { state, dispatch } = useApp();
  useEffect(() => {
    if (!state.logged || !state.phone || state.browserQa) return undefined;
    let active = true;
    loadWorks(state.phone)
      .then(works => { if (active && Array.isArray(works)) dispatch({ type: 'SET_WORKS', works }); })
      .catch(() => { /* 拉不到就先用本地缓存里的，不打断创作 */ });
    return () => { active = false; };
  }, [state.logged, state.phone, state.browserQa, dispatch]);
}
