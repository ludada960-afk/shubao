import React, { createContext, useContext, useState, useCallback } from 'react';

const PopoverGroupCtx = createContext(null);

/**
 * PopoverGroup — ensures only one popover is open at a time within the group.
 * Wrap a set of Popover components with this provider.
 */
export function PopoverGroup({ children }) {
  const [openId, setOpenId] = useState(null);
  const close = useCallback(() => setOpenId(null), []);
  return (
    <PopoverGroupCtx.Provider value={{ openId, setOpenId, close }}>
      {children}
    </PopoverGroupCtx.Provider>
  );
}

export function usePopoverGroup() {
  return useContext(PopoverGroupCtx);
}
