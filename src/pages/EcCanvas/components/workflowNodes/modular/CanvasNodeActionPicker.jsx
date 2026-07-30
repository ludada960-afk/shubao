import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MdAutoFixHigh, MdChevronRight, MdClose } from 'react-icons/md';
import { groupActions } from './workflowNodeViewModel';
import styles from './CanvasWorkflowNodes.module.css';

export default function CanvasNodeActionPicker({ actions, position, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const groups = useMemo(() => groupActions(actions, query), [actions, query]);
  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className={styles.actionPicker} style={position ? { left: position.x, top: position.y, width: position.width, maxHeight: position.maxHeight } : undefined} role="dialog" aria-label="选择电商任务">
      <div className={styles.pickerHeader}>
        <div><strong>从素材派生</strong><span>选择一个电商处理任务</span></div>
        <button type="button" className={styles.iconButton} aria-label="关闭" onClick={onClose}><MdClose size={16} /></button>
      </div>
      <input ref={inputRef} className={styles.pickerSearch} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }} placeholder="搜索电商任务" aria-label="搜索电商任务" />
      <div className={styles.pickerList}>
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className={styles.pickerGroup}>{group}</div>
            {items.map(action => {
              const Icon = action.icon || MdAutoFixHigh;
              return <button type="button" className={styles.pickerItem} key={action.id} onClick={() => onSelect?.(action)}>
                <span className={styles.pickerItemIcon}><Icon size={17} /></span>
                <span className={styles.pickerItemText}><strong>{action.label}</strong><small>{action.description}</small></span>
                <MdChevronRight size={16} />
              </button>;
            })}
          </div>
        ))}
        {!Object.keys(groups).length && <div className={styles.emptyState}>没有匹配的电商任务</div>}
      </div>
    </div>
  );
}
